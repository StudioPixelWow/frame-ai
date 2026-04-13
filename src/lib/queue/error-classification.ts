/**
 * PixelFrameAI — Queue Error Classification
 *
 * Determines whether a job error is retryable (transient) or permanent.
 * BullMQ's UnrecoverableError can be thrown from any processor to skip
 * all remaining retry attempts immediately.
 *
 * Retryable:     network errors, rate limits, temporary outages, OOM
 * Non-retryable: bad data, missing resources, schema errors
 */

// ── Retryable patterns ────────────────────────────────────────────────────

const RETRYABLE_PATTERNS = [
  // Network / connectivity
  "econnreset",
  "econnrefused",
  "etimedout",
  "enotfound",
  "epipe",

  // HTTP transient errors
  "503", // service unavailable
  "502", // bad gateway
  "429", // rate limit — backoff will help

  // Resource pressure
  "out of memory",
  "enomem",
  "enospc",
];

const NON_RETRYABLE_PATTERNS = [
  "not found in storage",
  "invalid render payload",
  "durationinframes must be",
  "schema version",
  "source video key missing",
  "unknown analysis job type",
];

/**
 * Determine if a queue job error is retryable (transient).
 *
 * Default behaviour for unrecognised errors: retry (conservative).
 * To force a permanent failure from a processor, throw BullMQ's
 * `UnrecoverableError` instead of relying on this classifier.
 */
export function isRetryable(error: Error | string): boolean {
  const message =
    typeof error === "string" ? error.toLowerCase() : error.message.toLowerCase();

  // Check non-retryable first — these are definitive
  if (NON_RETRYABLE_PATTERNS.some((p) => message.includes(p))) {
    return false;
  }

  // Check retryable patterns
  if (RETRYABLE_PATTERNS.some((p) => message.includes(p))) {
    return true;
  }

  // Unknown errors default to retryable (conservative)
  return true;
}
