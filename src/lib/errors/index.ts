/**
 * PixelFrameAI — Error Handling & Recovery Module
 *
 * Comprehensive error infrastructure for all failure modes across
 * the upload → analysis → render pipeline. Covers:
 *
 *   - Error code registry (22 codes across 6 categories)
 *   - PixelFrameError class with code + userMessage
 *   - Code-based retry classification (supersedes pattern matching)
 *   - Structured JSONB error_detail for job tables
 *   - Upload file validation (client + server)
 *   - Error banner UI contract (persistent, not toast)
 *   - API error response envelope
 *   - Per-failure recovery handlers (transcript→manual, render→approved)
 *   - Asset key resolution with existence check
 *
 * Usage:
 *   import { PixelFrameError, buildErrorDetail, isRetryableError } from '@/lib/errors';
 */

// Error codes + categories
export {
  categorise,
  NON_RETRYABLE_CODES,
  // Individual codes
  UPLOAD_NETWORK_FAILURE,
  UPLOAD_SIZE_EXCEEDED,
  UPLOAD_TYPE_REJECTED,
  UPLOAD_STORAGE_ERROR,
  VIDEO_PROBE_FAILED,
  VIDEO_CORRUPT,
  VIDEO_UNSUPPORTED_CODEC,
  VIDEO_NO_AUDIO,
  VIDEO_TOO_SHORT,
  TRANSCRIPT_ASR_FAILURE,
  TRANSCRIPT_ASR_QUOTA,
  TRANSCRIPT_EMPTY,
  TRANSCRIPT_LANGUAGE_UNSUPPORTED,
  SEGMENTS_EMPTY,
  SEGMENTS_GENERATION_FAILED,
  RENDER_SOURCE_MISSING,
  RENDER_PROPS_INVALID,
  RENDER_COMPOSITION_FAILED,
  RENDER_COMPOSITION_CRASH,
  RENDER_STORAGE_FAILURE,
  RENDER_POSTPROCESS_FAILED,
  ASSET_KEY_MISSING,
  ASSET_KEY_CORRUPT,
  UNKNOWN_ERROR,
} from "./error-codes";
export type { ErrorCategory, PixelFrameErrorCode } from "./error-codes";

// Error class + retry classification
export {
  PixelFrameError,
  isRetryableError,
  isPixelFrameError,
} from "./pixelframe-error";

// Structured error detail
export {
  buildErrorDetail,
  getUserMessage,
  isDetailRetryable,
} from "./error-detail";
export type { JobErrorDetail, ErrorContext } from "./error-detail";

// Upload validation
export {
  validateFileBeforeUpload,
  validateUploadServer,
  ALLOWED_VIDEO_TYPES,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS_DISPLAY,
} from "./upload-validation";

// Error banner + API error response
export {
  buildErrorBanner,
  buildApiErrorResponse,
} from "./error-banner";
export type {
  ProjectErrorBanner,
  ErrorBannerAction,
  ApiErrorResponse,
} from "./error-banner";

// Recovery handlers
export {
  handleTranscriptExhausted,
  handleSegmentGenerationFailed,
  handleRenderExhausted,
  handleVideoInvalid,
  handleUploadFailed,
  handleMissingAsset,
  resolveAllAssetKeys,
} from "./recovery";
export type {
  RecoveryQueryExecutor,
  StorageExistenceChecker,
} from "./recovery";
