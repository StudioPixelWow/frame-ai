/**
 * Shared .frameai path helper.
 *
 * Vercel serverless runtime mounts the deployment at /var/task/ (read-only).
 * On Vercel, writes MUST go to /tmp/ which is the only writable directory.
 * In local dev (NODE_ENV !== 'production'), keep the current cwd-based path.
 */
import path from 'path';

const BASE = process.env.NODE_ENV === 'production'
  ? '/tmp'
  : process.cwd();

/** Root .frameai directory — writable in both local dev and Vercel */
export const FRAMEAI_DIR = path.join(BASE, '.frameai');

/** .frameai/data — used by JsonStore, api-keys, ai-settings, stock-search, etc. */
export const DATA_DIR = path.join(FRAMEAI_DIR, 'data');
