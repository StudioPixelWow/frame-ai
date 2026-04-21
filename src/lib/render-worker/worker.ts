// ── Production guard: prevent this worker from running on Vercel ──
if (process.env.NODE_ENV === "production") {
  console.log("Worker disabled in production (Vercel). Use Railway or a dedicated server.");
  process.exit(0);
}

/**
 * PixelFrameAI — Render Worker
 * Standalone background process that performs REAL Remotion video rendering.
 * Run with: npx tsx src/lib/render-worker/worker.ts
 *
 * Flow:
 *   1. Polls Supabase render_jobs for "queued" jobs
 *   2. Bundles Remotion project
 *   3. Renders via renderMedia() (real FFmpeg-based encoding)
 *   4. Uploads the rendered MP4 to Supabase Storage (outputs/{projectId}_{ts}.mp4)
 *   5. Updates render_jobs.result_url with the Supabase public URL
 *   6. Updates video_projects with video_url + render_output_key
 *   7. Verifies the DB write
 *
 * NOTE: Requires a persistent server/VM with:
 *   - Node.js filesystem access (for Remotion bundle + rendered output)
 *   - FFmpeg installed (used internally by @remotion/renderer)
 *   - SUPABASE_SERVICE_ROLE_KEY env var
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";

const tag = "[Worker]";

// Paths — only for Remotion bundle + output (worker runs on a real server)
const PROJECT_ROOT = process.cwd();
const REMOTION_ENTRY = path.join(PROJECT_ROOT, "src/remotion/index.ts");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public/renders");
const BUCKET = "project-files";

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// State
let bundlePath: string | null = null;
let isRendering = false;

/* ── Supabase client ───────────────────────────────────────────────────── */

let _sb: SupabaseClient | null = null;

function getWorkerSupabase(): SupabaseClient {
  if (_sb) return _sb;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://uaruggdabeyiuppcvbbi.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(`${tag} SUPABASE_SERVICE_ROLE_KEY is required`);
  }
  _sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  console.log(`${tag} Supabase client initialized`);
  return _sb;
}

/* ── DB helpers ────────────────────────────────────────────────────────── */

async function updateJob(
  jobId: string,
  updates: { status?: string; progress?: number; stage?: string; result_url?: string; error?: string }
): Promise<void> {
  try {
    const sb = getWorkerSupabase();
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const { error } = await sb.from("render_jobs").update(payload).eq("job_id", jobId);
    if (error) {
      console.warn(`${tag} DB update failed for ${jobId}: ${error.message}`);
    } else {
      console.log(`${tag} DB updated: ${jobId} status=${updates.status || "-"} progress=${updates.progress ?? "-"}%`);
    }
  } catch (err) {
    console.warn(`${tag} DB update error:`, err instanceof Error ? err.message : err);
  }
}

async function fetchJob(jobId: string): Promise<any | null> {
  const sb = getWorkerSupabase();
  const { data, error } = await sb.from("render_jobs").select("*").eq("job_id", jobId).maybeSingle();
  if (error) {
    console.warn(`${tag} fetchJob failed: ${error.message}`);
    return null;
  }
  return data;
}

/* ── Bundle ─────────────────────────────────────────────────────────────── */

async function ensureBundle(): Promise<string> {
  if (bundlePath && fs.existsSync(bundlePath)) {
    console.log(`${tag} Using cached bundle`);
    return bundlePath;
  }
  console.log(`${tag} Bundling Remotion project...`);
  bundlePath = await bundle({
    entryPoint: REMOTION_ENTRY,
    onProgress: (progress: number) => {
      if (progress % 20 === 0) console.log(`${tag} Bundle progress: ${progress}%`);
    },
  });
  console.log(`${tag} Bundle ready at: ${bundlePath}`);
  return bundlePath;
}

/* ── Extract storage path from public URL ──────────────────────────────── */

function extractStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(publicUrl.substring(idx + marker.length));
  return null;
}

/* ── Render a single job ────────────────────────────────────────────────── */

