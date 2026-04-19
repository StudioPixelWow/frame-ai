/**
 * Shared Supabase Storage upload utility.
 *
 * TWO upload patterns:
 *
 * 1. DIRECT (client → Supabase, bypasses Vercel):
 *    Server: getSignedUploadUrl() → returns { uploadUrl, publicUrl, storagePath }
 *    Client: PUT file directly to uploadUrl (XHR for progress)
 *    Use for: video uploads, any file > 4MB
 *
 * 2. SERVER-SIDE (for small files only, < 4MB):
 *    uploadToStorage() — receives buffer, uploads via service role
 *    Use for: project-files, milestone-files (already small)
 *
 * Bucket: "videos" — auto-created if missing, public.
 * Path format: uploads/${Date.now()}.mp4
 */

import { getSupabase } from "@/lib/db/store";

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface UploadOptions {
  bucket?: string;
  storagePath?: string;
  fileName?: string;
  buffer: Buffer;
  contentType?: string;
  maxSize?: number;
  upsert?: boolean;
}

export interface UploadResult {
  publicUrl: string;
  storagePath: string;
  size: number;
  bucket: string;
}

export interface SignedUploadUrlResult {
  /** The URL the client should PUT the file to (direct to Supabase CDN). */
  uploadUrl: string;
  /** The public URL the file will be available at after upload. */
  publicUrl: string;
  /** The path inside the bucket. */
  storagePath: string;
  /** The bucket name. */
  bucket: string;
  /** The token for the signed upload. */
  token: string;
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const DEFAULT_BUCKET = "videos";
const DEFAULT_MAX_SIZE = 500 * 1024 * 1024; // 500 MB
const RETRY_DELAY_MS = 1500;

/* ── Bucket cache ───────────────────────────────────────────────────────── */

const _bucketReady = new Set<string>();

/**
 * Ensure a Supabase Storage bucket exists and is public.
 * Caches per bucket name so we only check once per process lifetime.
 */
export async function ensureBucket(bucket: string, fileSizeLimit: number = DEFAULT_MAX_SIZE): Promise<void> {
  if (_bucketReady.has(bucket)) return;

  const sb = getSupabase();
  const tag = `[storage:ensureBucket]`;

  try {
    const { data: buckets, error: listErr } = await sb.storage.listBuckets();
    if (listErr) {
      console.warn(`${tag} listBuckets failed: ${listErr.message} — will try createBucket anyway`);
    }

    const exists = buckets?.some((b: any) => b.name === bucket || b.id === bucket);
    if (exists) {
      console.log(`${tag} ✅ Bucket "${bucket}" exists`);
      _bucketReady.add(bucket);
      return;
    }

    console.log(`${tag} Creating bucket "${bucket}" (public, limit=${(fileSizeLimit / 1048576).toFixed(0)}MB)...`);
    const { error: createErr } = await sb.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit,
    });

    if (createErr) {
      if (createErr.message?.includes("already exists")) {
        console.log(`${tag} ✅ Bucket "${bucket}" already exists (race condition — OK)`);
        _bucketReady.add(bucket);
        return;
      }
      console.error(`${tag} ❌ Failed to create bucket "${bucket}": ${createErr.message}`);
      throw new Error(`Bucket creation failed: ${createErr.message}`);
    }

    console.log(`${tag} ✅ Bucket "${bucket}" created successfully`);
    _bucketReady.add(bucket);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Bucket creation failed")) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ Unexpected error: ${msg}`);
    throw new Error(`Bucket setup error: ${msg}`);
  }
}

/* ── Path generation ────────────────────────────────────────────────────── */

/**
 * Generate storage path: uploads/${Date.now()}.ext
 */
