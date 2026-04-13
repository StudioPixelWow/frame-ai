/**
 * PixelFrameAI — Structured Error Detail
 *
 * Replaces the plain `error text` column on job tables with a
 * structured JSONB `error_detail` object. Enables the API to return
 * typed error data to the UI without parsing free-form strings.
 *
 * Every field in `JobErrorDetail` is intentionally designed:
 *   - `code` + `category`: machine-readable for triage and UI routing
 *   - `userMessage`: safe to render directly in the client
 *   - `technicalNote`: for server logs and support only
 *   - `retryable`: drives auto-retry and UI button state
 *   - `context`: optional structured data for debugging
 */

import type { ErrorCategory } from "./error-codes";
import { categorise } from "./error-codes";
import { PixelFrameError, isRetryableError } from "./pixelframe-error";

// ── Error detail schema ───────────────────────────────────────────────────

/**
 * Structured error detail stored as JSONB in `analysis_jobs.error_detail`
 * and `render_jobs.error_detail`.
 */
export interface JobErrorDetail {
  /** Machine-readable error code from the registry. */
  code: string;
  /** Error category for triage routing. */
  category: ErrorCategory;
  /** User-visible message — shown directly in the UI. */
  userMessage: string;
  /** Technical detail for logs and support. May contain stack traces. */
  technicalNote: string;
  /** Whether auto-retry is appropriate for this error. */
  retryable: boolean;
  /** Which attempt this error occurred on (1-indexed). */
  attemptNumber: number;
  /** ISO 8601 timestamp of when the error occurred. */
  occurredAt: string;
  /** Optional structured context for debugging. */
  context?: ErrorContext;
}

export interface ErrorContext {
  fileSizeBytes?: number;
  mimeType?: string;
  ffprobeOutput?: string;
  httpStatusCode?: number;
  asrProvider?: string;
  storageKey?: string;
  clipRangeSec?: { start: number; end: number };
  renderSubStatus?: string;
}

// ── Builder ───────────────────────────────────────────────────────────────

/**
 * Build a structured `JobErrorDetail` from any error.
 *
 * If the error is a `PixelFrameError`, its code and userMessage are
 * used directly. Otherwise, the error is classified as `UNKNOWN_ERROR`
 * with a generic user message.
 *
 * @param error          The caught error
 * @param attemptNumber  Which attempt this was (1-indexed)
 * @param context        Optional debugging context
 */
export function buildErrorDetail(
  error: Error,
  attemptNumber: number,
  context?: ErrorContext,
): JobErrorDetail {
  const isPf = error instanceof PixelFrameError;

  return {
    code: isPf ? error.code : "UNKNOWN_ERROR",
    category: isPf ? categorise(error.code) : "logic_error",
    userMessage: isPf
      ? error.userMessage
      : "An unexpected error occurred. Our team has been notified.",
    technicalNote: error.message,
    retryable: isRetryableError(error),
    attemptNumber,
    occurredAt: new Date().toISOString(),
    ...(context ? { context } : {}),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Extract a user-safe message from a `JobErrorDetail` or fall back
 * to a default message.
 */
export function getUserMessage(detail: JobErrorDetail | null | undefined): string {
  return detail?.userMessage ?? "An unexpected error occurred.";
}

/**
 * Check if a `JobErrorDetail` represents a retryable failure.
 */
export function isDetailRetryable(detail: JobErrorDetail | null | undefined): boolean {
  return detail?.retryable ?? false;
}
