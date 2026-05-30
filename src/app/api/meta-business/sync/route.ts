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
    const allowed = ['today', 'last_7d', 'last_30d', 'this_month', 'maximum'];
    const datePreset = allowed.includes(body.datePreset) ? body.datePreset : 'today';
    if (!clientId) return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });

    const sb = getSupabase();
    const { data: client } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
    if (!client) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });

    const c = client as any;
    const token = await resolveMetaToken(c.meta_access_token || c.metaAccessToken);
    if (!token) {
      return NextResponse.json({ error: 'אין אסימון גישה — חבר את Meta Business Manager' }, { status: 400 });
    }

    // Collect ALL ad accounts for this client: many-to-many links + legacy primary
    // + any campaign-assigned accounts.
    const { getClientAdAccounts } = await import('@/lib/meta-ads/client-accounts');
    const accounts = new Set<string>(await getClientAdAccounts(clientId));
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
    let campaignsSynced = 0;
    const errors: string[] = [];
    let tokenExpired = false;
    const perAccount: { account: string; status: string; campaigns: number; message: string }[] = [];

    for (const actId of accounts) {
      try {
        const r = await syncClientMetaAccount(clientId, c.name || '', actId, token, datePreset);
        perAccount.push({ account: actId, status: r.status, campaigns: r.campaigns?.synced || 0, message: r.message || '', insightsUpdated: r.insightsUpdated || 0, diagnostics: r.diagnostics } as any);
        if (r.status === 'success') {
          synced++;
          campaignsSynced += r.campaigns?.synced || 0;
        } else {
          if (r.status === 'token_expired') tokenExpired = true;
          errors.push(`${actId}: ${r.message || r.status}`);
        }
      } catch (e) {
        perAccount.push({ account: actId, status: 'exception', campaigns: 0, message: e instanceof Error ? e.message : 'שגיאה' });
        errors.push(`${actId}: ${e instanceof Error ? e.message : 'שגיאה'}`);
      }
    }

    // Full diagnostics — so the UI can show exactly what happened.
    const accountsList = [...accounts];
    if (synced === 0) {
      return NextResponse.json({
        error: tokenExpired
          ? 'אסימון ה-Meta פג תוקף — חבר מחדש בהגדרות (עדיף System User token קבוע)'
          : `הסנכרון נכשל. חשבונות שנבדקו: ${accountsList.join(', ') || 'אין'}. ${errors.join(' | ') || 'אין פירוט'}`,
        tokenExpired, accountsChecked: accountsList, perAccount,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true, accountsSynced: synced, campaignsSynced,
      accountsChecked: accountsList, perAccount, errors, tokenExpired,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    console.error('[meta-business/sync] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