export function makeStoragePath(fileName: string): string {
  const ext = fileName.includes(".")
    ? "." + fileName.split(".").pop()!.toLowerCase()
    : ".mp4";
  return `uploads/${Date.now()}${ext}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Pattern 1: DIRECT UPLOAD (client → Supabase, bypasses Vercel)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a signed upload URL so the CLIENT can PUT a file directly
 * to Supabase Storage — the file never touches the Next.js server.
 *
 * This is the ONLY way to upload files > 4.5MB when deployed on Vercel,
 * because Vercel serverless functions have a hard body-size limit.
 *
 * Flow:
 *   1. Ensure bucket exists
 *   2. Generate storage path
 *   3. createSignedUploadUrl (service role — bypasses RLS)
 *   4. Return { uploadUrl, publicUrl, storagePath, token }
 *
 * Retry: if createSignedUploadUrl fails, clears bucket cache and retries once.
 */
export async function getSignedUploadUrl(opts: {
  fileName: string;
  contentType?: string;
  fileSize?: number;
  bucket?: string;
}): Promise<SignedUploadUrlResult> {
  const bucket = opts.bucket || DEFAULT_BUCKET;
  const storagePath = makeStoragePath(opts.fileName);
  const tag = `[storage:getSignedUploadUrl]`;

  // Validate file size if provided
  if (opts.fileSize && opts.fileSize > DEFAULT_MAX_SIZE) {
    const sizeMB = (opts.fileSize / 1048576).toFixed(1);
    throw new Error(`File too large (${sizeMB}MB). Maximum is ${DEFAULT_MAX_SIZE / 1048576}MB.`);
  }

  console.log(`${tag} START: bucket="${bucket}" path="${storagePath}" fileName="${opts.fileName}"`);

  const sb = getSupabase();

  // Try up to 2 times
  for (let attempt = 1; attempt <= 2; attempt++) {
    const attemptTag = `${tag} [attempt ${attempt}/2]`;

    // Ensure bucket exists before creating signed URL
    await ensureBucket(bucket);

    console.log(`${attemptTag} Creating signed upload URL...`);
    const { data, error } = await sb.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (!error && data?.signedUrl && data?.token) {
      // Get the public URL this file will have after upload
      const { data: urlData } = sb.storage.from(bucket).getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl || "";

      console.log(`${attemptTag} ✅ Signed URL created: path=${storagePath} publicUrl=${publicUrl.slice(0, 80)}...`);

      return {
        uploadUrl: data.signedUrl,
        publicUrl,
        storagePath,
        bucket,
        token: data.token,
      };
    }

    // Failed
    const errMsg = error?.message || "Unknown error";
    console.error(`${attemptTag} ❌ createSignedUploadUrl failed: ${errMsg}`);

    if (attempt < 2) {
      console.log(`${attemptTag} Clearing bucket cache and retrying in ${RETRY_DELAY_MS}ms...`);
      _bucketReady.delete(bucket);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      throw new Error(`Failed to create upload URL: ${errMsg}`);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error("Failed to create upload URL after retries");
}

/* ══════════════════════════════════════════════════════════════════════════
   Pattern 2: SERVER-SIDE UPLOAD (for small files < 4MB only)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Upload a file to Supabase Storage from the server.
 *
 * ⚠️  Only use for files < 4MB (Vercel body limit).
 *     For larger files, use getSignedUploadUrl() + client-side PUT.
 */
export async function uploadToStorage(opts: UploadOptions): Promise<UploadResult> {
  const bucket = opts.bucket || DEFAULT_BUCKET;
  const storagePath = opts.storagePath || makeStoragePath(opts.fileName || "file.mp4");
  const contentType = opts.contentType || "application/octet-stream";
  const maxSize = opts.maxSize ?? DEFAULT_MAX_SIZE;
  const upsert = opts.upsert ?? true;
  const { buffer } = opts;

  const sizeMB = (buffer.length / 1048576).toFixed(1);
  const tag = `[storage:upload]`;

  if (buffer.length === 0) {
    throw new Error("File is empty");
  }

  if (buffer.length > maxSize) {
    throw new Error(`File too large (${sizeMB}MB). Maximum is ${(maxSize / 1048576).toFixed(0)}MB.`);
  }

  console.log(`${tag} START: bucket="${bucket}" path="${storagePath}" size=${sizeMB}MB type=${contentType}`);

  await ensureBucket(bucket, maxSize);

  const sb = getSupabase();
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const attemptTag = `${tag} [attempt ${attempt}/2]`;
    console.log(`${attemptTag} Uploading...`);

    const t0 = Date.now();
    const { error: uploadErr } = await sb.storage
      .from(bucket)
      .upload(storagePath, buffer, { contentType, upsert });

    const ms = Date.now() - t0;

    if (!uploadErr) {
      const { data: urlData } = sb.storage.from(bucket).getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl || "";
      console.log(`${attemptTag} ✅ Done (${ms}ms): ${publicUrl.slice(0, 100)}`);
      return { publicUrl, storagePath, size: buffer.length, bucket };
    }

    lastError = uploadErr.message || "Unknown error";
    console.error(`${attemptTag} ❌ Failed (${ms}ms): ${lastError}`);

    if (attempt < 2) {
      _bucketReady.delete(bucket);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      await ensureBucket(bucket, maxSize);
    }
  }

  throw new Error(`Upload failed after retry: ${lastError}`);
}
