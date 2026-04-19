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
  readRenderJobAsync,
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
  console.log(`${tag}   projectId: ${job.projectId}`);
  console.log(`${tag}   outputPath: ${job.outputPath}`);

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
      let updatePayload: Record<string, unknown> = {
        render_output_key: publicUrl,
        video_url: publicUrl,
        status: "complete",
        updated_at: new Date().toISOString(),
      };

      // Auto-drop unknown columns and retry (handles missing video_url, render_output_key, etc.)
      let success = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { error } = await sb
          .from("video_projects")
          .update(updatePayload)
          .eq("id", job.projectId);

        if (!error) {
          success = true;
          console.log(`${tag} ✅ Project ${job.projectId} updated: status=complete, cols=${Object.keys(updatePayload).join(',')}`);
          break;
        }

        const m = error.message.match(/column .*?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
        const bad = m?.[1] || m?.[2];
        if (bad && bad in updatePayload) {
          console.warn(`${tag} ⚠️ Dropping unknown column "${bad}" from persist update`);
          const { [bad]: _d, ...rest } = updatePayload;
          void _d;
          updatePayload = rest;
        } else {
          console.error(`${tag} ❌ Project DB update failed: ${error.message}`);
          break;
        }
      }

      if (!success) {
        console.error(`${tag} ❌ Could not update project ${job.projectId} — run migration: GET /api/data/migrate-video-projects`);
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
  let jobId = "(unknown)";
  try {
    jobId = (await context.params).jobId;
  } catch (paramErr) {
    console.error(`${tag} ❌ Failed to extract jobId from params:`, paramErr);
    return NextResponse.json({ error: "Invalid route params" }, { status: 400 });
  }

  console.log(`${tag} ── GET /api/render/${jobId} ──`);

  try {
    // ── 1. Synchronous file read FIRST (fastest, no Supabase dependency) ──
    let job = readRenderJob(jobId);
    let source = job ? "file" : null;

    // ── 2. If not in file, try Supabase DB ──
    if (!job) {
      try {
        job = await readRenderJobAsync(jobId);
        if (job) source = "supabase";
      } catch (dbErr) {
        console.warn(`${tag} Supabase read threw (non-fatal):`, dbErr instanceof Error ? dbErr.message : dbErr);
      }
    }

    // ── 3. Last resort: brute-force file scan (different DATA_DIR) ──
    if (!job) {
      console.warn(`${tag} Not found via file or DB — trying direct file scan`);
      try {
        const { DATA_DIR: FRAMEAI_DATA_DIR } = await import("@/lib/db/paths");
        const jobDir = path.join(FRAMEAI_DATA_DIR, "render-jobs");
        const jobFile = path.join(jobDir, `${jobId}.json`);
        console.log(`${tag}   checking: ${jobFile} exists=${fs.existsSync(jobFile)}`);
        if (fs.existsSync(jobDir)) {
          const files = fs.readdirSync(jobDir).filter(f => f.endsWith(".json"));
          console.log(`${tag}   dir has ${files.length} files: ${files.slice(0, 5).join(", ")}${files.length > 5 ? "..." : ""}`);
        }
        if (fs.existsSync(jobFile)) {
          job = JSON.parse(fs.readFileSync(jobFile, "utf-8"));
          source = "direct-file";
        }
      } catch (scanErr) {
        console.error(`${tag}   direct scan error:`, scanErr instanceof Error ? scanErr.message : scanErr);
      }
    }

    if (!job) {
      console.warn(`${tag} ❌ Job ${jobId} not found anywhere (file, supabase, direct-scan)`);
      return NextResponse.json({ error: "Render job not found", jobId }, { status: 404 });
    }

    console.log(`${tag} ✅ GET ${jobId} — status=${job.status} progress=${job.progress}% (source=${source})`);

    // Ensure completed jobs are persisted to durable storage + DB
    job = await ensurePersisted(jobId, job) || job;

    return NextResponse.json({ job });
  } catch (err) {
    // Top-level catch: prevents any uncaught error from producing an opaque 404/500
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`${tag} ❌ Uncaught error in GET /api/render/${jobId}:`, msg);
    if (stack) console.error(`${tag}   stack:`, stack);
    return NextResponse.json({ error: msg, jobId }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const body = await req.json();

  const job = await readRenderJobAsync(jobId);
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
