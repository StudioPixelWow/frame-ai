/**
 * FrameAI — Whisper Transcription Service for Podcast Clip Engine
 *
 * Integrates with OpenAI's Whisper API for audio-to-text transcription.
 * Supports chunked transcription for files exceeding the 25MB API limit,
 * merging results with correct time offsets.
 *
 * All user-facing strings are in Hebrew.
 */

import { existsSync, createReadStream, statSync } from "fs";
import path from "path";
import type { AudioChunk } from "./ffmpeg-service";

// ── Types ────────────────────────────────────────────────────────────────────

/** A single transcription segment with timing information. */
export interface TranscriptionSegment {
  /** Zero-based segment index in the full transcription. */
  id: number;
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
  /** Transcribed text for this segment. */
  text: string;
  /** Speaker label placeholder (e.g. "speaker_0"). */
  speaker: string;
}

/** Full transcription result with text and timed segments. */
export interface TranscriptionResult {
  /** Complete transcribed text. */
  text: string;
  /** Timed segments with speaker labels. */
  segments: TranscriptionSegment[];
  /** ISO language code detected or requested. */
  language: string;
  /** Total audio duration in seconds. */
  durationSeconds: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Whisper API endpoint. */
const WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";

/** Whisper model name. */
const WHISPER_MODEL = "whisper-1";

/** Maximum file size for a single Whisper API call (25MB). */
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/** Delay between API calls in milliseconds to respect rate limits. */
const RATE_LIMIT_DELAY_MS = 1_000;

/** Maximum retries per chunk on transient errors. */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff in milliseconds. */
const RETRY_BASE_DELAY_MS = 2_000;

// ── Whisper API response types ──────────────────────────────────────────────

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface WhisperVerboseResponse {
  text: string;
  language: string;
  duration: number;
  segments: WhisperSegment[];
  words?: WhisperWord[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the OpenAI API key from environment. Throws with Hebrew message if missing.
 */
function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("חסר OPENAI_API_KEY — לא ניתן לבצע תמלול");
  }
  return key;
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a single audio file to Whisper API and return the verbose JSON response.
 */
async function callWhisperApi(
  filePath: string,
  language: string | undefined,
  apiKey: string
): Promise<WhisperVerboseResponse> {
  const fileSize = statSync(filePath).size;
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `שגיאה: קובץ האודיו גדול מדי (${Math.round(fileSize / 1024 / 1024)}MB). ` +
      `הגבלת Whisper API היא 25MB — יש לפצל לקטעים`
    );
  }

  // Build multipart form data
  const formData = new FormData();

  // Read file as blob for FormData
  const fileBuffer = await readFileAsBuffer(filePath);
  const fileName = path.basename(filePath);
  const blob = new Blob([fileBuffer], { type: getMimeType(filePath) });
  formData.append("file", blob, fileName);
  formData.append("model", WHISPER_MODEL);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");
  formData.append("timestamp_granularities[]", "word");

  if (language) {
    formData.append("language", language);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(WHISPER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();

        // Rate limit — wait and retry
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("retry-after") ?? "5", 10);
          await sleep(retryAfter * 1000);
          continue;
        }

        throw new Error(
          `שגיאת Whisper API (${response.status}): ${errorBody.slice(0, 300)}`
        );
      }

      const data = (await response.json()) as WhisperVerboseResponse;
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on non-transient errors
      if (lastError.message.includes("שגיאת Whisper API") && !lastError.message.includes("429")) {
        throw lastError;
      }

      // Exponential backoff
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError ?? new Error("שגיאה לא צפויה בקריאה ל-Whisper API");
}

/**
 * Read a file into a Buffer.
 */
async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  const { readFile } = await import("fs/promises");
  return readFile(filePath);
}

/**
 * Get MIME type based on file extension.
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".mp4": "audio/mp4",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
  };
  return mimeMap[ext] ?? "audio/mpeg";
}

/**
 * Merge Whisper segments from a chunk, applying time offset.
 */
function mergeSegmentsWithOffset(
  segments: WhisperSegment[],
  timeOffset: number,
  startingId: number
): TranscriptionSegment[] {
  return segments.map((seg, idx) => ({
    id: startingId + idx,
    start: seg.start + timeOffset,
    end: seg.end + timeOffset,
    text: seg.text.trim(),
    speaker: "speaker_0", // placeholder — diarization not yet integrated
  }));
}

// ── Main exports ────────────────────────────────────────────────────────────

/**
 * Transcribe a single audio file using OpenAI Whisper API.
 *
 * For files under 25MB. For larger files, use `transcribeChunkedAudio`.
 *
 * @param audioFilePath  Absolute path to the audio file.
 * @param language       Optional ISO 639-1 language code (e.g. "he", "en").
 * @returns              Full transcription result with timed segments.
 */
export async function transcribeAudio(
  audioFilePath: string,
  language?: string
): Promise<TranscriptionResult> {
  if (!existsSync(audioFilePath)) {
    throw new Error(`שגיאה: קובץ האודיו לא נמצא — ${audioFilePath}`);
  }

  const apiKey = getApiKey();
  const response = await callWhisperApi(audioFilePath, language, apiKey);

  const segments = mergeSegmentsWithOffset(response.segments ?? [], 0, 0);

  return {
    text: response.text.trim(),
    segments,
    language: response.language ?? language ?? "unknown",
    durationSeconds: response.duration ?? 0,
  };
}

/**
 * Transcribe a series of audio chunks and merge results into a single transcript.
 *
 * Each chunk is sent to Whisper API independently. Results are merged with
 * corrected time offsets based on each chunk's `startTime` in the original file.
 * Includes rate limiting between API calls.
 *
 * @param chunks    Array of AudioChunk from ffmpeg-service or audio-chunker.
 * @param language  Optional ISO 639-1 language code (e.g. "he", "en").
 * @returns         Merged transcription result covering the full audio.
 */
export async function transcribeChunkedAudio(
  chunks: AudioChunk[],
  language?: string
): Promise<TranscriptionResult> {
  if (chunks.length === 0) {
    throw new Error("שגיאה: רשימת הקטעים ריקה — אין מה לתמלל");
  }

  const apiKey = getApiKey();
  const allSegments: TranscriptionSegment[] = [];
  const textParts: string[] = [];
  let totalDuration = 0;
  let detectedLanguage = language ?? "unknown";

  // Sort chunks by index to ensure correct order
  const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);

  for (let i = 0; i < sortedChunks.length; i++) {
    const chunk = sortedChunks[i];

    if (!existsSync(chunk.path)) {
      throw new Error(`שגיאה: קובץ קטע ${chunk.index} לא נמצא — ${chunk.path}`);
    }

    // Rate limiting — wait between chunks (skip before first)
    if (i > 0) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    const response = await callWhisperApi(chunk.path, language, apiKey);

    // Use detected language from first chunk
    if (i === 0 && response.language) {
      detectedLanguage = response.language;
    }

    // Merge segments with time offset from the chunk's position in the original file
    const chunkSegments = mergeSegmentsWithOffset(
      response.segments ?? [],
      chunk.startTime,
      allSegments.length
    );

    allSegments.push(...chunkSegments);
    textParts.push(response.text.trim());

    // Track total duration from the last chunk's end time
    totalDuration = Math.max(totalDuration, chunk.endTime);
  }

  return {
    text: textParts.join(" "),
    segments: allSegments,
    language: detectedLanguage,
    durationSeconds: totalDuration,
  };
}
