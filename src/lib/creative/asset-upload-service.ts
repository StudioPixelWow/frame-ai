/**
 * Asset Upload Service — Creative Studio
 *
 * Handles uploading brand assets (logos, reference images, competitor samples,
 * approved/rejected creatives) to Supabase Storage and recording them in the DB.
 *
 * TWO upload patterns (mirrors the existing upload utility conventions):
 *  1. uploadBrandAsset  — server-side buffer upload (files < 4 MB)
 *  2. getAssetUploadUrl — signed URL for large files (client-side direct upload)
 *
 * Storage bucket : "project-files" (single shared bucket, must exist in Supabase)
 * Path format    : brand-assets/{clientId}/{assetType}/{timestamp}-{filename}
 */

import { uploadToStorage, getSignedUploadUrl } from '@/lib/storage/upload';
import { brandAssets } from '@/lib/db/collections';
import type { BrandAsset, BrandAssetType } from '@/lib/db/schema';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface UploadBrandAssetParams {
  clientId: string;
  file: {
    buffer: Buffer;
    name: string;
    type: string;  // MIME type, e.g. "image/jpeg"
    size: number;  // bytes
  };
  /** Must match BrandAssetType: 'logo' | 'brand_guideline' | 'approved_ad' | 'rejected_ad' | ... */
  assetType: BrandAssetType;
  title?: string;
  description?: string;
  tags?: string[];
  isApprovedReference?: boolean;   // לקוח אישר — ייכלל בניתוח DNA
  isRejectedReference?: boolean;   // לקוח דחה — ייכלל כנגטיב בניתוח DNA
  isCompetitorReference?: boolean; // תמונת מתחרה לעיון בלבד
  notes?: string;
  uploadedBy?: string | null;
}

