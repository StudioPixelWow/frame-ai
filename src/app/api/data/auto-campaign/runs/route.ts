/**
 * GET /api/data/auto-campaign/runs — List auto-monitor scan runs
 *
 * Query: ?clientId=X&limit=20
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoCampaignRuns } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId');
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    let runs = await autoCampaignRuns.getAllAsync();

    if (clientId) {
      runs = runs.filter(r => r.clientId === clientId);
    }

    // Sort by startedAt desc
    runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return NextResponse.json({
      runs: runs.slice(0, limit),
      total: runs.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
