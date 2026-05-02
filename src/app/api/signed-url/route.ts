/**
 * POST /api/signed-url
 *
 * Returns a time-limited signed download URL for a file in Supabase Storage.
 * Use this when browsers can't access public URLs (Supabase 544 errors).
 *
 * Body: { url: string, expiresIn?: number }
 * Response: { signedUrl: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSignedDownloadUrl, extractStoragePath } from "@/lib/storage/upload";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { url, expiresIn } = (await req.json()) as {
      url: string;
      expiresIn?: number;
    };

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // Only process Supabase storage URLs
    const storagePath = extractStoragePath(url);
    if (!storagePath) {
      // Not a Supabase URL — return as-is (it might work directly)
      return NextResponse.json({ signedUrl: url });
    }

    const signedUrl = await getSignedDownloadUrl(url, expiresIn || 3600);
    return NextResponse.json({ signedUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/signed-url] ERROR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
