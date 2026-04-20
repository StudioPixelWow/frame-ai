/**
 * PixelFrameAI — DEPRECATED Serverless Render Job Processor
 *
 * ⚠️  THIS FILE IS DEPRECATED AND MUST NOT BE USED.
 *
 * BUG FOUND: The old processRenderJob() downloaded the source video and
 * re-uploaded the EXACT SAME BYTES to a new path at outputs/{id}_{ts}.mp4.
 * NO actual rendering was performed — just sleep() calls faking progress.
 * This caused the bug where "rendered" output was identical to the source.
 *
 * REAL rendering is now handled exclusively by worker.ts, which:
 *   1. Bundles the Remotion project via @remotion/bundler
 *   2. Renders via renderMedia() from @remotion/renderer (real FFmpeg encoding)
 *   3. Produces a genuinely NEW video with all edits applied:
 *      - Crop/framing per format (9:16, 16:9, 1:1, 4:5)
 *      - Subtitles with styling, animation, positioning
 *      - Transitions (fade/zoom/cut) between clips
 *      - B-roll overlays with opacity/scale transitions
 *      - Audio mixing with music ducking
 *      - Smart zoom, Ken Burns drift, visual effects
 *      - Cleanup cuts (removing marked segments)
 *   4. Uploads the rendered MP4 to Supabase Storage
 *   5. Updates video_projects with the output URL
 *
 * The worker runs on a persistent server and polls Supabase for queued jobs.
 * The API route (/api/render) only creates the job row — it does NOT render.
 *
 * If this function is called, it's a BUG in the API route configuration.
 */

export async function processRenderJob(_jobId: string): Promise<void> {
  console.error(
    "[RenderProcessor] ❌ DEPRECATED: processRenderJob() was called but must not be used!",
    "This function used to re-upload the source video as 'output' — that's the bug.",
    "Real rendering is handled by worker.ts (polls Supabase, runs Remotion renderMedia).",
    `jobId=${_jobId}`
  );
  throw new Error(
    "processRenderJob is DEPRECATED — it re-uploaded source video as output (the bug). " +
    "Real rendering is handled by worker.ts. Remove any after() call that invokes this."
  );
}
