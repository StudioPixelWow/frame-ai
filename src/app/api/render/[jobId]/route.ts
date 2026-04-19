/**
 * GET /api/render/[jobId] — Get render job status
 * PUT /api/render/[jobId] — Update render job (retry, cancel)
 * DELETE /api/render/[jobId] — Remove job
 *
 * PERSISTENCE FIX: When GET returns a completed job, the route ensures
 * the output file is uploaded to Supabase Storage and the project record
 * is updated with the public URL. This makes persistence server-side
 * and deterministic — no dependency on the client polling at the right time.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  readRenderJob,
  updateRenderJobFile,
  deleteRenderJobFile,
} from "@/lib/render-worker/job-manager";
import { uploadToStorage } from "@/lib/storage/upload";
import { getSupabase } from "@/lib/db/store";

const tag = "[render/jobId]";

/**
 * When a render job is completed with a local outputPath but no publicUrl,
 * upload the output to Supabase Storage and update the project record.
 *
 * This runs ONCE — after the first successful upload, the job file is
 * updated with `publicUrl` so subsequent polls skip this step.
 */
async function ensurePersisted(jobId: string, job: ReturnType<typeof readRenderJob>) {
  if (!job) return job;
  if (job.status !== "completed") return job;
  if (job.publicUrl) return job; // Already persisted
  if (!job.outputPath) return job;

  console.log(`${tag} ⚡ Job ${jobId} completed but not persisted — starting upload+DB update`);

  // Resolve local file path: outputPath is like "/renders/render-xxx.mp4"
  const localPath = path.join(process.cwd(), "public", job.outputPath.replace(/^\//, ""));

  if (!fs.existsSync(localPath)) {
    console.error(`${tag} ❌ Output file not found: ${localPath}`);
    return job;
  }

  const stats = fs.statSync(localPath);
  console.log(`${tag} 📂 Output file: ${localPath} (${(stats.size / 1048576).toFixed(1)}MB)`);

  // 1. Upload to Supabase Storage
  let publicUrl: string | null = null;
  try {
    const buffer = fs.readFileSync(localPath);
    const fileName = path.basename(localPath);
    const storagePath = `renders/${Date.now()}-${fileName}`;
    console.log(`${tag} 📤 Uploading to Supabase Storage: path=${storagePath}`);

    const result = await uploadToStorage({
      storagePath,
      buffer,
      contentType: "video/mp4",
      upsert: true,
    });

    publicUrl = result.publicUrl;
    console.log(`${tag} ✅ Upload complete: ${publicUrl}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ Upload failed: ${msg}`);
    return job; // Don't update job file — retry on next poll
  }

  // 2. Update project in Supabase DB
  if (publicUrl && job.projectId) {
    try {
      const sb = getSupabase();
      const { error } = await sb
        .from("video_projects")
        .update({
          render_output_key: publicUrl,
          video_url: publicUrl,
          status: "complete",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.projectId);

      if (error) {
        console.error(`${tag} ❌ Project DB update failed: ${error.message}`);
      } else {
        console.log(`${tag} ✅ Project ${job.projectId} updated: status=complete, render_output_key=${publicUrl.slice(0, 80)}...`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${tag} ❌ Project DB update error: ${msg}`);
    }
  }

  // 3. Update job file with publicUrl so we don't re-upload on next poll
  const updated = updateRenderJobFile(jobId, { publicUrl });
  return updated || job;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  let job = readRenderJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Render job not found" }, { status: 404 });
  }

  // Ensure completed jobs are persisted to durable storage + DB
  job = await ensurePersisted(jobId, job) || job;

  return NextResponse.json({ job });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const body = await req.json();

  const job = readRenderJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Render job not found" }, { status: 404 });
  }

  // Handle retry
  if (body.action === "retry" && job.status === "failed") {
    const updated = updateRenderJobFile(jobId, {
      status: "queued",
      progress: 0,
      currentStage: "ממתין בתור (ניסיון חוזר)",
      error: null,
      retryCount: job.retryCount + 1,
    });
    return NextResponse.json({ job: updated });
  }

  // Handle cancel
  if (body.action === "cancel" && ["queued", "preparing", "rendering"].includes(job.status)) {
    const updated = updateRenderJobFile(jobId, {
      status: "failed",
      error: "Cancelled by user",
      currentStage: "בוטל",
    });
    return NextResponse.json({ job: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const deleted = deleteRenderJobFile(jobId);

  if (!deleted) {
    return NextResponse.json({ error: "Render job not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
