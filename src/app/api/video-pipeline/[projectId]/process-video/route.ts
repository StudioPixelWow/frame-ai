/**
 * POST /api/video-pipeline/:projectId/process-video
 *
 * Downloads the source video from Supabase Storage, applies trim/crop and
 * optionally prepends a hook segment using ffmpeg, then uploads the processed
 * video back to Supabase Storage and returns the new public URL.
 *
 * Uses ffmpeg-static for Vercel serverless compatibility.
 * All temp files go to /tmp and are cleaned up after upload.
 * User-facing error messages are in Hebrew.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/store";
import { uploadToStorage } from "@/lib/storage/upload";
import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import { getFfmpegPath, getFfprobePath } from "@/lib/ffmpeg-paths";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // allow up to 2 minutes for ffmpeg processing

const execFileAsync = promisify(execFile);
const EXEC_TIMEOUT_MS = 90_000; // 90 seconds

// ── Types ───────────────────────────────────────────────────────────────

type Params = { params: Promise<{ projectId: string }> };

interface ProcessVideoBody {
  sourceVideoUrl: string;
  trimStart: number;
  trimEnd: number;
  cropX: number;       // 0-100 percentage
  cropY: number;       // 0-100 percentage
  cropWidth: number;   // 0-100 percentage
  cropHeight: number;  // 0-100 percentage
  targetAspectRatio?: string;
  hookEnabled: boolean;
  hookStartTime?: number;
  hookEndTime?: number;
  // Client-side metadata — avoids needing ffprobe on server
  sourceWidth?: number;
  sourceHeight?: number;
  sourceDuration?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function extractSupabaseStoragePath(url: string): string | null {
  const marker = "/storage/v1/object/public/project-files/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

async function downloadFromSupabase(url: string): Promise<Buffer> {
  const storagePath = extractSupabaseStoragePath(url);

  if (storagePath) {
    // Try direct Supabase download via service role
    try {
      const sb = getSupabase();
      const { data, error } = await sb.storage.from("project-files").download(storagePath);
      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      console.warn(`[process-video] Supabase download error: ${error?.message} — falling back to fetch`);
    } catch (e) {
      console.warn(`[process-video] Supabase download threw: ${e instanceof Error ? e.message : e}`);
    }

    // Try signed URL
    try {
      const sb = getSupabase();
      const { data, error } = await sb.storage
        .from("project-files")
        .createSignedUrl(storagePath, 3600);
      if (!error && data?.signedUrl) {
        const resp = await fetch(data.signedUrl);
        if (resp.ok) {
          const arrayBuffer = await resp.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
      }
    } catch {
      // fall through to direct fetch
    }
  }

  // Direct fetch fallback
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`שגיאה בהורדת הוידאו: HTTP ${resp.status}`);
  }
  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function runFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(getFfmpegPath(), args, { timeout: EXEC_TIMEOUT_MS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`שגיאת FFmpeg: ${msg}`);
  }
}

async function getVideoInfo(
  filePath: string,
  clientMeta?: { width?: number; height?: number; duration?: number }
): Promise<{ width: number; height: number; duration: number }> {
  // If client provided metadata, use it (avoids needing ffprobe binary on Vercel)
  if (clientMeta?.width && clientMeta?.height) {
    console.log(`[process-video] Using client-provided metadata: ${clientMeta.width}x${clientMeta.height}, duration=${clientMeta.duration || 0}`);
    return {
      width: clientMeta.width,
      height: clientMeta.height,
      duration: clientMeta.duration || 0,
    };
  }

  // Fallback to ffprobe if available
  try {
    const ffprobePath = getFfprobePath();
    const { stdout } = await execFileAsync(ffprobePath, [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,duration",
      "-show_entries", "format=duration",
      "-of", "json",
      filePath,
    ], { timeout: 30_000 });

    const info = JSON.parse(stdout);
    const stream = info.streams?.[0];
    const w = stream?.width;
    const h = stream?.height;
    if (!w || !h) throw new Error("שגיאה בקריאת מידות הוידאו");

    const duration = parseFloat(stream?.duration) || parseFloat(info.format?.duration) || 0;
    return { width: w, height: h, duration };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT")) {
      throw new Error(
        "ffprobe לא זמין בסביבת Vercel. יש לשלוח sourceWidth, sourceHeight ו-sourceDuration מהלקוח."
      );
    }
    throw err;
  }
}

function cleanupFiles(...files: string[]) {
  for (const f of files) {
    try {
      if (existsSync(f)) unlinkSync(f);
    } catch {
      // best-effort cleanup
    }
  }
}

// ── Main handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest, context: Params) {
  const { projectId } = await context.params;
  const tempFiles: string[] = [];

  try {
    const body: ProcessVideoBody = await req.json();
    const {
      sourceVideoUrl,
      trimStart,
      trimEnd,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      hookEnabled,
      hookStartTime,
      hookEndTime,
    } = body;

    if (!sourceVideoUrl) {
      return NextResponse.json(
        { error: "שגיאה: לא סופק קישור לוידאו מקור" },
        { status: 400 },
      );
    }

    if (trimEnd <= trimStart) {
      return NextResponse.json(
        { error: "שגיאה: זמן סיום חייב להיות אחרי זמן התחלה" },
        { status: 400 },
      );
    }

    // ── Check ffmpeg availability ──
    const ffmpegBin = getFfmpegPath();
    if (ffmpegBin === "ffmpeg") {
      // System fallback — check if it actually exists
      try {
        await execFileAsync("which", ["ffmpeg"], { timeout: 5000 });
      } catch {
        return NextResponse.json(
          { error: "שגיאה: ffmpeg לא זמין בסביבת השרת. עיבוד וידאו דורש שרת עם ffmpeg מותקן." },
          { status: 503 },
        );
      }
    }

    // ── Setup temp directory ──
    const tmpDir = path.join("/tmp", `process-video-${projectId}-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    // ── Download source video ──
    console.log(`[process-video] Downloading source video for project ${projectId}...`);
    const sourceBuffer = await downloadFromSupabase(sourceVideoUrl);
    const sourceExt = ".mp4"; // assume mp4
    const sourcePath = path.join(tmpDir, `source${sourceExt}`);
    writeFileSync(sourcePath, sourceBuffer);
    tempFiles.push(sourcePath);
    console.log(`[process-video] Downloaded ${(sourceBuffer.length / 1048576).toFixed(1)}MB`);

    // ── Get video info for crop calculations and duration clamping ──
    const { width: srcWidth, height: srcHeight, duration: srcDuration } = await getVideoInfo(sourcePath, {
      width: body.sourceWidth,
      height: body.sourceHeight,
      duration: body.sourceDuration,
    });
    console.log(`[process-video] Source: ${srcWidth}x${srcHeight}, duration=${srcDuration.toFixed(1)}s`);

    // Clamp trimEnd to actual video duration
    const clampedTrimEnd = srcDuration > 0 ? Math.min(trimEnd, srcDuration) : trimEnd;

    // ── Build the main body segment (trim + crop) ──
    const bodyPath = path.join(tmpDir, `body${sourceExt}`);
    tempFiles.push(bodyPath);

    const trimDuration = clampedTrimEnd - trimStart;

    // Convert percentage-based crop to pixel values
    const pixCropW = Math.round((cropWidth / 100) * srcWidth);
    const pixCropH = Math.round((cropHeight / 100) * srcHeight);
    const pixCropX = Math.round((cropX / 100) * srcWidth);
    const pixCropY = Math.round((cropY / 100) * srcHeight);

    // Ensure crop dimensions are even (required by most codecs)
    const evenCropW = pixCropW % 2 === 0 ? pixCropW : pixCropW - 1;
    const evenCropH = pixCropH % 2 === 0 ? pixCropH : pixCropH - 1;

    const needsCrop = cropX !== 0 || cropY !== 0 || cropWidth < 100 || cropHeight < 100;

    const bodyArgs: string[] = [
      "-y",
      "-i", sourcePath,
      "-ss", String(trimStart),
      "-t", String(trimDuration),
    ];

    if (needsCrop) {
      bodyArgs.push("-vf", `crop=${evenCropW}:${evenCropH}:${pixCropX}:${pixCropY}`);
      bodyArgs.push("-c:v", "libx264", "-preset", "fast", "-crf", "23");
      bodyArgs.push("-c:a", "aac", "-b:a", "128k");
    } else {
      // No crop — re-encode to ensure clean cuts at non-keyframe boundaries
      bodyArgs.push("-c:v", "libx264", "-preset", "fast", "-crf", "23");
      bodyArgs.push("-c:a", "aac", "-b:a", "128k");
    }

    bodyArgs.push("-avoid_negative_ts", "make_zero");
    bodyArgs.push(bodyPath);

    console.log(`[process-video] Processing body: trim ${trimStart}s-${trimEnd}s, crop=${needsCrop}`);
    await runFfmpeg(bodyArgs);

    if (!existsSync(bodyPath)) {
      throw new Error("שגיאה: עיבוד הוידאו נכשל — קובץ הפלט לא נוצר");
    }

    // ── Build hook segment if enabled ──
    let finalPath = bodyPath;

    if (hookEnabled && hookStartTime !== undefined && hookEndTime !== undefined && hookEndTime > hookStartTime) {
      console.log(`[process-video] Processing hook segment: ${hookStartTime}s-${hookEndTime}s`);
      const hookPath = path.join(tmpDir, `hook${sourceExt}`);
      tempFiles.push(hookPath);

      const hookDuration = hookEndTime - hookStartTime;

      const hookArgs: string[] = [
        "-y",
        "-i", sourcePath,
        "-ss", String(hookStartTime),
        "-t", String(hookDuration),
      ];

      if (needsCrop) {
        hookArgs.push("-vf", `crop=${evenCropW}:${evenCropH}:${pixCropX}:${pixCropY}`);
      }

      hookArgs.push("-c:v", "libx264", "-preset", "fast", "-crf", "23");
      hookArgs.push("-c:a", "aac", "-b:a", "128k");
      hookArgs.push("-avoid_negative_ts", "make_zero");
      hookArgs.push(hookPath);

      await runFfmpeg(hookArgs);

      if (!existsSync(hookPath)) {
        throw new Error("שגיאה: עיבוד ההוק נכשל — קובץ הפלט לא נוצר");
      }

      // ── Concatenate hook + body ──
      const concatPath = path.join(tmpDir, `final${sourceExt}`);
      tempFiles.push(concatPath);

      const concatListPath = path.join(tmpDir, "concat.txt");
      tempFiles.push(concatListPath);
      writeFileSync(concatListPath, `file '${hookPath}'\nfile '${bodyPath}'\n`);

      await runFfmpeg([
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concatListPath,
        "-c", "copy",
        "-avoid_negative_ts", "make_zero",
        concatPath,
      ]);

      if (!existsSync(concatPath)) {
        throw new Error("שגיאה: חיבור ההוק לגוף הוידאו נכשל");
      }

      finalPath = concatPath;
    }

    // ── Upload processed video to Supabase ──
    const processedBuffer = readFileSync(finalPath);
    const storagePath = `processed/${projectId}/final-${Date.now()}.mp4`;

    console.log(`[process-video] Uploading processed video (${(processedBuffer.length / 1048576).toFixed(1)}MB) to ${storagePath}...`);

    const uploadResult = await uploadToStorage({
      storagePath,
      buffer: processedBuffer,
      contentType: "video/mp4",
      maxSize: 500 * 1024 * 1024, // 500MB max
      upsert: true,
    });

    console.log(`[process-video] Upload complete: ${uploadResult.publicUrl.slice(0, 100)}...`);

    // ── Cleanup ──
    cleanupFiles(...tempFiles);
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }

    return NextResponse.json({
      processedVideoUrl: uploadResult.publicUrl,
      storagePath: uploadResult.storagePath,
      size: uploadResult.size,
    });
  } catch (err) {
    // Cleanup on error
    cleanupFiles(...tempFiles);

    const msg = err instanceof Error ? err.message : "שגיאה בעיבוד הוידאו";
    console.error(`[process-video] Error for project ${projectId}:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
