/**
 * PixelFrameAI — Analysis Job Types
 *
 * Types for the server-side analysis pipeline that runs between file upload
 * and the user entering Transcript Review (step 8).
 *
 * Two job types are tracked in the DB: video-inspection and transcription.
 * Segment generation is synchronous within the transcription worker.
 */

// ── Job status machine ─────────────────────────────────────────────────────

export type AnalysisJobType = "video-inspection" | "transcription";

export type AnalysisJobStatus =
  | "waiting"    // created but not yet queued (transcription waits for clip)
  | "queued"     // in the Redis queue, worker hasn't picked it up
  | "processing" // worker is actively running
  | "completed"  // finished successfully, output written
  | "failed"     // error occurred, may retry
  | "exhausted"  // all retry attempts failed
  | "superseded"; // output replaced by a newer job (e.g. language change)

export type TranscriptionSubStatus =
  | "extracting_audio"
  | "transcribing"
  | "segmenting";

export type AnalysisTriggerEvent =
  | "post-upload"
  | "post-clip-confirmation"
  | "manual-retry";

// ── Video inspection ───────────────────────────────────────────────────────

export interface VideoInspectionInput {
  sourceVideoKey: string;
  sourceVideoUrl?: string; // pre-signed URL, valid ~30 min
}

export interface VideoInspectionOutput {
  durationSec: number;
  totalFrames: number;
  fps: number;
  width: number;
  height: number;
  codec: string;
  audioChannels: number;
  audioCodec: string;
  sampleRate: number;
  fileSizeBytes: number;
  container: string;
  hasSpeech: boolean;
}

// ── Transcription ──────────────────────────────────────────────────────────

export interface TranscriptionInput {
  sourceVideoKey: string;
  clipStartSec: number;
  clipEndSec: number;
  languageCode: string; // BCP-47 or 'auto'
  provider: string;     // from env TRANSCRIPTION_PROVIDER
  model: string;        // from env TRANSCRIPTION_MODEL
}

export interface TranscriptWord {
  word: string;
  start: number;   // seconds
  end: number;      // seconds
  confidence: number;
}

export interface RawSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  confidence: number;
  withinClip: boolean;
}

export interface TranscriptionOutput {
  segments: RawSegment[];
  words: TranscriptWord[];
  languageDetected: string;
  durationMs: number;
  wordCount: number;
  avgConfidence: number;
}

// ── Analysis job record ────────────────────────────────────────────────────

export interface AnalysisJob {
  id: string;
  projectId: string;
  jobType: AnalysisJobType;
  status: AnalysisJobStatus;
  subStatus: TranscriptionSubStatus | null;
  triggerEvent: AnalysisTriggerEvent | null;
  attempt: number;
  maxAttempts: number;
  progress: number; // 0–100
  input: VideoInspectionInput | TranscriptionInput | null;
  output: VideoInspectionOutput | TranscriptionOutput | null;
  error: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

// ── API response ───────────────────────────────────────────────────────────

export interface AnalysisJobSummary {
  id: string;
  status: AnalysisJobStatus;
  subStatus: TranscriptionSubStatus | null;
  progress: number;
  error: string | null;
  output: VideoInspectionOutput | TranscriptionOutput | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AnalysisStatusResponse {
  projectId: string;
  jobs: Record<string, AnalysisJobSummary>;
  /** Computed convenience flags */
  inspectionComplete: boolean;
  transcriptionComplete: boolean;
  readyForTranscript: boolean; // both complete; step 8 can render
}
