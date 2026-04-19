/**
 * POST /api/upload/signed-url
 *
 * Returns a Supabase Storage signed upload URL so the client can upload
 * video files DIRECTLY to storage — bypassing Next.js body parsing entirely.
 *
 * Body: { fileName: string, fileSize: number, contentType: string }
 * Returns: { signedUrl: string, publicUrl: string, storagePath: string }
 *
 * This eliminates 413 errors because the video never touches the API route.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/store";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const BUCKET = "video-uploads";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
  "video/ogg",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/ogg",
  "audio/flac",
]);

/** Auto-create the storage bucket if it doesn't exist */
async function ensureBucket(sb: ReturnType<typeof getSupabase>) {
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
  });
  if (error && !error.message?.includes("already exists")) {
    console.warn(`[signed-url] Bucket creation warning: ${error.message}`);
  }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const { fileName, fileSize, contentType } = (await req.json()) as {
      fileName?: string;
      fileSize?: number;
      contentType?: string;
    };

    // ── Validate ──
    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }
    if (!fileSize || fileSize <= 0) {
      return NextResponse.json({ error: "fileSize is required" }, { status: 400 });
    }
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(fileSize / 1048576).toFixed(0)}MB). Maximum is ${MAX_FILE_SIZE / 1048576}MB.` },
        { status: 413 },
      );
    }
    if (contentType && !ALLOWED_VIDEO_TYPES.has(contentType)) {
      console.warn(`[signed-url] Non-standard content type: ${contentType} (allowing anyway)`);
    }

    // ── Build storage path ──
    const ext = fileName.includes(".") ? "." + fileName.split(".").pop()!.toLowerCase() : ".mp4";
    const safeId = randomUUID();
    const storagePath = `uploads/${safeId}${ext}`;

    console.log(`[signed-url] Generating signed URL: path=${storagePath} size=${(fileSize / 1048576).toFixed(1)}MB type=${contentType || "unknown"}`);

    // ── Get signed upload URL from Supabase ──
    const sb = getSupabase();
    await ensureBucket(sb);

    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error(`[signed-url] Failed to create signed URL:`, error?.message);
      return NextResponse.json(
        { error: `Failed to create upload URL: ${error?.message || "unknown error"}` },
        { status: 500 },
      );
    }

    // ── Build public URL ──
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl || "";

    const latencyMs = Date.now() - t0;
    console.log(`[signed-url] SUCCESS: path=${storagePath} publicUrl=${publicUrl.slice(0, 80)}... (${latencyMs}ms)`);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
      publicUrl,
      bucket: BUCKET,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[signed-url] ERROR: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
