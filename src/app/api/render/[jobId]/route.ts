/**
 * GET /api/render/[jobId] — Poll render job status + check Lambda progress
 * PUT /api/render/[jobId] — Update render job (retry, cancel)
 * DELETE /api/render/[jobId] — Remove job
 *
 * The GET handler does the actual Lambda progress checking:
 *   - If status is "rendering" and we have renderId/bucketName in metadata,
 *     it calls getRenderProgress to get real-time Lambda progress
 *   - When Lambda finishes, it saves the S3 output URL and marks the job done
 *   - Each poll is a short-lived request — fully Vercel-compatible
 */
import { NextRequest, NextResponse } from "next/server";
import {
  readRenderJob,
  updateRenderJob,
  deleteRenderJob,
} from "@/lib/render-worker/job-manager";
import { getRenderProgress } from "@remotion/lambda/client";
import { getSupabase } from "@/lib/db/store";

const tag = "[render/jobId]";

/* ── Ensure AWS SDK can find credentials ──────────────────────────── */
function ensureAwsEnv() {
  if (process.env.REMOTION_AWS_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID) {
    process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
  }
  if (process.env.REMOTION_AWS_SECRET_ACCESS_KEY && !process.env.AWS_SECRET_ACCESS_KEY) {
    process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
  }
  if (process.env.REMOTION_AWS_REGION && !process.env.AWS_REGION) {
    process.env.AWS_REGION = process.env.REMOTION_AWS_REGION;
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

  try {
    const job = await readRenderJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Render job not found", jobId }, { status: 404 });
    }

    // ── If the job is actively rendering, check Lambda progress ──
    if (
      ["rendering", "processing"].includes(job.status) &&
      job.metadata?.renderId &&
      job.metadata?.bucketName
    ) {
      try {
        ensureAwsEnv();
        const region = process.env.REMOTION_AWS_REGION || "us-east-1";
        const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME || "";

        const progress = await getRenderProgress({
          renderId: job.metadata.renderId as string,
          bucketName: job.metadata.bucketName as string,
          functionName,
          region: region as "us-east-1",
        });

        const pct = Math.round((progress.overallProgress ?? 0) * 100);

        if (progress.done && progress.outputFile) {
          // ── Lambda finished! Save the S3 URL and mark done ──
          console.log(`${tag} ✅ Render complete for ${jobId}: ${progress.outputFile}`);

          await updateRenderJob(jobId, {
            status: "done",
            progress: 100,
            stage: "הושלם",
            result_url: progress.outputFile,
          });

          // Also update the video project with the rendered output URL
          // IMPORTANT: write to render_output_key + video_url (the columns the detail page reads)
          try {
            const sb = getSupabase();
            await sb.from("video_projects").update({
              status: "completed",
              render_output_key: progress.outputFile,
              video_url: progress.outputFile,
              render_job_id: jobId,
              updated_at: new Date().toISOString(),
            }).eq("id", job.project_id);
          } catch { /* non-fatal */ }

          return NextResponse.json({
            job: {
              id: jobId,
              projectId: job.project_id,
              status: "completed",
              progress: 100,
              currentStage: "הושלם",
              publicUrl: progress.outputFile,
            },
          });
        }

        if (progress.fatalErrorEncountered) {
          const errMsg = progress.errors?.[0]?.message || "Lambda render error";
          console.error(`${tag} ❌ Fatal error for ${jobId}: ${errMsg}`);

          await updateRenderJob(jobId, {
            status: "error",
            error: errMsg,
            stage: "שגיאת Lambda",
            progress: pct,
          });

          try {
            const sb = getSupabase();
            await sb.from("video_projects").update({
              status: "error",
              updated_at: new Date().toISOString(),
            }).eq("id", job.project_id);
          } catch { /* non-fatal */ }

          return NextResponse.json({
            job: {
              id: jobId,
              projectId: job.project_id,
              status: "failed",
              progress: pct,
              currentStage: "שגיאת Lambda",
              error: errMsg,
            },
          });
        }

        // ── Still rendering — update progress and return ──
        const stage = `רינדור ${pct}%`;
        await updateRenderJob(jobId, {
          progress: Math.min(pct, 95),
          stage,
        });

        return NextResponse.json({
          job: {
            id: jobId,
            projectId: job.project_id,
            status: "rendering",
            progress: Math.min(pct, 95),
            currentStage: stage,
          },
        });
      } catch (progressErr) {
        // getRenderProgress failed — return last known DB state
        console.warn(`${tag} ⚠️ getRenderProgress error: ${progressErr instanceof Error ? progressErr.message : progressErr}`);
      }
    }

    // ── Return DB state as-is (for done/failed/queued jobs, or if progress check failed) ──
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
