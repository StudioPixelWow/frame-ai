/**
 * FrameAI — FFmpeg Execution Service for Podcast Clip Engine
 *
 * Wraps ffmpeg commands for audio extraction, chunking, and segment cutting.
 * Uses child_process.execFile for safe, shell-injection-free execution.
 *
 * All user-facing strings are in Hebrew.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

// ── Types ────────────────────────────────────────────────────────────────────

/** A single audio chunk produced by splitting a longer audio file. */
export interface AudioChunk {
  /** Absolute path to the chunk file. */
  path: string;
  /** Zero-based chunk index. */
  index: number;
  /** Start time in seconds relative to the original file. */
  startTime: number;
  /** End time in seconds relative to the original file. */
  endTime: number;
  /** Duration of this chunk in seconds. */
  duration: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Default audio sample rate for Whisper-optimized output. */
const WHISPER_SAMPLE_RATE = "16000";

/** Default audio channels (mono) for Whisper. */
const WHISPER_CHANNELS = "1";

/** Default audio bitrate for compressed chunks. */
const DEFAULT_BITRATE = "64k";

/** Max ffmpeg execution time in milliseconds (10 minutes). */
const EXEC_TIMEOUT_MS = 10 * 60 * 1000;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate that a file exists on disk. Throws with a Hebrew message if not.
 */
function assertFileExists(filePath: string, label: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`שגיאה: הקובץ ${label} לא נמצא — ${filePath}`);
  }
}

/**
 * Run ffmpeg with the given arguments. Returns stdout/stderr.
 */
async function runFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync("ffmpeg", args, { timeout: EXEC_TIMEOUT_MS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`שגיאת FFmpeg: ${msg}`);
  }
}

/**
 * Get the duration of a media file in seconds using ffprobe.
 */
async function getMediaDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ], { timeout: 30_000 });

    const duration = parseFloat(stdout.trim());
    if (isNaN(duration) || duration <= 0) {
      throw new Error("משך הקובץ לא תקין");
    }
    return duration;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`שגיאה בקריאת משך הקובץ: ${msg}`);
  }
}

// ── Main exports ────────────────────────────────────────────────────────────

/**
 * Extract the audio track from a video file as MP3 (Whisper-optimized).
 *
 * Output is mono, 16kHz sample rate, 64kbps — optimal for Whisper transcription.
 *
 * @param videoFilePath  Absolute path to the source video file.
 * @param outputDir      Directory to write the extracted audio into.
 * @returns              Absolute path to the extracted audio file.
 */
export async function extractAudio(
  videoFilePath: string,
  outputDir: string
): Promise<string> {
  assertFileExists(videoFilePath, "וידאו מקור");

  const basename = path.basename(videoFilePath, path.extname(videoFilePath));
  const outputPath = path.join(outputDir, `${basename}.mp3`);

  await runFfmpeg([
    "-y",
    "-i", videoFilePath,
    "-vn",                       // strip video
    "-acodec", "libmp3lame",
    "-ar", WHISPER_SAMPLE_RATE,  // 16kHz
    "-ac", WHISPER_CHANNELS,     // mono
    "-b:a", DEFAULT_BITRATE,
    outputPath,
  ]);

  if (!existsSync(outputPath)) {
    throw new Error("שגיאה: חילוץ האודיו נכשל — קובץ הפלט לא נוצר");
  }

  return outputPath;
}

/**
 * Split an audio file into sequential chunks of a given duration.
 *
 * Uses ffmpeg to cut segments without re-encoding where possible.
 * Each chunk is written as an MP3 file optimised for Whisper.
 *
 * @param audioPath         Absolute path to the source audio file.
 * @param chunkDurationSec  Maximum duration of each chunk in seconds.
 * @param outputDir         Directory to write chunk files into.
 * @returns                 Array of AudioChunk describing each produced file.
 */
export async function splitAudioIntoChunks(
  audioPath: string,
  chunkDurationSec: number,
  outputDir: string
): Promise<AudioChunk[]> {
  assertFileExists(audioPath, "אודיו מקור");

  if (chunkDurationSec <= 0) {
    throw new Error("שגיאה: משך הקטע חייב להיות חיובי");
  }

  const totalDuration = await getMediaDuration(audioPath);
  const basename = path.basename(audioPath, path.extname(audioPath));
  const chunks: AudioChunk[] = [];

  let startTime = 0;
  let index = 0;

  while (startTime < totalDuration) {
    const endTime = Math.min(startTime + chunkDurationSec, totalDuration);
    const duration = endTime - startTime;
    const paddedIndex = String(index).padStart(3, "0");
    const chunkPath = path.join(outputDir, `${basename}_chunk_${paddedIndex}.mp3`);

    await runFfmpeg([
      "-y",
      "-i", audioPath,
      "-ss", String(startTime),
      "-t", String(duration),
      "-vn",
      "-acodec", "libmp3lame",
      "-ar", WHISPER_SAMPLE_RATE,
      "-ac", WHISPER_CHANNELS,
      "-b:a", DEFAULT_BITRATE,
      chunkPath,
    ]);

    if (!existsSync(chunkPath)) {
      throw new Error(`שגיאה: יצירת קטע ${index} נכשלה — קובץ הפלט לא נוצר`);
    }

    chunks.push({
      path: chunkPath,
      index,
      startTime,
      endTime,
      duration,
    });

    startTime = endTime;
    index++;
  }

  if (chunks.length === 0) {
    throw new Error("שגיאה: לא נוצרו קטעים — ייתכן שהקובץ ריק");
  }

  return chunks;
}

/**
 * Cut a specific time segment from a media file.
 *
 * Preserves original encoding where possible (stream copy). Falls back to
 * re-encoding if the container format requires it.
 *
 * @param inputPath   Absolute path to the source media file.
 * @param startTime   Start time in seconds.
 * @param endTime     End time in seconds.
 * @param outputPath  Absolute path for the output file.
 */
export async function cutSegment(
  inputPath: string,
  startTime: number,
  endTime: number,
  outputPath: string
): Promise<void> {
  assertFileExists(inputPath, "קובץ מקור");

  if (startTime < 0) {
    throw new Error("שגיאה: זמן התחלה לא יכול להיות שלילי");
  }
  if (endTime <= startTime) {
    throw new Error("שגיאה: זמן סיום חייב להיות אחרי זמן התחלה");
  }

  const duration = endTime - startTime;

  await runFfmpeg([
    "-y",
    "-i", inputPath,
    "-ss", String(startTime),
    "-t", String(duration),
    "-c", "copy",          // stream copy — fast, no quality loss
    "-avoid_negative_ts", "make_zero",
    outputPath,
  ]);

  if (!existsSync(outputPath)) {
    throw new Error("שגיאה: חיתוך הסגמנט נכשל — קובץ הפלט לא נוצר");
  }
}