async function renderJob(jobId: string): Promise<void> {
  const job = await fetchJob(jobId);
  if (!job || job.status !== "queued") return;

  const metadata = job.metadata || {};
  const inputProps = metadata.inputProps || {};
  const compositionId = metadata.compositionId || "PixelFrameEdit";
  const sourceVideoUrl: string = inputProps.videoUrl || metadata.videoUrl || "";
  const projectId = job.project_id || "unknown";

  isRendering = true;
  const outputFileName = `render-${jobId}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFileName);

  console.log(`${tag} ═══════════════════════════════════════`);
  console.log(`${tag} START RENDER`);
  console.log(`${tag}   Job ID:      ${jobId}`);
  console.log(`${tag}   Project:     ${projectId}`);
  console.log(`${tag}   Source URL:  ${sourceVideoUrl.substring(0, 150)}`);
  console.log(`${tag}   Format:      ${inputProps.format || metadata.outputFormat || "9:16"}`);
  console.log(`${tag}   Duration:    ${inputProps.durationSec || "unknown"}s`);
  console.log(`${tag}   OUTPUT PATH: ${outputPath}`);
  console.log(`${tag} ═══════════════════════════════════════`);

  try {
    // ── Stage 1: Preparing ──
    await updateJob(jobId, { status: "preparing", progress: 5, stage: "מכין את הקומפוזיציה" });

    const serveUrl = await ensureBundle();
    await updateJob(jobId, { progress: 15, stage: "טוען קבצי מקור" });

    // ── Stage 2: Select composition ──
    console.log(`${tag} Selecting composition: ${compositionId}`);
    let composition;
    try {
      composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
    } catch (compErr) {
      console.error(`${tag} selectComposition FAILED:`, compErr instanceof Error ? compErr.message : compErr);
      throw compErr;
    }

    console.log(`${tag} Composition resolved: ${composition.width}x${composition.height}, ${composition.durationInFrames}f @ ${composition.fps}fps`);
    await updateJob(jobId, { status: "rendering", progress: 20, stage: "מתחיל רינדור" });

    // ── Stage 3: REAL Remotion render ──
    console.log(`${tag} Starting renderMedia...`);
    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        onProgress: ({ progress }) => {
          const pct = Math.round(20 + progress * 70);
          const stage =
            progress < 0.3 ? "מעבד קטעי וידאו" :
            progress < 0.6 ? "משלב אפקטים" :
            progress < 0.9 ? "מחיל שיפורים" :
            "רינדור סופי";
          updateJob(jobId, { status: "rendering", progress: pct, stage }).catch(() => {});
        },
      });
    } catch (renderErr) {
      console.error(`${tag} renderMedia FAILED:`, renderErr instanceof Error ? renderErr.message : renderErr);
      throw renderErr;
    }

    // ── Stage 4: Validate rendered output ──
    await updateJob(jobId, { status: "finalizing", progress: 92, stage: "מאמת קובץ" });

    if (!fs.existsSync(outputPath)) {
      throw new Error("Render completed but output file not found on disk");
    }

    const stats = fs.statSync(outputPath);
    const renderedSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`${tag} RENDER DONE`);
    console.log(`${tag} OUTPUT PATH: ${outputPath}`);
    console.log(`${tag}   Rendered size:  ${renderedSizeMB} MB`);
    console.log(`${tag}   Render width:   ${composition.width}`);
    console.log(`${tag}   Render height:  ${composition.height}`);
    console.log(`${tag}   Render frames:  ${composition.durationInFrames}`);
    console.log(`${tag}   Render FPS:     ${composition.fps}`);
    console.log(`${tag}   Render duration: ${(composition.durationInFrames / composition.fps).toFixed(1)}s`);

    if (stats.size < 1024) {
      throw new Error(`Rendered file is suspiciously small: ${stats.size} bytes — render likely failed`);
    }

    // ── Stage 5: Upload rendered file to Supabase Storage ──
    await updateJob(jobId, { progress: 94, stage: "מעלה קובץ סופי" });

    const storagePath = `outputs/${projectId}_${Date.now()}.mp4`;
    const fileBuffer = fs.readFileSync(outputPath);

    console.log(`${tag} Uploading rendered file to Storage: ${storagePath} (${renderedSizeMB} MB)`);

    const sb = getWorkerSupabase();
    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, { contentType: "video/mp4", upsert: true });

    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`);
    }

    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
    const outputUrl = urlData?.publicUrl || "";

    if (!outputUrl) {
      throw new Error("Upload succeeded but getPublicUrl returned empty");
    }

    console.log(`${tag} UPLOADED OUTPUT URL: ${outputUrl}`);

    // ── Validate output URL differs from source ──
    if (sourceVideoUrl) {
      const sourcePath = extractStoragePath(sourceVideoUrl);
      const outputPathInStorage = extractStoragePath(outputUrl);
      if (sourcePath && outputPathInStorage && sourcePath === outputPathInStorage) {
        throw new Error(`CRITICAL: Output storage path equals source path — not a new rendered file`);
      }
      if (outputUrl === sourceVideoUrl) {
        throw new Error(`CRITICAL: Output URL equals source URL — rendered file was not uploaded correctly`);
      }
      console.log(`${tag} ✅ Output URL differs from source URL — confirmed new rendered file`);
    }

    // ── Stage 6: Save to render_jobs ──
    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      stage: "הושלם",
      result_url: outputUrl,
    });
    console.log(`${tag} ✅ render_jobs updated: result_url=${outputUrl.substring(0, 100)}`);

    // ── Stage 7: Save to video_projects — CRITICAL ──
    if (job.project_id) {
      console.log(`${tag} SAVING TO PROJECT: ${job.project_id}`);

      const now = new Date().toISOString();
      const updatePayload = {
        status: "complete",
        video_url: outputUrl,
        render_output_key: outputUrl,
        render_job_id: jobId,
        rendered_at: now,
        updated_at: now,
      };

      const { data: updateData, error: updateErr } = await sb
        .from("video_projects")
        .update(updatePayload)
        .eq("id", job.project_id)
        .select("id, status, video_url, render_output_key")
        .maybeSingle();

      if (updateErr) {
        console.error(`${tag} ❌ video_projects update ERROR:`, updateErr.message);

        // If a column doesn't exist, retry without it
        const colMatch = updateErr.message.match(/column.*['"]?([a-z_]+)['"]?.*does not exist/i);
        if (colMatch) {
          const badCol = colMatch[1];
          console.warn(`${tag} ⚠️ Column "${badCol}" missing — retrying without it`);
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
        console.log(`${tag} ✅ PROJECT UPDATED: ${JSON.stringify(updateData)}`);
      }

      // ── VERIFY: read back the project ──
      const { data: verifyRow, error: verifyErr } = await sb
        .from("video_projects")
        .select("id, status, video_url, render_output_key")
        .eq("id", job.project_id)
        .maybeSingle();

      if (verifyErr) {
        console.warn(`${tag} ⚠️ Verify select failed: ${verifyErr.message}`);
      } else if (verifyRow) {
        const savedUrl = (verifyRow as any).video_url || (verifyRow as any).render_output_key;
        console.log(`${tag} VERIFY: video_url=${(verifyRow as any).video_url || "(null)"} render_output_key=${(verifyRow as any).render_output_key || "(null)"} status=${(verifyRow as any).status}`);

        if (!savedUrl) {
          console.error(`${tag} ❌ CRITICAL: Output URL NOT saved to video_projects!`);
          console.error(`${tag}   Run: ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS video_url TEXT;`);
          console.error(`${tag}   Run: ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS render_output_key TEXT;`);
        } else if (savedUrl !== outputUrl) {
          console.error(`${tag} ❌ MISMATCH: saved=${savedUrl.substring(0, 80)} expected=${outputUrl.substring(0, 80)}`);
        } else {
          console.log(`${tag} ✅ VERIFIED: DB video_url matches rendered output URL`);
        }
      } else {
        console.error(`${tag} ❌ Project ${job.project_id} not found after update!`);
      }
    } else {
      console.error(`${tag} ❌ No project_id on job — cannot update video_projects`);
    }

    // ── Clean up local rendered file ──
    try {
      fs.unlinkSync(outputPath);
      console.log(`${tag} Cleaned up local file: ${outputPath}`);
    } catch { /* non-critical */ }

    console.log(`${tag} ═══════════════════════════════════════`);
    console.log(`${tag} RENDER COMPLETE SUMMARY`);
    console.log(`${tag}   jobId:      ${jobId}`);
    console.log(`${tag}   projectId:  ${projectId}`);
    console.log(`${tag}   source:     ${sourceVideoUrl.substring(0, 120)}`);
    console.log(`${tag}   output:     ${outputUrl}`);
    console.log(`${tag}   size:       ${renderedSizeMB} MB`);
    console.log(`${tag}   dimensions: ${composition.width}x${composition.height}`);
    console.log(`${tag}   duration:   ${(composition.durationInFrames / composition.fps).toFixed(1)}s`);
    console.log(`${tag}   storage:    bucket="${BUCKET}" path="${storagePath}"`);
    console.log(`${tag} ═══════════════════════════════════════`);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown render error";
    console.error(`${tag} ═══ RENDER FAILED: ${errorMsg} ═══`);
    await updateJob(jobId, { status: "failed", error: errorMsg, stage: "נכשל" });

    // Clean up partial output
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { /* */ }
  } finally {
    isRendering = false;
  }
}

/* ── Poll for new jobs (from Supabase) ─────────────────────────────────── */

async function pollForJobs(): Promise<void> {
  if (isRendering) return;

  try {
    const sb = getWorkerSupabase();
    const { data, error } = await sb
      .from("render_jobs")
      .select("job_id")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      console.warn(`${tag} Poll query failed:`, error.message);
      return;
    }

    if (data && data.length > 0) {
      const jobId = data[0].job_id;
      console.log(`${tag} Found queued job: ${jobId}`);
      await renderJob(jobId);
    }
  } catch (err) {
    console.warn(`${tag} Poll error:`, err instanceof Error ? err.message : err);
  }
}

/* ── Main ───────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════");
  console.log(" PixelFrameAI Render Worker (Real Remotion)");
  console.log(` Output dir: ${OUTPUT_DIR}`);
  console.log(` Storage bucket: ${BUCKET}`);
  console.log("═══════════════════════════════════════════════");

  // Verify Supabase connection
  getWorkerSupabase();

  setInterval(pollForJobs, 3000);
  await pollForJobs();
}

main().catch((err) => {
  console.error(`${tag} Fatal error:`, err);
  process.exit(1);
});
