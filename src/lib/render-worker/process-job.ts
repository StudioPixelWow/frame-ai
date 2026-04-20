/**
 * PixelFrameAI — process-job stub
 *
 * Rendering is handled by the external worker process:
 *   npx tsx src/lib/render-worker/worker.ts
 *
 * This file exists only so old imports don't break.
 * It does NOT run Remotion — Vercel serverless cannot host Remotion.
 */

export async function processRenderJob(_jobId: string): Promise<void> {
  console.log(
    "[ProcessJob] Rendering is handled by the external worker (worker.ts).",
    "This function is a no-op on Vercel.",
    `jobId=${_jobId}`,
  );
}
