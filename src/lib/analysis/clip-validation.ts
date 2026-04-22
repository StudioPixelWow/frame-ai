/**
 * PixelManageAI — Clip Timing Validation
 *
 * Validates clip range and re-indexes segments to clip-relative time.
 * Runs synchronously in the API handler (not a worker job).
 */

import type { RawSegment } from "@/types/analysis";

// ── Validation ─────────────────────────────────────────────────────────────

export type ClipValidationResult =
  | { ok: true; clipDuration: number }
  | { ok: false; error: string };

/**
 * Validate a clip range against the source video duration.
 *
 * @param clipStart      Start time in seconds
 * @param clipEnd        End time in seconds
 * @param sourceDuration Authoritative source duration from ffprobe
 */
export function validateClipRange(
  clipStart: number,
  clipEnd: number,
  sourceDuration: number,
): ClipValidationResult {
  if (clipStart < 0) {
    return { ok: false, error: "clipStart cannot be negative" };
  }
  if (clipEnd <= clipStart) {
    return { ok: false, error: "clipEnd must be after clipStart" };
  }
  // 100ms tolerance for floating-point drift
  if (clipEnd > sourceDuration + 0.1) {
    return {
      ok: false,
      error: `clipEnd (${clipEnd}s) exceeds source duration (${sourceDuration}s)`,
    };
  }
  if (clipEnd - clipStart < 1) {
    return { ok: false, error: "Clip must be at least 1 second" };
  }

  return { ok: true, clipDuration: clipEnd - clipStart };
}

// ── Segment re-indexing ────────────────────────────────────────────────────

/**
 * Re-index existing segments to clip-relative timestamps.
 *
 * When the user sets a custom clip range after transcription already ran
 * on the full video, segments need to be filtered and offset to the clip range.
 *
 * @param segments  Original segments (absolute timestamps)
 * @param clipStart Clip start in seconds
 * @param clipEnd   Clip end in seconds
 */
export function reindexSegmentsToClip(
  segments: RawSegment[],
  clipStart: number,
  clipEnd: number,
): RawSegment[] {
  const startMs = clipStart * 1000;
  const endMs = clipEnd * 1000;

  return segments
    .filter((seg) => seg.endMs > startMs && seg.startMs < endMs)
    .map((seg) => {
      const newStartMs = Math.max(0, seg.startMs - startMs);
      const newEndMs = Math.min(endMs - startMs, seg.endMs - startMs);
      return {
        ...seg,
        startMs: newStartMs,
        endMs: newEndMs,
        durationMs: newEndMs - newStartMs,
        withinClip: true,
      };
    });
}
