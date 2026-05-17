/**
 * GET /api/render/[jobId] — Poll render job status from DB (Railway worker updates it)
 * PUT /api/render/[jobId] — Update render job (retry, cancel)
 * DELETE /api/render/[jobId] — Remove job
 *
 * Rendering is done by the Railway worker (worker.ts). This endpoint
 * simply reads the latest status from Supabase and returns it.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import {
  readRenderJob,
  updateRenderJob,
  deleteRenderJob,
} from "@/lib/render-worker/job-manager";

const tag = "[render/jobId]";

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

  try {
    const job = await readRenderJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Render job not found", jobId }, { status: 404 });
    }

    // Return DB state as-is (Railway worker updates progress directly in DB)
    return NextResponse.json({
      job: {
        id: job.job_id,
        projectId: job.project_id,
        status: mapStatus(job.status),
        progress: job.progress,
        currentStage: job.stage || "",
        publicUrl: job.result_url,
        error: job.error,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ GET error:`, msg);
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
    error: "failed",
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

  if (body.action === "retry" && ["failed", "error"].includes(job.status)) {
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
