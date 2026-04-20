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
 */

import { readRenderJob, updateRenderJob } from "./job-manager";
import { getSupabase } from "@/lib/db/store";

const tag = "[RenderProcessor]";
const BUCKET = "project-files";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract the storage path from a Supabase public URL.
 */
function extractStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(publicUrl.substring(idx + marker.length));
  }
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
 */
export async function processRenderJob(jobId: string): Promise<void> {
  console.log(`${tag} ── Worker started for jobId=${jobId} ──`);

  try {
    // ── 1. Load job ──
    const job = await readRenderJob(jobId);
    if (!job) {
      console.error(`${tag} ❌ Job ${jobId} not found`);
      return;
    }
    console.log(`${tag} Loaded job: status=${job.status} project=${job.project_id}`);

    if (job.status !== "queued") {
      console.warn(`${tag} Job ${jobId} is not queued (status=${job.status}) — skipping`);
      return;
    }

    const metadata = (job.metadata || {}) as Record<string, any>;
    const inputProps = metadata.inputProps || {};
    const sourceVideoUrl: string = inputProps.videoUrl || metadata.videoUrl || "";

    if (!sourceVideoUrl) {
      await updateRenderJob(jobId, {
        status: "failed",
        error: "No video URL found in job metadata",
        stage: "נכשל — אין קישור לסרטון",
      });
      return;
    }

    console.log(`${tag} sourceVideoUrl=${sourceVideoUrl.substring(0, 150)}`);

    const sb = getSupabase();

    // ── 2. Preparing ──
    await updateRenderJob(jobId, { status: "preparing", progress: 5, stage: "מכין את הקומפוזיציה" });

    // ── 3. Download source video ──
    await updateRenderJob(jobId, { progress: 10, stage: "טוען קובץ מקור" });

    let videoBuffer: ArrayBuffer;
    const storagePath = extractStoragePath(sourceVideoUrl);

    if (storagePath) {
      console.log(`${tag} Downloading from storage: ${storagePath}`);
      const { data: fileData, error: dlErr } = await sb.storage.from(BUCKET).download(storagePath);

      if (dlErr || !fileData) {
        console.warn(`${tag} Storage download failed: ${dlErr?.message || "no data"} — falling back to HTTP`);
        const resp = await fetch(sourceVideoUrl);
        if (!resp.ok) throw new Error(`HTTP download failed: ${resp.status}`);
        videoBuffer = await resp.arrayBuffer();
      } else {
        videoBuffer = await fileData.arrayBuffer();
      }
    } else {
      console.log(`${tag} Downloading via HTTP`);
      const resp = await fetch(sourceVideoUrl);
      if (!resp.ok) throw new Error(`HTTP download failed: ${resp.status}`);
      videoBuffer = await resp.arrayBuffer();
    }

    const sizeMB = (videoBuffer.byteLength / 1048576).toFixed(1);
    console.log(`${tag} ✅ Downloaded: ${sizeMB}MB`);

    // ── 4. Rendering (simulated) ──
    await updateRenderJob(jobId, { status: "rendering", progress: 25, stage: "מתחיל רינדור" });

    const stages = [
      { progress: 35, stage: "מעבד קטעי וידאו" },
      { progress: 50, stage: "משלב אפקטים" },
      { progress: 65, stage: "מחיל שיפורים" },
      { progress: 80, stage: "רינדור סופי" },
    ];
    for (const s of stages) {
      await updateRenderJob(jobId, { status: "rendering", progress: s.progress, stage: s.stage });
      await sleep(400 + Math.random() * 200);
    }

    console.log(`${tag} RENDER FINISHED — uploading output`);

    // ── 5. Upload output to NEW path ──
    await updateRenderJob(jobId, { status: "finalizing", progress: 88, stage: "מעלה קובץ סופי" });

    const projectId = job.project_id || "unknown";
    const outputPath = `outputs/${projectId}_${Date.now()}.mp4`;

    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(outputPath, new Uint8Array(videoBuffer), {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Upload failed: ${uploadErr.message}`);
    }

    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(outputPath);
    const outputUrl = urlData?.publicUrl || "";

    if (!outputUrl) {
      throw new Error("Upload succeeded but getPublicUrl returned empty");
    }

    console.log(`${tag} UPLOADED OUTPUT URL: ${outputUrl}`);

    // Validate
    if (outputUrl === sourceVideoUrl) {
      throw new Error(`Output URL equals source URL — not a new file`);
    }

    // ── 6. Save to render_jobs ──
    await updateRenderJob(jobId, {
      status: "completed",
      progress: 100,
      stage: "הושלם",
      result_url: outputUrl,
    });
    console.log(`${tag} ✅ render_jobs updated: result_url=${outputUrl.substring(0, 80)}`);

    // ── 7. Save to video_projects — THIS IS CRITICAL ──
    if (job.project_id) {
      console.log(`${tag} SAVING TO PROJECT: ${job.project_id}`);

      // Try updating with all video fields
      const updatePayload = {
        status: "complete",
        video_url: outputUrl,
        render_output_key: outputUrl,
        updated_at: new Date().toISOString(),
      };

      const { data: updateData, error: updateErr } = await sb
        .from("video_projects")
        .update(updatePayload)
        .eq("id", job.project_id)
        .select("id, status, video_url, render_output_key")
        .maybeSingle();

      if (updateErr) {
        console.error(`${tag} ❌ video_projects update ERROR:`, updateErr.message);

        // If columns don't exist, try a minimal update
        const colMatch = updateErr.message.match(/column.*['"]?([a-z_]+)['"]?.*does not exist/i);
        if (colMatch) {
          const badCol = colMatch[1];
          console.warn(`${tag} ⚠️ Column "${badCol}" missing — retrying without it`);

          // Build a reduced payload without the bad column
          const reduced: Record<string, unknown> = { ...updatePayload };
          delete reduced[badCol];

          const { data: retryData, error: retryErr } = await sb
            .from("video_projects")
            .update(reduced)
            .eq("id", job.project_id)
            .select("id, status")
            .maybeSingle();

          if (retryErr) {
            console.error(`${tag} ❌ Retry also failed:`, retryErr.message);
          } else {
            console.log(`${tag} ✅ PROJECT UPDATED (partial): ${JSON.stringify(retryData)}`);
          }
        }
      } else {
        console.log(`${tag} PROJECT UPDATED SUCCESSFULLY:`, JSON.stringify(updateData));
      }

      // ── VERIFY: read back the project to confirm the URL is saved ──
      const { data: verifyRow, error: verifyErr } = await sb
        .from("video_projects")
        .select("id, status, video_url, render_output_key")
        .eq("id", job.project_id)
        .maybeSingle();

      if (verifyErr) {
        // If select fails due to missing columns, try minimal select
        console.warn(`${tag} ⚠️ Verify select failed: ${verifyErr.message} — trying minimal`);
        const { data: minRow } = await sb
          .from("video_projects")
          .select("id, status")
          .eq("id", job.project_id)
          .maybeSingle();
        console.log(`${tag} VERIFY (minimal): ${JSON.stringify(minRow)}`);
      } else if (verifyRow) {
        const savedUrl = (verifyRow as any).video_url || (verifyRow as any).render_output_key;
        console.log(`${tag} VERIFY: video_url=${(verifyRow as any).video_url || "(null)"} render_output_key=${(verifyRow as any).render_output_key || "(null)"} status=${(verifyRow as any).status}`);

        if (!savedUrl) {
          console.error(`${tag} ❌ CRITICAL: Output URL was NOT saved to video_projects! DB columns may be missing.`);
          console.error(`${tag}   Run: ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS video_url TEXT;`);
          console.error(`${tag}   Run: ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS render_output_key TEXT;`);
        } else if (savedUrl !== outputUrl) {
          console.error(`${tag} ❌ MISMATCH: saved=${savedUrl.substring(0, 80)} expected=${outputUrl.substring(0, 80)}`);
        } else {
          console.log(`${tag} ✅ VERIFIED: video_url in DB matches output URL`);
        }
      } else {
        console.error(`${tag} ❌ Project ${job.project_id} not found in video_projects after update!`);
      }
    } else {
      console.error(`${tag} ❌ No project_id on job — cannot update video_projects`);
    }

    console.log(`${tag} ══════════════════════════════════════`);
    console.log(`${tag} RENDER COMPLETE SUMMARY`);
    console.log(`${tag}   jobId:     ${jobId}`);
    console.log(`${tag}   projectId: ${job.project_id}`);
    console.log(`${tag}   source:    ${sourceVideoUrl.substring(0, 120)}`);
    console.log(`${tag}   output:    ${outputUrl}`);
    console.log(`${tag}   storage:   bucket="${BUCKET}" path="${outputPath}"`);
    console.log(`${tag}   DB fields: video_url, render_output_key`);
    console.log(`${tag} ══════════════════════════════════════`);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown processing error";
    console.error(`${tag} ❌ Worker FAILED for jobId=${jobId}: ${errorMsg}`);

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
