/**
 * GET /api/data/growth
 *
 * Returns growth dashboard data — opportunities, actions, KPIs, runs.
 * Optional ?clientId= for client-scoped view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGrowthDashboardData } from '@/lib/growth/growth-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId') || undefined;
    const data = await getGrowthDashboardData(clientId);
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
