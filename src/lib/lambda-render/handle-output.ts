/**
 * PixelManageAI — Lambda Render Output Handler
 *
 * After Remotion Lambda finishes:
 *   1. Download the rendered video from the S3 output URL
 *   2. Upload it to Supabase Storage ("project-files" bucket)
 *   3. Update the render job + video project in Supabase
 */

import { getSupabase } from "@/lib/db/store";
import { updateRenderJob } from "@/lib/render-worker/job-manager";

const tag = "[LambdaOutput]";

/**
 * Download from S3 output URL, upload to Supabase Storage,
 * and update all relevant DB records.
 */
export async function handleLambdaOutput(opts: {
  jobId: string;
  projectId: string;
  s3OutputUrl: string;
}): Promise<string> {
  const { jobId, projectId, s3OutputUrl } = opts;

  console.log(`${tag} Handling output for job ${jobId}`);
  console.log(`${tag}   S3 URL: ${s3OutputUrl}`);

  // ── 1. Download from S3 ───────────────────────────────────────────────
  await updateRenderJob(jobId, {
    progress: 96,
    stage: "מוריד מ-S3",
  });

  const response = await fetch(s3OutputUrl);
  if (!response.ok) {
    throw new Error(`Failed to download from S3: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
  console.log(`${tag} Downloaded ${sizeMB}MB from S3`);

  // ── 2. Upload to Supabase Storage ─────────────────────────────────────
  await updateRenderJob(jobId, {
    progress: 98,
    stage: "מעלה לאחסון",
  });

  const sb = getSupabase();
  const fileName = `renders/${projectId}/${jobId}.mp4`;

  const { error: uploadErr } = await sb.storage
    .from("project-files")
    .upload(fileName, buffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (uploadErr) {
    console.error(`${tag} ❌ Upload to Supabase Storage failed:`, uploadErr.message);
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  // Get public URL
  const { data: urlData } = sb.storage.from("project-files").getPublicUrl(fileName);
  const publicUrl = urlData?.publicUrl || "";

  console.log(`${tag} ✅ Uploaded to Supabase Storage: ${publicUrl}`);

  // ── 3. Update render job as done ──────────────────────────────────────
  await updateRenderJob(jobId, {
    status: "done",
    progress: 100,
    stage: "הושלם",
    result_url: publicUrl,
  });

  // ── 4. Update video project with result ───────────────────────────────
  try {
    await sb.from("video_projects").update({
      status: "completed",
      output_url: publicUrl,
      render_job_id: jobId,
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    console.log(`${tag} ✅ Project ${projectId} updated with output URL`);
  } catch (err) {
    console.warn(`${tag} ⚠️ Could not update project:`, err instanceof Error ? err.message : err);
    // Non-fatal — the job itself is marked done
  }

  return publicUrl;
}
