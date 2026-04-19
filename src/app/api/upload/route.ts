/**
 * POST /api/upload
 *
 * Universal file upload endpoint. Receives a file via FormData and uploads
 * it to Supabase Storage using the service role key.
 *
 * Body: FormData with:
 *   - "file"   (required) — the file to upload
 *   - "bucket" (optional) — Supabase Storage bucket, defaults to "videos"
 *   - "prefix" (optional) — path prefix inside bucket, defaults to "uploads"
 *
 * Returns: { publicUrl, storagePath, size, bucket }
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadToStorage, makeStoragePath } from "@/lib/storage/upload";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEFAULT_BUCKET = "videos";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || DEFAULT_BUCKET;
    const prefix = (formData.get("prefix") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const sizeMB = (file.size / 1048576).toFixed(1);
    console.log(`[upload] Received: name=${file.name} size=${sizeMB}MB type=${file.type} bucket=${bucket}`);

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${sizeMB}MB). Maximum is ${MAX_FILE_SIZE / 1048576}MB.` },
        { status: 413 },
      );
    }

    // Build storage path
    const storagePath = makeStoragePath(file.name, prefix);

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload via shared utility
    const result = await uploadToStorage({
      bucket,
      storagePath,
      buffer,
      contentType: file.type || "application/octet-stream",
      maxSize: MAX_FILE_SIZE,
    });

    const latencyMs = Date.now() - t0;
    console.log(`[upload] SUCCESS: ${result.publicUrl.slice(0, 80)}... (${latencyMs}ms)`);

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[upload] ERROR: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
