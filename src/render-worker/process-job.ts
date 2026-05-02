/**
 * Render Worker — Process a single render job
 *
 * Orchestrates: load data → bundle → render → upload → update DB
 * Uses @remotion/bundler and @remotion/renderer directly (this file
 * runs in a standalone Node process, NOT inside Next.js).
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

import { loadProjectData } from "./load-project-data";
import { uploadOutput } from "./upload-output";
import { updateJob, updateProject } from "./update-job";

const tag = "[Worker:Render]";

/** Ensure output directory exists */
function getOutputDir(): string {
  const dir = path.join(process.cwd(), "public/renders");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Cached Remotion bundle path */
let cachedBundlePath: string | null = null;

async function ensureBundle(): Promise<string> {
  if (cachedBundlePath && fs.existsSync(cachedBundlePath)) {
    console.log(`${tag} Using cached bundle`);
    return cachedBundlePath;
  }

  const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");
  if (!fs.existsSync(entryPoint)) {
    throw new Error(`Remotion entry point not found: ${entryPoint}`);
  }

  console.log(`${tag} Bundling Remotion project from: ${entryPoint}`);
  cachedBundlePath = await bundle({
    entryPoint,
    onProgress: (p: number) => {
      if (p % 20 === 0) console.log(`${tag} Bundle: ${p}%`);
    },
  });
  console.log(`${tag} ✅ Bundle ready: ${cachedBundlePath}`);
  return cachedBundlePath;
}

export async function processJob(jobId: string): Promise<void> {
  console.log(`${tag} ═══════════════════════════════════════`);
  console.log(`${tag} START RENDER: ${jobId}`);
  console.log(`${tag} ═══════════════════════════════════════`);

  const outputDir = getOutputDir();
  const outputPath = path.join(outputDir, `render-${jobId}.mp4`);

  try {
    // ── 1. Load project data ──
    const data = await loadProjectData(jobId);
    if (!data) return; // Already logged reason

    if (!data.videoUrl) {
      await updateJob(jobId, { status: "failed", error: "No video URL in project data" });
      return;
    }

    // ── 2. Mark as processing ──
    await updateJob(jobId, { status: "preparing", progress: 5, stage: "מכין את הקומפוזיציה" });

    // ── 3. Bundle ──
    const serveUrl = await ensureBundle();
    await updateJob(jobId, { progress: 15, stage: "טוען קבצי מקור" });

    // ── 4. Select composition (resolves dimensions + duration from inputProps) ──
    console.log(`${tag} Selecting composition: ${data.compositionId}`);
    console.log(`${tag}   Expected: ${data.width}x${data.height} (${data.format})`);
    console.log(`${tag}   serveUrl: ${serveUrl}`);
    console.log(`${tag}   inputProps keys: ${Object.keys(data.inputProps).join(", ")}`);

    let composition;
    try {
      composition = await selectComposition({
        serveUrl,
        id: data.compositionId,
        inputProps: data.inputProps,
      });
    } catch (compErr) {
      // Properly extract error details
      let errorMsg = "Unknown error";
      let errorStack = "";

      if (compErr instanceof Error) {
        errorMsg = compErr.message;
        errorStack = compErr.stack || "";
      } else if (typeof compErr === "object" && compErr !== null) {
        errorMsg = (compErr as any).message || (compErr as any).error || JSON.stringify(compErr);
        if ((compErr as any).stack) {
          errorStack = (compErr as any).stack;
        }
      } else {
        errorMsg = String(compErr);
      }

      console.error(`${tag} ❌ selectComposition CRASHED: ${errorMsg}`);
      if (errorStack) console.error(`${tag}   Stack: ${errorStack}`);
      throw new Error(`selectComposition failed: ${errorMsg}`);
    }

    console.log(
      `${tag} ✅ Composition resolved: ${composition.width}x${composition.height}, ` +
      `${composition.durationInFrames}f @ ${composition.fps}fps ` +
      `(${(composition.durationInFrames / composition.fps).toFixed(1)}s)`,
    );

    // ── 5. Render ──
    await updateJob(jobId, { status: "rendering", progress: 20, stage: "מתחיל רינדור" });

    console.log(`${tag} renderMedia → ${outputPath}`);
    console.log(`${tag}   format:     ${data.format}`);
    console.log(`${tag}   dimensions: ${composition.width}x${composition.height}`);
    console.log(`${tag}   duration:   ${(composition.durationInFrames / composition.fps).toFixed(1)}s`);

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: data.inputProps,
      onProgress: ({ progress }) => {
        const pct = Math.round(20 + progress * 65);
        const stage =
          progress < 0.3 ? "מעבד קטעי וידאו" :
          progress < 0.6 ? "משלב אפקטים וכתוביות" :
          progress < 0.9 ? "מחיל שיפורים פרימיום" :
          "רינדור סופי";
        updateJob(jobId, { status: "rendering", progress: pct, stage }).catch(() => {});
      },
    });

    console.log(`${tag} ✅ Render complete`);

    // ── 6. Upload ──
    await updateJob(jobId, { progress: 90, stage: "מעלה קובץ סופי" });

    const upload = await uploadOutput(outputPath, data.projectId, data.videoUrl);

    // ── 7. Mark job done ──
    await updateJob(jobId, {
      status: "done",
      progress: 100,
      stage: "הושלם",
      result_url: upload.publicUrl,
      error: null,
    });
    console.log(`${tag} ✅ render_jobs updated: result_url=${upload.publicUrl}`);

    // ── 8. Update video_projects ──
    await updateProject(data.projectId, upload.publicUrl, jobId);

    // ── Summary ──
    console.log(`${tag} ═══════════════════════════════════════`);
    console.log(`${tag} ✅ RENDER COMPLETE`);
    console.log(`${tag}   jobId:      ${jobId}`);
    console.log(`${tag}   projectId:  ${data.projectId}`);
    console.log(`${tag}   source:     ${data.videoUrl.substring(0, 100)}`);
    console.log(`${tag}   output:     ${upload.publicUrl}`);
    console.log(`${tag}   size:       ${(upload.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`${tag}   format:     ${data.format} (${composition.width}x${composition.height})`);
    console.log(`${tag}   duration:   ${(composition.durationInFrames / composition.fps).toFixed(1)}s`);
    console.log(`${tag} ═══════════════════════════════════════`);

  } catch (err) {
    let errorMsg = "Unknown render error";
    let errorStack = "";

    if (err instanceof Error) {
      errorMsg = err.message;
      errorStack = err.stack || "";
    } else if (typeof err === "object" && err !== null) {
      errorMsg = (err as any).message || (err as any).error || JSON.stringify(err);
      if ((err as any).stack) {
        errorStack = (err as any).stack;
      }
    } else {
      errorMsg = String(err);
    }

    console.error(`${tag} ❌ RENDER FAILED: ${errorMsg}`);
    if (errorStack) console.error(`${tag}   Stack: ${errorStack}`);
    await updateJob(jobId, { status: "failed", error: errorMsg.substring(0, 1000), stage: "נכשל" }).catch(() => {});
  } finally {
    // Clean up local file
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { /* */ }
  }
}
