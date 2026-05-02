/**
 * PixelManageAI — Composition Layout Calculator
 *
 * Maps output format IDs to canvas pixel dimensions and computes
 * `durationInFrames` from clip duration. The result is stored in
 * `render_jobs.composition_config` and passed to `renderMedia()`.
 *
 * Duration priority rule:
 *   clip.durSec (actual selected clip length) takes precedence over
 *   targetDurationSec (user's abstract target). A user who picked
 *   "30s target" but trimmed to a 22-second clip gets a 22-second
 *   composition (durationInFrames = 660), not a 30-second one.
 */

// ── Canonical pixel dimensions per output format ──────────────────────────

export const COMPOSITION_SIZES: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 }, // Instagram Stories · TikTok · Reels
  "1:1":  { width: 1080, height: 1080 }, // Instagram Feed · Facebook
  "4:5":  { width: 1080, height: 1350 }, // Instagram Portrait Feed · LinkedIn
  "16:9": { width: 1920, height: 1080 }, // YouTube · Desktop
};

export const COMPOSITION_FPS = 30;

// ── Composition ID ────────────────────────────────────────────────────────

/**
 * The stable Remotion composition ID — always "PixelManage".
 * This matches the `<Composition id="PixelManage" ...>` in Root.tsx.
 *
 * Do NOT use the project metadata ID (e.g. 'p1234567890') as the
 * composition ID — that is for logging only.
 */
export const REMOTION_COMPOSITION_ID = "PixelManage";

// ── Layout result ─────────────────────────────────────────────────────────

export interface CompositionLayout {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

// ── Calculator ────────────────────────────────────────────────────────────

/**
 * Calculate composition canvas dimensions and frame count.
 *
 * @param formatId          Output format ('9:16', '1:1', '4:5', '16:9')
 * @param clipDurSec        Actual clip duration in seconds (takes priority)
 * @param targetDurationSec Fallback target duration if clip is not trimmed
 */
export function calculateCompositionLayout(
  formatId: string,
  clipDurSec: number,
  targetDurationSec?: number,
): CompositionLayout {
  const size = COMPOSITION_SIZES[formatId] ?? COMPOSITION_SIZES["9:16"];
  const durSec = clipDurSec > 0 ? clipDurSec : (targetDurationSec || 30);

  return {
    width: size.width,
    height: size.height,
    fps: COMPOSITION_FPS,
    durationInFrames: Math.round(durSec * COMPOSITION_FPS),
  };
}

// ── Coordinate system helpers ─────────────────────────────────────────────

/**
 * Convert a composition frame number to clip time (seconds).
 * Frame 0 = 0 s into the clip.
 */
export function frameToClipTimeSec(frame: number, fps: number = COMPOSITION_FPS): number {
  return frame / fps;
}

/**
 * Convert clip time (seconds) to source time (seconds).
 * Adds the clip's start offset in the source file.
 */
export function clipTimeToSourceTimeSec(clipTimeSec: number, clipStartSec: number): number {
  return clipStartSec + clipTimeSec;
}

/**
 * Convert a clip start time to a Remotion `startFrom` frame number.
 * This is the frame in the source file where the composition begins playing.
 */
export function clipStartToFrame(clipStartSec: number, fps: number = COMPOSITION_FPS): number {
  return Math.round(clipStartSec * fps);
}
