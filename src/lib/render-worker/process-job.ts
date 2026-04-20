/**
 * PixelFrameAI — Render Job Processor
 *
 * Called via `after()` from POST /api/render after the response is sent.
 * Performs REAL Remotion rendering using @remotion/bundler + @remotion/renderer.
 *
 * ARCHITECTURE NOTE:
 *   @remotion/bundler and @remotion/renderer are imported DYNAMICALLY at runtime
 *   (via `await import(...)`) so that Next.js / Turbopack never statically
 *   traverses their platform-specific native binaries during the build step.
 *   This keeps the App Route bundle light and avoids Turbopack parse errors.
 *
 * Status flow: queued → preparing → rendering → finalizing → done (or → failed)
 */

import { readRenderJob, updateRenderJob, type RenderJobRow } from "./job-manager";
import { getSupabase } from "@/lib/db/store";
import path from "path";
import fs from "fs";

const tag = "[ProcessJob]";
const BUCKET = "project-files";

/**
 * Resolve a writable output directory.
 * Prefers public/renders; falls back to /tmp on read-only filesystems (Vercel).
 */
function getOutputDir(): string {
  const preferred = path.join(process.cwd(), "public/renders");
  try {
    if (!fs.existsSync(preferred)) fs.mkdirSync(preferred, { recursive: true });
    const probe = path.join(preferred, ".probe");
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
    return preferred;
  } catch {
    const tmp = "/tmp/pixelframe-renders";
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    return tmp;
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

    if (job.status !== "queued") {
      console.log(`${tag} ⏭ Job ${jobId} is already '${job.status}', skipping`);
      return;
    }

    const metadata = (job.metadata ?? {}) as Record<string, unknown>;
    const inputProps = (metadata.inputProps as Record<string, unknown>) || {};
    const compositionId = (metadata.compositionId as string) || "PixelFrameEdit";
    const videoUrl = (inputProps.videoUrl as string) || (metadata.videoUrl as string) || "";
    const projectId = job.project_id;

    // ── LOG: Composition props ──
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
    await updateRenderJob(jobId, { status: "rendering", progress: 5, stage: "מכין את הקומפוזיציה" });

    // ── 3. Dynamic-import Remotion packages (keeps Next.js build clean) ──
    console.log(`${tag} Loading @remotion/bundler + @remotion/renderer at runtime...`);

    const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([
      import("@remotion/bundler") as Promise<typeof import("@remotion/bundler")>,
      import("@remotion/renderer") as Promise<typeof import("@remotion/renderer")>,
    ]);

    console.log(`${tag} ✅ Remotion packages loaded`);

    // ── 4. Bundle Remotion project ──
    const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");
    console.log(`${tag} Bundling from: ${entryPoint}`);

    if (!fs.existsSync(entryPoint)) {
      await failJob(jobId, `Remotion entry point not found: ${entryPoint}`);
      return;
    }

    let serveUrl: string;
    try {
      serveUrl = await bundle({
        entryPoint,
        onProgress: (p: number) => { if (p % 25 === 0) console.log(`${tag} Bundle: ${p}%`); },
      });
      console.log(`${tag} ✅ Bundle ready: ${serveUrl}`);
    } catch (e) {
      await failJob(jobId, `Remotion bundle failed: ${e instanceof Error ? e.message : e}`);
      return;
    }

    await updateRenderJob(jobId, { progress: 15, stage: "טוען קבצי מקור" });

    // ── 5. Select composition with project inputProps ──
    let composition: Awaited<ReturnType<typeof selectComposition>>;
    try {
      composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
      console.log(`${tag} ✅ Composition: ${composition.width}x${composition.height}, ${composition.durationInFrames}f @ ${composition.fps}fps`);
    } catch (e) {
      await failJob(jobId, `selectComposition failed: ${e instanceof Error ? e.message : e}`);
      return;
    }

    await updateRenderJob(jobId, { status: "rendering", progress: 20, stage: "מתחיל רינדור" });

    // ── 6. renderMedia — real FFmpeg-based encoding ──
    const outputDir = getOutputDir();
    const outputPath = path.join(outputDir, `render-${jobId}.mp4`);
    console.log(`${tag} renderMedia → ${outputPath} (${composition.width}x${composition.height}, ${(composition.durationInFrames / composition.fps).toFixed(1)}s)`);

    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        onProgress: ({ progress }) => {
          const pct = Math.round(20 + progress * 65);
          const stage = progress < 0.3 ? "מעבד קטעי וידאו"
            : progress < 0.6 ? "משלב אפקטים וכתוביות"
            : progress < 0.9 ? "מחיל שיפורים פרימיום"
            : "רינדור סופי";
          updateRenderJob(jobId, { status: "rendering", progress: pct, stage }).catch(() => {});
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${tag} ❌ renderMedia FAILED:`, msg);
      await failJob(jobId, `Remotion renderMedia failed: ${msg}`);
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { /* */ }
      return;
    }

    // ── 7. Validate output ──
    await updateRenderJob(jobId, { progress: 88, stage: "מאמת קובץ פלט" });

    if (!fs.existsSync(outputPath)) {
      await failJob(jobId, "Render completed but output file missing on disk");
      return;
    }
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`${tag} ✅ RENDER DONE: ${sizeMB} MB`);

    if (stats.size < 1024) {
      await failJob(jobId, `Rendered file too small: ${stats.size} bytes`);
      try { fs.unlinkSync(outputPath); } catch { /* */ }
      return;
    }

    // ── 8. Upload to Supabase Storage ──
    await updateRenderJob(jobId, { progress: 92, stage: "מעלה קובץ סופי" });

    const storagePath = `outputs/${projectId}_${Date.now()}.mp4`;
    const fileBuffer = fs.readFileSync(outputPath);
    console.log(`${tag} Uploading: bucket=${BUCKET} path=${storagePath}`);

    const sb = getSupabase();
    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, { contentType: "video/mp4", upsert: true });

    if (uploadErr) {
      await failJob(jobId, `Storage upload failed: ${uploadErr.message}`);
      try { fs.unlinkSync(outputPath); } catch { /* */ }
      return;
    }

    // ── 9. Get public URL & validate ──
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
    const outputUrl = urlData?.publicUrl || "";

    if (!outputUrl) {
      await failJob(jobId, "getPublicUrl returned empty after upload");
      try { fs.unlinkSync(outputPath); } catch { /* */ }
      return;
    }
    if (outputUrl === videoUrl) {
      await failJob(jobId, "CRITICAL: Output URL === source URL — render produced no new file");
      try { fs.unlinkSync(outputPath); } catch { /* */ }
      return;
    }

    console.log(`${tag} ✅ Output URL: ${outputUrl}`);

    // ── 10. Mark job done ──
    await updateRenderJob(jobId, {
      status: "done",
      progress: 100,
      stage: "הושלם",
      result_url: outputUrl,
      error: null,
    });

    // ── 11. Update video_projects ──
    try {
      const now = new Date().toISOString();
      await sb.from("video_projects").update({
        video_url: outputUrl,
        render_output_key: outputUrl,
        render_job_id: jobId,
        rendered_at: now,
        status: "complete",
        updated_at: now,
      }).eq("id", projectId);
      console.log(`${tag} ✅ video_projects updated`);
    } catch (e) {
      console.error(`${tag} ⚠️ video_projects update failed:`, e instanceof Error ? e.message : e);
    }

    // ── 12. Clean up ──
    try { fs.unlinkSync(outputPath); } catch { /* */ }

    console.log(`${tag} ════════════════════════════════════════`);
    console.log(`${tag} ✅ COMPLETE jobId=${jobId} output=${outputUrl}`);
    console.log(`${tag} ════════════════════════════════════════`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ UNCAUGHT:`, msg);
    try { await updateRenderJob(jobId, { status: "failed", error: msg, stage: "שגיאה" }); } catch { /* */ }
    if (job?.project_id) {
      try {
        const sb = getSupabase();
        await sb.from("video_projects").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", job.project_id);
      } catch { /* */ }
    }
  }
}

async function failJob(jobId: string, errorMsg: string): Promise<void> {
  console.error(`${tag} ❌ FAIL: ${errorMsg}`);
  await updateRenderJob(jobId, { status: "failed", error: errorMsg, stage: "שגיאה" });
}
