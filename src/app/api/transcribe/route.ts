/**
 * POST /api/transcribe
 *
 * Sends the original uploaded file to a transcription provider.
 * Supports Whisper (OpenAI) and AssemblyAI with automatic fallback.
 *
 * Body: { language: string, durationSec: number, offsetSec?: number, audioUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiKeys, getApiKeyStatus } from "@/lib/db/api-keys";
import { DATA_DIR as FRAMEAI_DATA_DIR } from "@/lib/db/paths";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface SubSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  confidence?: number;
  edited: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Language mapping
   ═══════════════════════════════════════════════════════════════════════════ */

const LANG_MAP: Record<string, string> = { he: "he", ar: "ar", ru: "ru", en: "en" };
const whisperLang = (l: string) => LANG_MAP[l] || "en";

// AssemblyAI language codes
const ASSEMBLY_LANG_MAP: Record<string, string> = { he: "he", ar: "ar", ru: "ru", en: "en" };
const assemblyLang = (l: string) => ASSEMBLY_LANG_MAP[l] || "en";

/* ═══════════════════════════════════════════════════════════════════════════
   MIME helper
   ═══════════════════════════════════════════════════════════════════════════ */

function mime(p: string): string {
  const e = (p.split(".").pop() || "").toLowerCase();
  return (
    ({
      mov: "video/quicktime", mp4: "video/mp4", webm: "video/webm",
      avi: "video/x-msvideo", mkv: "video/x-matroska", wav: "audio/wav",
      mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", flac: "audio/flac",
    } as Record<string, string>)[e] || "application/octet-stream"
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Whisper — direct send, no preprocessing
   ═══════════════════════════════════════════════════════════════════════════ */

async function whisperTranscribe(
  key: string, filePath: string, lang: string,
): Promise<{ segments: SubSegment[]; error?: string }> {
  const fs = require("fs");
  const path = require("path");

  if (!fs.existsSync(filePath)) return { segments: [], error: `File not found: ${filePath}` };
  const st = fs.statSync(filePath);
  if (!st.size) return { segments: [], error: "Empty file" };

  // Whisper limit is 25 MB
  if (st.size > 25 * 1024 * 1024) {
    return { segments: [], error: `File too large for Whisper: ${(st.size / 1048576).toFixed(1)}MB (max 25MB)` };
  }

  const ext = path.extname(filePath).toLowerCase();
  console.log(`[whisper] Sending original file directly: ${(st.size / 1024).toFixed(0)}KB ${ext}`);

  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: mime(filePath) }), `audio${ext}`);
  fd.append("model", "whisper-1");
  fd.append("language", whisperLang(lang));
  fd.append("response_format", "verbose_json");

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });

  if (!r.ok) {
    const errText = await r.text();
    console.log(`[whisper] Error ${r.status}: ${errText.slice(0, 200)}`);
    return { segments: [], error: `Whisper ${r.status}: ${errText.slice(0, 150)}` };
  }

  const d = await r.json();
  console.log(`[whisper] OK: ${(d.text || "").length} chars, ${(d.segments || []).length} segments, dur=${d.duration}`);
  return { segments: groupWhisperSegments(d.segments || [], d.text, d.duration) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   AssemblyAI transcription
   ═══════════════════════════════════════════════════════════════════════════ */

async function assemblyaiTranscribe(
  key: string, filePath: string, lang: string,
): Promise<{ segments: SubSegment[]; error?: string }> {
  const fs = require("fs");
  const path = require("path");

  if (!fs.existsSync(filePath)) return { segments: [], error: `File not found: ${filePath}` };
  const st = fs.statSync(filePath);
  if (!st.size) return { segments: [], error: "Empty file" };

  console.log(`[assemblyai] Uploading file: ${(st.size / 1024).toFixed(0)}KB`);

  // Step 1: Upload the file to AssemblyAI
  const buf = fs.readFileSync(filePath);
  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      authorization: key,
      "content-type": "application/octet-stream",
    },
    body: buf,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.log(`[assemblyai] Upload error ${uploadRes.status}: ${errText.slice(0, 200)}`);
    return { segments: [], error: `AssemblyAI upload ${uploadRes.status}: ${errText.slice(0, 150)}` };
  }

  const { upload_url } = await uploadRes.json();
  console.log(`[assemblyai] File uploaded, creating transcript...`);

  // Step 2: Create transcription job
  const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      authorization: key,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: upload_url,
      language_code: assemblyLang(lang),
    }),
  });

  if (!transcriptRes.ok) {
    const errText = await transcriptRes.text();
    console.log(`[assemblyai] Transcript create error ${transcriptRes.status}: ${errText.slice(0, 200)}`);
    return { segments: [], error: `AssemblyAI transcript ${transcriptRes.status}: ${errText.slice(0, 150)}` };
  }

  const { id: transcriptId } = await transcriptRes.json();
  console.log(`[assemblyai] Transcript job created: ${transcriptId}`);

  // Step 3: Poll for completion (max 120s)
  const maxWait = 120000;
  const pollInterval = 3000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { authorization: key },
    });

    if (!pollRes.ok) {
      const errText = await pollRes.text();
      return { segments: [], error: `AssemblyAI poll ${pollRes.status}: ${errText.slice(0, 150)}` };
    }

    const pollData = await pollRes.json();

    if (pollData.status === "completed") {
      console.log(`[assemblyai] Completed: ${(pollData.text || "").length} chars, ${(pollData.words || []).length} words`);
      return { segments: groupAssemblySegments(pollData.words || [], pollData.text, pollData.audio_duration) };
    }

    if (pollData.status === "error") {
      console.log(`[assemblyai] Error: ${pollData.error}`);
      return { segments: [], error: `AssemblyAI: ${pollData.error}` };
    }

    console.log(`[assemblyai] Status: ${pollData.status} (${Math.round((Date.now() - start) / 1000)}s)`);
  }

  return { segments: [], error: "AssemblyAI: timeout after 120s" };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHORT-FORM SEGMENTATION RULES (TikTok / Reels)
   ─────────────────────────────────────────────────────────────────────────
   • Max 3 words per LINE
   • Max 2 lines per FRAME → max 6 words per segment
   • Timing distributed proportionally when splitting
   • Hebrew RTL word order preserved (split by spaces, never reverse)
   • Natural break priority: punctuation > pause > word boundary
   ═══════════════════════════════════════════════════════════════════════════ */

