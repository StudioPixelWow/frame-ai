/**
 * PixelManageAI — Analysis Job Status Machine & Retry Logic
 *
 * Manages job state transitions, retry with exponential backoff,
 * and error classification (retryable vs terminal).
 */

import type {
  AnalysisJobStatus,
  TranscriptionSubStatus,
} from "@/types/analysis";

// ── Status transitions ─────────────────────────────────────────────────────

/** Valid transitions in the job status machine. */
const VALID_TRANSITIONS: Record<AnalysisJobStatus, AnalysisJobStatus[]> = {
  waiting: ["queued"],
  queued: ["processing"],
  processing: ["completed", "failed"],
  completed: ["superseded"],
  failed: ["queued", "exhausted"], // queued = retry, exhausted = max attempts
  exhausted: ["queued"],            // manual retry via API
  superseded: [],                   // terminal
};

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(
  from: AnalysisJobStatus,
  to: AnalysisJobStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Error classification ───────────────────────────────────────────────────

const RETRYABLE_PATTERNS = [
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "timeout",
  "429",   // rate limit
  "503",   // service unavailable
  "502",   // bad gateway
  "EPIPE",
];

/**
 * Determine if an error is retryable (transient network/service issues).
 */
export function isRetryableError(error: Error | string): boolean {
  const message = typeof error === "string" ? error : error.message;
  return RETRYABLE_PATTERNS.some((pattern) => message.includes(pattern));
}

// ── Retry backoff ──────────────────────────────────────────────────────────

/**
 * Calculate exponential backoff delay for a retry attempt.
 *
 * @param attempt Current attempt number (1-based)
 * @returns Delay in milliseconds: 10s, 20s, 40s, ...
 */
export function getRetryDelay(attempt: number): number {
  return Math.pow(2, attempt) * 5000;
}

/**
 * Determine the next status after a job error.
 *
 * @param error       The error that occurred
 * @param attempt     Current attempt number
 * @param maxAttempts Maximum allowed attempts
 */
export function getErrorNextStatus(
  error: Error | string,
  attempt: number,
  maxAttempts: number,
): { status: AnalysisJobStatus; shouldRetry: boolean; delayMs: number } {
  if (isRetryableError(error) && attempt < maxAttempts) {
    return {
      status: "queued",
      shouldRetry: true,
      delayMs: getRetryDelay(attempt),
    };
  }

  return {
    status: attempt >= maxAttempts ? "exhausted" : "failed",
    shouldRetry: false,
    delayMs: 0,
  };
}

// ── Sub-status → UI step mapping ───────────────────────────────────────────

/**
 * Map transcription sub_status to the _nf.analysisStep UI indicator.
 */
export function subStatusToAnalysisStep(
  subStatus: TranscriptionSubStatus | null,
  isComplete: boolean,
): number {
  if (isComplete) return 4;
  switch (subStatus) {
    case "extracting_audio":
      return 1;
    case "transcribing":
      return 2;
    case "segmenting":
      return 3;
    default:
      return 0;
  }
}

/**
 * Human-readable label for each sub-status (Hebrew).
 */
export function subStatusLabel(
  subStatus: TranscriptionSubStatus | null,
): string {
  switch (subStatus) {
    case "extracting_audio":
      return "מחלץ שמע...";
    case "transcribing":
      return "מריץ זיהוי דיבור...";
    case "segmenting":
      return "בונה קטעי כתוביות...";
    default:
      return "ממתין בתור...";
  }
}
