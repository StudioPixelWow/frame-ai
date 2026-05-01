/**
 * POST /api/data/meta-sync/test-connection
 *
 * Tests a Meta Ad Account connection without saving.
 * Body: { adAccountId, accessToken }
 * Returns: { valid, accountName?, error? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-guard';
import { testMetaConnection } from '@/lib/meta-ads/sync-service';

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const { adAccountId, accessToken } = body;

    if (!adAccountId || !accessToken) {
      return NextResponse.json({ valid: false, error: 'חסר מזהה חשבון או אסימון גישה' });
    }

    const result = await testMetaConnection(adAccountId, accessToken);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ valid: false, error: `שגיאה: ${msg}` });
  }
}
