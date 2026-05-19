/**
 * FrameAI — Thumbnail Generator for AI Clip Engine
 *
 * Generates thumbnail configurations and ffmpeg commands for
 * extracting expressive frames and applying text overlays.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ThumbnailConfig {
  textOverlay: string;
  position: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  template: "youtube" | "instagram" | "tiktok";
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Default brand colors when none are provided. */
const DEFAULT_BRAND_COLORS = {
  primary: "#FFFFFF",
  secondary: "#000000",
};

/** Template-specific defaults for thumbnail overlays. */
const TEMPLATE_DEFAULTS: Record<
  ThumbnailConfig["template"],
  { position: string; fontSize: number }
> = {
  youtube: { position: "bottom-center", fontSize: 72 },
  instagram: { position: "center", fontSize: 64 },
  tiktok: { position: "center", fontSize: 56 },
};

/** Candidate frame positions as fractions of total duration. */
const FRAME_SAMPLE_POINTS = [1 / 3, 1 / 2, 2 / 3] as const;

// ── Main exports ───────────────────────────────────────────────────────────

/**
 * Determine the best frame to extract from a video for thumbnail use.
 *
 * Samples at 1/3, 1/2, and 2/3 of the clip duration. Returns the
 * middle sample (1/2) as the primary candidate and provides an
 * ffmpeg command for extraction.
 *
 * @param videoPath        Absolute path to the source video file.
 * @param durationSeconds  Total duration of the video in seconds.
 * @returns                Timestamp (seconds) and ffmpeg extraction command.
 */
export function extractBestFrame(
  videoPath: string,
  durationSeconds: number
): { timestamp: number; command: string } {
  if (durationSeconds <= 0) {
    throw new Error("Video duration must be greater than 0");
  }

  // Pick the midpoint sample as the primary candidate — typically
  // the most expressive moment in a short clip.
  const timestamp = Math.round(durationSeconds * FRAME_SAMPLE_POINTS[1]);

  const command = [
    "ffmpeg",
    "-ss",
    String(timestamp),
    "-i",
    `"${videoPath}"`,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    `"${stripExtension(videoPath)}_thumb_${timestamp}s.jpg"`,
  ].join(" ");

  return { timestamp, command };
}

/**
 * Generate a thumbnail overlay configuration for a given title.
 *
 * Produces a ThumbnailConfig with text, positioning, and color
 * settings suitable for the "youtube" template by default.
 *
 * @param title        Title text to overlay on the thumbnail.
 * @param brandColors  Optional brand primary/secondary colors.
 * @returns            Complete ThumbnailConfig object.
 */
export function generateThumbnailOverlay(
  title: string,
  brandColors?: { primary: string; secondary: string }
): ThumbnailConfig {
  const colors = brandColors ?? DEFAULT_BRAND_COLORS;
  const template: ThumbnailConfig["template"] = "youtube";
  const defaults = TEMPLATE_DEFAULTS[template];

  // Truncate long titles for visual clarity on thumbnails
  const maxLength = 60;
  const textOverlay =
    title.length > maxLength ? `${title.slice(0, maxLength - 3)}...` : title;

  return {
    textOverlay,
    position: defaults.position,
    fontSize: defaults.fontSize,
    color: colors.primary,
    backgroundColor: colors.secondary,
    template,
  };
}

/**
 * Build ffmpeg commands for extracting frames at multiple timestamps.
 *
 * Uses the three sample points (1/3, 1/2, 2/3 of each timestamp)
 * and outputs one JPEG per timestamp into the specified directory.
 *
 * @param videoPath   Absolute path to the source video file.
 * @param timestamps  Array of timestamps (seconds) to extract.
 * @param outputDir   Directory to write extracted frame images.
 * @returns           Array of ffmpeg command strings.
 */
export function buildThumbnailCommands(
  videoPath: string,
  timestamps: number[],
  outputDir: string
): string[] {
  const normalizedDir = outputDir.endsWith("/") ? outputDir : `${outputDir}/`;

  return timestamps.map((ts, index) => {
    const outputPath = `${normalizedDir}thumb_${index + 1}_${ts}s.jpg`;

    return [
      "ffmpeg",
      "-ss",
      String(ts),
      "-i",
      `"${videoPath}"`,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      `"${outputPath}"`,
    ].join(" ");
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function stripExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot <= 0) return filePath;
  return filePath.slice(0, lastDot);
}
