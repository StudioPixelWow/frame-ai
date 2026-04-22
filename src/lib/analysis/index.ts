/**
 * PixelManageAI — Analysis Pipeline Module
 *
 * The server-side pipeline that runs between file upload and Transcript Review.
 * Covers video inspection (ffprobe), clip validation, transcription (ASR),
 * and segment generation.
 *
 * Usage:
 *   import { generateSegments, validateClipRange, parseInspectionResult } from '@/lib/analysis';
 */

// Video inspection
export {
  extractDuration,
  parseInspectionResult,
  buildFfprobeCommand,
  buildAudioExtractionCommand,
} from "./video-inspection";

// Clip validation
export { validateClipRange, reindexSegmentsToClip } from "./clip-validation";
export type { ClipValidationResult } from "./clip-validation";

// Segment generation
export { generateSegments } from "./segment-generation";
export type { SegmentGenerationOptions } from "./segment-generation";

// Transcription
export {
  getTranscriptionConfig,
  isTranscriptionConfigured,
} from "./transcription";
export type {
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult,
  TranscriptionConfig,
} from "./transcription";

// Job status machine
export {
  isValidTransition,
  isRetryableError,
  getRetryDelay,
  getErrorNextStatus,
  subStatusToAnalysisStep,
  subStatusLabel,
} from "./job-status";
