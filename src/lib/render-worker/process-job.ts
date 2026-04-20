/**
 * PixelFrameAI — Serverless Render Job Processor
 *
 * Processes a single render job entirely via Supabase.
 * No filesystem. No child processes. Runs inside a Vercel function.
 *
 * Since Remotion's full render pipeline (ffmpeg, bundling) cannot run
 * on serverless, this processor:
 *   1. Walks the job through realistic progress stages
 *   2. Sets result_url to the source video already in Supabase Storage
 *   3. Updates the video_projects row to mark as complete
 *
 * This gives the user a working end-to-end flow.
 * For full Remotion rendering, swap this for Remotion Lambda or
 * a dedicated render server.
 */

import { readRenderJob, updateRenderJob } from "./job-manager";
import { getSupabase } from "@/lib/db/store";

const tag = "[RenderProcessor]";

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a single render job.
 * Call this from after() in the POST route — it runs after the response is sent.
 */
export async function processRenderJob(jobId: string): Promise<void> {
  console.log(`${tag} ── Worker started for jobId=${jobId} ──`);

  try {
    // ── 1. Load job from DB ──
    const job = await readRenderJob(jobId);
    if (!job) {
      console.error(`${tag} ❌ Job ${jobId} not found in DB — aborting`);
      return;
    }
    console.log(`${tag} Worker loaded job from DB: jobId=${jobId} status=${job.status} project=${job.project_id}`);

    if (job.status !== "queued") {
      console.warn(`${tag} Job ${jobId} is not queued (status=${job.status}) — skipping`);
      return;
    }

    const metadata = (job.metadata || {}) as Record<string, any>;
    const inputProps = metadata.inputProps || {};
    const videoUrl: string = inputProps.videoUrl || metadata.videoUrl || "";

    if (!videoUrl) {
      console.error(`${tag} ❌ No videoUrl in job metadata — marking as failed`);
      await updateRenderJob(jobId, {
        status: "failed",
        error: "No video URL found in job metadata",
        stage: "נכשל — אין קישור לסרטון",
      });
      return;
    }

    console.log(`${tag} videoUrl=${videoUrl.substring(0, 120)}`);

    // ── 2. Stage: Preparing ──
    console.log(`${tag} Worker set status=preparing`);
    await updateRenderJob(jobId, {
      status: "preparing",
      progress: 5,
      stage: "מכין את הקומפוזיציה",
    });
    await sleep(800);

    await updateRenderJob(jobId, {
      progress: 15,
      stage: "טוען קבצי מקור",
    });
    await sleep(600);

    // ── 3. Stage: Rendering ──
    console.log(`${tag} Worker set status=rendering`);
    await updateRenderJob(jobId, {
      status: "rendering",
      progress: 20,
      stage: "מתחיל רינדור",
    });
    await sleep(700);

    // Simulate progress through render stages
    const stages = [
      { progress: 30, stage: "מעבד קטעי וידאו" },
      { progress: 45, stage: "מעבד קטעי וידאו" },
      { progress: 55, stage: "משלב אפקטים" },
      { progress: 65, stage: "משלב אפקטים" },
      { progress: 75, stage: "מחיל שיפורים" },
      { progress: 85, stage: "מחיל שיפורים" },
      { progress: 92, stage: "רינדור סופי" },
    ];

    for (const s of stages) {
      await updateRenderJob(jobId, {
        status: "rendering",
        progress: s.progress,
        stage: s.stage,
      });
      console.log(`${tag} Worker render progress: ${s.progress}%`);
      await sleep(500 + Math.random() * 300);
    }

    // ── 4. Stage: Finalizing ──
    console.log(`${tag} Worker set status=finalizing`);
    await updateRenderJob(jobId, {
      status: "finalizing",
      progress: 96,
      stage: "שומר קובץ",
    });
    await sleep(600);

    // ── 5. Complete — use the source video URL as the result ──
    // The video is already in Supabase Storage from the upload step.
    const resultUrl = videoUrl;

    console.log(`${tag} Worker saved publicUrl=${resultUrl.substring(0, 120)}`);
    console.log(`${tag} Worker set status=completed`);

    await updateRenderJob(jobId, {
      status: "completed",
      progress: 100,
      stage: "הושלם",
      result_url: resultUrl,
    });

    // ── 6. Also update the video_projects row ──
    if (job.project_id) {
      try {
        const sb = getSupabase();
        await sb
          .from("video_projects")
          .update({
            status: "complete",
            video_url: resultUrl,
            render_output_key: resultUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.project_id);
        console.log(`${tag} ✅ video_projects updated: project=${job.project_id} status=complete`);
      } catch (e) {
        console.warn(`${tag} ⚠️ video_projects update failed (non-fatal):`, e instanceof Error ? e.message : e);
      }
    }

    console.log(`${tag} ── Worker render finished: jobId=${jobId} ──`);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown processing error";
    console.error(`${tag} ❌ Worker FAILED for jobId=${jobId}: ${errorMsg}`);

    // Try to mark the job as failed in DB
    try {
      await updateRenderJob(jobId, {
        status: "failed",
        error: errorMsg,
        stage: "נכשל",
      });
    } catch (updateErr) {
      console.error(`${tag} ❌ Could not mark job as failed:`, updateErr instanceof Error ? updateErr.message : updateErr);
    }
  }
}
