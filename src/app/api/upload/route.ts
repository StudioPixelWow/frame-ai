/**
 * POST /api/upload
 *
 * Returns a signed upload URL so the client can PUT the file
 * DIRECTLY to Supabase Storage — the file never touches this server.
 *
 * This bypasses Vercel's 4.5MB serverless body limit entirely.
 *
 * Request body (JSON, ~100 bytes):
 *   { fileName: string, contentType?: string, fileSize?: number }
 *
 * Response:
 *   { uploadUrl, publicUrl, storagePath, bucket, token }
 *
 * Client flow:
 *   1. POST /api/upload { fileName: "video.mp4" }        ← tiny JSON
 *   2. PUT  uploadUrl   body=file                         ← direct to Supabase CDN
 *   3. Use  publicUrl   to reference the uploaded file
 */

import { NextRequest, NextResponse } from "next/server";
import { getSignedUploadUrl } from "@/lib/storage/upload";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const tag = "[/api/upload]";

  try {
    // Parse the tiny JSON body (fileName only, NO file blob)
    const body = await req.json().catch(() => null);

    if (!body || !body.fileName) {
      console.error(`${tag} ❌ Missing fileName in request body`);
      return NextResponse.json(
        { error: "fileName is required", code: "MISSING_FILENAME" },
        { status: 400 },
      );
    }

    const { fileName, contentType, fileSize } = body as {
      fileName: string;
      contentType?: string;
      fileSize?: number;
    };

    console.log(`${tag} 📥 Request: fileName="${fileName}" contentType=${contentType || "auto"} fileSize=${fileSize ? (fileSize / 1048576).toFixed(1) + "MB" : "unknown"}`);

    // Get signed upload URL (ensures bucket exists, creates URL, retries once on failure)
    const result = await getSignedUploadUrl({
      fileName,
      contentType,
      fileSize,
    });

    const latencyMs = Date.now() - t0;
    console.log(`${tag} ✅ Signed URL ready (${latencyMs}ms): path=${result.storagePath}`);

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      storagePath: result.storagePath,
      bucket: result.bucket,
      token: result.token,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - t0;
    console.error(`${tag} ❌ FAILED (${latencyMs}ms): ${msg}`);

    const status = msg.includes("too large") ? 413 : 500;
    return NextResponse.json(
      { error: msg, code: status === 413 ? "FILE_TOO_LARGE" : "UPLOAD_INIT_FAILED" },
      { status },
    );
  }
}
