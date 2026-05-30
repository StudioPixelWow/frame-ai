/**
 * GET /api/meta-business/campaigns?clientId=...
 *   Returns the client's synced campaigns with aggregated performance metrics
 *   (from the local synced tables — populated by sync-service).
 *
 * Response: { campaigns: CampaignSummary[], totals: {...} }
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaigns as campaignsCol, adSets as adSetsCol, ads as adsCol } from '@/lib/db/collections';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

// Resolve the client's Meta connection status so the UI can distinguish
// "not connected" / "token expired" from simply "no campaigns yet".
async function getConnectionStatus(clientId: string): Promise<string> {
  try {
    const sb = getSupabase();
    const { data } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
    const c = data as any;
    if (!c) return 'unknown';
    const status = c.meta_connection_status || c.metaConnectionStatus;
    const hasToken = c.meta_access_token || c.metaAccessToken;
    const hasAccount = c.meta_ad_account_id || c.metaAdAccountId;
    if (status === 'token_expired') return 'token_expired';
    if (!hasToken || !hasAccount) return 'not_connected';
    if (status === 'connected') return 'connected';
    return status || 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId');
    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח (clientId)' }, { status: 400 });
    }

    const [allCampaigns, allAdSets, allAds] = await Promise.all([
      campaignsCol.getAllAsync(),
      adSetsCol.getAllAsync(),
      adsCol.getAllAsync(),
    ]);

    const clientCampaigns = (allCampaigns as any[]).filter(
      (c) => c.clientId === clientId && c.metaCampaignId,
    );

    // Surface connection status when there's nothing to show.
    const connectionStatus = clientCampaigns.length === 0
      ? await getConnectionStatus(clientId)
      : 'connected';

    const summaries = clientCampaigns.map((c: any) => {
      const cAds = (allAds as any[]).filter((a) => a.campaignId === c.id);
      const cAdSets = (allAdSets as any[]).filter((as) => as.campaignId === c.id);
      const spend = cAds.reduce((s, a) => s + (a.spend || 0), 0);
      const leads = cAds.reduce((s, a) => s + (a.leads || 0), 0);
      const impressions = cAds.reduce((s, a) => s + (a.impressions || 0), 0);
      const clicks = cAds.reduce((s, a) => s + (a.clicks || 0), 0);
      const cpl = leads > 0 ? spend / leads : 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      return {
        id: c.id,
        metaCampaignId: c.metaCampaignId,
        name: c.campaignName || c.name || '',
        status: c.status || 'unknown',
        objective: c.objective || '',
        budget: c.budget || 0,
        spend,
        leads,
        cpl,
        ctr,
        impressions,
        clicks,
        adSetsCount: cAdSets.length,
        adsCount: cAds.length,
        lastSyncedAt: c.lastSyncedAt || null,
      };
    });

    // Sort by spend desc (most important first)
    summaries.sort((a, b) => b.spend - a.spend);

    const totals = summaries.reduce(
      (t, c) => ({
        spend: t.spend + c.spend,
        leads: t.leads + c.leads,
        impressions: t.impressions + c.impressions,
        clicks: t.clicks + c.clicks,
      }),
      { spend: 0, leads: 0, impressions: 0, clicks: 0 },
    );

    return NextResponse.json({
      campaigns: summaries,
      connectionStatus,
      totals: {
        ...totals,
        cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        count: summaries.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    console.error('[meta-business/campaigns] GET error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
