/**
 * GET /api/cron/meta-sync-all
 *   Frequent (every ~30 min) refresh of campaign metrics for ALL clients that
 *   have a connected Meta ad account. Pulls "today" insights so the campaign
 *   dashboard reflects near-live spend/leads/messages instead of only the
 *   initial sync snapshot.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically.
 * Time-boxed so it never blows the serverless limit on large rosters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { resolveMetaToken } from '@/lib/meta-ads/token';
import { syncClientMetaAccount } from '@/lib/meta-ads/sync-service';
import { getClientAdAccounts } from '@/lib/meta-ads/client-accounts';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TIME_BUDGET_MS = 270_000; // stop starting new syncs after 4.5 min

export async function GET(req: NextRequest) {
  const start = Date.now();

  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    // Allow manual trigger from the app with ?key= as a fallback for testing.
    const key = req.nextUrl.searchParams.get('key');
    if (auth !== `Bearer ${process.env.CRON_SECRET}` && key !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const sb = getSupabase();
    const { data: clients } = await sb.from('clients').select('*');
    const rows = (clients || []) as any[];

    let clientsSynced = 0;
    let accountsSynced = 0;
    let campaignsSynced = 0;
    const errors: string[] = [];

    for (const c of rows) {
      if (Date.now() - start > TIME_BUDGET_MS) {
        errors.push('time budget reached — remaining clients will sync next run');
        break;
      }

      // Skip clients that clearly aren't connected.
      const status = c.meta_connection_status || c.metaConnectionStatus;
      if (status === 'token_expired') continue;

      const token = await resolveMetaToken(c.meta_access_token || c.metaAccessToken);
      if (!token) continue;

      // Gather every ad account: many-to-many links + legacy primary + assignments.
      const accounts = new Set<string>(await getClientAdAccounts(c.id));
      try {
        const { data: assigns } = await sb
          .from('app_meta_campaign_assignments')
          .select('ad_account_id')
          .eq('client_id', c.id);
        for (const a of (assigns || []) as any[]) if (a.ad_account_id) accounts.add(a.ad_account_id);
      } catch { /* table optional */ }

      if (accounts.size === 0) continue;

      let touched = false;
      for (const actId of accounts) {
        if (Date.now() - start > TIME_BUDGET_MS) break;
        try {
          const r = await syncClientMetaAccount(c.id, c.name || '', actId, token, 'today');
          if (r.status === 'success') {
            accountsSynced++;
            campaignsSynced += r.campaigns?.synced || 0;
            touched = true;
          } else if (r.status !== 'token_expired') {
            errors.push(`${c.name || c.id}/${actId}: ${r.message || r.status}`);
          }
        } catch (e) {
          errors.push(`${c.name || c.id}/${actId}: ${e instanceof Error ? e.message : 'error'}`);
        }
      }
      if (touched) clientsSynced++;
    }

    return NextResponse.json({
      success: true,
      clientsSynced,
      accountsSynced,
      campaignsSynced,
      durationMs: Date.now() - start,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error';
    console.error('[cron/meta-sync-all] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
