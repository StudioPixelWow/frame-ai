/**
 * PixelManageAI — Upload File Validation
 *
 * Client-side gating in the wizard (step 2) — fast rejection before
 * any bytes are sent. Server-side validation repeats these checks
 * independently (never trust client-only validation).
 */

import { PixelManageError } from "./pixelmanage-error";

// ── Allowed types ─────────────────────────────────────────────────────────

export const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/x-matroska",
]);

export const MAX_FILE_SIZE_BYTES = 4 * 1024 ** 3; // 4 GB

export const ALLOWED_EXTENSIONS_DISPLAY = "MP4, MOV, AVI, WebM, MKV";

// ── Validation ────────────────────────────────────────────────────────────

/**
 * Validate a file before starting the upload.
 *
 * Returns `null` if the file is acceptable, or a `PixelManageError`
 * describing the rejection reason.
 *
 * @param file  The File object from the file input
 */
export function validateFileBeforeUpload(
  file: { type: string; size: number; name?: string },
): PixelManageError | null {
  // Type check
  if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
    const displayType = file.type || "unknown";
    return new PixelManageError(
      "UPLOAD_TYPE_REJECTED",
      `File type "${displayType}" is not supported. Please upload an ${ALLOWED_EXTENSIONS_DISPLAY} file.`,
    );
  }

  // Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeGb = (file.size / 1024 ** 3).toFixed(1);
    return new PixelManageError(
      "UPLOAD_SIZE_EXCEEDED",
      `File is ${sizeGb} GB. Maximum supported size is 4 GB.`,
    );
  }

  return null;
}

/**
 * Validate a file on the server side (mirrors client checks).
 *
 * @param mimeType   MIME type from the upload request
 * @param sizeBytes  Content-Length from the request
 */
export function validateUploadServer(
  mimeType: string,
  sizeBytes: number,
): PixelManageError | null {
  if (!ALLOWED_VIDEO_TYPES.has(mimeType)) {
    return new PixelManageError(
      "UPLOAD_TYPE_REJECTED",
      `File type "${mimeType}" is not supported. Please upload an ${ALLOWED_EXTENSIONS_DISPLAY} file.`,
    );
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    const sizeGb = (sizeBytes / 1024 ** 3).toFixed(1);
    return new PixelManageError(
      "UPLOAD_SIZE_EXCEEDED",
      `File is ${sizeGb} GB. Maximum supported size is 4 GB.`,
    );
  }

  return null;
}
