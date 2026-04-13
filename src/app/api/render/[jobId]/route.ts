/**
 * GET /api/render/[jobId] — Get render job status
 * PUT /api/render/[jobId] — Update render job (retry, cancel)
 * DELETE /api/render/[jobId] — Remove job
 */
import { NextRequest, NextResponse } from "next/server";
import {
  readRenderJob,
  updateRenderJobFile,
  deleteRenderJobFile,
} from "@/lib/render-worker/job-manager";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = readRenderJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Render job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
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
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const deleted = deleteRenderJobFile(jobId);

  if (!deleted) {
    return NextResponse.json({ error: "Render job not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
