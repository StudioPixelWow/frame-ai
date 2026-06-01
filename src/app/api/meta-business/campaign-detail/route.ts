/**
 * GET /api/meta-business/campaign-detail?campaignId=<localId>
 *   Returns the ad sets and ads of a campaign (from synced data) with metrics —
 *   powers the campaign drill-down in the dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adSets as adSetsCol, ads as adsCol, campaigns as campaignsCol } from '@/lib/db/collections';
import { getSupabase } from '@/lib/db/store';
import { resolveMetaToken } from '@/lib/meta-ads/token';

export const dynamic = 'force-dynamic';

const META_API = 'https://graph.facebook.com/v19.0';
const ALLOWED_PRESETS = ['today', 'yesterday', 'last_7d', 'last_30d', 'this_month', 'last_month', 'maximum'];
const num = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n; };
function leadsFromActions(actions: any[] = []): number {
  const a = actions.find((x) => x.action_type === 'lead' || x.action_type === 'onsite_conversion.lead_grouped');
  return a ? num(a.value) : 0;
}

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaignId');
    if (!campaignId) return NextResponse.json({ error: 'חסר מזהה קמפיין' }, { status: 400 });
    const presetParam = req.nextUrl.searchParams.get('datePreset') || '';
    const datePreset = ALLOWED_PRESETS.includes(presetParam) ? presetParam : '';
    const fromParam = req.nextUrl.searchParams.get('from');
    const toParam = req.nextUrl.searchParams.get('to');
    const isYmd = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const useTimeRange = isYmd(fromParam) && isYmd(toParam);
    const dateParam = useTimeRange
      ? `time_range[since]=${fromParam}&time_range[until]=${toParam}`
      : (datePreset ? `date_preset=${datePreset}` : '');

    const [allAdSets, allAds, allCampaigns] = await Promise.all([
      adSetsCol.getAllAsync(), adsCol.getAllAsync(), campaignsCol.getAllAsync(),
    ]);
    const cAdSets = (allAdSets as any[]).filter((s) => s.campaignId === campaignId);
    const cAds = (allAds as any[]).filter((a) => a.campaignId === campaignId);
    const campaign = (allCampaigns as any[]).find((c) => c.id === campaignId);

    // LIVE OVERLAY: pull per-ad insights for the selected range from Meta so the
    // drill-down matches the (live) campaign-level totals instead of a stale snapshot.
    const liveByAdId = new Map<string, { spend: number; leads: number; impressions: number; clicks: number }>();
    if ((datePreset || useTimeRange) && campaign?.metaCampaignId && campaign?.clientId) {
      try {
        const sb = getSupabase();
        const { data: cl } = await sb.from('clients').select('meta_access_token, metaAccessToken').eq('id', campaign.clientId).maybeSingle();
        const token = await resolveMetaToken((cl as any)?.meta_access_token || (cl as any)?.metaAccessToken);
        if (token) {
          const url = `${META_API}/${campaign.metaCampaignId}/insights?level=ad&${dateParam}` +
            `&fields=ad_id,spend,impressions,clicks,actions&limit=500&access_token=${encodeURIComponent(token)}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
          const data = await res.json().catch(() => ({}));
          if (res.ok && Array.isArray(data?.data)) {
            for (const row of data.data) {
              if (!row.ad_id) continue;
              liveByAdId.set(String(row.ad_id), {
                spend: num(row.spend), impressions: num(row.impressions), clicks: num(row.clicks), leads: leadsFromActions(row.actions),
              });
            }
          }
        }
      } catch { /* fall back to stored snapshot */ }
    }
    const liveApplied = liveByAdId.size > 0;
    const metricsFor = (a: any) => {
      const live = a.metaAdId ? liveByAdId.get(String(a.metaAdId)) : undefined;
      if (live) return live;
      if (liveApplied) return { spend: 0, leads: 0, impressions: 0, clicks: 0 }; // not active in range
      return { spend: a.spend || 0, leads: a.leads || 0, impressions: a.impressions || 0, clicks: a.clicks || 0 };
    };

    const adSetSummaries = cAdSets.map((s) => {
      const sAds = cAds.filter((a) => a.adSetId === s.id);
      const spend = sAds.reduce((t, a) => t + metricsFor(a).spend, 0);
      const leads = sAds.reduce((t, a) => t + metricsFor(a).leads, 0);
      return {
        id: s.id, name: s.name || '', status: s.status || 'unknown',
        spend, leads, cpl: leads > 0 ? spend / leads : 0, adsCount: sAds.length,
      };
    });

    const adSummaries = cAds.map((a) => {
      const m = metricsFor(a);
      const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : (a.ctr || 0);
      return ({
      id: a.id, name: a.name || '', status: a.status || 'unknown',
      spend: m.spend, leads: m.leads, cpl: m.leads > 0 ? m.spend / m.leads : 0,
      ctr, impressions: m.impressions,
      // Creative — for the visual preview
      creativeType: a.creativeType || 'image',
      mediaUrl: a.mediaUrl || '',
      thumbnailUrl: a.thumbnailUrl || '',
      primaryText: a.primaryText || '',
      headline: a.headline || '',
      description: a.description || '',
      ctaType: a.ctaType || '',
      ctaLink: a.ctaLink || '',
    }); });

    return NextResponse.json({ adSets: adSetSummaries, ads: adSummaries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
