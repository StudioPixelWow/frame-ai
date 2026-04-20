/**
 * PixelFrameAI — Render Job Orchestrator
 *
 * Called via `after()` from POST /api/render.
 * Handles job lifecycle (DB reads/writes, status transitions, upload).
 *
 * ZERO Remotion imports — not even dynamic ones.
 * The actual Remotion render lives in @/lib/remotion/run-render.ts,
 * which is loaded via dynamic import() INSIDE processRenderJob().
 * This guarantees Turbopack never traverses @remotion/* packages.
 *
 * Import chain visible to Turbopack:
 *   route.ts → process-job.ts → job-manager.ts → @/lib/db/store
 *   (nothing else — Remotion is loaded at runtime only)
 */
import { readRenderJob, updateRenderJob, type RenderJobRow } from "./job-manager";
import { getSupabase } from "@/lib/db/store";
import fs from "fs";

const tag = "[ProcessJob]";
const BUCKET = "project-files";

export async function processRenderJob(jobId: string): Promise<void> {
  console.log(`${tag} ════════════════════════════════════════`);
  console.log(`${tag} START jobId=${jobId}`);
  console.log(`${tag} ════════════════════════════════════════`);

  let job: RenderJobRow | null = null;

  try {
    // ── 1. Read job ──
    job = await readRenderJob(jobId);
    if (!job) { console.error(`${tag} Job not found`); return; }
    if (job.status !== "queued") { console.log(`${tag} Already '${job.status}', skip`); return; }

    const metadata = (job.metadata ?? {}) as Record<string, unknown>;
    const inputProps = (metadata.inputProps as Record<string, unknown>) || {};
    const compositionId = (metadata.compositionId as string) || "PixelFrameEdit";
    const videoUrl = (inputProps.videoUrl as string) || (metadata.videoUrl as string) || "";
    const projectId = job.project_id;

    // ── LOG: props summary ──
    console.log(`${tag} ═══ RENDER INPUT PROPS ═══`);
    console.log(`${tag}   projectId:     ${projectId}`);
    console.log(`${tag}   compositionId: ${compositionId}`);
    console.log(`${tag}   videoUrl:      ${videoUrl.substring(0, 120)}`);
    console.log(`${tag}   format:        ${inputProps.format || metadata.outputFormat || "?"}`);
    console.log(`${tag}   durationSec:   ${inputProps.durationSec || "?"}`);
    console.log(`${tag}   segments:      ${Array.isArray(inputProps.segments) ? (inputProps.segments as unknown[]).length : 0}`);
    console.log(`${tag}   broll:         ${Array.isArray(inputProps.brollPlacements) ? (inputProps.brollPlacements as unknown[]).length : 0}`);
    console.log(`${tag}   transition:    ${JSON.stringify(inputProps.transition || {})}`);
    console.log(`${tag}   subtitleStyle: ${JSON.stringify(inputProps.subtitleStyle || {}).substring(0, 80)}`);
    console.log(`${tag}   visual:        ${JSON.stringify(inputProps.visual || {})}`);
    console.log(`${tag}   premium:       ${JSON.stringify(inputProps.premium || {})}`);
    console.log(`${tag}   quality:       ${metadata.quality || "?"}`);
    console.log(`${tag} ═══════════════════════════`);

    if (!videoUrl) { await failJob(jobId, "No videoUrl in metadata"); return; }
    if (videoUrl.startsWith("blob:")) { await failJob(jobId, "blob: URL — need public https URL"); return; }

    // ── 2. Mark rendering ──
    await updateRenderJob(jobId, { status: "rendering", progress: 5, stage: "מכין את הקומפוזיציה" });

    // ── 3. Dynamic-import the render module (Turbopack never sees this) ──
    const { runRender } = await import("@/lib/remotion/run-render");

    // ── 4. Run the actual Remotion render ──
    const result = await runRender(jobId, {
      compositionId,
      inputProps,
      onProgress: (pct, stage) => {
        updateRenderJob(jobId, { status: "rendering", progress: pct, stage }).catch(() => {});
      },
    });

    console.log(`${tag} Render returned: ${result.width}x${result.height}, ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB`);

    // ── 5. Upload to Supabase Storage ──
    await updateRenderJob(jobId, { progress: 90, stage: "מעלה קובץ סופי" });

    const storagePath = `outputs/${projectId}_${Date.now()}.mp4`;
    const fileBuffer = fs.readFileSync(result.outputPath);
    console.log(`${tag} Uploading: bucket=${BUCKET} path=${storagePath}`);

    const sb = getSupabase();
    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, { contentType: "video/mp4", upsert: true });

    if (uploadErr) {
      await failJob(jobId, `Storage upload failed: ${uploadErr.message}`);
      cleanup(result.outputPath);
      return;
    }

    // ── 6. Public URL + validate ──
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
    const outputUrl = urlData?.publicUrl || "";

    if (!outputUrl) { await failJob(jobId, "getPublicUrl empty"); cleanup(result.outputPath); return; }
    if (outputUrl === videoUrl) { await failJob(jobId, "Output URL === source URL"); cleanup(result.outputPath); return; }

    console.log(`${tag} ✅ Output URL: ${outputUrl}`);

    // ── 7. Mark done ──
    await updateRenderJob(jobId, {
      status: "done", progress: 100, stage: "הושלם",
      result_url: outputUrl, error: null,
    });

    // ── 8. Update video_projects ──
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

    // ── 9. Clean up local file ──
    cleanup(result.outputPath);

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

function cleanup(filePath: string): void {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* */ }
}
