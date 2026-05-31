/**
 * GET /api/meta-business/action-log?clientId=...&limit=100
 *   Returns the optimization/management action history for a client (or all),
 *   newest first. Used by the campaign dashboard and client card to show a clean,
 *   verifiable report of everything done on the client's campaigns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetaActionLog } from '@/lib/meta-ads/action-log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId') || undefined;
    const limitParam = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100;
    const entries = await getMetaActionLog(clientId, limit);

    const summary = {
      total: entries.length,
      success: entries.filter((e) => e.status === 'success').length,
      failed: entries.filter((e) => e.status === 'failed').length,
      info: entries.filter((e) => e.status === 'info').length,
    };
    return NextResponse.json({ entries, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה';
    return NextResponse.json({ entries: [], summary: { total: 0, success: 0, failed: 0, info: 0 }, error: msg }, { status: 200 });
  }
}
