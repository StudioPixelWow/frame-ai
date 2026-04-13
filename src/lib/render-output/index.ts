/**
 * PixelFrameAI — Render Output Module
 *
 * Durable render output records — the permanent artifact layer
 * that survives job retention expiry. Covers:
 *   - Output record creation (transactional, versioned)
 *   - Version promotion (make primary)
 *   - Signed URL generation (download, preview, thumbnail)
 *   - Download filename builder
 *   - Lifecycle management (archive, restore, soft-delete)
 *   - Storage cleanup (nightly purge of expired soft-deletes)
 *
 * Usage:
 *   import { createOutputRecord, generateOutputUrls } from '@/lib/render-output';
 */

// Output record creation + version promotion
export {
  createOutputRecord,
  promoteOutputToPrimary,
} from "./output-record";
export type {
  TransactionExecutor,
  TransactionRunner,
  RenderJobRow,
} from "./output-record";

// URL generation + download filenames
export {
  generateOutputUrls,
  buildDownloadFilename,
  bytesToMb,
  OutputStorageKeys,
  DOWNLOAD_URL_TTL_SEC,
  PREVIEW_URL_TTL_SEC,
  THUMB_URL_TTL_SEC,
} from "./output-urls";
export type { StorageUrlProvider } from "./output-urls";

// Lifecycle management + cleanup
export {
  isValidOutputTransition,
  archiveOutput,
  restoreOutput,
  softDeleteOutput,
  runOutputCleanup,
  DELETION_GRACE_PERIOD_DAYS,
} from "./output-lifecycle";
export type {
  QueryExecutor,
  StorageDeleteProvider,
} from "./output-lifecycle";
