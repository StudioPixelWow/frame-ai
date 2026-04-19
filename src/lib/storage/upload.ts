/**
 * Shared Supabase Storage upload utility.
 *
 * ALL uploads use a SINGLE bucket: "project-files".
 * The bucket must already exist in Supabase Dashboard.
 * No dynamic bucket creation — just verification + logging.
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
 *    Use for: project docs, milestone attachments
 *
 * Path format: uploads/${Date.now()}.mp4
 */

import { getSupabase } from "@/lib/db/store";

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface UploadOptions {
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

/** Single bucket for ALL uploads. Must exist in Supabase Dashboard. */
const BUCKET = "project-files";

/** Default max file size: 100 MB. */
const MAX_SIZE = 100 * 1024 * 1024;

const RETRY_DELAY_MS = 1500;

/* ── Bucket verification (no creation) ──────────────────────────────────── */

let _bucketVerified = false;

/**
 * Verify the "project-files" bucket exists. Logs the result.
 * Does NOT create the bucket — it must be set up in Supabase Dashboard.
 * Checks only once per process lifetime.
 */
async function verifyBucket(): Promise<void> {
  if (_bucketVerified) return;

  const sb = getSupabase();
  const tag = `[storage:verifyBucket]`;

  try {
    const { data: buckets, error: listErr } = await sb.storage.listBuckets();

    if (listErr) {
      console.warn(`${tag} ⚠️ listBuckets failed: ${listErr.message} — proceeding anyway`);
      _bucketVerified = true;
      return;
    }

    const found = buckets?.find((b: any) => b.name === BUCKET || b.id === BUCKET);
    if (found) {
      const limit = (found as any).file_size_limit;
      const limitMB = limit ? (limit / 1048576).toFixed(0) + "MB" : "unknown";
      console.log(`${tag} ✅ Bucket "${BUCKET}" exists (public=${(found as any).public}, sizeLimit=${limitMB})`);
    } else {
      const available = buckets?.map((b: any) => b.name) || [];
      console.error(`${tag} ❌ Bucket "${BUCKET}" NOT FOUND! Available: [${available.join(", ")}]. Create it in Supabase Dashboard → Storage.`);
    }

    _bucketVerified = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`${tag} ⚠️ Verification error: ${msg} — proceeding anyway`);
    _bucketVerified = true;
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
 * This is the ONLY way to upload files > 4.5MB when deployed on Vercel.
 *
 * Bucket: "project-files" (always).
 * Retry: if createSignedUploadUrl fails, retries once after 1.5s.
 */
export async function getSignedUploadUrl(opts: {
  fileName: string;
  contentType?: string;
  fileSize?: number;
}): Promise<SignedUploadUrlResult> {
  const storagePath = makeStoragePath(opts.fileName);
  const tag = `[storage:getSignedUploadUrl]`;

  // Validate file size if provided
  if (opts.fileSize && opts.fileSize > MAX_SIZE) {
    const sizeMB = (opts.fileSize / 1048576).toFixed(1);
    throw new Error(`File too large (${sizeMB}MB). Maximum is ${MAX_SIZE / 1048576}MB.`);
  }

  console.log(`${tag} START: bucket="${BUCKET}" path="${storagePath}" fileName="${opts.fileName}"`);

  // Verify bucket exists (log only, no creation)
  await verifyBucket();

  const sb = getSupabase();

  // Try up to 2 times
  for (let attempt = 1; attempt <= 2; attempt++) {
    const attemptTag = `${tag} [attempt ${attempt}/2]`;

    console.log(`${attemptTag} Creating signed upload URL for bucket="${BUCKET}"...`);
    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (!error && data?.signedUrl && data?.token) {
      const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl || "";

      console.log(`${attemptTag} ✅ Signed URL created: bucket="${BUCKET}" path=${storagePath} publicUrl=${publicUrl.slice(0, 80)}...`);

      return {
        uploadUrl: data.signedUrl,
        publicUrl,
        storagePath,
        bucket: BUCKET,
        token: data.token,
      };
    }

    // Failed
    const errMsg = error?.message || "Unknown error";
    console.error(`${attemptTag} ❌ createSignedUploadUrl failed for bucket="${BUCKET}": ${errMsg}`);

    if (attempt < 2) {
      console.log(`${attemptTag} Retrying in ${RETRY_DELAY_MS}ms...`);
      _bucketVerified = false; // re-verify on retry
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      await verifyBucket();
    } else {
      throw new Error(`Failed to create upload URL (bucket="${BUCKET}"): ${errMsg}`);
    }
  }

  throw new Error("Failed to create upload URL after retries");
}

/* ══════════════════════════════════════════════════════════════════════════
   Pattern 2: SERVER-SIDE UPLOAD (for small files < 4MB only)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Upload a file to Supabase Storage from the server.
 *
 * Bucket: "project-files" (always).
 *
 * ⚠️  Only use for files < 4MB (Vercel body limit).
 *     For larger files, use getSignedUploadUrl() + client-side PUT.
 */
export async function uploadToStorage(opts: UploadOptions): Promise<UploadResult> {
  const storagePath = opts.storagePath || makeStoragePath(opts.fileName || "file.mp4");
  const contentType = opts.contentType || "application/octet-stream";
  const maxSize = opts.maxSize ?? MAX_SIZE;
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

  console.log(`${tag} START: bucket="${BUCKET}" path="${storagePath}" size=${sizeMB}MB type=${contentType}`);

  // Verify bucket exists (log only, no creation)
  await verifyBucket();

  const sb = getSupabase();
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const attemptTag = `${tag} [attempt ${attempt}/2]`;
    console.log(`${attemptTag} Uploading to bucket="${BUCKET}"...`);

    const t0 = Date.now();
    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert });

    const ms = Date.now() - t0;

    if (!uploadErr) {
      const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl || "";
      console.log(`${attemptTag} ✅ Done (${ms}ms): bucket="${BUCKET}" url=${publicUrl.slice(0, 100)}`);
      return { publicUrl, storagePath, size: buffer.length, bucket: BUCKET };
    }

    lastError = uploadErr.message || "Unknown error";
    console.error(`${attemptTag} ❌ Failed (${ms}ms): bucket="${BUCKET}" error=${lastError}`);

    if (attempt < 2) {
      _bucketVerified = false;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      await verifyBucket();
    }
  }

  throw new Error(`Upload failed after retry (bucket="${BUCKET}"): ${lastError}`);
}