export interface GetAssetUploadUrlParams {
  clientId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface AssetUploadUrlResult {
  /** PUT this URL directly from the browser — bypasses Vercel body limit. */
  signedUrl: string;
  /** Storage path inside the bucket — pass to createBrandAssetRecord() after upload. */
  storagePath: string;
  /** Public URL the asset will be available at once the PUT completes. */
  publicUrl?: string;
}

/* ── Path generation ────────────────────────────────────────────────────── */

/**
 * Generates a deterministic, human-readable storage path for brand assets.
 * Format: brand-assets/{clientId}/{assetType}/{timestamp}-{sanitizedFilename}
 */
function makeBrandAssetPath(
  clientId: string,
  assetType: string,
  fileName: string,
): string {
  const sanitizedName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-');
  return `brand-assets/${clientId}/${assetType}/${Date.now()}-${sanitizedName}`;
}

/* ── Main upload function ────────────────────────────────────────────────── */

/**
 * Upload a brand asset file to Supabase Storage and create a DB record.
 *
 * Use for server-side uploads of files under ~4 MB.
 * For larger files (e.g., full-res campaign images, video references) use
 * getAssetUploadUrl() so the browser uploads directly to Supabase Storage.
 *
 * @returns The created BrandAsset DB record (includes the public URL).
 */
export async function uploadBrandAsset(
  params: UploadBrandAssetParams,
): Promise<BrandAsset> {
  const {
    clientId,
    file,
    assetType,
    title,
    description,
    tags = [],
    isApprovedReference = false,
    isRejectedReference = false,
    isCompetitorReference = false,
    notes,
    uploadedBy = null,
  } = params;

  const storagePath = makeBrandAssetPath(clientId, assetType, file.name);

  // Upload buffer to Supabase Storage (Pattern 2 — server-side, < 4 MB)
  const uploadResult = await uploadToStorage({
    buffer: file.buffer,
    storagePath,
    contentType: file.type,
    upsert: false,
  });

  // Create the DB record using the actual BrandAsset field names from schema
  const now = new Date().toISOString();
  const asset = await brandAssets.createAsync({
    clientId,
    uploadedBy,
    assetType,
    assetCategory: null,
    title: title ?? file.name,
    description: description ?? '',
    fileUrl: uploadResult.publicUrl,
    filePath: uploadResult.storagePath,
    fileName: file.name,
    fileMimeType: file.type,
    fileSize: file.size,
    thumbnailUrl: '',
    sourceType: 'manual_upload',
    status: 'active',
    isApprovedReference,
    isRejectedReference,
    isCompetitorReference,
    tags,
    // AI analysis fields — populated later by analyzeAsset()
    // TODO: trigger analyzeAsset() here once Vision AI is integrated
    aiSummary: '',
    aiExtractedColors: [],
    aiDetectedStyle: {},
    aiDetectedText: {},
    aiVisualFeatures: {},
    createdAt: now,
    updatedAt: now,
  } as Omit<BrandAsset, 'id'>);

  console.log(
    `[asset-upload-service] Uploaded brand asset id=${asset.id} clientId=${clientId} path=${storagePath}`,
  );

  return asset;
}

/* ── Signed URL for large files ─────────────────────────────────────────── */

/**
 * Generate a signed upload URL for large brand asset files.
 *
 * The browser PUTs the file directly to this URL (bypassing the Next.js
 * server entirely, so no 4 MB Vercel body limit applies).
 *
 * After the browser finishes the PUT, call createBrandAssetRecord() to write
 * the DB record with the storagePath returned here.
 *
 * @returns { signedUrl, storagePath } — the client uses signedUrl to PUT,
 *          then sends storagePath back so the server can create the DB record.
 */
export async function getAssetUploadUrl(
  params: GetAssetUploadUrlParams,
): Promise<AssetUploadUrlResult> {
  const { clientId, fileName, contentType, fileSize } = params;

  // We pass the desired path as the fileName so upload.ts uses our convention.
  // upload.ts internally calls makeStoragePath(fileName) which extracts the
  // extension and prepends "uploads/". To get our brand-assets/ prefix we
  // build the full path ourselves and pass it directly.
  const storagePath = makeBrandAssetPath(clientId, 'uploads', fileName);

  const result = await getSignedUploadUrl({
    fileName,
    contentType,
    fileSize,
  });

  return {
    signedUrl: result.uploadUrl,
    storagePath: result.storagePath,
    publicUrl: result.publicUrl,
  };
}

/* ── Create DB record after client-side upload ───────────────────────────── */

/**
 * After a client-side direct upload (using getAssetUploadUrl), call this to
 * create the BrandAsset DB record with the now-known public URL.
 */
export async function createBrandAssetRecord(params: {
  clientId: string;
  storagePath: string;
  publicUrl: string;
  assetType: BrandAssetType;
  fileName: string;
  fileSize: number;
  contentType: string;
  title?: string;
  description?: string;
  tags?: string[];
  isApprovedReference?: boolean;
  isRejectedReference?: boolean;
  isCompetitorReference?: boolean;
  notes?: string;
  uploadedBy?: string | null;
}): Promise<BrandAsset> {
  const {
    clientId,
    storagePath,
    publicUrl,
    assetType,
    fileName,
    fileSize,
    contentType,
    title,
    description,
    tags = [],
    isApprovedReference = false,
    isRejectedReference = false,
    isCompetitorReference = false,
    uploadedBy = null,
  } = params;

  const now = new Date().toISOString();

  const asset = await brandAssets.createAsync({
    clientId,
    uploadedBy,
    assetType,
    assetCategory: null,
    title: title ?? fileName,
    description: description ?? '',
    fileUrl: publicUrl,
    filePath: storagePath,
    fileName,
    fileMimeType: contentType,
    fileSize,
    thumbnailUrl: '',
    sourceType: 'manual_upload',
    status: 'active',
    isApprovedReference,
    isRejectedReference,
    isCompetitorReference,
    tags,
    aiSummary: '',
    aiExtractedColors: [],
    aiDetectedStyle: {},
    aiDetectedText: {},
    aiVisualFeatures: {},
    createdAt: now,
    updatedAt: now,
  } as Omit<BrandAsset, 'id'>);

  console.log(
    `[asset-upload-service] Created brand asset record id=${asset.id} clientId=${clientId} (post-direct-upload)`,
  );

  return asset;
}
