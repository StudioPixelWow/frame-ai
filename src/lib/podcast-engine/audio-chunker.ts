/**
 * FrameAI — Audio Chunker for Podcast Clip Engine
 *
 * Provides chunking logic for splitting long audio files before Whisper
 * transcription. Actual ffmpeg execution happens on the Railway worker;
 * this module generates the chunk plan and ffmpeg commands.
 *
 * All user-facing strings are in Hebrew.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A single audio chunk to be transcribed independently. */
export interface AudioChunk {
  /** Zero-based chunk index. */
  index: number;
  /** Start time in seconds. */
  startTime: number;
  /** End time in seconds. */
  endTime: number;
  /** Expected output file path for this chunk. */
  filePath: string;
}

/** Cost estimate for transcription pipeline. */
export interface TranscriptionCostEstimate {
  /** Whisper API cost in USD. */
  whisperCost: number;
  /** Claude API cost in USD (for analysis pass). */
  claudeCost: number;
  /** Total estimated cost in USD. */
  total: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Default max chunk duration in minutes (Whisper 25MB limit ~ 15 min of mp3). */
const DEFAULT_MAX_CHUNK_MINUTES = 15;

/** Overlap in seconds between chunks to avoid cutting mid-sentence. */
const CHUNK_OVERLAP_S = 5;

/** Whisper API pricing: USD per minute of audio. */
const WHISPER_COST_PER_MINUTE = 0.006;

/** Claude Haiku pricing estimate: USD per 1K input tokens. */
const CLAUDE_INPUT_COST_PER_1K = 0.001;

/** Approximate tokens per minute of spoken audio (average ~150 words/min, ~200 tokens). */
const TOKENS_PER_MINUTE_ESTIMATE = 200;

/** Claude analysis output tokens estimate per episode. */
const CLAUDE_OUTPUT_TOKENS_ESTIMATE = 2000;

/** Claude output cost per 1K tokens. */
const CLAUDE_OUTPUT_COST_PER_1K = 0.005;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate the output file path for a chunk.
 * Pattern: {outputDir}/{basename}_chunk_{NNN}.mp3
 */
function chunkFilePath(outputDir: string, inputPath: string, index: number): string {
  const basename = inputPath
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "") ?? "audio";
  const padded = String(index).padStart(3, "0");
  return `${outputDir}/${basename}_chunk_${padded}.mp3`;
}

// ── Main exports ─────────────────────────────────────────────────────────────

/**
 * Plan audio chunks for Whisper transcription.
 *
 * Splits a long audio file into chunks of at most `maxChunkDurationMinutes`
 * minutes, with a small overlap to avoid sentence-boundary cuts.
 * The actual splitting is done by ffmpeg on the Railway worker —
 * use `buildFfmpegSplitCommand` to generate the commands.
 *
 * @param audioFilePath           Path to the source audio file.
 * @param totalDurationSeconds    Total duration of the audio in seconds.
 * @param maxChunkDurationMinutes Max chunk length in minutes (default: 15).
 * @param outputDir               Directory for chunk output files (default: same as input).
 * @returns                       Array of AudioChunk describing each chunk.
 */
