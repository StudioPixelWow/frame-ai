/**
 * PixelFrameAI — Serverless Render Job Processor
 *
 * Called via `after()` from POST /api/render after the response is sent.
 * Performs REAL Remotion rendering using @remotion/bundler + @remotion/renderer.
 *
 * Flow:
 *   1. Reads job from Supabase (metadata.inputProps contains all edit data)
 *   2. Bundles the Remotion project (src/remotion/index.ts)
 *   3. Selects the composition (PixelFrameEdit) with the project's inputProps
 *   4. Renders via renderMedia() — real FFmpeg-based video encoding
 *   5. Uploads the rendered MP4 to Supabase Storage (outputs/{projectId}_{ts}.mp4)
 *   6. Updates render_jobs: queued → rendering → uploading → completed
 *   7. Updates video_projects with video_url, render_output_key, rendered_at
 *
 * Requirements:
 *   - FFmpeg must be available (standard on Railway, Render, Docker, local dev)
 *   - Node.js filesystem access for Remotion bundle + temporary output
 *   - SUPABASE_SERVICE_ROLE_KEY env var
 *
 * Status flow: queued → preparing → rendering → finalizing → done (or → failed)
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readRenderJob, updateRenderJob, type RenderJobRow } from "./job-manager";
import { getSupabase } from "@/lib/db/store";
import path from "path";
import fs from "fs";

const tag = "[ProcessJob]";
const BUCKET = "project-files";

// Paths — relative to project root
const PROJECT_ROOT = process.cwd();
const REMOTION_ENTRY = path.join(PROJECT_ROOT, "src/remotion/index.ts");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public/renders");

// Ensure output dir exists
try {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
} catch {
  // On read-only filesystems (Vercel), use /tmp
}

// Use /tmp as fallback output dir on serverless
function getOutputDir(): string {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    // Test write access
    const testFile = path.join(OUTPUT_DIR, ".write-test");
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return OUTPUT_DIR;
  } catch {
    const tmpDir = "/tmp/pixelframe-renders";
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
  }
}

export async function processRenderJob(jobId: string): Promise<void> {
  console.log(`${tag} ════════════════════════════════════════`);
  console.log(`${tag} START processRenderJob jobId=${jobId}`);
  console.log(`${tag} ════════════════════════════════════════`);

  let job: RenderJobRow | null = null;

  try {
    // ── 1. Read job from DB ──
    job = await readRenderJob(jobId);
    if (!job) {
      console.error(`${tag} ❌ Job ${jobId} not found in render_jobs table`);
      return;
    }

    console.log(`${tag} Job found: status=${job.status} project_id=${job.project_id}`);

    // Don't re-process jobs that are already done or in progress
    if (job.status !== "queued") {
      console.log(`${tag} ⏭ Job ${jobId} is already '${job.status}', skipping`);
      return;
    }

    const metadata = (job.metadata ?? {}) as Record<string, unknown>;
    const inputProps = (metadata.inputProps as Record<string, unknown>) || {};
    const compositionId = (metadata.compositionId as string) || "PixelFrameEdit";
    const videoUrl = (inputProps.videoUrl as string) || (metadata.videoUrl as string) || "";
    const projectId = job.project_id;

    // ── LOG: Full composition props being passed to render ──
    console.log(`${tag} ═══ RENDER INPUT PROPS ═══`);
    console.log(`${tag}   projectId:       ${projectId}`);
    console.log(`${tag}   compositionId:   ${compositionId}`);
    console.log(`${tag}   videoUrl:        ${videoUrl.substring(0, 120)}`);
    console.log(`${tag}   format:          ${inputProps.format || metadata.outputFormat || "?"}`);
    console.log(`${tag}   durationSec:     ${inputProps.durationSec || "?"}`);
    console.log(`${tag}   trimStart:       ${inputProps.trimStart || 0}`);
    console.log(`${tag}   trimEnd:         ${inputProps.trimEnd || 0}`);
    console.log(`${tag}   segments count:  ${Array.isArray(inputProps.segments) ? (inputProps.segments as unknown[]).length : 0}`);
    console.log(`${tag}   broll count:     ${Array.isArray(inputProps.brollPlacements) ? (inputProps.brollPlacements as unknown[]).length : 0}`);
    console.log(`${tag}   transition:      ${JSON.stringify(inputProps.transition || {})}`);
    console.log(`${tag}   subtitleStyle:   ${JSON.stringify(inputProps.subtitleStyle || {}).substring(0, 100)}`);
    console.log(`${tag}   music enabled:   ${(inputProps.music as any)?.enabled ?? false}`);
    console.log(`${tag}   visual:          ${JSON.stringify(inputProps.visual || {})}`);
    console.log(`${tag}   premium:         ${JSON.stringify(inputProps.premium || {})}`);
    console.log(`${tag}   zoomKeyframes:   ${Array.isArray(inputProps.zoomKeyframes) ? (inputProps.zoomKeyframes as unknown[]).length : 0}`);
    console.log(`${tag}   hookBoost:       ${JSON.stringify(inputProps.hookBoost || {})}`);
    console.log(`${tag}   cleanupCuts:     ${Array.isArray(inputProps.cleanupCuts) ? (inputProps.cleanupCuts as unknown[]).length : 0}`);
    console.log(`${tag}   quality:         ${metadata.quality || "?"}`);
    console.log(`${tag}   outputFormat:    ${metadata.outputFormat || "?"}`);
    console.log(`${tag}   outputWidth:     ${metadata.outputWidth || "?"}`);
    console.log(`${tag}   outputHeight:    ${metadata.outputHeight || "?"}`);
    console.log(`${tag} ═══════════════════════════`);

    if (!videoUrl) {
      await failJob(jobId, "No videoUrl in job metadata — cannot render");
      return;
    }

    if (videoUrl.startsWith("blob:")) {
      await failJob(jobId, "Video URL is a blob: URL — must be a public https URL");
      return;
    }

    // ── 2. Transition to "preparing" ──
    await updateRenderJob(jobId, {
      status: "rendering",
      progress: 5,
      stage: "מכין את הקומפוזיציה",
    });
    console.log(`${tag} ✅ Status → preparing (5%)`);

    // ── 3. Bundle Remotion project ──
    console.log(`${tag} Bundling Remotion project from: ${REMOTION_ENTRY}`);

    if (!fs.existsSync(REMOTION_ENTRY)) {
      await failJob(jobId, `Remotion entry point not found: ${REMOTION_ENTRY}`);
      return;
    }

    let serveUrl: string;
    try {
      serveUrl = await bundle({
        entryPoint: REMOTION_ENTRY,
        onProgress: (progress: number) => {
          if (progress % 25 === 0) {
            console.log(`${tag} Bundle progress: ${progress}%`);
          }
        },
      });
      console.log(`${tag} ✅ Bundle ready at: ${serveUrl}`);
    } catch (bundleErr) {
      const msg = bundleErr instanceof Error ? bundleErr.message : String(bundleErr);
      await failJob(jobId, `Remotion bundle failed: ${msg}`);
      return;
    }

    await updateRenderJob(jobId, {
      progress: 15,
      stage: "טוען קבצי מקור",
    });

    // ── 4. Select composition with inputProps ──
    console.log(`${tag} Selecting composition: ${compositionId} with project inputProps`);

    let composition;
    try {
      composition = await selectComposition({
        serveUrl,
        id: compositionId,
        inputProps,
      });
      console.log(`${tag} ✅ Composition resolved: ${composition.width}x${composition.height}, ${composition.durationInFrames}f @ ${composition.fps}fps`);
    } catch (compErr) {
      const msg = compErr instanceof Error ? compErr.message : String(compErr);
      await failJob(jobId, `selectComposition failed: ${msg}`);
      return;
    }

    await updateRenderJob(jobId, {
      status: "rendering",
      progress: 20,
      stage: "מתחיל רינדור",
    });

    // ── 5. REAL Remotion renderMedia ──
    const outputDir = getOutputDir();
    const outputPath = path.join(outputDir, `render-${jobId}.mp4`);
    console.log(`${tag} Starting renderMedia → ${outputPath}`);
    console.log(`${tag}   Dimensions: ${composition.width}x${composition.height}`);
    console.log(`${tag}   Duration: ${composition.durationInFrames} frames @ ${composition.fps}fps = ${(composition.durationInFrames / composition.fps).toFixed(1)}s`);

    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        onProgress: ({ progress }) => {
          const pct = Math.round(20 + progress * 65);
          const stage =
            progress < 0.3 ? "מעבד קטעי וידאו" :
            progress < 0.6 ? "משלב אפקטים וכתוביות" :
            progress < 0.9 ? "מחיל שיפורים פרימיום" :
            "רינדור סופי";
          // Fire-and-forget progress updates
          updateRenderJob(jobId, { status: "rendering", progress: pct, stage }).catch(() => {});
        },
      });
    } catch (renderErr) {
      const msg = renderErr instanceof Error ? renderErr.message : String(renderErr);
      console.error(`${tag} ❌ renderMedia FAILED:`, msg);
      if (renderErr instanceof Error && renderErr.stack) {
        console.error(`${tag}   stack:`, renderErr.stack);
      }
      await failJob(jobId, `Remotion renderMedia failed: ${msg}`);
      // Clean up partial output
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { /* */ }
      return;
    }

    // ── 6. Validate rendered output ──
    await updateRenderJob(jobId, {
      progress: 88,
      stage: "מאמת קובץ פלט",
    });

    if (!fs.existsSync(outputPath)) {
      await failJob(jobId, "Render completed but output file not found on disk");
      return;
    }

    const stats = fs.statSync(outputPath);
    const renderedSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`${tag} ✅ RENDER DONE: ${renderedSizeMB} MB at ${outputPath}`);

    if (stats.size < 1024) {
      await failJob(jobId, `Rendered file suspiciously small: ${stats.size} bytes — render likely failed`);
      try { fs.unlinkSync(outputPath); } catch { /* */ }
      return;
    }

    // ── 7. Upload to Supabase Storage ──
    await updateRenderJob(jobId, {
      progress: 92,
      stage: "מעלה קובץ סופי",
    });

    const storagePath = `outputs/${projectId}_${Date.now()}.mp4`;
    const fileBuffer = fs.readFileSync(outputPath);
    console.log(`${tag} Uploading rendered file: bucket=${BUCKET} path=${storagePath} size=${renderedSizeMB}MB`);

    const sb = getSupabase();
    const { error: uploadError } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      await failJob(jobId, `Upload to Supabase Storage failed: ${uploadError.message}`);
      try { fs.unlinkSync(outputPath); } catch { /* */ }
      return;
    }

    console.log(`${tag} ✅ Upload succeeded: ${storagePath}`);

    // ── 8. Get public URL ──
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
    const outputUrl = urlData?.publicUrl || "";

    if (!outputUrl) {
      await failJob(jobId, "Failed to get public URL for uploaded output");
      try { fs.unlinkSync(outputPath); } catch { /* */ }
      return;
    }

    console.log(`${tag} ✅ Output URL: ${outputUrl}`);

    // ── Validate output URL ≠ source URL ──
    if (outputUrl === videoUrl) {
      console.error(`${tag} ❌ CRITICAL: Output URL === source URL — something went wrong`);
      await failJob(jobId, "CRITICAL: Output URL equals source URL — rendered file not distinct from source");
      try { fs.unlinkSync(outputPath); } catch { /* */ }
      return;
    }

    // ── 9. Mark job complete ──
    await updateRenderJob(jobId, {
      status: "done",
      progress: 100,
      stage: "הושלם",
      result_url: outputUrl,
      error: null,
    });
    console.log(`${tag} ✅ render_jobs updated: status=done result_url=${outputUrl}`);

    // ── 10. Update video_projects ──
    try {
      const now = new Date().toISOString();
      const { error: projError } = await sb
        .from("video_projects")
        .update({
          video_url: outputUrl,
          render_output_key: outputUrl,
          render_job_id: jobId,
          rendered_at: now,
          status: "complete",
          updated_at: now,
        })
        .eq("id", projectId);

      if (projError) {
        console.error(`${tag} ⚠️ Failed to update video_projects: ${projError.message}`);
      } else {
        console.log(`${tag} ✅ video_projects updated: video_url=${outputUrl} status=complete`);
      }
    } catch (projErr) {
      console.error(`${tag} ⚠️ Exception updating video_projects:`, projErr instanceof Error ? projErr.message : projErr);
    }

    // ── 11. Clean up local file ──
    try {
      fs.unlinkSync(outputPath);
      console.log(`${tag} Cleaned up local file: ${outputPath}`);
    } catch { /* non-critical */ }

    // ── Final summary ──
    console.log(`${tag} ════════════════════════════════════════`);
    console.log(`${tag} ✅ RENDER COMPLETE`);
    console.log(`${tag}   jobId:       ${jobId}`);
    console.log(`${tag}   projectId:   ${projectId}`);
    console.log(`${tag}   source:      ${videoUrl.substring(0, 100)}`);
    console.log(`${tag}   output:      ${outputUrl}`);
    console.log(`${tag}   size:        ${renderedSizeMB} MB`);
    console.log(`${tag}   dimensions:  ${composition.width}x${composition.height}`);
    console.log(`${tag}   duration:    ${(composition.durationInFrames / composition.fps).toFixed(1)}s`);
    console.log(`${tag}   format:      ${inputProps.format || "9:16"}`);
    console.log(`${tag}   segments:    ${Array.isArray(inputProps.segments) ? (inputProps.segments as unknown[]).length : 0}`);
    console.log(`${tag}   broll:       ${Array.isArray(inputProps.brollPlacements) ? (inputProps.brollPlacements as unknown[]).length : 0}`);
    console.log(`${tag}   storage:     bucket="${BUCKET}" path="${storagePath}"`);
    console.log(`${tag} ════════════════════════════════════════`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`${tag} ❌ UNCAUGHT ERROR in processRenderJob:`, msg);
    if (stack) console.error(`${tag}   stack:`, stack);

    // Try to mark the job as failed
    try {
      await updateRenderJob(jobId, {
        status: "failed",
        error: msg,
        stage: "שגיאה",
      });
    } catch {
      console.error(`${tag} ❌ Could not mark job as failed`);
    }

    // Revert project status
    if (job?.project_id) {
      try {
        const sb = getSupabase();
        await sb
          .from("video_projects")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", job.project_id);
      } catch {
        console.error(`${tag} ❌ Could not revert project status`);
      }
    }
  }
}

/** Helper: mark job as failed with an error message */
async function failJob(jobId: string, errorMsg: string): Promise<void> {
  console.error(`${tag} ❌ FAIL: ${errorMsg}`);
  await updateRenderJob(jobId, {
    status: "failed",
    error: errorMsg,
    stage: "שגיאה",
  });
}
