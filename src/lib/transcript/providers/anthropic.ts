/**
 * FrameAI — Anthropic Claude transcript analyzer.
 *
 * Uses the Anthropic Messages API to produce a structured TranscriptAnalysis.
 * Requires ANTHROPIC_API_KEY in the environment.
 * Falls back cleanly on any error (caller handles the catch).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptSegment, TranscriptAnalysis } from "../types";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001"; // fast + cheap; override via AnalyzeOptions

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(segments: TranscriptSegment[]): string {
  const formatted = segments
    .map(
      (s) =>
        `[${s.speaker} | ${(s.startMs / 1000).toFixed(1)}s–${(s.endMs / 1000).toFixed(1)}s]\n${s.text}`
    )
    .join("\n\n");

  return `You are a professional video editor's assistant analyzing a video transcript.

Return a single valid JSON object — no markdown, no commentary, only the JSON.

Transcript:
---
${formatted}
---

Required JSON shape (all fields mandatory):
{
  "summary": "2–3 sentence plain-English summary of the video content",
  "keyTopics": ["topic1", "topic2", ...],        // 3–6 short noun phrases
  "keywords": ["word1", "word2", ...],           // 8–12 significant words by relevance
  "tone": {
    "primary": "<professional|casual|energetic|educational|persuasive|inspirational|neutral>",
    "confidence": 0.0–1.0,
    "descriptors": ["descriptor1", "descriptor2", "descriptor3"]  // exactly 3
  },
  "importantMoments": [
    {
      "startMs": <number>,
      "endMs": <number>,
      "text": "<verbatim or paraphrased segment text>",
      "reason": "<why this moment matters editorially>",
      "type": "<hook|cta|key-claim|proof-point|transition|emotional-peak>",
      "score": 0.0–1.0
    }
  ]  // 3–8 moments, ordered by score descending
}

Rules:
- keyTopics must be 3–6 items
- keywords must be 8–12 items, all lowercase, no punctuation
- importantMoments must have 3–8 items
- startMs / endMs must match exact values from the transcript segments above
- score 1.0 = highest editorial importance
- All text fields in English`;
}

// ── Response validation ───────────────────────────────────────────────────────

function validate(raw: unknown): TranscriptAnalysis {
  // Cast to partial to validate shape before trusting
  const r = raw as Partial<TranscriptAnalysis> & {
    tone?: Partial<TranscriptAnalysis["tone"]>;
  };

  if (typeof r.summary !== "string") throw new Error("Missing summary");
  if (!Array.isArray(r.keyTopics))   throw new Error("Missing keyTopics");
  if (!Array.isArray(r.keywords))    throw new Error("Missing keywords");
  if (!r.tone || typeof r.tone.primary !== "string") throw new Error("Missing tone");
  if (!Array.isArray(r.importantMoments)) throw new Error("Missing importantMoments");

  const validTones = new Set([
    "professional","casual","energetic","educational",
    "persuasive","inspirational","neutral",
  ]);
  if (!validTones.has(r.tone.primary)) {
    r.tone.primary = "neutral";
  }

  const validTypes = new Set([
    "hook","cta","key-claim","proof-point","transition","emotional-peak",
  ]);
  const moments = r.importantMoments.map((m: unknown) => {
    const moment = m as Record<string, unknown>;
    return {
      startMs: Number(moment.startMs ?? 0),
      endMs:   Number(moment.endMs   ?? 0),
      text:    String(moment.text    ?? ""),
      reason:  String(moment.reason  ?? ""),
      type:    validTypes.has(String(moment.type)) ? String(moment.type) : "key-claim",
      score:   Math.min(1, Math.max(0, Number(moment.score ?? 0.5))),
    } as TranscriptAnalysis["importantMoments"][number];
  });

  return {
    summary:          r.summary,
    keyTopics:        r.keyTopics.slice(0, 6).map(String),
    keywords:         r.keywords.slice(0, 12).map(String),
    tone: {
      primary:     r.tone.primary as TranscriptAnalysis["tone"]["primary"],
      confidence:  Math.min(1, Math.max(0, Number(r.tone.confidence ?? 0.7))),
      descriptors: (r.tone.descriptors ?? []).slice(0, 4).map(String),
    },
    importantMoments: moments.sort((a, b) => b.score - a.score),
    // metadata is stamped by the orchestrator, not the provider
    metadata: undefined as unknown as TranscriptAnalysis["metadata"],
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyzeWithAnthropic(
  segments: TranscriptSegment[],
  model: string = DEFAULT_MODEL
): Promise<TranscriptAnalysis> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const message = await client.messages.create({
    model,
    max_tokens: 1500,
    messages: [
      {
        role:    "user",
        content: buildPrompt(segments),
      },
    ],
  });

  // Extract text content from the first content block
  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected content block type: ${block.type}`);
  }

  // Strip any accidental markdown fences
  const jsonText = block.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/,        "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Claude returned non-JSON content: ${jsonText.slice(0, 200)}`);
  }

  return validate(parsed);
}
