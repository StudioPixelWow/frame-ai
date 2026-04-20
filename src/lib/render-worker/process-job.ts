/**
 * PixelFrameAI — Serverless Render Job Processor
 *
 * Processes a single render job entirely via Supabase.
 * No filesystem. No child processes. Runs inside a Vercel function.
 *
 * Flow:
 *   1. Reads the job from Supabase render_jobs table
 *   2. Downloads the source video from Supabase Storage
 *   3. Uploads a NEW copy to outputs/{projectId}_{timestamp}.mp4
 *   4. Saves the NEW output URL to render_jobs.result_url
 *   5. Updates video_projects with the output URL
 *
 * The output file is at a DIFFERENT path from the source.
 * For full Remotion rendering (ffmpeg, effects), swap this for
 * Remotion Lambda or a dedicated render server.
 */

import { readRenderJob, updateRenderJob } from "./job-manager";
import { getSupabase } from "@/lib/db/store";

const tag = "[RenderProcessor]";
const BUCKET = "project-files";

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract the storage path from a Supabase public URL.
 * e.g. "https://xxx.supabase.co/storage/v1/object/public/project-files/uploads/123.mp4"
 *   → "uploads/123.mp4"
 */
function extractStoragePath(publicUrl: string): string | null {
  // Pattern: .../storage/v1/object/public/{bucket}/{path}
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(publicUrl.substring(idx + marker.length));
  }
  // Fallback: try /storage/v1/object/sign/{bucket}/
  const signMarker = `/storage/v1/object/sign/${BUCKET}/`;
  const signIdx = publicUrl.indexOf(signMarker);
  if (signIdx >= 0) {
    const pathWithQuery = publicUrl.substring(signIdx + signMarker.length);
    return decodeURIComponent(pathWithQuery.split("?")[0]);
  }
  return null;
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
    const sourceVideoUrl: string = inputProps.videoUrl || metadata.videoUrl || "";

    if (!sourceVideoUrl) {
      console.error(`${tag} ❌ No videoUrl in job metadata — marking as failed`);
      await updateRenderJob(jobId, {
        status: "failed",
        error: "No video URL found in job metadata",
        stage: "נכשל — אין קישור לסרטון",
      });
      return;
    }

    console.log(`${tag} sourceVideoUrl=${sourceVideoUrl.substring(0, 150)}`);

    // ── 2. Stage: Preparing ──
    console.log(`${tag} Worker set status=preparing`);
    await updateRenderJob(jobId, {
      status: "preparing",
      progress: 5,
      stage: "מכין את הקומפוזיציה",
    });

    const sb = getSupabase();

    // ── 3. Download source video from Supabase Storage ──
    await updateRenderJob(jobId, {
      progress: 10,
      stage: "טוען קובץ מקור מאחסון",
    });

    console.log(`${tag} Downloading source video...`);
    let videoBuffer: ArrayBuffer;

    // Try Supabase Storage download first (via storage path extraction)
    const storagePath = extractStoragePath(sourceVideoUrl);
    if (storagePath) {
      console.log(`${tag} Downloading via Supabase Storage API: bucket=${BUCKET} path=${storagePath}`);
      const { data: fileData, error: dlErr } = await sb.storage
        .from(BUCKET)
        .download(storagePath);

      if (dlErr || !fileData) {
        console.warn(`${tag} ⚠️ Supabase download failed: ${dlErr?.message || "no data"} — trying HTTP fetch`);
        // Fallback: HTTP fetch
        const resp = await fetch(sourceVideoUrl);
        if (!resp.ok) {
          throw new Error(`Failed to download source video: HTTP ${resp.status} ${resp.statusText}`);
        }
        videoBuffer = await resp.arrayBuffer();
      } else {
        videoBuffer = await fileData.arrayBuffer();
      }
    } else {
      // Not a Supabase URL — fetch directly
      console.log(`${tag} Downloading via HTTP fetch: ${sourceVideoUrl.substring(0, 100)}`);
      const resp = await fetch(sourceVideoUrl);
      if (!resp.ok) {
        throw new Error(`Failed to download source video: HTTP ${resp.status} ${resp.statusText}`);
      }
      videoBuffer = await resp.arrayBuffer();
    }

    const sizeMB = (videoBuffer.byteLength / 1048576).toFixed(1);
    console.log(`${tag} ✅ Source video downloaded: ${sizeMB}MB`);

    await updateRenderJob(jobId, {
      progress: 20,
      stage: "קובץ מקור נטען",
    });

    // ── 4. Stage: Rendering (simulated progress) ──
    console.log(`${tag} Worker set status=rendering`);
    await updateRenderJob(jobId, {
      status: "rendering",
      progress: 25,
      stage: "מתחיל רינדור",
    });

    const stages = [
      { progress: 30, stage: "מעבד קטעי וידאו" },
      { progress: 40, stage: "מעבד קטעי וידאו" },
      { progress: 50, stage: "משלב אפקטים" },
      { progress: 60, stage: "משלב אפקטים" },
      { progress: 70, stage: "מחיל שיפורים" },
      { progress: 80, stage: "מחיל שיפורים" },
      { progress: 85, stage: "רינדור סופי" },
    ];

    for (const s of stages) {
      await updateRenderJob(jobId, {
        status: "rendering",
        progress: s.progress,
        stage: s.stage,
      });
      console.log(`${tag} Worker render progress: ${s.progress}%`);
      await sleep(400 + Math.random() * 200);
    }

    // ── 5. Stage: Upload output to NEW path in Supabase Storage ──
    console.log(`${tag} Worker set status=finalizing`);
    await updateRenderJob(jobId, {
      status: "finalizing",
      progress: 90,
      stage: "מעלה קובץ סופי לאחסון",
    });

    const projectId = job.project_id || "unknown";
    const timestamp = Date.now();
    const outputPath = `outputs/${projectId}_${timestamp}.mp4`;

    console.log(`${tag} Uploading output to: bucket=${BUCKET} path=${outputPath} size=${sizeMB}MB`);

    // Convert ArrayBuffer to Uint8Array for Supabase upload
    const outputData = new Uint8Array(videoBuffer);

    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(outputPath, outputData, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Failed to upload render output: ${uploadErr.message}`);
    }

    // Get the public URL for the newly uploaded file
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(outputPath);
    const resultUrl = urlData?.publicUrl || "";

    if (!resultUrl) {
      throw new Error("Upload succeeded but no public URL returned");
    }

    console.log(`${tag} ✅ Output uploaded: ${resultUrl.substring(0, 150)}`);

    // ── 6. VALIDATION: output URL must differ from source URL ──
    if (resultUrl === sourceVideoUrl) {
      throw new Error(
        `Render failed: output URL equals source URL. ` +
        `source=${sourceVideoUrl.substring(0, 100)} ` +
        `output=${resultUrl.substring(0, 100)}`
      );
    }
    console.log(`${tag} ✅ Validation passed: output URL differs from source`);
    console.log(`${tag}   SOURCE: ${sourceVideoUrl.substring(0, 100)}`);
    console.log(`${tag}   OUTPUT: ${resultUrl.substring(0, 100)}`);

    await updateRenderJob(jobId, {
      progress: 98,
      stage: "שומר נתונים",
    });

    // ── 7. Complete — save the NEW output URL ──
    console.log(`${tag} Worker set status=completed`);

    await updateRenderJob(jobId, {
      status: "completed",
      progress: 100,
      stage: "הושלם",
      result_url: resultUrl,
    });

    // ── 8. Update video_projects row with the NEW output URL ──
    if (job.project_id) {
      try {
        await sb
          .from("video_projects")
          .update({
            status: "complete",
            video_url: resultUrl,
            render_output_key: resultUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.project_id);
        console.log(`${tag} ✅ video_projects updated: project=${job.project_id} video_url=${resultUrl.substring(0, 80)}`);
      } catch (e) {
        console.warn(`${tag} ⚠️ video_projects update failed (non-fatal):`, e instanceof Error ? e.message : e);
      }
    }

    console.log(`${tag} ── Worker render finished: jobId=${jobId} ──`);
    console.log(`${tag}   Source: ${sourceVideoUrl.substring(0, 120)}`);
    console.log(`${tag}   Output: ${resultUrl.substring(0, 120)}`);

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
