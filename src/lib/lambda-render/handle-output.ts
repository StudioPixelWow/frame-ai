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
 * Use the S3 output URL directly (video is already publicly accessible
 * via Remotion's "no-acl" privacy + "play-in-browser" download behavior).
 *
 * Previously this downloaded from S3 and re-uploaded to Supabase Storage,
 * but that times out on Vercel for large video files. Instead we just
 * store the S3 URL as the result — the video is already playable there.
 */
export async function handleLambdaOutput(opts: {
  jobId: string;
  projectId: string;
  s3OutputUrl: string;
}): Promise<string> {
  const { jobId, projectId, s3OutputUrl } = opts;

  console.log(`${tag} Handling output for job ${jobId}`);
  console.log(`${tag}   S3 URL: ${s3OutputUrl}`);

  // Use the S3 URL directly — no download/re-upload needed.
  // The file is already publicly accessible in the Remotion Lambda S3 bucket.
  const publicUrl = s3OutputUrl;

  // ── 1. Update render job as done ──────────────────────────────────────
  await updateRenderJob(jobId, {
    status: "done",
    progress: 100,
    stage: "הושלם",
    result_url: publicUrl,
  });

  console.log(`${tag} ✅ Render complete: ${publicUrl}`);

  // ── 2. Update video project with result ───────────────────────────────
  const sb = getSupabase();
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
