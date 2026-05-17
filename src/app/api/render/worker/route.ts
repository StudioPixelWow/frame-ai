/**
 * GET /api/render/worker — Get worker status
 * POST /api/render/worker — Start/restart worker
 */
import { NextResponse } from "next/server";
import { ensureWorkerRunning, getWorkerStatus } from "@/lib/render-worker/spawn-worker";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const status = getWorkerStatus();
  return NextResponse.json(status);
}

export async function POST() {
  const result = ensureWorkerRunning();
  return NextResponse.json({
    ...getWorkerStatus(),
    justStarted: result.started,
  });
}
