/**
 * POST /api/meta-business/sync-leads
 *   Pull leads from Meta lead forms into the CRM (attributed by campaign → client).
 *   Uses the central system token. Best-effort — needs pages + leads_retrieval perms.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSystemMetaToken } from '@/lib/meta-ads/token';
import { syncLeadAds } from '@/lib/meta-ads/leads-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(_req: NextRequest) {
  try {
    const token = await getSystemMetaToken();
    if (!token) return NextResponse.json({ error: 'אין אסימון Meta מחובר' }, { status: 400 });

    const result = await syncLeadAds(token);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    console.error('[meta-business/sync-leads] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
