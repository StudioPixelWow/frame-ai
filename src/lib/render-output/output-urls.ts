/**
 * PixelManageAI — Output URL Generation & Download Filenames
 *
 * Generates fresh signed URLs from storage keys on every API read.
 * URLs are NEVER stored in the DB — only `output_key` and `thumb_key`
 * are persisted.
 *
 * TTLs:
 *   - Download: 1 hour (single-use intent)
 *   - Preview:  4 hours (player may range-request over a longer session)
 *   - Thumb:    1 hour
 *
 * Storage adapter interface is injected — this module is decoupled
 * from the specific S3/R2/local adapter.
 */

import type { OutputUrls, OutputListItem } from "@/types/render-output";

// ── URL TTL constants ─────────────────────────────────────────────────────

export const DOWNLOAD_URL_TTL_SEC = 3600;      // 1 hour
export const PREVIEW_URL_TTL_SEC = 14400;       // 4 hours
export const THUMB_URL_TTL_SEC = 3600;           // 1 hour

// ── Storage adapter interface (minimal) ───────────────────────────────────

export interface StorageUrlProvider {
  getUrl: (key: string, ttlSeconds: number) => Promise<string>;
}

// ── URL generation ────────────────────────────────────────────────────────

/**
 * Generate fresh signed URLs for an output record.
 *
 * @param outputKey  Storage key for the MP4 file
 * @param thumbKey   Storage key for the thumbnail (null if not generated)
 * @param storage    Storage adapter with getUrl capability
 */
export async function generateOutputUrls(
  outputKey: string,
  thumbKey: string | null,
  storage: StorageUrlProvider,
): Promise<OutputUrls> {
  const [downloadUrl, previewUrl, thumbUrl] = await Promise.all([
    storage.getUrl(outputKey, DOWNLOAD_URL_TTL_SEC),
    storage.getUrl(outputKey, PREVIEW_URL_TTL_SEC),
    thumbKey ? storage.getUrl(thumbKey, THUMB_URL_TTL_SEC) : Promise.resolve(null),
  ]);

  return { downloadUrl, previewUrl, thumbUrl };
}

// ── Download filename builder ─────────────────────────────────────────────

/**
 * Build a descriptive download filename for an output.
 *
 * Format: `pixelmanage-v{version}-{preset}-{aspect}-{duration}s.mp4`
 * Example: `pixelmanage-v3-shift-9x16-30s.mp4`
 *
 * @param output  Output list item with version, preset, aspect ratio, duration
 */
export function buildDownloadFilename(
  output: Pick<OutputListItem, "versionNumber" | "presetLabel" | "aspectRatio" | "durationSec">,
): string {
  const slug = output.presetLabel.toLowerCase().replace(/\s+/g, "-");
  const ar = output.aspectRatio.replace(":", "x"); // '9:16' → '9x16'
  const dur = Math.round(output.durationSec);
  return `pixelmanage-v${output.versionNumber}-${slug}-${ar}-${dur}s.mp4`;
}

// ── File size formatting ──────────────────────────────────────────────────

const BYTES_PER_MB = 1_048_576;

/**
 * Convert file size in bytes to megabytes with 1 decimal place.
 */
export function bytesToMb(bytes: number): number {
  return Math.round((bytes / BYTES_PER_MB) * 10) / 10;
}

// ── Storage key builders ──────────────────────────────────────────────────

/**
 * Build storage key paths for render output artifacts.
 *
 * Uses `outputId` (not `renderId`) as the path component so the key
 * is stable and tied to the output record, surviving job row cleanup.
 *
 * Convention: `renders/{userId}/{projectId}/{outputId}/output.mp4`
 */
export const OutputStorageKeys = {
  output(userId: string, projectId: string, outputId: string): string {
    return `renders/${userId}/${projectId}/${outputId}/output.mp4`;
  },

  thumbnail(userId: string, projectId: string, outputId: string): string {
    return `renders/${userId}/${projectId}/${outputId}/thumb.jpg`;
  },
};
