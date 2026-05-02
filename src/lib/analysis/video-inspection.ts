/**
 * PixelManageAI — Video Inspection
 *
 * Extracts authoritative server-side metadata via ffprobe.
 * The browser's HTMLVideoElement.duration is unreliable for MXF, TS,
 * and long MOV files — ffprobe is the ground truth.
 *
 * This runs as a worker job (< 2s typical).
 */

import type { VideoInspectionOutput } from "@/types/analysis";

// ── ffprobe output shape (subset) ──────────────────────────────────────────

interface FfprobeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  nb_frames?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  channels?: number;
  sample_rate?: string;
}

interface FfprobeFormat {
  duration?: string;
  size?: string;
  format_name?: string;
}

interface FfprobeResult {
  streams: FfprobeStream[];
  format: FfprobeFormat;
}

/**
 * Extract authoritative duration from ffprobe output.
 * Takes the maximum of container-level and stream-level duration.
 */
export function extractDuration(ffprobeOutput: FfprobeResult): number {
  const formatDur = parseFloat(ffprobeOutput.format.duration ?? "0");
  const videoStream = ffprobeOutput.streams.find(
    (s) => s.codec_type === "video",
  );
  const streamDur = parseFloat(videoStream?.duration ?? "0");
  return Math.max(formatDur, streamDur);
}

/**
 * Parse rational frame rate string (e.g. "30000/1001") to decimal.
 */
function parseFrameRate(rate?: string): number {
  if (!rate) return 0;
  const parts = rate.split("/");
  if (parts.length === 2) {
    const num = parseInt(parts[0], 10);
    const den = parseInt(parts[1], 10);
    return den > 0 ? num / den : 0;
  }
  return parseFloat(rate) || 0;
}

/**
 * Parse the full ffprobe JSON output into a VideoInspectionOutput.
 */
export function parseInspectionResult(
  ffprobeOutput: FfprobeResult,
): VideoInspectionOutput {
  const videoStream = ffprobeOutput.streams.find(
    (s) => s.codec_type === "video",
  );
  const audioStream = ffprobeOutput.streams.find(
    (s) => s.codec_type === "audio",
  );

  const durationSec = extractDuration(ffprobeOutput);
  const fps = parseFrameRate(
    videoStream?.avg_frame_rate || videoStream?.r_frame_rate,
  );
  const totalFrames = videoStream?.nb_frames
    ? parseInt(videoStream.nb_frames, 10)
    : Math.round(durationSec * fps);

  return {
    durationSec: Math.round(durationSec * 1000) / 1000,
    totalFrames,
    fps: Math.round(fps * 100) / 100,
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    codec: videoStream?.codec_name ?? "unknown",
    audioChannels: audioStream?.channels ?? 0,
    audioCodec: audioStream?.codec_name ?? "none",
    sampleRate: audioStream?.sample_rate
      ? parseInt(audioStream.sample_rate, 10)
      : 0,
    fileSizeBytes: ffprobeOutput.format.size
      ? parseInt(ffprobeOutput.format.size, 10)
      : 0,
    container: ffprobeOutput.format.format_name ?? "unknown",
    hasSpeech: !!audioStream,
  };
}

/**
 * Build the ffprobe command arguments for a given source URL/path.
 */
export function buildFfprobeCommand(sourcePath: string): string[] {
  return [
    "ffprobe",
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    "-i",
    sourcePath,
  ];
}

/**
 * Build the ffmpeg command to extract audio for transcription.
 *
 * @param sourcePath   Source video path or URL
 * @param clipStartSec Start of clip in seconds
 * @param clipEndSec   End of clip in seconds
 * @param outputPath   Path for output MP3
 */
export function buildAudioExtractionCommand(
  sourcePath: string,
  clipStartSec: number,
  clipEndSec: number,
  outputPath: string,
): string[] {
  return [
    "ffmpeg",
    "-ss",
    clipStartSec.toString(),
    "-to",
    clipEndSec.toString(),
    "-i",
    sourcePath,
    "-vn",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-f",
    "mp3",
    outputPath,
  ];
}
