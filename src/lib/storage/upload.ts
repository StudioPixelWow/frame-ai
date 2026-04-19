/**
 * Shared Supabase Storage upload utility.
 *
 * Every upload flow in the app (video, project files, milestone files, logos)
 * should funnel through this module so bucket creation, error handling, and
 * logging are consistent.
 */

import { getSupabase } from "@/lib/db/store";

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface UploadOptions {
  /** Supabase Storage bucket name (created if missing). */
  bucket: string;
  /** Path inside the bucket, e.g. "uploads/1713500000000.mp4". */
  storagePath: string;
  /** Raw file bytes. */
  buffer: Buffer;
  /** MIME type. Defaults to "application/octet-stream". */
  contentType?: string;
  /** Max allowed file size in bytes. Default: 500 MB. */
  maxSize?: number;
  /** If true, overwrite existing file at storagePath. Default: true. */
  upsert?: boolean;
}

export interface UploadResult {
  publicUrl: string;
  storagePath: string;
  size: number;
  bucket: string;
}

/* ── Bucket cache ───────────────────────────────────────────────────────── */

const _bucketReady = new Set<string>();

/**
 * Ensure a Supabase Storage bucket exists and is public.
 * Caches per bucket name so we only check once per cold start.
 */
export async function ensureBucket(
  bucket: string,
  fileSizeLimit = 500 * 1024 * 1024,
): Promise<void> {
  if (_bucketReady.has(bucket)) return;

  const sb = getSupabase();

  // Check if it exists first
  const { data: buckets } = await sb.storage.listBuckets();
  const exists = buckets?.some((b: any) => b.name === bucket || b.id === bucket);
  if (exists) {
    console.log(`[storage] Bucket "${bucket}" exists`);
    _bucketReady.add(bucket);
    return;
  }

  // Create it
  console.log(`[storage] Creating bucket "${bucket}"...`);
  const { error } = await sb.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit,
  });

  if (error && !error.message?.includes("already exists")) {
    console.error(`[storage] Failed to create bucket "${bucket}":`, error.message);
    throw new Error(`Bucket creation failed: ${error.message}`);
  }

  console.log(`[storage] Bucket "${bucket}" ready`);
  _bucketReady.add(bucket);
}

/* ── Main upload function ───────────────────────────────────────────────── */

/**
 * Upload a file to Supabase Storage.
 *
 * 1. Validates file size
 * 2. Ensures bucket exists (creates if missing, public)
 * 3. Uploads via service role `.upload()`
 * 4. Returns the public URL
 */
export async function uploadToStorage(opts: UploadOptions): Promise<UploadResult> {
  const {
    bucket,
    storagePath,
    buffer,
    contentType = "application/octet-stream",
    maxSize = 500 * 1024 * 1024,
    upsert = true,
  } = opts;

  const sizeMB = (buffer.length / 1048576).toFixed(1);

  // Validate size
  if (buffer.length > maxSize) {
    const maxMB = (maxSize / 1048576).toFixed(0);
    throw new Error(`File too large (${sizeMB}MB). Maximum is ${maxMB}MB.`);
  }

  console.log(`[storage] Uploading: bucket=${bucket} path=${storagePath} size=${sizeMB}MB type=${contentType}`);

  // Ensure bucket exists
  await ensureBucket(bucket, maxSize);

  // Upload
  const sb = getSupabase();
  const { error: uploadErr } = await sb.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType, upsert });

  if (uploadErr) {
    console.error(`[storage] Upload FAILED: bucket=${bucket} path=${storagePath} error=${uploadErr.message}`);
    throw new Error(`Upload failed: ${uploadErr.message}`);
  }

  // Get public URL
  const { data: urlData } = sb.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl || "";

  console.log(`[storage] Upload OK: ${publicUrl.slice(0, 80)}... (${buffer.length} bytes)`);

  return { publicUrl, storagePath, size: buffer.length, bucket };
}

/* ── Convenience: generate a storage path ───────────────────────────────── */

/**
 * Build a storage path like `uploads/1713500000000_a1b2.mp4`.
 * Uses timestamp + random suffix to avoid collisions.
 */
export function makeStoragePath(fileName: string, prefix = "uploads"): string {
  const ext = fileName.includes(".")
    ? "." + fileName.split(".").pop()!.toLowerCase()
    : "";
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}/${Date.now()}_${rand}${ext}`;
}
