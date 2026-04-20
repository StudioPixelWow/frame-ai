/**
 * PixelFrameAI — Render Worker
 * Standalone background process that performs real Remotion video rendering.
 * Run with: npx tsx src/lib/render-worker/worker.ts
 *
 * Status updates go to BOTH:
 *   1. Local file (for worker's own state tracking)
 *   2. Supabase render_jobs table (source of truth for polling)
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";

// Paths
const PROJECT_ROOT = process.cwd();
const REMOTION_ENTRY = path.join(PROJECT_ROOT, "src/remotion/index.ts");
const RENDER_JOBS_DIR = path.join(PROJECT_ROOT, ".frameai/data/render-jobs");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public/renders");
const BUNDLE_CACHE_DIR = path.join(PROJECT_ROOT, ".frameai/remotion-bundle");

// Ensure directories exist
[RENDER_JOBS_DIR, OUTPUT_DIR, BUNDLE_CACHE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// State
let bundlePath: string | null = null;
let isRendering = false;

/* ── Supabase client ───────────────────────────────────────────────────── */

let _sb: SupabaseClient | null = null;

function getWorkerSupabase(): SupabaseClient | null {
  if (_sb) return _sb;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://uaruggdabeyiuppcvbbi.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[Worker] Supabase env vars missing — DB updates will be skipped");
    return null;
  }
  _sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  console.log("[Worker] Supabase client initialized");
  return _sb;
}

/* ── DB update helper ──────────────────────────────────────────────────── */

/**
 * Update the render_jobs row in Supabase.
 * Uses the SAME job_id as the polling endpoint reads.
 * Fire-and-forget — never blocks rendering.
 */
async function dbUpdateJob(
  jobId: string,
  updates: { status?: string; progress?: number; stage?: string; result_url?: string; error?: string }
): Promise<void> {
  try {
    const sb = getWorkerSupabase();
    if (!sb) return;
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb
      .from("render_jobs")
      .update(payload)
      .eq("job_id", jobId);
    if (error) {
      console.warn(`[Worker] DB update failed for ${jobId}: ${error.message}`);
    } else {
      console.log(`[Worker] DB updated: ${jobId} status=${updates.status || "-"} progress=${updates.progress ?? "-"}%`);
    }
  } catch (err) {
    console.warn("[Worker] DB update error:", err instanceof Error ? err.message : err);
  }
}

/* ── Local file + DB update ────────────────────────────────────────────── */

/** Update job status: local file + Supabase */
function updateJob(jobId: string, updates: Record<string, unknown>): void {
  // 1. Update local file (synchronous)
  const jobPath = path.join(RENDER_JOBS_DIR, `${jobId}.json`);
  if (fs.existsSync(jobPath)) {
    try {
      const job = JSON.parse(fs.readFileSync(jobPath, "utf-8"));
      Object.assign(job, updates);
      fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));
    } catch { /* non-fatal */ }
  }
  console.log(`[Worker] Job ${jobId}: status=${updates.status || "-"} progress=${updates.progress || "-"}% stage=${updates.currentStage || "-"}`);

  // 2. Update Supabase (async, fire-and-forget)
  dbUpdateJob(jobId, {
    status: updates.status as string | undefined,
    progress: updates.progress as number | undefined,
    stage: updates.currentStage as string | undefined,
    result_url: updates.resultUrl as string | undefined,
    error: updates.error as string | undefined,
  }).catch(() => {});
}

/* ── Bundle ─────────────────────────────────────────────────────────────── */

async function ensureBundle(): Promise<string> {
  if (bundlePath && fs.existsSync(bundlePath)) {
    console.log("[Worker] Using cached bundle");
    return bundlePath;
  }
  console.log("[Worker] Bundling Remotion project...");
  bundlePath = await bundle({
    entryPoint: REMOTION_ENTRY,
    onProgress: (progress: number) => {
      if (progress % 20 === 0) console.log(`[Worker] Bundle progress: ${progress}%`);
    },
  });
  console.log(`[Worker] Bundle ready at: ${bundlePath}`);
  return bundlePath;
}

/* ── Render a single job ────────────────────────────────────────────────── */

