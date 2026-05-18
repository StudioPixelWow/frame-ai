// ── Vercel guard: prevent this worker from running on Vercel serverless ──
// Railway sets RAILWAY_ENVIRONMENT — that's where the worker SHOULD run.
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  console.log("[Worker] Detected Vercel/Lambda — worker disabled. Use Railway.");
  process.exit(0);
}

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

const tag = "[Worker]";

// ── Config ────────────────────────────────────────────────────────────────

const PROJECT_ROOT = process.cwd();
const REMOTION_ENTRY = path.join(PROJECT_ROOT, "src/remotion/index.ts");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public/renders");
const BUCKET = "project-files";

const POLL_INTERVAL_MS = Number(process.env.RENDER_POLL_INTERVAL_MS ?? 3000);
const REMOTION_CONCURRENCY = Number(process.env.REMOTION_CONCURRENCY ?? 1); // Default 1 to prevent OOM
const RENDER_TIMEOUT_MS = Number(process.env.REMOTION_TIMEOUT_MS ?? 1000 * 60 * 30);
const RENDER_SCALE = Number(process.env.REMOTION_SCALE ?? 1);

// Cap Remotion's offthread video cache to 64 MB (default is unbounded — causes OOM)
const VIDEO_CACHE_SIZE_BYTES = Number(
  process.env.REMOTION_VIDEO_CACHE_MB ?? 64
) * 1024 * 1024;

// Performance: Set offthread video cache limit
process.env.REMOTION_OFFTHREAD_VIDEO_CACHE_SIZE_IN_BYTES = String(VIDEO_CACHE_SIZE_BYTES);

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ── State ─────────────────────────────────────────────────────────────────

let bundlePath: string | null = null;
let isRendering = false;
let isPolling = false;
let pollCount = 0;

// ── Types ─────────────────────────────────────────────────────────────────

type RenderJobRow = {
  job_id: string;
  project_id: string | null;
  status: string;
  created_at: string;
  metadata?: Record<string, any> | null;
  result_url?: string | null;
  error?: string | null;
};

type JobUpdate = {
  status?: string;
  progress?: number;
  stage?: string;
  result_url?: string;
  error?: string;
};

// ── Supabase client ───────────────────────────────────────────────────────

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
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`${tag} Supabase client initialized`);
  return _sb;
}

// ── Utilities ─────────────────────────────────────────────────────────────

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`${tag} Cleaned up local file: ${filePath}`);
    }
  } catch (err) {
    console.warn(`${tag} Failed to clean up file ${filePath}:`, err);
  }
}

function extractStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(publicUrl.substring(idx + marker.length));
  return null;
}

// ── DB helpers ────────────────────────────────────────────────────────────

async function updateJob(jobId: string, updates: JobUpdate): Promise<void> {
  try {
    const sb = getWorkerSupabase();
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from("render_jobs").update(payload).eq("job_id", jobId);

    if (error) {
      console.warn(`${tag} DB update failed for ${jobId}: ${error.message}`);
      return;
    }

    console.log(
      `${tag} DB updated: ${jobId} status=${updates.status || "-"} progress=${updates.progress ?? "-"}% stage=${updates.stage || "-"}`
    );
  } catch (err) {
    console.warn(`${tag} DB update error:`, err instanceof Error ? err.message : err);
  }
}

async function fetchJob(jobId: string): Promise<RenderJobRow | null> {
  const sb = getWorkerSupabase();

  const { data, error } = await sb
    .from("render_jobs")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) {
    console.warn(`${tag} fetchJob failed: ${error.message}`);
    return null;
  }

  return (data as unknown as RenderJobRow | null) ?? null;
}

// ── Stale job recovery ───────────────────────────────────────────────────
// Jobs stuck in "rendering" or "preparing" for more than STALE_THRESHOLD_MS
// are reset to "queued" so the worker picks them up again.

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
let lastStaleCheck = 0;
const STALE_CHECK_INTERVAL_MS = 60_000; // check once per minute

