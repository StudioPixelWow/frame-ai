/**
 * PixelFrameAI — Runtime Configuration
 *
 * Centralised runtime constants injected via environment variables.
 * All frontend-accessible vars must use the NEXT_PUBLIC_ prefix.
 *
 * This replaces scattered `process.env.NEXT_PUBLIC_*` reads with a
 * single source of truth so refactors only touch one file.
 */

// ── Server URLs ───────────────────────────────────────────────────────────

/**
 * Base URL for the API / render server.
 * In development: http://localhost:3000 (same Next.js server)
 * In production:  env-injected domain
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/**
 * Legacy alias — some modules reference RENDER_SERVER specifically.
 * Points to the same server; the render endpoints live under /api/render.
 */
export const RENDER_SERVER =
  process.env.NEXT_PUBLIC_RENDER_SERVER ?? API_BASE_URL;

// ── Feature flags ─────────────────────────────────────────────────────────

/** When true, auth checks are skipped (dev only) */
export const AUTH_DISABLED =
  process.env.NEXT_PUBLIC_AUTH_DISABLED === "true";

/** When true, BullMQ Board is mounted at /api/admin/queues */
export const BULL_BOARD_ENABLED =
  process.env.NEXT_PUBLIC_BULL_BOARD_ENABLED !== "false";

// ── Polling intervals ─────────────────────────────────────────────────────

/** How often the frontend polls for render status (ms) */
export const RENDER_POLL_INTERVAL_MS = 2_000;

/** How often the frontend polls for analysis status (ms) */
export const ANALYSIS_POLL_INTERVAL_MS = 3_000;

// ── Upload limits ─────────────────────────────────────────────────────────

/** Maximum upload file size in bytes (4 GB) */
export const MAX_UPLOAD_SIZE_BYTES = 4_294_967_296;

/** Allowed MIME types for video uploads */
export const ALLOWED_VIDEO_MIMES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/x-matroska",
] as const;

// ── Signed URL TTLs ───────────────────────────────────────────────────────

/** Default signed URL expiry for playback / preview (seconds) */
export const SIGNED_URL_TTL_DEFAULT = 3_600; // 1 hour

/** Signed URL expiry for download buttons (seconds) */
export const SIGNED_URL_TTL_DOWNLOAD = 3_600; // 1 hour

/** Signed URL expiry for preview thumbnails (seconds) */
export const SIGNED_URL_TTL_PREVIEW = 14_400; // 4 hours

// ── Storage paths ─────────────────────────────────────────────────────────

/** Build the storage key for a source upload */
export function sourceVideoKey(userId: string, projectId: string, ext: string): string {
  return `uploads/${userId}/${projectId}/source.${ext}`;
}

/** Build the storage key for a render output */
export function renderOutputKey(
  userId: string,
  projectId: string,
  outputId: string,
): string {
  return `renders/${userId}/${projectId}/${outputId}/output.mp4`;
}

/** Build the storage key for an output thumbnail */
export function renderThumbKey(
  userId: string,
  projectId: string,
  outputId: string,
): string {
  return `renders/${userId}/${projectId}/${outputId}/thumb.jpg`;
}
