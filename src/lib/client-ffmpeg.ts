/**
 * Client-side video processing using ffmpeg.wasm (WebAssembly).
 *
 * Runs entirely in the browser — no server binary needed.
 * Uses the single-threaded core (no SharedArrayBuffer / COOP/COEP headers required).
 *
 * Install: npm install @ffmpeg/ffmpeg @ffmpeg/util
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// CDN base for the single-threaded core (no SharedArrayBuffer needed)
const CORE_VERSION = "0.12.6";
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let _ffmpeg: FFmpeg | null = null;
let _loading: Promise<FFmpeg> | null = null;

/**
 * Load the ffmpeg WASM instance (cached — only loads once per page).
 * The first call downloads ~30MB of WASM from CDN.
 */
export async function getFFmpeg(
  onProgress?: (msg: string) => void,
): Promise<FFmpeg> {
  if (_ffmpeg) return _ffmpeg;
  if (_loading) return _loading;

  _loading = (async () => {
    onProgress?.("טוען מנוע עיבוד וידאו...");
    const ffmpeg = new FFmpeg();

    // Log ffmpeg output for debugging
    ffmpeg.on("log", ({ message }) => {
      console.log(`[ffmpeg.wasm] ${message}`);
    });

    // Progress callback
    ffmpeg.on("progress", ({ progress }) => {
      const pct = Math.round(progress * 100);
      onProgress?.(`מעבד וידאו... ${pct}%`);
    });

    const coreURL = await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, "text/javascript");
    const wasmURL = await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, "application/wasm");

    await ffmpeg.load({ coreURL, wasmURL });

    _ffmpeg = ffmpeg;
    _loading = null;
    return ffmpeg;
  })();

  return _loading;
}

/**
 * Release the ffmpeg instance (frees WASM memory).
 */
export function terminateFFmpeg() {
  if (_ffmpeg) {
    _ffmpeg.terminate();
    _ffmpeg = null;
    _loading = null;
  }
}

// ── Types ─────────────────────────────────────────────────────────────

export interface ProcessVideoOptions {
  /** Video source — URL string or Blob */
  source: string | Blob;
  trimStart: number;
  trimEnd: number;
  /** Crop values as 0-100 percentages */
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  /** Source video dimensions (from <video> element) */
  sourceWidth: number;
  sourceHeight: number;
  sourceDuration: number;
  /** Hook segment (optional) */
  hookEnabled: boolean;
  hookStartTime?: number;
  hookEndTime?: number;
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface ProcessVideoResult {
  /** The processed video as a Blob */
  blob: Blob;
  /** Size in bytes */
  size: number;
}

// ── Main processing function ─────────────────────────────────────────

export async function processVideoClientSide(
  opts: ProcessVideoOptions,
): Promise<ProcessVideoResult> {
  const {
    source,
    trimStart,
    trimEnd,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    sourceWidth,
    sourceHeight,
    sourceDuration,
    hookEnabled,
    hookStartTime,
    hookEndTime,
    onProgress,
  } = opts;

  const ffmpeg = await getFFmpeg(onProgress);

  // ── Write source video to WASM filesystem ──
  onProgress?.("טוען את הוידאו לעיבוד...");
  const sourceData = await fetchFile(source);
  await ffmpeg.writeFile("input.mp4", sourceData);

  // ── Calculate crop values ──
  const clampedTrimEnd = sourceDuration > 0 ? Math.min(trimEnd, sourceDuration) : trimEnd;
  const trimDuration = clampedTrimEnd - trimStart;

  const pixCropW = Math.round((cropWidth / 100) * sourceWidth);
  const pixCropH = Math.round((cropHeight / 100) * sourceHeight);
  const pixCropX = Math.round((cropX / 100) * sourceWidth);
  const pixCropY = Math.round((cropY / 100) * sourceHeight);

  // Ensure even dimensions (required by most codecs)
  const evenCropW = pixCropW % 2 === 0 ? pixCropW : pixCropW - 1;
  const evenCropH = pixCropH % 2 === 0 ? pixCropH : pixCropH - 1;

  const needsCrop = cropX !== 0 || cropY !== 0 || cropWidth < 100 || cropHeight < 100;

  // ── Process body segment (trim + crop) ──
  onProgress?.("חותך ומעבד את הוידאו...");

  const bodyArgs: string[] = [
    "-y",
    "-i", "input.mp4",
    "-ss", String(trimStart),
    "-t", String(trimDuration),
  ];

  if (needsCrop) {
    bodyArgs.push("-vf", `crop=${evenCropW}:${evenCropH}:${pixCropX}:${pixCropY}`);
  }

  // Use ultrafast preset for browser — speed over compression
  bodyArgs.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "28");
  bodyArgs.push("-c:a", "aac", "-b:a", "128k");
  bodyArgs.push("-avoid_negative_ts", "make_zero");
  bodyArgs.push("body.mp4");

  console.log(`[client-ffmpeg] Body args:`, bodyArgs.join(" "));
  await ffmpeg.exec(bodyArgs);

  // ── Process hook segment if enabled ──
  let finalFile = "body.mp4";

  if (
    hookEnabled &&
    hookStartTime !== undefined &&
    hookEndTime !== undefined &&
    hookEndTime > hookStartTime
  ) {
    onProgress?.("מעבד את ההוק...");
    const hookDuration = hookEndTime - hookStartTime;

    const hookArgs: string[] = [
      "-y",
      "-i", "input.mp4",
      "-ss", String(hookStartTime),
      "-t", String(hookDuration),
    ];

    if (needsCrop) {
      hookArgs.push("-vf", `crop=${evenCropW}:${evenCropH}:${pixCropX}:${pixCropY}`);
    }

    hookArgs.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "28");
    hookArgs.push("-c:a", "aac", "-b:a", "128k");
    hookArgs.push("-avoid_negative_ts", "make_zero");
    hookArgs.push("hook.mp4");

    console.log(`[client-ffmpeg] Hook args:`, hookArgs.join(" "));
    await ffmpeg.exec(hookArgs);

    // ── Concatenate hook + body ──
    onProgress?.("מחבר הוק + גוף הוידאו...");
    await ffmpeg.writeFile("concat.txt", "file 'hook.mp4'\nfile 'body.mp4'\n");

    await ffmpeg.exec([
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", "concat.txt",
      "-c", "copy",
      "-avoid_negative_ts", "make_zero",
      "final.mp4",
    ]);

    finalFile = "final.mp4";

    // Cleanup intermediate files
    try { await ffmpeg.deleteFile("hook.mp4"); } catch { /* ignore */ }
    try { await ffmpeg.deleteFile("concat.txt"); } catch { /* ignore */ }
  }

  // ── Read result ──
  onProgress?.("שומר את הוידאו המעובד...");
  const outputData = await ffmpeg.readFile(finalFile);
  const blob = new Blob([outputData], { type: "video/mp4" });

  // Cleanup WASM filesystem
  try { await ffmpeg.deleteFile("input.mp4"); } catch { /* ignore */ }
  try { await ffmpeg.deleteFile("body.mp4"); } catch { /* ignore */ }
  try { await ffmpeg.deleteFile(finalFile); } catch { /* ignore */ }

  console.log(`[client-ffmpeg] Done — output size: ${(blob.size / 1048576).toFixed(1)}MB`);

  return { blob, size: blob.size };
}
