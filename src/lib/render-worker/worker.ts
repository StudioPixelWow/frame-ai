/**
 * PixelFrameAI — Render Worker
 * Standalone background process that performs real Remotion video rendering.
 * Run with: npx tsx src/lib/render-worker/worker.ts
 *
 * ALL state lives in Supabase render_jobs table.
 * Zero filesystem usage for job state — fully compatible with serverless.
 *
 * NOTE: This worker still needs a real filesystem for Remotion's bundle
 * output and the rendered video file. It is intended to run on a
 * persistent server / VM — NOT inside a Vercel function.
 * The API routes (which run on Vercel) never import this file.
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";

// Paths — only for Remotion bundle + output (worker runs on a real server)
const PROJECT_ROOT = process.cwd();
const REMOTION_ENTRY = path.join(PROJECT_ROOT, "src/remotion/index.ts");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public/renders");

// Ensure output dir exists (worker runs on a real server, not Vercel)
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
    throw new Error("[Worker] SUPABASE_SERVICE_ROLE_KEY is required");
  }
  _sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  console.log("[Worker] Supabase client initialized");
  return _sb;
}

/* ── DB helpers ────────────────────────────────────────────────────────── */

/** Update the render_jobs row in Supabase. Fire-and-forget — never blocks rendering. */
async function updateJob(
  jobId: string,
  updates: { status?: string; progress?: number; stage?: string; result_url?: string; error?: string }
): Promise<void> {
  try {
    const sb = getWorkerSupabase();
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

/** Fetch a single job row from Supabase */
async function fetchJob(jobId: string): Promise<any | null> {
  const sb = getWorkerSupabase();
  const { data, error } = await sb
    .from("render_jobs")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) {
    console.warn(`[Worker] fetchJob failed: ${error.message}`);
    return null;
  }
  return data;
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
  // Read job data from Supabase
  const job = await fetchJob(jobId);
  if (!job || job.status !== "queued") return;

  const metadata = job.metadata || {};
  const inputProps = metadata.inputProps || {};
  const compositionId = metadata.compositionId || "PixelFrameEdit";

  isRendering = true;
  const outputFileName = `render-${jobId}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFileName);

  console.log(`[Worker] ═══ RENDER STARTED ═══`);
  console.log(`[Worker]   Job ID:    ${jobId}`);
  console.log(`[Worker]   Project:   ${job.project_id}`);

  try {
    // Stage 1: Preparing
    await updateJob(jobId, { status: "preparing", progress: 5, stage: "מכין את הקומפוזיציה" });

    const serveUrl = await ensureBundle();
    await updateJob(jobId, { progress: 15, stage: "טוען קבצי מקור" });

    // Stage 2: Select composition
    console.log(`[Worker]   compositionId: ${compositionId}`);
    console.log(`[Worker]   videoUrl: ${(inputProps.videoUrl || "").substring(0, 120) || "(empty)"}`);

    let composition;
    try {
      composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
    } catch (compErr) {
      console.error(`[Worker] selectComposition FAILED:`, compErr instanceof Error ? compErr.message : compErr);
      throw compErr;
    }

    console.log(`[Worker] Composition: ${composition.width}x${composition.height}, ${composition.durationInFrames}f @ ${composition.fps}fps`);
    await updateJob(jobId, { status: "rendering", progress: 20, stage: "מתחיל רינדור" });

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
          // Fire-and-forget progress updates
          updateJob(jobId, { status: "rendering", progress: pct, stage }).catch(() => {});
        },
      });
    } catch (renderErr) {
      console.error(`[Worker] renderMedia FAILED:`, renderErr instanceof Error ? renderErr.message : renderErr);
      throw renderErr;
    }

    // Stage 4: Finalize
    await updateJob(jobId, { status: "finalizing", progress: 96, stage: "שומר קובץ" });

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
    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      stage: "הושלם",
      result_url: resultUrl,
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown render error";
    console.error(`[Worker] ═══ RENDER FAILED: ${errorMsg} ═══`);
    await updateJob(jobId, { status: "failed", error: errorMsg, stage: "נכשל" });
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
      console.warn("[Worker] Poll query failed:", error.message);
      return;
    }

    if (data && data.length > 0) {
      const jobId = data[0].job_id;
      console.log(`[Worker] Found queued job: ${jobId}`);
      await renderJob(jobId);
    }
  } catch (err) {
    console.warn("[Worker] Poll error:", err instanceof Error ? err.message : err);
  }
}

/* ── Main ───────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════");
  console.log(" PixelFrameAI Render Worker (DB-only mode)");
  console.log(` Output dir: ${OUTPUT_DIR}`);
  console.log("═══════════════════════════════════════════════");

  // Verify Supabase connection
  getWorkerSupabase();

  setInterval(pollForJobs, 3000);
  await pollForJobs();
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