const MAX_WORDS_PER_LINE = 3;
const MAX_LINES_PER_FRAME = 2;
const MAX_WORDS_PER_SEGMENT = MAX_WORDS_PER_LINE * MAX_LINES_PER_FRAME; // 6

/** Hebrew / general punctuation that suggests a natural break */
const BREAK_CHARS = /[.,;:!?…–—\-־׳״]/;

/**
 * Given an array of words, find the best split point at or before `maxIdx`.
 * Prefers punctuation boundaries, then just uses `maxIdx`.
 */
function bestBreak(words: string[], startIdx: number, maxIdx: number): number {
  // Look backwards from maxIdx for a word ending with punctuation
  for (let i = maxIdx; i > startIdx; i--) {
    if (BREAK_CHARS.test(words[i - 1].slice(-1))) return i;
  }
  return maxIdx;
}

/**
 * Post-process: enforce the 6-word-per-segment rule.
 * Splits any oversized segment, distributing time proportionally.
 */
function enforceShortFormSegments(segments: SubSegment[]): SubSegment[] {
  const out: SubSegment[] = [];

  for (const seg of segments) {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);

    if (words.length <= MAX_WORDS_PER_SEGMENT) {
      // Already fits — keep as-is
      out.push({ ...seg, id: `seg-${out.length}` });
      continue;
    }

    // Need to split into multiple sub-segments
    const totalDur = seg.endSec - seg.startSec;
    const totalWords = words.length;
    let wordIdx = 0;

    console.log(`[segmentation] Splitting: "${seg.text}" (${totalWords} words → ${Math.ceil(totalWords / MAX_WORDS_PER_SEGMENT)} frames)`);

    while (wordIdx < totalWords) {
      const remaining = totalWords - wordIdx;
      const chunkEnd = Math.min(wordIdx + MAX_WORDS_PER_SEGMENT, totalWords);
      const splitAt = bestBreak(words, wordIdx, chunkEnd);
      const actualEnd = splitAt > wordIdx ? splitAt : chunkEnd;

      const chunkText = words.slice(wordIdx, actualEnd).join(" ");
      const fracStart = wordIdx / totalWords;
      const fracEnd = actualEnd / totalWords;

      out.push({
        id: `seg-${out.length}`,
        startSec: Math.round((seg.startSec + totalDur * fracStart) * 100) / 100,
        endSec: Math.round((seg.startSec + totalDur * fracEnd) * 100) / 100,
        text: chunkText,
        confidence: seg.confidence,
        edited: false,
      });

      wordIdx = actualEnd;
    }
  }

  console.log(`[segmentation] Final: ${out.length} segments (from ${segments.length} raw)`);
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Group AssemblyAI words into short-form subtitle segments
   ═══════════════════════════════════════════════════════════════════════════ */

