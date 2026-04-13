/**
 * PixelFrameAI — Environment Variable Schema
 *
 * Defines required environment variables per process type.
 * Used by `validateEnv()` at startup to fail fast with a clear
 * error message rather than crashing mid-request.
 *
 * Variable scoping:
 *   [all]              — needed by app-server, analysis-worker, render-worker
 *   [app-server]       — HTTP/auth/admin only
 *   [analysis-worker]  — ASR + ffprobe only
 *   [render-worker]    — Remotion + ffmpeg only
 */

// ── Process types ─────────────────────────────────────────────────────────

export type ProcessType = "app" | "analysis" | "render";

// ── Required by all processes ─────────────────────────────────────────────

const REQUIRED_BY_ALL = [
  "NODE_ENV",
  "DATABASE_URL",
  "REDIS_HOST",
  "REDIS_PORT",
  "STORAGE_PROVIDER",
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
] as const;

// ── Process-specific requirements ─────────────────────────────────────────

const REQUIRED_BY_APP_SERVER = [
  ...REQUIRED_BY_ALL,
  "JWT_SECRET",
  "PORT",
] as const;

const REQUIRED_BY_ANALYSIS_WORKER = [
  ...REQUIRED_BY_ALL,
  "TRANSCRIPTION_API_KEY",
  "FFPROBE_PATH",
  "FFMPEG_PATH",
] as const;

const REQUIRED_BY_RENDER_WORKER = [
  ...REQUIRED_BY_ALL,
  "REMOTION_SERVE_URL",
  "FFMPEG_PATH",
  "FFPROBE_PATH",
  "RENDER_TMP_DIR",
] as const;

// ── Schema map ────────────────────────────────────────────────────────────

export const ENV_REQUIREMENTS: Record<ProcessType, readonly string[]> = {
  app: REQUIRED_BY_APP_SERVER,
  analysis: REQUIRED_BY_ANALYSIS_WORKER,
  render: REQUIRED_BY_RENDER_WORKER,
};

// ── Optional variables with defaults ──────────────────────────────────────

/**
 * Optional variables with sensible defaults.
 * Used by `getEnvWithDefault()` at startup.
 */
export const ENV_DEFAULTS: Record<string, string> = {
  NODE_ENV: "development",
  LOG_LEVEL: "info",
  PORT: "3000",
  REDIS_HOST: "localhost",
  REDIS_PORT: "6379",
  REDIS_TLS: "false",
  STORAGE_PROVIDER: "local",
  STORAGE_REGION: "auto",
  STORAGE_URL_EXPIRY_DEFAULT: "3600",
  MAX_UPLOAD_SIZE_BYTES: "4294967296", // 4 GB
  DATABASE_POOL_MIN: "2",
  DATABASE_POOL_MAX: "10",
  RENDER_TIMEOUT_MS: "1800000", // 30 minutes
  RENDER_TMP_DIR: "/tmp/pixelframe-renders",
  FFMPEG_PATH: "/usr/bin/ffmpeg",
  FFPROBE_PATH: "/usr/bin/ffprobe",
  TRANSCRIPTION_MAX_FILE_SIZE_MB: "500",
  AUTH_DISABLED: "false",
  BULL_BOARD_ENABLED: "true",
  CORS_ORIGIN: "*",
};
