/**
 * PixelFrameAI — Worker Spawner
 *
 * On Vercel (serverless): spawning child processes is not supported.
 * This module becomes a safe no-op that returns status info only.
 *
 * On a persistent server: the worker should be started separately
 * via `npx tsx src/lib/render-worker/worker.ts` — not spawned from
 * the API process. The worker polls Supabase for queued jobs.
 *
 * Zero filesystem usage. Fully Vercel-compatible.
 */

/** Check if the worker is alive — always false on serverless */
export function isWorkerRunning(): boolean {
  return false;
}

/** No-op on serverless — worker runs as a separate process */
export function ensureWorkerRunning(): { pid: number | null; started: boolean } {
  console.log("[Spawner] Worker spawning is disabled on serverless. Run the worker separately.");
  return { pid: null, started: false };
}

/** Get worker status info */
export function getWorkerStatus(): {
  running: boolean;
  pid: number | null;
  startedAt: string | null;
} {
  return {
    running: false,
    pid: null,
    startedAt: null,
  };
}
