/**
 * POST /api/data/growth/run
 *
 * Triggers a growth scan.
 * Body: { clientId?: string, triggeredBy?: 'manual' | 'scheduled' | 'system' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { runGrowthScan } from '@/lib/growth/growth-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runGrowthScan({
      clientId: body.clientId || undefined,
      triggeredBy: body.triggeredBy || 'manual',
    });

    return NextResponse.json({
      success: true,
      run: result.run,
      opportunitiesFound: result.opportunities.length,
      actionsGenerated: result.actions.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
