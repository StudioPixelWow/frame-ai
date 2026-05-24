/**
 * Server-side FFmpeg WASM — audio extraction without native binaries.
 *
 * Uses @ffmpeg/ffmpeg (already installed) to run ffmpeg in pure WASM.
 * This works on Vercel serverless where native ffmpeg binaries cannot execute.
 *
 * Loads the WASM core from CDN on first use (~30MB download, cached by Node).
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AudioExtractionResult {
  /** Path to the extracted audio file */
  audioPath: string;
  /** Size in bytes */
  sizeBytes: number;
}

// ── WASM FFmpeg singleton ────────────────────────────────────────────────────

let _ffmpegInstance: any = null;
let _loadingPromise: Promise<any> | null = null;

/**
 * Load the FFmpeg WASM instance (cached — only loads once per cold start).
 */
async function getServerFFmpeg(): Promise<any> {
  if (_ffmpegInstance) return _ffmpegInstance;
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();

    // Log for debugging
    ffmpeg.on('log', ({ message }: { message: string }) => {
      console.log(`[server-ffmpeg-wasm] ${message}`);
    });

    // Load WASM core from CDN
    const CORE_VERSION = '0.12.6';
    const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

    const coreURL = await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');

    await ffmpeg.load({ coreURL, wasmURL });

    _ffmpegInstance = ffmpeg;
    _loadingPromise = null;
    return ffmpeg;
  })();

  return _loadingPromise;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Extract audio from a video file using WASM FFmpeg.
 *
 * Reads the video file into WASM memory, extracts audio as MP3 (16kHz mono 64kbps),
 * and writes the result to disk.
 *
 * @param videoFilePath  Path to the source video file on disk.
 * @param outputDir      Directory to write the extracted audio.
 * @returns              Path and size of the extracted audio file.
 */
export async function extractAudioWasm(
  videoFilePath: string,
  outputDir: string
): Promise<AudioExtractionResult> {
  console.log(`[server-ffmpeg-wasm] Starting audio extraction from ${videoFilePath}`);

  const ffmpeg = await getServerFFmpeg();

  // Read the video file into memory
  const videoData = await readFile(videoFilePath);
  console.log(`[server-ffmpeg-wasm] Video loaded: ${Math.round(videoData.length / 1024 / 1024)}MB`);

  // Write to WASM virtual filesystem
  await ffmpeg.writeFile('input.mp4', new Uint8Array(videoData));

  // Extract audio — mono, 16kHz, 64kbps MP3 (optimal for Whisper)
  await ffmpeg.exec([
    '-y',
    '-i', 'input.mp4',
    '-vn',                      // Strip video
    '-acodec', 'libmp3lame',
    '-ar', '16000',             // 16kHz sample rate
    '-ac', '1',                 // Mono
    '-b:a', '64k',              // 64kbps
    'output.mp3',
  ]);

  // Read the output from WASM filesystem
  const audioData = await ffmpeg.readFile('output.mp3');

  // Clean up WASM filesystem
  try { await ffmpeg.deleteFile('input.mp4'); } catch { /* ignore */ }
  try { await ffmpeg.deleteFile('output.mp3'); } catch { /* ignore */ }

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Write audio to disk
  const audioPath = join(outputDir, 'audio.mp3');

  // Handle both Uint8Array and string returns
  let audioBuffer: Buffer;
  if (audioData instanceof Uint8Array) {
    audioBuffer = Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength);
  } else {
    throw new Error('שגיאה: חילוץ האודיו נכשל — פלט לא תקין מ-WASM');
  }

  await writeFile(audioPath, audioBuffer);

  console.log(`[server-ffmpeg-wasm] Audio extracted: ${Math.round(audioBuffer.length / 1024 / 1024)}MB → ${audioPath}`);

  return {
    audioPath,
    sizeBytes: audioBuffer.length,
  };
}

/**
 * Split an audio file into chunks using WASM FFmpeg.
 * Each chunk is a separate MP3 file of at most `chunkDurationSec` seconds.
 */
export async function splitAudioWasm(
  audioFilePath: string,
  chunkDurationSec: number,
  outputDir: string
): Promise<Array<{ path: string; index: number; startTime: number; endTime: number; duration: number }>> {
  console.log(`[server-ffmpeg-wasm] Splitting ${audioFilePath} into ${chunkDurationSec}s chunks`);

  const ffmpeg = await getServerFFmpeg();

  // Read audio file
  const audioData = await readFile(audioFilePath);
  await ffmpeg.writeFile('input_audio.mp3', new Uint8Array(audioData));

  // Get duration by probing — run a quick exec that will log duration
  // Since we can't use ffprobe in WASM easily, we'll estimate from file size
  // A 64kbps mono MP3 is ~8KB/sec, so duration ≈ fileSize / 8000
  const estimatedDurationSec = Math.ceil(audioData.length / 8000);
  console.log(`[server-ffmpeg-wasm] Estimated audio duration: ${estimatedDurationSec}s`);

  const chunks: Array<{ path: string; index: number; startTime: number; endTime: number; duration: number }> = [];
  let startTime = 0;
  let index = 0;

  await mkdir(outputDir, { recursive: true });

  while (startTime < estimatedDurationSec) {
    const endTime = Math.min(startTime + chunkDurationSec, estimatedDurationSec);
    const duration = endTime - startTime;
    const chunkName = `chunk_${String(index).padStart(3, '0')}.mp3`;

    await ffmpeg.exec([
      '-y',
      '-i', 'input_audio.mp3',
      '-ss', String(startTime),
      '-t', String(duration),
      '-vn',
      '-acodec', 'libmp3lame',
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '64k',
      chunkName,
    ]);

    const chunkData = await ffmpeg.readFile(chunkName);
    if (!(chunkData instanceof Uint8Array) || chunkData.length < 100) {
      // No more audio data — we've passed the actual duration
      try { await ffmpeg.deleteFile(chunkName); } catch { /* ignore */ }
      break;
    }

    const chunkPath = join(outputDir, chunkName);
    await writeFile(chunkPath, Buffer.from(chunkData.buffer, chunkData.byteOffset, chunkData.byteLength));

    try { await ffmpeg.deleteFile(chunkName); } catch { /* ignore */ }

    chunks.push({ path: chunkPath, index, startTime, endTime, duration });
    startTime = endTime;
    index++;
  }

  // Cleanup WASM filesystem
  try { await ffmpeg.deleteFile('input_audio.mp3'); } catch { /* ignore */ }

  console.log(`[server-ffmpeg-wasm] Split into ${chunks.length} chunks`);
  return chunks;
}
