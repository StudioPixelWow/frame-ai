/**
 * PixelFrameAI — Error Banner & API Error Contracts
 *
 * Type definitions for user-visible error states.
 *
 * The API returns typed error payloads that the client maps directly
 * to persistent error banners. The client does NOT derive error state
 * from status strings — it reads `error_detail` from the job row and
 * renders the pre-built `userMessage` directly.
 *
 * Key distinction:
 *   - `failed`:    job attempt failed, more retries remain → show "retrying..."
 *   - `exhausted`: all attempts failed, no auto-retry → show error banner
 */

import type { JobErrorDetail } from "./error-detail";

// ── Project error banner ──────────────────────────────────────────────────

/**
 * UI contract for the persistent error card in Project Details.
 * Replaces the old toast-only approach (which vanished after 2.2s).
 */
export interface ProjectErrorBanner {
  visible: boolean;
  severity: "error" | "warning" | "info";
  headline: string;        // e.g. "Render failed"
  detail: string;          // e.g. "Source video is no longer available..."
  primaryAction: ErrorBannerAction | null;
  secondaryAction: ErrorBannerAction | null;
}

export interface ErrorBannerAction {
  label: string;           // e.g. "Retry render"
  href?: string;           // navigation target if applicable
  apiCall?: string;        // e.g. "POST /api/render"
}

// ── API error response ────────────────────────────────────────────────────

/**
 * Consistent error envelope for all job-related API routes.
 * Returned on any 4xx / 5xx from endpoints involving jobs.
 */
export interface ApiErrorResponse {
  error: {
    code: string;          // matches JobErrorDetail.code
    message: string;       // matches JobErrorDetail.userMessage
    retryable: boolean;
    jobId?: string;        // for support triage
  };
}

// ── Banner builder helpers ────────────────────────────────────────────────

/**
 * Build a ProjectErrorBanner from a job error detail.
 *
 * Maps error codes to appropriate headlines, severity levels,
 * and suggested actions.
 */
export function buildErrorBanner(
  errorDetail: JobErrorDetail,
  context: { projectId: string; renderId?: string },
): ProjectErrorBanner {
  const { code, userMessage, retryable } = errorDetail;

  // Determine severity
  const severity: ProjectErrorBanner["severity"] =
    code.startsWith("RENDER_SOURCE_MISSING") || code.startsWith("ASSET_KEY")
      ? "warning"
      : "error";

  // Determine headline
  const headline = getHeadlineForCode(code);

  // Determine actions
  const primaryAction = buildPrimaryAction(code, retryable, context);
  const secondaryAction = buildSecondaryAction(code);

  return {
    visible: true,
    severity,
    headline,
    detail: userMessage,
    primaryAction,
    secondaryAction,
  };
}

function getHeadlineForCode(code: string): string {
  if (code.startsWith("UPLOAD_")) return "העלאה נכשלה"; // Upload failed
  if (code.startsWith("VIDEO_")) return "קובץ וידאו לא תקין"; // Invalid video file
  if (code.startsWith("TRANSCRIPT_")) return "תמלול נכשל"; // Transcription failed
  if (code.startsWith("SEGMENTS_")) return "יצירת כתוביות נכשלה"; // Subtitle generation failed
  if (code.startsWith("RENDER_SOURCE") || code.startsWith("ASSET_KEY"))
    return "קובץ מקור חסר"; // Source file missing
  if (code.startsWith("RENDER_")) return "רנדור נכשל"; // Render failed
  return "שגיאה"; // Error
}

function buildPrimaryAction(
  code: string,
  retryable: boolean,
  context: { projectId: string; renderId?: string },
): ErrorBannerAction | null {
  // Source/asset missing → re-upload
  if (code === "RENDER_SOURCE_MISSING" || code === "ASSET_KEY_MISSING") {
    return {
      label: "העלאה מחדש", // Re-upload
      href: `/projects/${context.projectId}/upload`,
    };
  }

  // Video invalid → start over
  if (code.startsWith("VIDEO_")) {
    return {
      label: "העלאת וידאו אחר", // Upload different video
      href: `/projects/new`,
    };
  }

  // Transcript failed → retry or manual
  if (code.startsWith("TRANSCRIPT_")) {
    return {
      label: "נסה שוב", // Retry
      apiCall: `POST /api/projects/${context.projectId}/analysis/retry`,
    };
  }

  // Render failed → retry render
  if (code.startsWith("RENDER_") && retryable) {
    return {
      label: "נסה רנדור מחדש", // Retry render
      apiCall: `POST /api/render/${context.renderId}/retry`,
    };
  }

  if (code.startsWith("RENDER_")) {
    return {
      label: "נסה רנדור מחדש", // Retry render
      apiCall: `POST /api/render`,
    };
  }

  return null;
}

function buildSecondaryAction(code: string): ErrorBannerAction | null {
  // Transcript failed → offer manual subtitles
  if (code.startsWith("TRANSCRIPT_") || code.startsWith("SEGMENTS_")) {
    return {
      label: "המשך עם כתוביות ידניות", // Continue with manual subtitles
    };
  }

  return null;
}

// ── API error response builder ────────────────────────────────────────────

/**
 * Build an API error response from a job error detail.
 */
export function buildApiErrorResponse(
  errorDetail: JobErrorDetail,
  jobId?: string,
): ApiErrorResponse {
  return {
    error: {
      code: errorDetail.code,
      message: errorDetail.userMessage,
      retryable: errorDetail.retryable,
      ...(jobId ? { jobId } : {}),
    },
  };
}
