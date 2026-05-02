/**
 * PixelManageAI — Render Job Status Machine
 *
 * Status transitions, retry classification, progress reporting,
 * and UI label mapping for render jobs.
 */

import type { RenderJobStatus, RenderSubStatus } from "@/types/render";

// ── Valid transitions ──────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<RenderJobStatus, RenderJobStatus[]> = {
  queued: ["processing"],
  processing: ["completed", "failed"],
  completed: [],             // terminal
  failed: ["queued", "exhausted"],  // queued = retry, exhausted = max attempts
  exhausted: ["queued"],     // manual re-render creates a new row, but this allows reset
};

export function isValidRenderTransition(
  from: RenderJobStatus,
  to: RenderJobStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Error classification ───────────────────────────────────────────────────

const RETRYABLE_PATTERNS = [
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "timeout",
  "503",
  "502",
  "out of memory",
  "ENOMEM",
];

/**
 * Determine if a render error is retryable (transient).
 * Non-retryable: invalid payload structure, missing source video, zero duration.
 */
export function isRetryableRenderError(error: Error | string): boolean {
  const message = typeof error === "string" ? error : error.message;
  return RETRYABLE_PATTERNS.some((p) => message.includes(p));
}

/**
 * Calculate exponential backoff delay.
 * Attempt 1 → 10s, attempt 2 → 20s, attempt 3 → 40s
 */
export function getRenderRetryDelay(attempt: number): number {
  return Math.pow(2, attempt) * 5000;
}

/**
 * Determine the next status after a render error.
 */
export function getNextStatusAfterError(
  error: Error | string,
  attempt: number,
  maxAttempts: number,
): {
  status: RenderJobStatus;
  shouldRetry: boolean;
  delayMs: number;
} {
  if (isRetryableRenderError(error) && attempt < maxAttempts) {
    return {
      status: "failed",
      shouldRetry: true,
      delayMs: getRenderRetryDelay(attempt),
    };
  }

  return {
    status: attempt >= maxAttempts ? "exhausted" : "failed",
    shouldRetry: false,
    delayMs: 0,
  };
}

// ── Progress reporting ─────────────────────────────────────────────────────

/**
 * Determine if a progress update should be written to DB.
 * Throttle to every 5% to avoid excessive writes.
 */
export function shouldReportProgress(progressPct: number): boolean {
  return progressPct % 5 === 0;
}

// ── UI label mapping ───────────────────────────────────────────────────────

/**
 * Human-readable label for the current render phase (Hebrew).
 */
export function renderSubStatusLabel(
  subStatus: RenderSubStatus | null,
  progress: number,
): string {
  switch (subStatus) {
    case "preparing":
      return "מכין רינדור...";
    case "rendering":
      return `מרנדר... ${progress}%`;
    case "uploading":
      return "שומר פלט...";
    case "thumbnailing":
      return "מייצר תצוגה מקדימה...";
    default:
      return "ממתין בתור...";
  }
}

/**
 * Full status label for render state (Hebrew).
 */
export function renderStatusLabel(
  status: RenderJobStatus | "rendering" | "done" | "error" | string,
  subStatus: RenderSubStatus | null,
  progress: number,
): string {
  switch (status) {
    case "rendering":
    case "processing":
    case "queued":
      return renderSubStatusLabel(subStatus, progress);
    case "completed":
    case "done":
      return "רינדור הושלם";
    case "failed":
    case "exhausted":
    case "error":
      return "רינדור נכשל";
    default:
      return "מוכן לרינדור";
  }
}
