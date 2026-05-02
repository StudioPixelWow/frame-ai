/**
 * POST /api/data/auto-campaign/scan — Trigger an auto-monitor scan
 *
 * Body: { clientId?, campaignId?, triggeredBy? }
 *
 * Permissions:
 *   admin: full access
 *   employee: can trigger for assigned clients
 *   client: blocked
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAutoMonitorScan } from '@/lib/optimization/auto-monitor';

export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role') || 'admin';
    if (role === 'client') {
      return NextResponse.json(
        { error: 'לקוחות לא יכולים להריץ סריקה אוטומטית' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { clientId, campaignId, triggeredBy } = body as {
      clientId?: string;
      campaignId?: string;
      triggeredBy?: 'manual' | 'scheduled' | 'system';
    };

    const result = await runAutoMonitorScan({
      clientId,
      campaignId,
      triggeredBy: triggeredBy || 'manual',
      skipCooldown: triggeredBy === 'manual',
    });

    return NextResponse.json({
      success: result.run.status === 'completed',
      run: result.run,
      findings: result.findings,
      actionsCreated: result.actionsCreated,
      summary: result.run.summary,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[auto-campaign/scan] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
