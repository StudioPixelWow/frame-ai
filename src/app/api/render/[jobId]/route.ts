/**
 * GET /api/render/[jobId] — Get render job status (from Supabase only)
 * PUT /api/render/[jobId] — Update render job (retry, cancel)
 * DELETE /api/render/[jobId] — Remove job
 *
 * Source of truth: Supabase render_jobs table.
 * No file reads. No in-memory maps.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  readRenderJob,
  updateRenderJob,
  deleteRenderJob,
} from "@/lib/render-worker/job-manager";
import { uploadToStorage } from "@/lib/storage/upload";
import { getSupabase } from "@/lib/db/store";
import path from "path";
import fs from "fs";

const tag = "[render/jobId]";

/**
 * When a render job is completed with a local result but no public URL,
 * upload the output to Supabase Storage and update the project record.
 */
async function ensurePersisted(job: NonNullable<Awaited<ReturnType<typeof readRenderJob>>>) {
  if (job.status !== "completed") return job;
  if (job.result_url) return job; // Already persisted

  // Check metadata for local outputPath
  const outputPath = (job.metadata as any)?.outputPath as string | undefined;
  if (!outputPath) return job;

  console.log(`${tag} ⚡ Job ${job.job_id} completed but not persisted — uploading`);

  const localPath = path.join(process.cwd(), "public", outputPath.replace(/^\//, ""));
  if (!fs.existsSync(localPath)) {
    console.error(`${tag} ❌ Output file not found: ${localPath}`);
    return job;
  }

  try {
    const buffer = fs.readFileSync(localPath);
    const fileName = path.basename(localPath);
    const storagePath = `renders/${Date.now()}-${fileName}`;
    const result = await uploadToStorage({ storagePath, buffer, contentType: "video/mp4", upsert: true });

    // Update render_jobs with the public URL
    const updated = await updateRenderJob(job.job_id, { result_url: result.publicUrl });

    // Update the video_projects record too
    if (job.project_id) {
      try {
        const sb = getSupabase();
        await sb.from("video_projects").update({
          status: "complete",
          updated_at: new Date().toISOString(),
        }).eq("id", job.project_id);
      } catch { /* non-fatal */ }
    }

    console.log(`${tag} ✅ Upload + persist complete: ${result.publicUrl}`);
    return updated || job;
  } catch (err) {
    console.error(`${tag} ❌ Upload failed:`, err instanceof Error ? err.message : err);
    return job;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  let jobId = "(unknown)";
  try {
    jobId = (await context.params).jobId;
  } catch {
    return NextResponse.json({ error: "Invalid route params" }, { status: 400 });
  }

  console.log(`${tag} ── GET /api/render/${jobId} ──`);

  try {
    // ── Read ONLY from Supabase ──
    let job = await readRenderJob(jobId);

    if (!job) {
      console.warn(`${tag} ❌ Job ${jobId} not found in render_jobs table`);
      return NextResponse.json({ error: "Render job not found", jobId }, { status: 404 });
    }

    console.log(`${tag} ✅ Job found: status=${job.status} progress=${job.progress}%`);

    // If completed, ensure output is persisted to durable storage
    job = await ensurePersisted(job) || job;

    // Return shape the client expects
    return NextResponse.json({
      job: {
        id: job.job_id,
        projectId: job.project_id,
        status: mapStatus(job.status),
        progress: job.progress,
        currentStage: job.stage || "",
        outputPath: (job.metadata as any)?.outputPath || null,
        publicUrl: job.result_url,
        error: job.error,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ Uncaught error in GET:`, msg);
    return NextResponse.json({ error: msg, jobId }, { status: 500 });
  }
}

/** Map DB status values to what the client expects */
function mapStatus(s: string): string {
  const map: Record<string, string> = {
    queued: "queued",
    processing: "rendering",
    preparing: "preparing",
    rendering: "rendering",
    finalizing: "finalizing",
    done: "completed",
    completed: "completed",
    failed: "failed",
  };
  return map[s] || s;
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const body = await req.json();

  const job = await readRenderJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Render job not found" }, { status: 404 });
  }

  if (body.action === "retry" && job.status === "failed") {
    const updated = await updateRenderJob(jobId, {
      status: "queued",
      progress: 0,
      stage: "ממתין בתור (ניסיון חוזר)",
      error: null,
    });
    return NextResponse.json({ job: updated });
  }

  if (body.action === "cancel" && ["queued", "preparing", "rendering"].includes(job.status)) {
    const updated = await updateRenderJob(jobId, {
      status: "failed",
      error: "Cancelled by user",
      stage: "בוטל",
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
  const deleted = await deleteRenderJob(jobId);

  if (!deleted) {
    return NextResponse.json({ error: "Render job not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