function groupAssemblySegments(words: any[], text?: string, dur?: number): SubSegment[] {
  if (!words.length && text) {
    // Single fallback — will be split by enforceShortFormSegments
    return enforceShortFormSegments([{
      id: "seg-0", startSec: 0, endSec: Math.ceil(dur || 30),
      text, confidence: 0.9, edited: false,
    }]);
  }

  // Group words into ≤6-word chunks, also respecting ~2s timing
  const out: SubSegment[] = [];
  let pendingWords: string[] = [];
  let groupStart = 0;
  let groupEnd = 0;
  let totalConf = 0;
  let confCount = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const wStart = w.start / 1000; // AssemblyAI uses milliseconds
    const wEnd = w.end / 1000;

    if (pendingWords.length === 0) groupStart = wStart;
    pendingWords.push(w.text);
    groupEnd = wEnd;
    totalConf += w.confidence || 0;
    confCount++;

    // Flush: max 6 words OR natural time gap OR last word
    const isPunct = BREAK_CHARS.test(w.text.slice(-1));
    const shouldFlush =
      pendingWords.length >= MAX_WORDS_PER_SEGMENT ||
      (pendingWords.length >= 3 && isPunct) ||
      i === words.length - 1;

    if (shouldFlush) {
      out.push({
        id: `seg-${out.length}`,
        startSec: Math.round(groupStart * 100) / 100,
        endSec: Math.round(groupEnd * 100) / 100,
        text: pendingWords.join(" "),
        confidence: confCount > 0 ? Math.round((totalConf / confCount) * 100) / 100 : 0.9,
        edited: false,
      });
      pendingWords = [];
      totalConf = 0;
      confCount = 0;
    }
  }

  console.log(`[segmentation] AssemblyAI: ${words.length} words → ${out.length} segments`);
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Group Whisper segments into short-form subtitle segments
   ═══════════════════════════════════════════════════════════════════════════ */

