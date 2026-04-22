/**
 * PixelManageAI — Render Input Props Validator
 *
 * Validates the key fields in `inputProps` before calling renderMedia().
 * A silent bad value (e.g. `clip.durSec = 0`) produces a 0-frame
 * composition and Remotion throws a cryptic error instead of a clear
 * message.
 *
 * On validation failure, throws an UnrecoverableError (from BullMQ)
 * which skips all retry attempts — a bad payload will not be retried
 * since the result would be the same.
 */

import type { PixelManageRemotionProps } from "@/types/remotion-handoff";
import type { CompositionLayout } from "./composition-layout";

/**
 * Error class for non-retryable render validation failures.
 *
 * In the BullMQ worker, this should be replaced with BullMQ's
 * UnrecoverableError. This standalone version allows the validator
 * to work outside the BullMQ context (e.g. in tests or API routes).
 */
export class RenderValidationError extends Error {
  public readonly isUnrecoverable = true;

  constructor(message: string) {
    super(message);
    this.name = "RenderValidationError";
  }
}

/**
 * Validate input props and composition config before renderMedia().
 *
 * @param props   The full _remotion props (after videoUrl substitution)
 * @param config  The composition layout (width, height, fps, durationInFrames)
 * @param renderId  Optional render ID for error context
 *
 * @throws RenderValidationError with all issues listed if validation fails
 */
export function validateInputProps(
  props: PixelManageRemotionProps,
  config: CompositionLayout,
  renderId?: string,
): void {
  const errors: string[] = [];

  // ── Video URL ─────────────────────────────────────────────────────────
  if (!props.videoUrl) {
    errors.push("videoUrl is missing — source video URL was not substituted");
  } else if (props.videoUrl.startsWith("blob:")) {
    errors.push(
      "videoUrl is a blob URL — worker must substitute with a signed storage URL",
    );
  }

  // ── Composition dimensions ────────────────────────────────────────────
  if (config.durationInFrames <= 0) {
    errors.push(
      `durationInFrames=${config.durationInFrames} — clip duration must be > 0`,
    );
  }

  if (config.width <= 0 || config.height <= 0) {
    errors.push(`Invalid canvas: ${config.width}×${config.height}`);
  }

  if (!config.fps || config.fps <= 0) {
    errors.push(`Invalid fps: ${config.fps}`);
  }

  // ── Clip range ────────────────────────────────────────────────────────
  if (props.clip) {
    if (props.clip.durSec <= 0) {
      errors.push(`clip.durSec=${props.clip.durSec} — must be > 0`);
    }
    if (props.clip.endSec <= props.clip.startSec) {
      errors.push(
        `clip.endSec (${props.clip.endSec}) <= clip.startSec (${props.clip.startSec})`,
      );
    }
  } else {
    errors.push("clip specification is missing");
  }

  // ── Subtitles ─────────────────────────────────────────────────────────
  if (props.subtitleMode !== "none") {
    if (!props.segments || props.segments.length === 0) {
      errors.push(
        "subtitleMode is not 'none' but segments array is empty",
      );
    }
    if (!props.subtitle?.fontSizePx) {
      errors.push(
        "subtitle.fontSizePx is missing — SubtitleRenderSpec not fully resolved",
      );
    }
  }

  // ── Format ────────────────────────────────────────────────────────────
  const validFormats = ["9:16", "1:1", "4:5", "16:9"];
  if (props.format && !validFormats.includes(props.format)) {
    errors.push(`Unknown format: '${props.format}'`);
  }

  // ── Throw if any errors ───────────────────────────────────────────────
  if (errors.length > 0) {
    const context = renderId ? ` for render ${renderId}` : "";
    throw new RenderValidationError(
      `Invalid inputProps${context}:\n` + errors.join("\n"),
    );
  }
}
