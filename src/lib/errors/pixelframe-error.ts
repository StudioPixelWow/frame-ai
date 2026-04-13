/**
 * PixelFrameAI — Error Class & Retry Classification
 *
 * `PixelFrameError` carries a machine-readable `code` and a
 * user-visible `userMessage`. The code-based `isRetryable()`
 * supersedes the pattern-matching approach in Phase 6.6 — it uses
 * the structured error code registry for deterministic classification.
 *
 * Philosophy:
 *   - Non-retryable failures fail fast (UnrecoverableError)
 *   - Every failure has a deterministic recovery path
 *   - User never sees raw technical error messages
 */

import type { PixelFrameErrorCode } from "./error-codes";
import { NON_RETRYABLE_CODES } from "./error-codes";

// ── PixelFrameError class ─────────────────────────────────────────────────

/**
 * Structured error with a machine-readable code and user-safe message.
 *
 * @example
 *   throw new PixelFrameError(
 *     'UPLOAD_TYPE_REJECTED',
 *     'File type "text/plain" is not supported. Please upload a video file.',
 *   );
 */
export class PixelFrameError extends Error {
  public readonly name = "PixelFrameError";

  constructor(
    /** Machine-readable error code from the registry. */
    public readonly code: PixelFrameErrorCode | string,
    /** User-visible message — non-technical, actionable. */
    public readonly userMessage: string,
    /** Optional technical detail (for logs only, never shown to users). */
    technicalDetail?: string,
  ) {
    super(technicalDetail ?? userMessage);
  }
}

// ── Retry classification ──────────────────────────────────────────────────

/**
 * Determine if an error is retryable.
 *
 * Decision order:
 *   1. BullMQ's UnrecoverableError → always non-retryable
 *   2. PixelFrameError with a code in NON_RETRYABLE_CODES → non-retryable
 *   3. Unknown errors → retryable (conservative default)
 *
 * This supersedes the pattern-matching `isRetryable()` from Phase 6.6
 * for errors that carry a PixelFrameError code. The old pattern matcher
 * in `queue/error-classification.ts` remains as a fallback for
 * third-party errors that don't have codes.
 */
export function isRetryableError(error: Error): boolean {
  // BullMQ's UnrecoverableError — always skip retries
  if (error.name === "UnrecoverableError") return false;

  // PixelFrameError with a known non-retryable code
  if (error instanceof PixelFrameError) {
    return !NON_RETRYABLE_CODES.has(error.code);
  }

  // Unknown errors — conservative: retry
  return true;
}

// ── Type guard ────────────────────────────────────────────────────────────

/**
 * Check if an error is a PixelFrameError.
 */
export function isPixelFrameError(error: unknown): error is PixelFrameError {
  return error instanceof PixelFrameError;
}
