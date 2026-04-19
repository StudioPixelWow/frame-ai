/**
 * POST /api/upload
 *
 * DEPRECATED — This route is kept only as a fallback for non-video small files.
 * Video uploads now go directly to Supabase Storage via signed URLs.
 * See /api/upload/signed-url for the new flow.
 *
 * This route now returns a 413 for any file > 4MB and directs callers
 * to use the direct-to-storage upload flow instead.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  console.warn("[upload] DEPRECATED: /api/upload called — callers should use direct Supabase Storage upload via /api/upload/signed-url");
  return NextResponse.json(
    {
      error: "This upload endpoint is deprecated for video files. Use /api/upload/signed-url for direct-to-storage uploads.",
      migration: "POST /api/upload/signed-url with { fileName, fileSize, contentType } to get a signed upload URL, then PUT the file directly to Supabase Storage.",
    },
    { status: 410 }, // 410 Gone
  );
}
