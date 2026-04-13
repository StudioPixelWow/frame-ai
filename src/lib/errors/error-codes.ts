/**
 * PixelFrameAI — Error Code Registry
 *
 * Stable, machine-readable error codes for every failure mode.
 * Used for support triage, UI branching, and retry classification.
 *
 * Error categories:
 *   transient       — auto-retry appropriate (network, rate limits)
 *   input_invalid   — bad user input, never retryable
 *   input_missing   — storage key not found, never retryable
 *   payload_invalid — schema/validation failure, never retryable
 *   quota_exceeded  — rate/quota limit, retry after delay
 *   logic_error     — code bug, never retryable, requires fix
 */

// ── Error categories ──────────────────────────────────────────────────────

export type ErrorCategory =
  | "transient"
  | "input_invalid"
  | "input_missing"
  | "payload_invalid"
  | "quota_exceeded"
  | "logic_error";

// ── Error codes ───────────────────────────────────────────────────────────

/** Upload phase errors */
export const UPLOAD_NETWORK_FAILURE = "UPLOAD_NETWORK_FAILURE" as const;
export const UPLOAD_SIZE_EXCEEDED = "UPLOAD_SIZE_EXCEEDED" as const;
export const UPLOAD_TYPE_REJECTED = "UPLOAD_TYPE_REJECTED" as const;
export const UPLOAD_STORAGE_ERROR = "UPLOAD_STORAGE_ERROR" as const;

/** Analysis — video inspection errors */
export const VIDEO_PROBE_FAILED = "VIDEO_PROBE_FAILED" as const;
export const VIDEO_CORRUPT = "VIDEO_CORRUPT" as const;
export const VIDEO_UNSUPPORTED_CODEC = "VIDEO_UNSUPPORTED_CODEC" as const;
export const VIDEO_NO_AUDIO = "VIDEO_NO_AUDIO" as const;
export const VIDEO_TOO_SHORT = "VIDEO_TOO_SHORT" as const;

/** Analysis — transcription errors */
export const TRANSCRIPT_ASR_FAILURE = "TRANSCRIPT_ASR_FAILURE" as const;
export const TRANSCRIPT_ASR_QUOTA = "TRANSCRIPT_ASR_QUOTA" as const;
export const TRANSCRIPT_EMPTY = "TRANSCRIPT_EMPTY" as const;
export const TRANSCRIPT_LANGUAGE_UNSUPPORTED = "TRANSCRIPT_LANGUAGE_UNSUPPORTED" as const;

/** Analysis — segment generation errors */
export const SEGMENTS_EMPTY = "SEGMENTS_EMPTY" as const;
export const SEGMENTS_GENERATION_FAILED = "SEGMENTS_GENERATION_FAILED" as const;

/** Render errors */
export const RENDER_SOURCE_MISSING = "RENDER_SOURCE_MISSING" as const;
export const RENDER_PROPS_INVALID = "RENDER_PROPS_INVALID" as const;
export const RENDER_COMPOSITION_FAILED = "RENDER_COMPOSITION_FAILED" as const;
export const RENDER_COMPOSITION_CRASH = "RENDER_COMPOSITION_CRASH" as const;
export const RENDER_STORAGE_FAILURE = "RENDER_STORAGE_FAILURE" as const;
export const RENDER_POSTPROCESS_FAILED = "RENDER_POSTPROCESS_FAILED" as const;

/** Asset reference errors */
export const ASSET_KEY_MISSING = "ASSET_KEY_MISSING" as const;
export const ASSET_KEY_CORRUPT = "ASSET_KEY_CORRUPT" as const;

/** Catch-all */
export const UNKNOWN_ERROR = "UNKNOWN_ERROR" as const;

// ── All error codes type ──────────────────────────────────────────────────

