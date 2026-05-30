/**
 * GET  /api/meta-business/recommendations?clientId=...
 *   Analyze the client's synced campaigns/adsets/ads and return actionable
 *   optimization recommendations, each with an "apply" descriptor.
 *
 * POST /api/meta-business/recommendations  { clientId, action }
 *   Apply one recommendation (pause adset / pause ad / adjust budget) on Meta.
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaigns as campaignsCol, adSets as adSetsCol, ads as adsCol } from '@/lib/db/collections';
import { resolveMetaToken, getSystemMetaToken } from '@/lib/meta-ads/token';
import { getSupabase } from '@/lib/db/store';
import { pauseMetaAd, pauseMetaAdSet, updateMetaCampaign } from '@/lib/meta-ads/write-service';

export const dynamic = 'force-dynamic';

const CPL_GOOD = 40;
const CPL_BAD = 120;
const MIN_SPEND = 50;

interface Reco {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  expectedImpact: string;
  // apply descriptor
  apply: { kind: 'pause_adset' | 'pause_ad' | 'lower_budget'; metaId: string; objectName: string; newDailyBudget?: number };
}

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });

    const [allCampaigns, allAdSets, allAds] = await Promise.all([
      campaignsCol.getAllAsync(), adSetsCol.getAllAsync(), adsCol.getAllAsync(),
    ]);
    const cCampaigns = (allCampaigns as any[]).filter((c) => c.clientId === clientId && c.metaCampaignId);
    const campIds = new Set(cCampaigns.map((c) => c.id));
    const cAdSets = (allAdSets as any[]).filter((s) => campIds.has(s.campaignId));
    const cAds = (allAds as any[]).filter((a) => campIds.has(a.campaignId));

    const totalLeads = cAds.reduce((s, a) => s + (a.leads || 0), 0);
    const totalSpend = cAds.reduce((s, a) => s + (a.spend || 0), 0);
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    const recos: Reco[] = [];

    // 1) Ad sets spending with no leads → pause
    for (const s of cAdSets) {
      if (!(s as any).metaAdSetId) continue;
      const sAds = cAds.filter((a) => a.adSetId === s.id);
      const spend = sAds.reduce((t, a) => t + (a.spend || 0), 0);
      const leads = sAds.reduce((t, a) => t + (a.leads || 0), 0);
      const cpl = leads > 0 ? spend / leads : 0;
      if (spend >= MIN_SPEND && leads === 0) {
        recos.push({
          id: `as_noleads_${s.id}`, severity: 'high',
          title: `השהיית Ad Set ללא לידים: ${s.name}`,
          reason: `הוציא ₪${Math.round(spend)} ללא אף ליד.`,
          expectedImpact: `חיסכון של ~₪${Math.round(spend)} שניתן להפנות לקבוצות מניבות.`,
          apply: { kind: 'pause_adset', metaId: (s as any).metaAdSetId, objectName: s.name },
        });
      } else if (leads > 0 && avgCpl > 0 && cpl > avgCpl * 1.5 && cpl > CPL_BAD) {
        recos.push({
          id: `as_highcpl_${s.id}`, severity: 'medium',
          title: `CPL גבוה ב-Ad Set: ${s.name}`,
          reason: `CPL ₪${Math.round(cpl)} מול ממוצע ₪${Math.round(avgCpl)}.`,
          expectedImpact: 'השהיה תוריד את ה-CPL הממוצע של הקמפיין.',
          apply: { kind: 'pause_adset', metaId: (s as any).metaAdSetId, objectName: s.name },
        });
      }
    }

    // 2) Ads with spend and no leads → pause
    for (const a of cAds) {
      if (!(a as any).metaAdId) continue;
      if ((a.spend || 0) >= MIN_SPEND && (a.leads || 0) === 0) {
        recos.push({
          id: `ad_noleads_${a.id}`, severity: 'high',
          title: `השהיית מודעה ללא לידים: ${a.name}`,
          reason: `הוציאה ₪${Math.round(a.spend)} ללא ליד.`,
          expectedImpact: `חיסכון של ~₪${Math.round(a.spend)}.`,
          apply: { kind: 'pause_ad', metaId: (a as any).metaAdId, objectName: a.name },
        });
      }
    }

    // 3) Campaign overspending pace → suggest lowering daily budget 20%
    for (const c of cCampaigns) {
      if (!c.metaCampaignId || !c.budget) continue;
      const cAdsForC = cAds.filter((a) => a.campaignId === c.id);
      const spend = cAdsForC.reduce((t, a) => t + (a.spend || 0), 0);
      const leads = cAdsForC.reduce((t, a) => t + (a.leads || 0), 0);
      const cpl = leads > 0 ? spend / leads : 0;
      if (cpl > 0 && cpl > CPL_BAD) {
        const newDaily = Math.max(10, Math.round((c.budget / 30) * 0.8));
        recos.push({
          id: `camp_budget_${c.id}`, severity: 'low',
          title: `הקטנת תקציב בקמפיין יקר: ${c.campaignName}`,
          reason: `CPL ₪${Math.round(cpl)} גבוה — מומלץ לצמצם הוצאה עד שיפור.`,
          expectedImpact: `הורדת תקציב יומי ל-~₪${newDaily} עד התייצבות.`,
          apply: { kind: 'lower_budget', metaId: c.metaCampaignId, objectName: c.campaignName, newDailyBudget: newDaily },
        });
      }
    }

    recos.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]));
    return NextResponse.json({ recommendations: recos, summary: { totalSpend, totalLeads, avgCpl } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { clientId, action } = body as { clientId?: string; action?: Reco['apply'] };
    if (!action?.kind || !action.metaId) return NextResponse.json({ error: 'פעולה לא תקינה' }, { status: 400 });

    const sb = getSupabase();
    let token: string | null = null;
    if (clientId) {
      const { data: client } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
      token = await resolveMetaToken((client as any)?.meta_access_token || (client as any)?.metaAccessToken);
    } else {
      token = await getSystemMetaToken();
    }
    if (!token) return NextResponse.json({ error: 'אין אסימון גישה' }, { status: 400 });

    const creds = { accessToken: token, adAccountId: '' };
    let result;
    if (action.kind === 'pause_adset') result = await pauseMetaAdSet(creds, action.metaId);
    else if (action.kind === 'pause_ad') result = await pauseMetaAd(creds, action.metaId);
    else if (action.kind === 'lower_budget') result = await updateMetaCampaign(creds, action.metaId, { dailyBudget: Math.round((action.newDailyBudget || 0) * 100) });
    else return NextResponse.json({ error: 'סוג פעולה לא נתמך' }, { status: 400 });

    if (!result.success) return NextResponse.json({ error: result.error || 'הפעולה נכשלה', result }, { status: 400 });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