function groupWhisperSegments(segs: any[], text?: string, dur?: number): SubSegment[] {
  // Fallback: if Whisper returned no segments but has text
  if (!segs.length && text) {
    return enforceShortFormSegments([{
      id: "seg-0", startSec: 0, endSec: Math.ceil(dur || 30),
      text, confidence: 0.9, edited: false,
    }]);
  }

  // First pass: group by Whisper's own segmentation
  const raw: SubSegment[] = [];
  let pendingTexts: string[] = [];
  let groupStart = 0;
  let groupEnd = 0;

  for (let i = 0; i < segs.length; i++) {
    if (pendingTexts.length === 0) groupStart = segs[i].start;
    pendingTexts.push(segs[i].text);
    groupEnd = segs[i].end;

    // Flush when accumulated text hits 6 words or last segment
    const wordCount = pendingTexts.join(" ").trim().split(/\s+/).length;
    if (wordCount >= MAX_WORDS_PER_SEGMENT || i === segs.length - 1) {
      raw.push({
        id: `seg-${raw.length}`,
        startSec: Math.round(groupStart * 100) / 100,
        endSec: Math.round(groupEnd * 100) / 100,
        text: pendingTexts.join(" "),
        confidence: 0.95,
        edited: false,
      });
      pendingTexts = [];
    }
  }

  // Second pass: enforce strict 6-word limit on any oversized segments
  const final = enforceShortFormSegments(raw);
  console.log(`[segmentation] Whisper: ${segs.length} raw segs → ${raw.length} grouped → ${final.length} final`);
  return final;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Read transcription priority from ai-settings.json
   ═══════════════════════════════════════════════════════════════════════════ */

function getTranscriptionPriority(): { primary: string; fallback: string } {
  try {
    const fs = require("fs");
    const path = require("path");
    const settingsFile = path.join(FRAMEAI_DATA_DIR, "ai-settings.json");
    if (!fs.existsSync(settingsFile)) return { primary: "whisper", fallback: "assemblyai" };
    const raw = fs.readFileSync(settingsFile, "utf8");
    const arr = JSON.parse(raw);
    const s = Array.isArray(arr) ? arr[0] : arr;
    return {
      primary: s?.primaryTranscriptionProvider || "whisper",
      fallback: s?.fallbackTranscriptionProvider || "none",
    };
  } catch {
    return { primary: "whisper", fallback: "assemblyai" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Route handler
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const { language, durationSec, offsetSec = 0, audioUrl } = (await req.json()) as {
      language: string; durationSec: number; offsetSec?: number; audioUrl?: string;
    };

    // ── Validate ──
    if (!durationSec || durationSec <= 0) {
      return NextResponse.json({ error: "durationSec required", segments: [] }, { status: 400 });
    }
    if (!language) {
      return NextResponse.json({ error: "language required", segments: [] }, { status: 400 });
    }
    if (!audioUrl || !audioUrl.startsWith("/")) {
      return NextResponse.json({ error: "audioUrl required (local path)", segments: [] }, { status: 400 });
    }

    // ── Get API keys (merged from both sources) ──
    const ks = getApiKeyStatus();
    const keys = getApiKeys();
    const priority = getTranscriptionPriority();

    console.log(`[transcribe] Keys: openai=${ks.openai}, assemblyai=${ks.assemblyai}, priority=${priority.primary}/${priority.fallback}`);

    if (!ks.openai && !ks.assemblyai) {
      return NextResponse.json({
        error: "לא הוגדר מפתח API — יש לעבור להגדרות ולהוסיף מפתח OpenAI או AssemblyAI",
        segments: [], language, provider: null,
        debug: { apiKeyStatus: ks, timestamp: new Date().toISOString(), latencyMs: Date.now() - t0 },
      }, { status: 503 });
    }

    // ── Resolve file path ──
    const pathMod = require("path");
    const fsMod = require("fs");
    const localPath = pathMod.join(process.cwd(), "public", audioUrl);

    if (!fsMod.existsSync(localPath)) {
      return NextResponse.json({ error: "File not found", segments: [] }, { status: 404 });
    }

    const fileSizeMB = (fsMod.statSync(localPath).size / 1048576).toFixed(1);
    console.log(`[transcribe] File: ${audioUrl} size=${fileSizeMB}MB lang=${language} dur=${durationSec}s`);

    // ── Build provider order based on settings & available keys ──
    const providers: { name: string; fn: () => Promise<{ segments: SubSegment[]; error?: string }> }[] = [];

    const addProvider = (name: string) => {
      if (name === "whisper" && keys.openai) {
        providers.push({ name: "whisper", fn: () => whisperTranscribe(keys.openai, localPath, language) });
      } else if (name === "assemblyai" && keys.assemblyai) {
        providers.push({ name: "assemblyai", fn: () => assemblyaiTranscribe(keys.assemblyai, localPath, language) });
      }
    };

    addProvider(priority.primary);
    if (priority.fallback !== "none") addProvider(priority.fallback);

    // If no providers from settings, add whatever has a key
    if (providers.length === 0) {
      if (keys.openai) addProvider("whisper");
      if (keys.assemblyai) addProvider("assemblyai");
    }

    if (providers.length === 0) {
      return NextResponse.json({
        error: "לא נמצא מפתח API תקין — יש להגדיר מפתח בהגדרות",
        segments: [], language, provider: null,
      }, { status: 503 });
    }

    // ── Try providers in order ──
    const providersTried: string[] = [];
    let lastError = "";
    let fallbackTriggered = false;
    let fallbackReason = "";

    for (let i = 0; i < providers.length; i++) {
      const p = providers[i];
      providersTried.push(p.name);
      console.log(`[transcribe] Trying provider: ${p.name}${i > 0 ? " (fallback)" : ""}`);

      const result = await p.fn();

      if (result.segments.length > 0) {
        // ── Apply trim offset ──
        let segs = result.segments;
        if (offsetSec > 0) {
          segs = segs.map((s) => ({
            ...s,
            startSec: Math.round((s.startSec + offsetSec) * 100) / 100,
            endSec: Math.round((s.endSec + offsetSec) * 100) / 100,
          }));
        }

        const latencyMs = Date.now() - t0;
        console.log(`[transcribe] DONE: ${p.name} ${segs.length} segments ${latencyMs}ms`);

        return NextResponse.json({
          segments: segs,
          language,
          provider: p.name,
          fallbackTriggered,
          fallbackReason,
          debug: {
            provider: p.name,
            providerTried: providersTried,
            apiKeyStatus: ks,
            requestLanguage: language,
            requestDuration: durationSec,
            responseSegments: segs.length,
            requestStatus: "success",
            timestamp: new Date().toISOString(),
            latencyMs,
          },
        });
      }

      // Provider failed
      lastError = result.error || "No segments returned";
      console.log(`[transcribe] Provider ${p.name} failed: ${lastError}`);
      if (i === 0 && providers.length > 1) {
        fallbackTriggered = true;
        fallbackReason = `${p.name} failed: ${lastError}`;
      }
    }

    // All providers failed
    console.log(`[transcribe] ALL PROVIDERS FAILED: ${lastError}`);
    return NextResponse.json({
      error: lastError || "Transcription failed",
      segments: [], language, provider: null,
      debug: {
        providerTried: providersTried,
        error: lastError,
        apiKeyStatus: ks,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
        fallbackTriggered,
        fallbackReason,
      },
    }, { status: 503 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[transcribe] ERROR: ${msg}`);
    return NextResponse.json({
      error: msg, segments: [], language: "unknown", provider: null,
      debug: { error: msg, requestStatus: "error", timestamp: new Date().toISOString(), latencyMs: Date.now() - t0 },
    }, { status: 400 });
  }
}
