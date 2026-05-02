/**
 * GET  /api/data/growth/results  — learning loop data (optional ?clientId)
 * POST /api/data/growth/results  — record action result
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLearningData, recordActionResult } from '@/lib/growth/learning-loop';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId') || undefined;
    const data = await getLearningData(clientId);
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { actionId, beforeMetrics, afterMetrics, notes } = body;

    if (!actionId || !beforeMetrics || !afterMetrics) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await recordActionResult({
      actionId,
      beforeMetrics,
      afterMetrics,
      notes,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