export type PixelFrameErrorCode =
  | typeof UPLOAD_NETWORK_FAILURE
  | typeof UPLOAD_SIZE_EXCEEDED
  | typeof UPLOAD_TYPE_REJECTED
  | typeof UPLOAD_STORAGE_ERROR
  | typeof VIDEO_PROBE_FAILED
  | typeof VIDEO_CORRUPT
  | typeof VIDEO_UNSUPPORTED_CODEC
  | typeof VIDEO_NO_AUDIO
  | typeof VIDEO_TOO_SHORT
  | typeof TRANSCRIPT_ASR_FAILURE
  | typeof TRANSCRIPT_ASR_QUOTA
  | typeof TRANSCRIPT_EMPTY
  | typeof TRANSCRIPT_LANGUAGE_UNSUPPORTED
  | typeof SEGMENTS_EMPTY
  | typeof SEGMENTS_GENERATION_FAILED
  | typeof RENDER_SOURCE_MISSING
  | typeof RENDER_PROPS_INVALID
  | typeof RENDER_COMPOSITION_FAILED
  | typeof RENDER_COMPOSITION_CRASH
  | typeof RENDER_STORAGE_FAILURE
  | typeof RENDER_POSTPROCESS_FAILED
  | typeof ASSET_KEY_MISSING
  | typeof ASSET_KEY_CORRUPT
  | typeof UNKNOWN_ERROR;

// ── Code → category mapping ───────────────────────────────────────────────

const CODE_CATEGORIES: Record<PixelFrameErrorCode, ErrorCategory> = {
  UPLOAD_NETWORK_FAILURE: "transient",
  UPLOAD_SIZE_EXCEEDED: "input_invalid",
  UPLOAD_TYPE_REJECTED: "input_invalid",
  UPLOAD_STORAGE_ERROR: "transient",
  VIDEO_PROBE_FAILED: "input_invalid",
  VIDEO_CORRUPT: "input_invalid",
  VIDEO_UNSUPPORTED_CODEC: "input_invalid",
  VIDEO_NO_AUDIO: "input_invalid",
  VIDEO_TOO_SHORT: "input_invalid",
  TRANSCRIPT_ASR_FAILURE: "transient",
  TRANSCRIPT_ASR_QUOTA: "quota_exceeded",
  TRANSCRIPT_EMPTY: "input_invalid",
  TRANSCRIPT_LANGUAGE_UNSUPPORTED: "input_invalid",
  SEGMENTS_EMPTY: "input_invalid",
  SEGMENTS_GENERATION_FAILED: "logic_error",
  RENDER_SOURCE_MISSING: "input_missing",
  RENDER_PROPS_INVALID: "payload_invalid",
  RENDER_COMPOSITION_FAILED: "transient",
  RENDER_COMPOSITION_CRASH: "logic_error",
  RENDER_STORAGE_FAILURE: "transient",
  RENDER_POSTPROCESS_FAILED: "transient",
  ASSET_KEY_MISSING: "input_missing",
  ASSET_KEY_CORRUPT: "input_invalid",
  UNKNOWN_ERROR: "logic_error",
};

/**
 * Get the error category for a given error code.
 */
export function categorise(code: string): ErrorCategory {
  return CODE_CATEGORIES[code as PixelFrameErrorCode] ?? "logic_error";
}

// ── Non-retryable codes set ───────────────────────────────────────────────

/**
 * Error codes that should NEVER be auto-retried.
 * Used by the enhanced `isRetryable()` in pixelframe-error.ts.
 */
export const NON_RETRYABLE_CODES = new Set<string>([
  UPLOAD_SIZE_EXCEEDED,
  UPLOAD_TYPE_REJECTED,
  VIDEO_PROBE_FAILED,
  VIDEO_CORRUPT,
  VIDEO_UNSUPPORTED_CODEC,
  VIDEO_NO_AUDIO,
  VIDEO_TOO_SHORT,
  TRANSCRIPT_EMPTY,
  TRANSCRIPT_LANGUAGE_UNSUPPORTED,
  SEGMENTS_EMPTY,
  SEGMENTS_GENERATION_FAILED,
  RENDER_SOURCE_MISSING,
  RENDER_PROPS_INVALID,
  RENDER_COMPOSITION_CRASH,
  ASSET_KEY_MISSING,
  ASSET_KEY_CORRUPT,
]);
