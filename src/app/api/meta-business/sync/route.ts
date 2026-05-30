/**
 * POST /api/meta-business/sync  { clientId }
 *   Manually pull fresh data from Meta for a client — syncs its dedicated ad
 *   account and any accounts referenced by its campaign assignments.
 *   Token resolved centrally (client's own → system token).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { resolveMetaToken } from '@/lib/meta-ads/token';
import { syncClientMetaAccount } from '@/lib/meta-ads/sync-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clientId = body.clientId;
    if (!clientId) return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });

    const sb = getSupabase();
    const { data: client } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
    if (!client) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });

    const c = client as any;
    const token = await resolveMetaToken(c.meta_access_token || c.metaAccessToken);
    if (!token) {
      return NextResponse.json({ error: 'אין אסימון גישה — חבר את Meta Business Manager' }, { status: 400 });
    }

    // Collect ad accounts: dedicated + campaign-assigned.
    const accounts = new Set<string>();
    if (c.meta_ad_account_id || c.metaAdAccountId) accounts.add(c.meta_ad_account_id || c.metaAdAccountId);
    try {
      const { data: assigns } = await sb
        .from('app_meta_campaign_assignments')
        .select('ad_account_id')
        .eq('client_id', clientId);
      for (const a of (assigns || []) as any[]) if (a.ad_account_id) accounts.add(a.ad_account_id);
    } catch { /* table may not exist */ }

    if (accounts.size === 0) {
      return NextResponse.json({ error: 'ללקוח אין חשבון מודעות מוקדש ולא קמפיינים משויכים' }, { status: 400 });
    }

    let synced = 0;
    const errors: string[] = [];
    for (const actId of accounts) {
      try {
        await syncClientMetaAccount(clientId, c.name || '', actId, token);
        synced++;
      } catch (e) {
        errors.push(`${actId}: ${e instanceof Error ? e.message : 'שגיאה'}`);
      }
    }

    return NextResponse.json({ success: synced > 0, accountsSynced: synced, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    console.error('[meta-business/sync] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
