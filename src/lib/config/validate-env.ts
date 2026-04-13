/**
 * PixelFrameAI — Startup Environment Validation
 *
 * Called as the first line of each process entry point.
 * Validates that all required environment variables are set,
 * and logs a clear error message with the missing variable names
 * before calling `process.exit(1)`.
 *
 * Usage:
 *   // server.ts
 *   validateEnv('app');
 *
 *   // workers/analysis-worker.ts
 *   validateEnv('analysis');
 *
 *   // workers/render-worker.ts
 *   validateEnv('render');
 */

import { ENV_REQUIREMENTS, ENV_DEFAULTS } from "./env-schema";
import type { ProcessType } from "./env-schema";

/**
 * Validate that all required environment variables are present.
 *
 * Exits the process with code 1 if any required variables are missing.
 * Logs the list of missing variables to stderr for easy diagnosis.
 *
 * @param processType  Which process is starting: 'app', 'analysis', or 'render'
 */
export function validateEnv(processType: ProcessType): void {
  const required = ENV_REQUIREMENTS[processType];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `[startup] Missing required environment variables for ${processType} process:\n  ${missing.join("\n  ")}`,
    );
    process.exit(1);
  }

  console.log(
    `[startup] Environment validated for ${processType} process (${required.length} vars checked)`,
  );
}

/**
 * Get an environment variable with a default fallback.
 *
 * Checks `process.env[key]` first, then falls back to the
 * `ENV_DEFAULTS` map, then returns the provided fallback.
 *
 * @param key       Environment variable name
 * @param fallback  Override fallback (takes precedence over ENV_DEFAULTS)
 */
export function getEnvWithDefault(key: string, fallback?: string): string {
  return process.env[key] ?? ENV_DEFAULTS[key] ?? fallback ?? "";
}

/**
 * Get an environment variable as an integer.
 * Returns the default if the variable is not set or not a valid number.
 */
export function getEnvInt(key: string, defaultValue: number): number {
  const raw = process.env[key] ?? ENV_DEFAULTS[key];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get an environment variable as a boolean.
 * Treats 'true', '1', 'yes' as true; everything else as false.
 */
export function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const raw = (process.env[key] ?? ENV_DEFAULTS[key] ?? "").toLowerCase();
  if (!raw) return defaultValue;
  return ["true", "1", "yes"].includes(raw);
}
