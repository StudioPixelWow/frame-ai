/**
 * PixelFrameAI — Render Worker
 * Standalone background process that performs real Remotion video rendering.
 * Run with: npx tsx src/lib/render-worker/worker.ts
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
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

/** Update job status on disk */
function updateJobFile(jobId: string, updates: Record<string, unknown>): void {
  const jobPath = path.join(RENDER_JOBS_DIR, `${jobId}.json`);
  if (!fs.existsSync(jobPath)) return;
  const job = JSON.parse(fs.readFileSync(jobPath, "utf-8"));
  Object.assign(job, updates);
  fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));
  console.log(`[Worker] Job ${jobId}: ${updates.status || ""} ${updates.progress || ""}% — ${updates.currentStage || ""}`);
}

/** Bundle the Remotion project (cached) */
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

/** Render a single job */
async function renderJob(jobId: string): Promise<void> {
  const jobPath = path.join(RENDER_JOBS_DIR, `${jobId}.json`);
  const job = JSON.parse(fs.readFileSync(jobPath, "utf-8"));

  if (job.status !== "queued") return;

  isRendering = true;
  const outputFileName = `render-${jobId}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFileName);

  try {
    // Stage 1: Preparing
    updateJobFile(jobId, {
      status: "preparing",
      progress: 5,
      currentStage: "מכין את הקומפוזיציה",
      startedAt: new Date().toISOString(),
    });

    const serveUrl = await ensureBundle();

    updateJobFile(jobId, {
      progress: 15,
      currentStage: "טוען קבצי מקור",
    });

    // Stage 2: Select composition
    const inputProps = job.inputProps || {};
    const compositionId = job.compositionId || "PixelFrameEdit";
    console.log(`[Worker] Selecting composition ${compositionId} with props:`, JSON.stringify(inputProps).slice(0, 200));

    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps,
    });

    console.log(`[Worker] Composition selected: ${composition.width}x${composition.height}, ${composition.durationInFrames} frames @ ${composition.fps}fps`);

    updateJobFile(jobId, {
      status: "rendering",
      progress: 20,
      currentStage: "מתחיל רינדור",
    });

    // Stage 3: Render
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      onProgress: ({ progress }) => {
        const pct = Math.round(20 + progress * 75);
        const stage =
          progress < 0.15 ? "מעבד קטעי וידאו" :
          progress < 0.3 ? "מוסיף כתוביות" :
          progress < 0.45 ? "משלב B-Roll" :
          progress < 0.6 ? "מחיל מעברים ואפקטים" :
          progress < 0.75 ? "מוסיף מוזיקה ואודיו" :
          progress < 0.9 ? "מחיל שיפורים פרימיום" :
          "רינדור סופי";

        updateJobFile(jobId, {
          status: "rendering",
          progress: pct,
          currentStage: stage,
        });
      },
    });

    // Stage 4: Finalize
    updateJobFile(jobId, {
      status: "finalizing",
      progress: 96,
      currentStage: "שומר קובץ",
    });

    // Verify output exists
    if (!fs.existsSync(outputPath)) {
      throw new Error("Render completed but output file not found");
    }

    const stats = fs.statSync(outputPath);
    console.log(`[Worker] Render complete: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    updateJobFile(jobId, {
      status: "completed",
      progress: 100,
      currentStage: "הושלם",
      outputPath: `/renders/${outputFileName}`,
      completedAt: new Date().toISOString(),
      actualDurationSec: Math.round((Date.now() - new Date(job.startedAt || job.createdAt).getTime()) / 1000),
      outputFileSizeBytes: stats.size,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown render error";
    console.error(`[Worker] Render failed for job ${jobId}:`, errorMsg);
    updateJobFile(jobId, {
      status: "failed",
      error: errorMsg,
      currentStage: "נכשל",
    });
  } finally {
    isRendering = false;
  }
}

/** Poll for new jobs */
async function pollForJobs(): Promise<void> {
  if (isRendering) return;

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
        return; // Process one at a time
      }
    } catch {
      // Skip malformed files
    }
  }
}

/** Main loop */
async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════");
  console.log(" PixelFrameAI Render Worker");
  console.log(" Watching for render jobs...");
  console.log(`  Jobs dir: ${RENDER_JOBS_DIR}`);
  console.log(`  Output dir: ${OUTPUT_DIR}`);
  console.log("═══════════════════════════════════════════════");

  // Poll every 2 seconds
  setInterval(pollForJobs, 2000);

  // Initial poll
  await pollForJobs();
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
