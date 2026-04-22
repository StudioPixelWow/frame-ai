/**
 * PixelManageAI — Segment Generation
 *
 * Groups the raw word array from transcription into readable subtitle
 * blocks (RawSegment[]). Runs synchronously inside the transcription worker,
 * immediately after the ASR result arrives.
 *
 * Breaking rules:
 * - Sentence boundaries (. ? !)
 * - Silence gaps > threshold
 * - Max words per segment
 * - Max duration per segment
 */

import type { TranscriptWord, RawSegment } from "@/types/analysis";

// ── Options ────────────────────────────────────────────────────────────────

export interface SegmentGenerationOptions {
  /** Maximum words per subtitle segment (default: 8). */
  maxWordsPerSegment?: number;
  /** Maximum duration per segment in ms (default: 5000). */
  maxDurationMs?: number;
  /** Silence gap threshold to break a segment in ms (default: 300). */
  silenceThresholdMs?: number;
  /** Clip start offset in ms (subtract from all timestamps, default: 0). */
  clipStartMs?: number;
}

const DEFAULTS: Required<SegmentGenerationOptions> = {
  maxWordsPerSegment: 8,
  maxDurationMs: 5000,
  silenceThresholdMs: 300,
  clipStartMs: 0,
};

// ── Segment builder ────────────────────────────────────────────────────────

function bufferToSegment(
  words: TranscriptWord[],
  clipOffsetMs: number,
): RawSegment {
  const startMs = Math.round(words[0].start * 1000) - clipOffsetMs;
  const endMs = Math.round(words[words.length - 1].end * 1000) - clipOffsetMs;
  const text = words
    .map((w) => w.word)
    .join(" ")
    .trim();
  const avgConf =
    words.reduce((sum, w) => sum + (w.confidence ?? 1), 0) / words.length;

  return {
    id: `seg-${Math.max(0, startMs)}-${Math.max(0, endMs)}`,
    text,
    startMs: Math.max(0, startMs),
    endMs: Math.max(0, endMs),
    durationMs: Math.max(0, endMs - startMs),
    confidence: parseFloat(avgConf.toFixed(3)),
    withinClip: true,
  };
}

// ── Main function ──────────────────────────────────────────────────────────

/**
 * Generate subtitle segments from a word-level transcription.
 *
 * @param words  Word array from ASR output (with start/end in seconds)
 * @param opts   Generation options
 * @returns      Array of RawSegment ready for PV.segments
 */
export function generateSegments(
  words: TranscriptWord[],
  opts: SegmentGenerationOptions = {},
): RawSegment[] {
  const {
    maxWordsPerSegment,
    maxDurationMs,
    silenceThresholdMs,
    clipStartMs,
  } = { ...DEFAULTS, ...opts };

  if (words.length === 0) return [];

  const segments: RawSegment[] = [];
  let buffer: TranscriptWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prev = buffer.length > 0 ? buffer[buffer.length - 1] : null;

    // Detect sentence boundaries
    const isSentenceEnd = /[.?!]$/.test(prev?.word ?? "");

    // Detect silence gaps between words
    const silenceGap = prev ? word.start * 1000 - prev.end * 1000 : 0;

    // Check max duration
    const bufferDuration =
      buffer.length > 0
        ? word.end * 1000 - buffer[0].start * 1000
        : 0;

    const shouldBreak =
      buffer.length >= maxWordsPerSegment ||
      (buffer.length > 0 && isSentenceEnd) ||
      (buffer.length > 2 && silenceGap >= silenceThresholdMs) ||
      (buffer.length > 0 && bufferDuration >= maxDurationMs);

    if (shouldBreak && buffer.length > 0) {
      segments.push(bufferToSegment(buffer, clipStartMs));
      buffer = [];
    }

    buffer.push(word);
  }

  // Flush remaining buffer
  if (buffer.length > 0) {
    segments.push(bufferToSegment(buffer, clipStartMs));
  }

  return segments;
}