async function renderJob(jobId: string): Promise<void> {
  const jobPath = path.join(RENDER_JOBS_DIR, `${jobId}.json`);
  const job = JSON.parse(fs.readFileSync(jobPath, "utf-8"));

  if (job.status !== "queued") return;

  isRendering = true;
  const outputFileName = `render-${jobId}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFileName);

  console.log(`[Worker] ═══ RENDER STARTED ═══`);
  console.log(`[Worker]   Job ID:    ${jobId}`);
  console.log(`[Worker]   Project:   ${job.projectId}`);

  try {
    // Stage 1: Preparing
    updateJob(jobId, { status: "preparing", progress: 5, currentStage: "מכין את הקומפוזיציה", startedAt: new Date().toISOString() });

    const serveUrl = await ensureBundle();
    updateJob(jobId, { progress: 15, currentStage: "טוען קבצי מקור" });

    // Stage 2: Select composition
    const inputProps = job.inputProps || {};
    const compositionId = job.compositionId || "PixelFrameEdit";
    console.log(`[Worker]   compositionId: ${compositionId}`);
    console.log(`[Worker]   videoUrl: ${inputProps.videoUrl?.substring(0, 120) || "(empty)"}`);

    let composition;
    try {
      composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
    } catch (compErr) {
      console.error(`[Worker] ❌ selectComposition FAILED:`, compErr instanceof Error ? compErr.message : compErr);
      throw compErr;
    }

    console.log(`[Worker] ✅ Composition: ${composition.width}x${composition.height}, ${composition.durationInFrames}f @ ${composition.fps}fps`);
    updateJob(jobId, { status: "rendering", progress: 20, currentStage: "מתחיל רינדור" });

    // Stage 3: Render
    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        onProgress: ({ progress }) => {
          const pct = Math.round(20 + progress * 75);
          const stage =
            progress < 0.3 ? "מעבד קטעי וידאו" :
            progress < 0.6 ? "משלב אפקטים" :
            progress < 0.9 ? "מחיל שיפורים" :
            "רינדור סופי";
          updateJob(jobId, { status: "rendering", progress: pct, currentStage: stage });
        },
      });
    } catch (renderErr) {
      console.error(`[Worker] ❌ renderMedia FAILED:`, renderErr instanceof Error ? renderErr.message : renderErr);
      throw renderErr;
    }

    // Stage 4: Finalize
    updateJob(jobId, { status: "finalizing", progress: 96, currentStage: "שומר קובץ" });

    if (!fs.existsSync(outputPath)) {
      throw new Error("Render completed but output file not found");
    }

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const resultUrl = `/renders/${outputFileName}`;

    console.log(`[Worker] ═══ RENDER FINISHED ═══`);
    console.log(`[Worker]   File: ${outputPath} (${sizeMB} MB)`);
    console.log(`[Worker]   result_url: ${resultUrl}`);

    // Final update — mark as completed with result_url
    updateJob(jobId, {
      status: "completed",
      progress: 100,
      currentStage: "הושלם",
      outputPath: resultUrl,
      completedAt: new Date().toISOString(),
    });

    // Also set result_url explicitly in Supabase (updateJob maps it)
    await dbUpdateJob(jobId, {
      status: "completed",
      progress: 100,
      stage: "הושלם",
      result_url: resultUrl,
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown render error";
    console.error(`[Worker] ═══ RENDER FAILED: ${errorMsg} ═══`);
    updateJob(jobId, { status: "failed", error: errorMsg, currentStage: "נכשל" });
    // Explicit DB update for failure
    await dbUpdateJob(jobId, { status: "failed", error: errorMsg, stage: "נכשל" });
  } finally {
    isRendering = false;
  }
}

/* ── Poll for new jobs ──────────────────────────────────────────────────── */

async function pollForJobs(): Promise<void> {
  if (isRendering) return;

  // Check local files for queued jobs
  if (!fs.existsSync(RENDER_JOBS_DIR)) return;
  const files = fs.readdirSync(RENDER_JOBS_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    try {
      const jobPath = path.join(RENDER_JOBS_DIR, file);
      const job = JSON.parse(fs.readFileSync(jobPath, "utf-8"));
      if (job.status === "queued") {
        const jobId = file.replace(".json", "");
        console.log(`[Worker] Found queued job: ${jobId}`);
        await renderJob(jobId);
        return;
      }
    } catch { /* skip */ }
  }
}

/* ── Main ───────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════");
  console.log(" PixelFrameAI Render Worker");
  console.log(` Jobs dir: ${RENDER_JOBS_DIR}`);
  console.log(` Output dir: ${OUTPUT_DIR}`);
  console.log("═══════════════════════════════════════════════");

  setInterval(pollForJobs, 2000);
  await pollForJobs();
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
