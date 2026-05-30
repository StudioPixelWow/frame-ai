/**
 * GET /api/meta-business/campaign-detail?campaignId=<localId>
 *   Returns the ad sets and ads of a campaign (from synced data) with metrics —
 *   powers the campaign drill-down in the dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adSets as adSetsCol, ads as adsCol } from '@/lib/db/collections';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaignId');
    if (!campaignId) return NextResponse.json({ error: 'חסר מזהה קמפיין' }, { status: 400 });

    const [allAdSets, allAds] = await Promise.all([adSetsCol.getAllAsync(), adsCol.getAllAsync()]);
    const cAdSets = (allAdSets as any[]).filter((s) => s.campaignId === campaignId);
    const cAds = (allAds as any[]).filter((a) => a.campaignId === campaignId);

    const adSetSummaries = cAdSets.map((s) => {
      const sAds = cAds.filter((a) => a.adSetId === s.id);
      const spend = sAds.reduce((t, a) => t + (a.spend || 0), 0);
      const leads = sAds.reduce((t, a) => t + (a.leads || 0), 0);
      return {
        id: s.id, name: s.name || '', status: s.status || 'unknown',
        spend, leads, cpl: leads > 0 ? spend / leads : 0, adsCount: sAds.length,
      };
    });

    const adSummaries = cAds.map((a) => ({
      id: a.id, name: a.name || '', status: a.status || 'unknown',
      spend: a.spend || 0, leads: a.leads || 0, cpl: a.cpl || (a.leads > 0 ? (a.spend || 0) / a.leads : 0),
      ctr: a.ctr || 0, impressions: a.impressions || 0,
    }));

    return NextResponse.json({ adSets: adSetSummaries, ads: adSummaries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
