/**
 * DEPRECATED — Redirects to POST /api/upload
 * Kept as a stub to prevent 404s from stale clients.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use POST /api/upload (FormData) instead." },
    { status: 410 },
  );
}
