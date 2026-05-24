/**
 * Client-side audio extraction for podcast episodes.
 *
 * Uses the existing @ffmpeg/ffmpeg WASM to extract audio from uploaded video
 * files directly in the browser. The resulting MP3 is small enough (~22MB
 * for a 1-hour podcast at 48kbps) to send straight to the Whisper API.
 *
 * This eliminates the need for any server-side ffmpeg — Vercel serverless
 * just downloads the pre-extracted audio and sends it to Whisper.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// CDN base — same version as client-ffmpeg.ts
const CORE_VERSION = '0.12.6';
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let _ffmpeg: FFmpeg | null = null;
let _loading: Promise<FFmpeg> | null = null;

/**
 * Load the ffmpeg WASM instance (singleton — shared with client-ffmpeg.ts
 * if both are used, but each manages its own instance for safety).
 */
async function getFFmpegForAudio(
  onProgress?: (msg: string) => void,
): Promise<FFmpeg> {
  if (_ffmpeg) return _ffmpeg;
  if (_loading) return _loading;

  _loading = (async () => {
    onProgress?.('טוען מנוע חילוץ אודיו...');
    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      console.log(`[client-audio-extract] ${message}`);
    });

    ffmpeg.on('progress', ({ progress }) => {
      const pct = Math.round(progress * 100);
      onProgress?.(`מחלץ אודיו... ${pct}%`);
    });

    const coreURL = await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');

    await ffmpeg.load({ coreURL, wasmURL });

    _ffmpeg = ffmpeg;
    _loading = null;
    return ffmpeg;
  })();

  return _loading;
}

// ── Types ─────────────────────────────────────────────────────────────

export interface AudioExtractionOptions {
  /** The video File object from the upload input */
  videoFile: File;
  /** Progress callback for UI updates */
  onProgress?: (msg: string) => void;
}

export interface AudioExtractionResult {
  /** The extracted audio as a Blob */
  audioBlob: Blob;
  /** Size in bytes */
  sizeBytes: number;
  /** Suggested filename */
  filename: string;
}

// ── Main extraction function ──────────────────────────────────────────

/**
 * Extract audio from a video file using WASM FFmpeg in the browser.
 *
 * Produces a mono MP3 at 16kHz / 48kbps — optimised for speech (Whisper).
 * A 1-hour podcast ≈ 22MB at this bitrate, well under Whisper's 25MB limit.
 *
 * @param opts.videoFile  The source video File from the file input.
 * @param opts.onProgress Optional progress callback.
 * @returns               Blob + metadata for the extracted audio.
 */
export async function extractAudioClientSide(
  opts: AudioExtractionOptions,
): Promise<AudioExtractionResult> {
  const { videoFile, onProgress } = opts;

  const sizeMBInput = Math.round(videoFile.size / 1048576);
  console.log(`[client-audio-extract] Starting — source: ${videoFile.name} (${sizeMBInput}MB)`);

  const ffmpeg = await getFFmpegForAudio(onProgress);

  // Write video to WASM filesystem
  // For large files (>200MB), read in chunks via arrayBuffer to avoid fetchFile overhead
  onProgress?.(`טוען את הסרטון לחילוץ אודיו... (${sizeMBInput}MB)`);
  console.log(`[client-audio-extract] Loading file into WASM filesystem (${sizeMBInput}MB)...`);
  const loadStart = Date.now();

  try {
    // Use arrayBuffer() directly — avoids fetchFile's extra copy for File objects
    const buffer = await videoFile.arrayBuffer();
    console.log(`[client-audio-extract] arrayBuffer() completed in ${((Date.now() - loadStart) / 1000).toFixed(1)}s`);
    const videoData = new Uint8Array(buffer);
    await ffmpeg.writeFile('input_video', videoData);
    console.log(`[client-audio-extract] writeFile() completed — file loaded into WASM FS`);
  } catch (loadErr) {
    const msg = loadErr instanceof Error ? loadErr.message : String(loadErr);
    console.error(`[client-audio-extract] FAILED to load file into WASM: ${msg}`);
    throw new Error(`נכשל טעינת הקובץ לחילוץ אודיו (${sizeMBInput}MB): ${msg}`);
  }

  // Extract audio — mono, 16kHz, 48kbps MP3 (optimal for Whisper, small file)
  onProgress?.(`מחלץ אודיו מהסרטון (${sizeMBInput}MB)...`);
  console.log(`[client-audio-extract] Running ffmpeg exec — extracting audio...`);
  const execStart = Date.now();
  await ffmpeg.exec([
    '-y',
    '-i', 'input_video',
    '-vn',                      // Strip video
    '-acodec', 'libmp3lame',
    '-ar', '16000',             // 16kHz sample rate
    '-ac', '1',                 // Mono
    '-b:a', '48k',              // 48kbps — ~22MB/hour, under Whisper's 25MB limit
    'output.mp3',
  ]);

  console.log(`[client-audio-extract] ffmpeg exec completed in ${((Date.now() - execStart) / 1000).toFixed(1)}s`);

  // Read the output
  const audioData = await ffmpeg.readFile('output.mp3');

  // Clean up WASM filesystem
  try { await ffmpeg.deleteFile('input_video'); } catch { /* ignore */ }
  try { await ffmpeg.deleteFile('output.mp3'); } catch { /* ignore */ }

  if (!(audioData instanceof Uint8Array) || audioData.length < 100) {
    throw new Error('חילוץ האודיו נכשל — הקובץ שהועלה אינו מכיל אודיו תקין');
  }

  // Copy into a fresh ArrayBuffer (WASM buffer may use SharedArrayBuffer)
  const ab = new ArrayBuffer(audioData.byteLength);
  new Uint8Array(ab).set(audioData);
  const blob = new Blob([ab], { type: 'audio/mpeg' });

  const sizeMB = (blob.size / 1048576).toFixed(1);
  console.log(`[client-audio-extract] Done — audio: ${sizeMB}MB`);
  onProgress?.(`אודיו חולץ בהצלחה (${sizeMB}MB)`);

  // Generate filename from video name
  const baseName = videoFile.name.replace(/\.[^.]+$/, '');
  const filename = `${baseName}_audio.mp3`;

  return {
    audioBlob: blob,
    sizeBytes: blob.size,
    filename,
  };
}

/**
 * Release the WASM ffmpeg instance to free memory.
 */
export function terminateAudioFFmpeg(): void {
  if (_ffmpeg) {
    _ffmpeg.terminate();
    _ffmpeg = null;
    _loading = null;
  }
}