async function recoverStaleJobs(): Promise<void> {
  const now = Date.now();
  if (now - lastStaleCheck < STALE_CHECK_INTERVAL_MS) return;
  lastStaleCheck = now;

  const sb = getWorkerSupabase();
  const cutoff = new Date(now - STALE_THRESHOLD_MS).toISOString();

  const { data: staleJobs, error } = await sb
    .from("render_jobs")
    .select("job_id, status, updated_at, progress")
    .in("status", ["rendering", "preparing"])
    .lt("updated_at", cutoff)
    .limit(10);

  if (error) {
    console.warn(`${tag} Stale job query failed: ${error.message}`);
    return;
  }

  if (!staleJobs || staleJobs.length === 0) return;

  for (const stale of staleJobs) {
    console.log(`${tag} ♻️ Recovering stale job ${stale.job_id} (status=${stale.status}, progress=${stale.progress}%, updated_at=${stale.updated_at})`);
    const { error: resetErr } = await sb
      .from("render_jobs")
      .update({
        status: "queued",
        progress: 0,
        stage: "ממתין בתור (שוחזר אוטומטית)",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", stale.job_id);

    if (resetErr) {
      console.warn(`${tag} Failed to reset stale job ${stale.job_id}: ${resetErr.message}`);
    } else {
      console.log(`${tag} ✅ Stale job ${stale.job_id} reset to "queued"`);
    }
  }
}

async function claimNextQueuedJob(): Promise<RenderJobRow | null> {
  const sb = getWorkerSupabase();

  const { data, error } = await sb
    .from("render_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.warn(`${tag} Poll query failed: ${error.message}`);
    return null;
  }

  if (!data || data.length === 0) return null;

  const job = data[0] as unknown as RenderJobRow;

  const { data: claimedRow, error: claimError } = await sb
    .from("render_jobs")
    .update({
      status: "preparing",
      progress: 1,
      stage: "נתפס לעיבוד",
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", job.job_id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (claimError) {
    console.warn(`${tag} Failed to claim job ${job.job_id}: ${claimError.message}`);
    return null;
  }

  if (!claimedRow) {
    console.warn(`${tag} Job ${job.job_id} was already claimed by another worker`);
    return null;
  }

  console.log(`${tag} ══ CLAIMED JOB: ${job.job_id} (created ${job.created_at}) ══`);
  return claimedRow as unknown as RenderJobRow;
}

// ── Bundle ────────────────────────────────────────────────────────────────

async function ensureBundle(): Promise<string> {
  if (bundlePath && fs.existsSync(bundlePath)) {
    console.log(`${tag} Using cached bundle`);
    return bundlePath;
  }

  console.log(`${tag} Bundling Remotion project...`);

  bundlePath = await bundle({
    entryPoint: REMOTION_ENTRY,
    onProgress: (progress: number) => {
      if (progress % 20 === 0) {
        console.log(`${tag} Bundle progress: ${progress}%`);
      }
    },
  });

  console.log(`${tag} Bundle ready at: ${bundlePath}`);
  return bundlePath;
}

// ── Render a single job ───────────────────────────────────────────────────

async function renderJob(jobId: string): Promise<void> {
  const job = await fetchJob(jobId);
  if (!job) return;

  const metadata = job.metadata || {};
  const inputProps = metadata.inputProps || {};
  const compositionId = metadata.compositionId || "PixelManageEdit";
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
  console.log(`${tag}   Concurrency: ${REMOTION_CONCURRENCY}`);
  console.log(`${tag} ═══════════════════════════════════════`);

  try {
    await updateJob(jobId, {
      status: "preparing",
      progress: 5,
      stage: "מכין את הקומפוזיציה",
    });

    const serveUrl = await ensureBundle();

    await updateJob(jobId, {
      status: "preparing",
      progress: 15,
      stage: "טוען קבצי מקור",
    });

    // ── Chromium options for Railway (24GB RAM available) ──
    // IMPORTANT: Do NOT use --single-process or --no-zygote — they cause
    // Chromium deadlocks mid-render (the 62% stall bug). Multi-process mode
    // lets Chromium recover from renderer hangs.
    const chromiumOpts = {
      disableWebSecurity: true,
      ignoreCertificateErrors: true,
      gl: "swiftshader" as const,
      enableMultiProcessOnLinux: true, // Allow Chromium to recover from renderer hangs
      chromiumFlags: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // --single-process and --no-zygote REMOVED — they cause deadlocks at ~60% render
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-extensions",
        "--mute-audio",
        "--disable-breakpad",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-translate",
        "--metrics-recording-only",
        "--no-first-run",
        "--js-flags=--max-old-space-size=512",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--disable-backgrounding-occluded-windows",
        "--force-color-profile=srgb",
      ],
    };

    // ── Stage: selectComposition ──
    console.log(`${tag} [STEP] selectComposition: ${compositionId}`);
    console.log(`${tag}   serveUrl: ${serveUrl}`);
    console.log(`${tag}   inputProps keys: ${Object.keys(inputProps).join(", ")}`);
    let composition;
    try {
      composition = await selectComposition({
        serveUrl,
        id: compositionId,
        inputProps,
        chromiumOptions: chromiumOpts,
        timeoutInMilliseconds: 30000,
      });
    } catch (compErr) {
      // Properly extract error details
      let errorMsg = "Unknown error";
      let errorStack = "";

      if (compErr instanceof Error) {
        errorMsg = compErr.message;
        errorStack = compErr.stack || "";
      } else if (typeof compErr === "object" && compErr !== null) {
        // Try to extract message from object
        errorMsg = (compErr as any).message || (compErr as any).error || JSON.stringify(compErr);
        if ((compErr as any).stack) {
          errorStack = (compErr as any).stack;
        }
      } else {
        errorMsg = String(compErr);
      }

      console.error(`${tag} ❌ selectComposition CRASHED`);
      console.error(`${tag}    Error: ${errorMsg}`);
      if (errorStack) console.error(`${tag}    Stack: ${errorStack}`);
      throw new Error(`selectComposition failed: ${errorMsg}`);
    }

    console.log(
      `${tag} [STEP] Composition resolved: ${composition.width}x${composition.height}, ${composition.durationInFrames}f @ ${composition.fps}fps`
    );

    await updateJob(jobId, {
      status: "rendering",
      progress: 20,
      stage: "מתחיל רינדור",
    });

    // ── Stage: renderMedia ──
    const memBefore = process.memoryUsage();
    console.log(`${tag} [STEP] renderMedia starting (scale=${RENDER_SCALE}, jpeg=55, concurrency=${REMOTION_CONCURRENCY}, gl=swiftshader) RSS=${Math.round(memBefore.rss / 1024 / 1024)}MB`);
    console.log(`${tag} Render config: scale=${RENDER_SCALE}, concurrency=${REMOTION_CONCURRENCY}, codec=h264, cache=${VIDEO_CACHE_SIZE_BYTES}bytes, multiProcess=true`);

    // ── Watchdog: detect hung renders (no progress for 120s = deadlock) ──
    let lastWatchdogProgress = -1;
    let watchdogSameCount = 0;
    const WATCHDOG_INTERVAL_MS = 15_000; // check every 15s
    const WATCHDOG_MAX_STALLS = 8;       // 8 × 15s = 120s of no progress → kill
    const watchdogTimer = setInterval(() => {
      const mem = process.memoryUsage();
      console.log(`${tag} [WATCHDOG] progress=${lastWatchdogProgress}% stalls=${watchdogSameCount}/${WATCHDOG_MAX_STALLS} RSS=${Math.round(mem.rss / 1024 / 1024)}MB heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
    }, WATCHDOG_INTERVAL_MS);

    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        concurrency: REMOTION_CONCURRENCY,
        scale: RENDER_SCALE,
        imageFormat: "jpeg",
        jpegQuality: 55,
        offthreadVideoCacheSizeInBytes: VIDEO_CACHE_SIZE_BYTES,
        timeoutInMilliseconds: RENDER_TIMEOUT_MS,
        crf: 28, // Good quality, reasonable encoding overhead
        chromiumOptions: chromiumOpts,
        everyNthFrame: 1,
        // ── Progress ──
        onProgress: ({ progress }) => {
          const pct = Math.round(20 + progress * 70);
          const mem = process.memoryUsage();
          console.log(`${tag} render progress=${(progress * 100).toFixed(0)}% pct=${pct}% RSS=${Math.round(mem.rss / 1024 / 1024)}MB`);

          // Update watchdog
          if (pct === lastWatchdogProgress) {
            watchdogSameCount++;
          } else {
            watchdogSameCount = 0;
            lastWatchdogProgress = pct;
          }

          updateJob(jobId, {
            status: "rendering",
            progress: pct,
            stage: "Rendering...",
          }).catch(() => {});
        },
      });
    } catch (renderErr) {
      const msg = renderErr instanceof Error ? renderErr.message : String(renderErr);
      const stack = renderErr instanceof Error ? renderErr.stack : "";
      const memAfter = process.memoryUsage();
      console.error(`${tag} ❌ renderMedia CRASHED: ${msg}`);
      console.error(`${tag}    RSS at crash: ${Math.round(memAfter.rss / 1024 / 1024)}MB heap: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
      if (stack) console.error(`${tag}    Stack: ${stack}`);
      throw new Error(`renderMedia failed: ${msg}`);
    } finally {
      clearInterval(watchdogTimer);
    }

    const memAfterRender = process.memoryUsage();
    console.log(`${tag} [STEP] renderMedia completed. RSS=${Math.round(memAfterRender.rss / 1024 / 1024)}MB`);

    await updateJob(jobId, {
      status: "finalizing",
      progress: 92,
      stage: "מאמת קובץ",
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error("Render completed but output file not found on disk");
    }

    const stats = fs.statSync(outputPath);
    const renderedSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    if (stats.size < 1024) {
      throw new Error(`Rendered file is suspiciously small: ${stats.size} bytes`);
    }

    console.log(`${tag} RENDER DONE`);
    console.log(`${tag} OUTPUT PATH: ${outputPath}`);
    console.log(`${tag}   Rendered size:  ${renderedSizeMB} MB`);
    console.log(`${tag}   Render width:   ${composition.width}`);
    console.log(`${tag}   Render height:  ${composition.height}`);
    console.log(`${tag}   Render frames:  ${composition.durationInFrames}`);
    console.log(`${tag}   Render FPS:     ${composition.fps}`);
    console.log(
      `${tag}   Render duration: ${(composition.durationInFrames / composition.fps).toFixed(1)}s`
    );

    await updateJob(jobId, {
      status: "finalizing",
      progress: 94,
      stage: "מעלה קובץ סופי",
    });

    const storagePath = `outputs/${projectId}_${Date.now()}.mp4`;
    const fileBuffer = fs.readFileSync(outputPath);

    console.log(`${tag} Uploading rendered file to Storage: ${storagePath} (${renderedSizeMB} MB)`);

    const sb = getWorkerSupabase();

    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`);
    }

    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
    const outputUrl = urlData?.publicUrl || "";

    if (!outputUrl) {
      throw new Error("Upload succeeded but getPublicUrl returned empty");
    }

    console.log(`${tag} UPLOADED OUTPUT URL: ${outputUrl}`);

    if (sourceVideoUrl) {
      const sourcePath = extractStoragePath(sourceVideoUrl);
      const outputPathInStorage = extractStoragePath(outputUrl);

      if (sourcePath && outputPathInStorage && sourcePath === outputPathInStorage) {
        throw new Error("CRITICAL: Output storage path equals source path");
      }

      if (outputUrl === sourceVideoUrl) {
        throw new Error("CRITICAL: Output URL equals source URL");
      }

      console.log(`${tag} ✅ Output URL differs from source URL — confirmed new rendered file`);
    }

    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      stage: "הושלם",
      result_url: outputUrl,
    });

    console.log(`${tag} ✅ render_jobs updated: result_url=${outputUrl.substring(0, 100)}`);

    if (job.project_id) {
      console.log(`${tag} SAVING TO PROJECT: ${job.project_id}`);

      const now = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
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
        console.error(`${tag} ❌ video_projects update ERROR: ${updateErr.message}`);

        const colMatch = updateErr.message.match(/column.*['"]?([a-z_]+)['"]?.*does not exist/i);
        if (colMatch) {
          const badCol = colMatch[1];
          console.warn(`${tag} ⚠️ Column "${badCol}" missing — retrying without it`);

          const reduced = { ...updatePayload };
          delete reduced[badCol];

          const { data: retryData, error: retryErr } = await sb
            .from("video_projects")
            .update(reduced)
            .eq("id", job.project_id)
            .select("id, status")
            .maybeSingle();

          if (retryErr) {
            console.error(`${tag} ❌ Retry also failed: ${retryErr.message}`);
          } else {
            console.log(`${tag} ✅ PROJECT UPDATED (partial): ${JSON.stringify(retryData)}`);
          }
        }
      } else {
        console.log(`${tag} ✅ PROJECT UPDATED: ${JSON.stringify(updateData)}`);
      }

      const { data: verifyRow, error: verifyErr } = await sb
        .from("video_projects")
        .select("id, status, video_url, render_output_key")
        .eq("id", job.project_id)
        .maybeSingle();

      if (verifyErr) {
        console.warn(`${tag} ⚠️ Verify select failed: ${verifyErr.message}`);
      } else if (verifyRow) {
        const savedUrl =
          (verifyRow as any).video_url || (verifyRow as any).render_output_key;

        console.log(
          `${tag} VERIFY: video_url=${(verifyRow as any).video_url || "(null)"} render_output_key=${(verifyRow as any).render_output_key || "(null)"} status=${(verifyRow as any).status}`
        );

        if (!savedUrl) {
          console.error(`${tag} ❌ CRITICAL: Output URL NOT saved to video_projects!`);
        } else if (savedUrl !== outputUrl) {
          console.error(
            `${tag} ❌ MISMATCH: saved=${savedUrl.substring(0, 80)} expected=${outputUrl.substring(0, 80)}`
          );
        } else {
          console.log(`${tag} ✅ VERIFIED: DB video_url matches rendered output URL`);
        }
      } else {
        console.error(`${tag} ❌ Project ${job.project_id} not found after update!`);
      }
    } else {
      console.error(`${tag} ❌ No project_id on job — cannot update video_projects`);
    }

    cleanupFile(outputPath);

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
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error(`${tag} ═══════════════════════════════════════`);
    console.error(`${tag} RENDER FAILED: ${errorMsg}`);
    if (errorStack) console.error(`${tag} Stack: ${errorStack}`);
    console.error(`${tag} ═══════════════════════════════════════`);

    try {
      await updateJob(jobId, {
        status: "failed",
        progress: 0,
        error: errorMsg.substring(0, 500),
        stage: "Render failed",
      });
      console.log(`${tag} ✅ JOB MARKED FAILED: ${jobId}`);
    } catch (dbErr) {
      console.error(`${tag} ❌ Could not mark job as failed in DB:`, dbErr instanceof Error ? dbErr.message : dbErr);
    }

    cleanupFile(outputPath);
  } finally {
    isRendering = false;
    // Force GC hint after render (success or fail) to free Chrome memory
    if (global.gc) {
      try { global.gc(); } catch {}
    }
  }
}

// ── Poll loop ─────────────────────────────────────────────────────────────

async function pollForJobs(): Promise<void> {
  if (isRendering || isPolling) return;

  isPolling = true;

  try {
    // First, check for stale jobs that need recovery (runs at most once per minute)
    await recoverStaleJobs();

    const job = await claimNextQueuedJob();
    if (!job) return;

    await renderJob(job.job_id);
  } catch (err) {
    console.warn(`${tag} Poll error:`, err instanceof Error ? err.message : err);
  } finally {
    isPolling = false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" PixelManageAI Render Worker (Real Remotion)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`${tag} NODE_ENV:          ${process.env.NODE_ENV ?? "(unset)"}`);
  console.log(`${tag} RAILWAY_ENV:       ${process.env.RAILWAY_ENVIRONMENT ?? "(unset)"}`);
  console.log(
    `${tag} SUPABASE_URL:      ${
      process.env.SUPABASE_URL
        ? process.env.SUPABASE_URL.slice(0, 40) + "..."
        : process.env.NEXT_PUBLIC_SUPABASE_URL
          ? process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 40) + "..."
          : "(using hardcoded default)"
    }`
  );
  console.log(
    `${tag} SERVICE_ROLE_KEY:  ${
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? `set (${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)`
        : "❌ MISSING"
    }`
  );
  console.log(`${tag} Output dir:        ${OUTPUT_DIR}`);
  console.log(`${tag} Storage bucket:    ${BUCKET}`);
  console.log(`${tag} Remotion entry:    ${REMOTION_ENTRY}`);
  console.log(`${tag} CWD:               ${PROJECT_ROOT}`);
  console.log(`${tag} Concurrency:       ${REMOTION_CONCURRENCY}`);
  console.log(`${tag} Render scale:      ${RENDER_SCALE}`);
  console.log(`${tag} JPEG quality:      60`);
  console.log(`${tag} Video cache MB:    ${VIDEO_CACHE_SIZE_BYTES / 1024 / 1024}`);
  const mem = process.memoryUsage();
  console.log(`${tag} Memory at start:   RSS=${Math.round(mem.rss / 1024 / 1024)}MB heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
  console.log("═══════════════════════════════════════════════════════════");

  const sb = getWorkerSupabase();

  const { data: testRows, error: testErr } = await sb
    .from("render_jobs")
    .select("job_id, status")
    .limit(3);

  if (testErr) {
    console.error(`${tag} ❌ Supabase connection test FAILED: ${testErr.message}`);
    process.exit(1);
  }

  console.log(`${tag} ✅ Supabase connection OK — found ${testRows?.length ?? 0} recent jobs`);

  if (testRows && testRows.length > 0) {
    testRows.forEach((r: any) => {
      console.log(`${tag}    job=${r.job_id} status=${r.status}`);
    });
  }

  if (!fs.existsSync(REMOTION_ENTRY)) {
    console.error(`${tag} ❌ Remotion entry file not found: ${REMOTION_ENTRY}`);
    process.exit(1);
  }

  console.log(`${tag} ✅ Remotion entry file exists`);
  console.log(`${tag} Starting poll loop (every ${POLL_INTERVAL_MS}ms)...`);
  console.log("═══════════════════════════════════════════════════════════");

  // ── Memory logger: every 5s during renders, visible in Railway logs ──
  setInterval(() => {
    const m = process.memoryUsage();
    console.log("[MEMORY]", {
      rss: Math.round(m.rss / 1024 / 1024) + "MB",
      heap: Math.round(m.heapUsed / 1024 / 1024) + "MB",
      rendering: isRendering,
    });
  }, 5000);

  setInterval(() => {
    pollCount++;
    if (pollCount % 20 === 0) {
      const hbMem = process.memoryUsage();
      console.log(
        `${tag} ♥ heartbeat — polls=${pollCount} rendering=${isRendering} uptime=${Math.round(process.uptime())}s RSS=${Math.round(hbMem.rss / 1024 / 1024)}MB heap=${Math.round(hbMem.heapUsed / 1024 / 1024)}MB`
      );
    }
    void pollForJobs();
  }, POLL_INTERVAL_MS);

  await pollForJobs();
}

// ── Global error handlers ────────────────────────────────────────────────

process.on("uncaughtException", (err) => {
  console.error(`${tag} ❌ Uncaught exception:`, err.message);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error(`${tag} ❌ Unhandled rejection:`, reason);
});

main().catch((err) => {
  console.error(`${tag} Fatal error in main():`, err);
  process.exit(1);
});