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
import { getSystemMetaToken } from '@/lib/meta-ads/token';

export const dynamic = 'force-dynamic';

// Resolve the client's Meta connection status so the UI can distinguish
// "not connected" / "token expired" from simply "no campaigns yet".
// A usable token = the client's own token OR the central system token.
async function getConnectionStatus(clientId: string): Promise<string> {
  try {
    const sb = getSupabase();
    const { data } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
    const c = data as any;
    if (!c) return 'unknown';
    const status = c.meta_connection_status || c.metaConnectionStatus;
    const hasAccount = c.meta_ad_account_id || c.metaAdAccountId;
    const hasToken = (c.meta_access_token || c.metaAccessToken) || (await getSystemMetaToken());
    if (status === 'token_expired') return 'token_expired';
    if (!hasAccount) return 'not_connected';
    if (!hasToken) return 'token_expired';
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

    // 1) Campaigns from a dedicated account assigned to this client.
    const byAccount = (allCampaigns as any[]).filter(
      (c) => c.clientId === clientId && c.metaCampaignId,
    );

    // 2) Campaigns explicitly assigned to this client (shared-account / campaign-level).
    let assignedRecords: any[] = [];
    try {
      const sb = getSupabase();
      const { data: assigns } = await sb
        .from('app_meta_campaign_assignments')
        .select('meta_campaign_id, campaign_name')
        .eq('client_id', clientId);
      const assignedIds = new Set((assigns || []).map((a: any) => a.meta_campaign_id));
      const nameById: Record<string, string> = {};
      for (const a of (assigns || []) as any[]) nameById[a.meta_campaign_id] = a.campaign_name;

      if (assignedIds.size > 0) {
        const alreadyById = new Set(byAccount.map((c) => c.metaCampaignId));
        for (const id of assignedIds) {
          if (alreadyById.has(id)) continue;
          // Find synced metrics for this campaign (synced by whoever owns the account)
          const synced = (allCampaigns as any[]).find((c) => c.metaCampaignId === id);
          if (synced) {
            assignedRecords.push(synced);
          } else {
            // No synced data yet — stub so it still shows (run a sync for metrics)
            assignedRecords.push({ id: `assign_${id}`, metaCampaignId: id, campaignName: nameById[id] || '', status: 'unknown', budget: 0, notSynced: true });
          }
        }
      }
    } catch { /* assignments table may not exist yet */ }

    const clientCampaigns = [...byAccount, ...assignedRecords];

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
      // Budget can live at campaign level OR ad-set level (ABO). Fall back to
      // summing ad-set budgets so the column isn't empty for ABO campaigns.
      const adSetBudget = cAdSets.reduce((s, as: any) => s + (as.dailyBudget || as.budget || 0), 0);
      const budget = c.budget || adSetBudget || 0;

      return {
        id: c.id,
        metaCampaignId: c.metaCampaignId,
        name: c.campaignName || c.name || '',
        status: c.status || 'unknown',
        objective: c.objective || '',
        budget,
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
