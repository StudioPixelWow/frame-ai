/**
 * PixelFrameAI — Configuration Module
 *
 * Startup validation + typed environment variable access.
 *
 * Usage:
 *   import { validateEnv, getEnvWithDefault, getEnvInt } from '@/lib/config';
 *
 *   // First line of every entry point:
 *   validateEnv('app');        // server.ts
 *   validateEnv('analysis');   // workers/analysis-worker.ts
 *   validateEnv('render');     // workers/render-worker.ts
 *
 *   // Read env vars with typed defaults:
 *   const port = getEnvInt('PORT', 3000);
 *   const isDev = getEnvWithDefault('NODE_ENV') === 'development';
 */

// Validation + accessors
export {
  validateEnv,
  getEnvWithDefault,
  getEnvInt,
  getEnvBool,
} from "./validate-env";

// Schema definitions
export {
  ENV_REQUIREMENTS,
  ENV_DEFAULTS,
} from "./env-schema";
export type { ProcessType } from "./env-schema";

// Runtime constants
export {
  API_BASE_URL,
  RENDER_SERVER,
  AUTH_DISABLED,
  BULL_BOARD_ENABLED,
  RENDER_POLL_INTERVAL_MS,
  ANALYSIS_POLL_INTERVAL_MS,
  MAX_UPLOAD_SIZE_BYTES,
  ALLOWED_VIDEO_MIMES,
  SIGNED_URL_TTL_DEFAULT,
  SIGNED_URL_TTL_DOWNLOAD,
  SIGNED_URL_TTL_PREVIEW,
  sourceVideoKey,
  renderOutputKey,
  renderThumbKey,
} from "./runtime";
