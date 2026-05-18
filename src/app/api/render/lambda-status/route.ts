/**
 * GET /api/render/lambda-status — Render infrastructure status
 *
 * Lambda is deprecated. Rendering is handled by the Railway worker.
 * This endpoint is kept for backwards compatibility.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ready: true,
    mode: "railway-worker",
    message: "Lambda is deprecated. Rendering is handled by the Railway worker that polls render_jobs table.",
    missing: [],
  });
}