export function chunkAudioForTranscription(
  audioFilePath: string,
  totalDurationSeconds: number,
  maxChunkDurationMinutes: number = DEFAULT_MAX_CHUNK_MINUTES,
  outputDir?: string
): AudioChunk[] {
  if (totalDurationSeconds <= 0) {
    throw new Error("שגיאה: משך האודיו חייב להיות חיובי");
  }
  if (maxChunkDurationMinutes <= 0) {
    throw new Error("שגיאה: משך מקסימלי לקטע חייב להיות חיובי");
  }

  const resolvedOutputDir =
    outputDir ?? (audioFilePath.split("/").slice(0, -1).join("/") || "/tmp");

  const maxChunkS = maxChunkDurationMinutes * 60;

  // If the file is short enough, return a single chunk
  if (totalDurationSeconds <= maxChunkS) {
    return [
      {
        index: 0,
        startTime: 0,
        endTime: totalDurationSeconds,
        filePath: chunkFilePath(resolvedOutputDir, audioFilePath, 0),
      },
    ];
  }

  // Build chunks with overlap
  const chunks: AudioChunk[] = [];
  let start = 0;
  let idx = 0;

  while (start < totalDurationSeconds) {
    const end = Math.min(start + maxChunkS, totalDurationSeconds);
    chunks.push({
      index: idx,
      startTime: start,
      endTime: end,
      filePath: chunkFilePath(resolvedOutputDir, audioFilePath, idx),
    });
    idx++;
    // Advance with overlap (unless we've reached the end)
    start = end >= totalDurationSeconds ? totalDurationSeconds : end - CHUNK_OVERLAP_S;
  }

  return chunks;
}

/**
 * Estimate transcription pipeline cost for a given audio duration.
 *
 * Covers:
 * - Whisper API cost (per-minute pricing)
 * - Claude API cost (input + output tokens for analysis)
 *
 * @param durationSeconds  Total audio duration in seconds.
 * @returns                Cost breakdown in USD.
 */
export function estimateTranscriptionCost(durationSeconds: number): TranscriptionCostEstimate {
  if (durationSeconds <= 0) {
    return { whisperCost: 0, claudeCost: 0, total: 0 };
  }

  const minutes = durationSeconds / 60;

  // Whisper: straightforward per-minute pricing
  const whisperCost = minutes * WHISPER_COST_PER_MINUTE;

  // Claude: input tokens (transcript) + output tokens (analysis)
  const inputTokens = minutes * TOKENS_PER_MINUTE_ESTIMATE;
  const claudeInputCost = (inputTokens / 1000) * CLAUDE_INPUT_COST_PER_1K;
  const claudeOutputCost = (CLAUDE_OUTPUT_TOKENS_ESTIMATE / 1000) * CLAUDE_OUTPUT_COST_PER_1K;
  const claudeCost = claudeInputCost + claudeOutputCost;

  const total = whisperCost + claudeCost;

  return {
    whisperCost: Math.round(whisperCost * 10000) / 10000,
    claudeCost: Math.round(claudeCost * 10000) / 10000,
    total: Math.round(total * 10000) / 10000,
  };
}

/**
 * Build ffmpeg commands to split an audio file according to chunk boundaries.
 *
 * Each command extracts one chunk from the input file. Commands are designed
 * to run sequentially on the Railway worker.
 *
 * @param inputPath  Absolute path to the source audio file.
 * @param outputDir  Directory to write chunk files into.
 * @param chunks     Array of AudioChunk from `chunkAudioForTranscription`.
 * @returns          Array of ffmpeg command strings, one per chunk.
 */
export function buildFfmpegSplitCommand(
  inputPath: string,
  outputDir: string,
  chunks: AudioChunk[]
): string[] {
  if (chunks.length === 0) {
    throw new Error("שגיאה: רשימת הקטעים ריקה — אין מה לפצל");
  }

  return chunks.map((chunk) => {
    const duration = chunk.endTime - chunk.startTime;
    const outputPath = chunkFilePath(outputDir, inputPath, chunk.index);

    // -y: overwrite output, -vn: no video, -acodec libmp3lame: re-encode as mp3
    // -ar 16000: 16kHz sample rate (optimal for Whisper)
    // -ac 1: mono (Whisper handles mono best)
    return [
      "ffmpeg",
      "-y",
      "-i", `"${inputPath}"`,
      "-ss", String(chunk.startTime),
      "-t", String(duration),
      "-vn",
      "-acodec", "libmp3lame",
      "-ar", "16000",
      "-ac", "1",
      "-b:a", "64k",
      `"${outputPath}"`,
    ].join(" ");
  });
}
