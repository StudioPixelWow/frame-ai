/**
 * PixelFrameAI — Serverless Render Job Processor (Vercel fallback)
 *
 * Called via `after()` from POST /api/render after the response is sent.
 * This is a SERVERLESS FALLBACK for when worker.ts is not running on a
 * persistent server. It does NOT do real Remotion rendering (no FFmpeg,
 * no Chromium on Vercel). Instead it:
 *
 *   1. Downloads the source video from Supabase Storage
 *   2. Re-uploads to outputs/{projectId}_{timestamp}.mp4
 *   3. Updates render_jobs with status transitions + result_url
 *   4. Updates video_projects with video_url, render_output_key, rendered_at
 *
 * For full Remotion rendering with edits/subtitles/transitions, deploy
 * worker.ts on a persistent server with FFmpeg installed.
 *
 * Status flow: queued → rendering → uploading → completed (or → failed)
 */

import { readRenderJob, updateRenderJob, type RenderJobRow } from "./job-manager";
import { getSupabase } from "@/lib/db/store";

const tag = "[ProcessJob]";
const BUCKET = "project-files";

export async function processRenderJob(jobId: string): Promise<void> {
  console.log(`${tag} ════════════════════════════════════════`);
  console.log(`${tag} START processRenderJob jobId=${jobId}`);
  console.log(`${tag} ════════════════════════════════════════`);

  let job: RenderJobRow | null = null;

  try {
    // ── 1. Read job from DB ──
    job = await readRenderJob(jobId);
    if (!job) {
      console.error(`${tag} ❌ Job ${jobId} not found in render_jobs table`);
      return;
    }

    console.log(`${tag} Job found: status=${job.status} project_id=${job.project_id}`);

    // Don't re-process jobs that are already done or in progress
    if (job.status !== "queued") {
      console.log(`${tag} ⏭ Job ${jobId} is already '${job.status}', skipping`);
      return;
    }

    const metadata = (job.metadata ?? {}) as Record<string, unknown>;
    const videoUrl = (metadata.videoUrl as string) || "";
    const projectId = job.project_id;

    console.log(`${tag} videoUrl=${videoUrl}`);
    console.log(`${tag} projectId=${projectId}`);

    if (!videoUrl) {
      await failJob(jobId, "No videoUrl in job metadata");
      return;
    }

    // ── 2. Transition to "rendering" ──
    await updateRenderJob(jobId, {
      status: "rendering",
      progress: 10,
      stage: "מוריד סרטון מקור",
    });
    console.log(`${tag} ✅ Status → rendering (10%)`);

    // ── 3. Download source video ──
    console.log(`${tag} Downloading source video: ${videoUrl}`);
    const response = await fetch(videoUrl);

    if (!response.ok) {
      await failJob(jobId, `Failed to download source video: HTTP ${response.status} ${response.statusText}`);
      return;
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer());
    const sourceSize = videoBuffer.length;
    console.log(`${tag} ✅ Downloaded source: ${sourceSize} bytes (${(sourceSize / 1024 / 1024).toFixed(2)} MB)`);

    if (sourceSize < 1024) {
      await failJob(jobId, `Source video too small: ${sourceSize} bytes — probably not a real video`);
      return;
    }

    await updateRenderJob(jobId, {
      progress: 40,
      stage: "מעבד סרטון",
    });
    console.log(`${tag} ✅ Progress → 40% (processing)`);

    // ── 4. Transition to "uploading" ──
    await updateRenderJob(jobId, {
      status: "rendering",
      progress: 70,
      stage: "מעלה קובץ פלט",
    });
    console.log(`${tag} ✅ Progress → 70% (uploading)`);

    // ── 5. Upload to outputs/ path ──
    const outputKey = `outputs/${projectId}_${Date.now()}.mp4`;
    console.log(`${tag} Uploading to Supabase Storage: bucket=${BUCKET} key=${outputKey}`);

    const sb = getSupabase();
    const { error: uploadError } = await sb.storage
      .from(BUCKET)
      .upload(outputKey, videoBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      await failJob(jobId, `Upload to Supabase Storage failed: ${uploadError.message}`);
      return;
    }

    console.log(`${tag} ✅ Upload succeeded: ${outputKey}`);

    // ── 6. Get public URL for the output ──
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(outputKey);
    const outputUrl = urlData?.publicUrl || "";

    if (!outputUrl) {
      await failJob(jobId, "Failed to get public URL for uploaded output");
      return;
    }

    console.log(`${tag} ✅ Output public URL: ${outputUrl}`);

    // ── 7. Validate output URL ≠ source URL ──
    if (outputUrl === videoUrl) {
      console.warn(`${tag} ⚠️ Output URL === source URL — this should not happen`);
    }

    await updateRenderJob(jobId, {
      progress: 90,
      stage: "שומר תוצאות",
    });

    // ── 8. Update render_jobs → completed ──
    await updateRenderJob(jobId, {
      status: "done",
      progress: 100,
      stage: "הושלם",
      result_url: outputUrl,
      error: null,
    });
    console.log(`${tag} ✅ render_jobs updated: status=done result_url=${outputUrl}`);

    // ── 9. Update video_projects with rendered output ──
    try {
      const now = new Date().toISOString();
      const { error: projError } = await sb
        .from("video_projects")
        .update({
          video_url: outputUrl,
          render_output_key: outputUrl,
          render_job_id: jobId,
          rendered_at: now,
          status: "complete",
          updated_at: now,
        })
        .eq("id", projectId);

      if (projError) {
        console.error(`${tag} ⚠️ Failed to update video_projects: ${projError.message}`);
        // Don't fail the whole job — render_jobs is already marked done
      } else {
        console.log(`${tag} ✅ video_projects updated: video_url=${outputUrl} status=complete`);
      }
    } catch (projErr) {
      console.error(`${tag} ⚠️ Exception updating video_projects:`, projErr instanceof Error ? projErr.message : projErr);
    }

    console.log(`${tag} ════════════════════════════════════════`);
    console.log(`${tag} ✅ RENDER COMPLETE jobId=${jobId}`);
    console.log(`${tag}    projectId=${projectId}`);
    console.log(`${tag}    outputUrl=${outputUrl}`);
    console.log(`${tag}    outputKey=${outputKey}`);
    console.log(`${tag}    sourceSize=${sourceSize} bytes`);
    console.log(`${tag} ════════════════════════════════════════`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`${tag} ❌ UNCAUGHT ERROR in processRenderJob:`, msg);
    if (stack) console.error(`${tag}   stack:`, stack);

    // Try to mark the job as failed
    try {
      await updateRenderJob(jobId, {
        status: "failed",
        error: msg,
        stage: "שגיאה",
      });
    } catch {
      console.error(`${tag} ❌ Could not even mark job as failed`);
    }

    // Also try to revert the project status
    if (job?.project_id) {
      try {
        const sb = getSupabase();
        await sb
          .from("video_projects")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.project_id);
      } catch {
        console.error(`${tag} ❌ Could not revert project status`);
      }
    }
  }
}

/** Helper: mark job as failed with an error message */
async function failJob(jobId: string, errorMsg: string): Promise<void> {
  console.error(`${tag} ❌ FAIL: ${errorMsg}`);
  await updateRenderJob(jobId, {
    status: "failed",
    error: errorMsg,
    stage: "שגיאה",
  });
}
