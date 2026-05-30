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
import { updateMetaAdSetBudget, createMetaAdSet, createMetaAd } from '@/lib/meta-ads/write-service';
import { generateVariation } from '@/lib/optimization/variations';

export const dynamic = 'force-dynamic';

const CPL_GOOD = 40;
const CPL_BAD = 120;
const MIN_SPEND = 50;

type ApplyKind =
  | 'pause_adset' | 'pause_ad' | 'lower_budget'        // (legacy defensive — no longer generated)
  | 'shift_budget'      // move budget from a weak ad set to a winning one
  | 'expand_audience'   // duplicate a winning ad set with broader targeting
  | 'refresh_creative'  // create a fresh ad variation under a fatigued ad set
  | 'ab_test';          // create a parallel ad variation as an A/B challenger

interface Reco {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: 'audience' | 'creative' | 'budget' | 'ab_test';
  title: string;
  reason: string;
  expectedImpact: string;
  apply: {
    kind: ApplyKind;
    objectName: string;
    // shift_budget
    fromMetaId?: string; toMetaId?: string; newFromBudget?: number; newToBudget?: number;
    // expand_audience
    sourceMetaAdSetId?: string; campaignMetaId?: string; dailyBudget?: number;
    targeting?: Record<string, unknown>; newName?: string;
    // refresh_creative / ab_test
    sourceAdId?: string;        // local ad id (to pull creative + variation)
    metaAdSetId?: string;       // where to create the new ad
  };
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

    // Per-ad-set performance summary
    const setStats = cAdSets.map((s) => {
      const sAds = cAds.filter((a) => a.adSetId === s.id);
      const spend = sAds.reduce((t, a) => t + (a.spend || 0), 0);
      const leads = sAds.reduce((t, a) => t + (a.leads || 0), 0);
      const cpl = leads > 0 ? spend / leads : 0;
      const dailyBudget = (s as any).dailyBudget || (s as any).budget || 0;
      return { s, sAds, spend, leads, cpl, dailyBudget };
    }).filter((x) => x.spend >= MIN_SPEND);

    const winners = setStats.filter((x) => x.leads >= 3 && x.cpl > 0).sort((a, b) => a.cpl - b.cpl);
    const laggards = setStats.filter((x) => x.cpl > 0 && avgCpl > 0 && x.cpl > avgCpl * 1.3).sort((a, b) => b.cpl - a.cpl);

    // ── A) EXPAND WINNING AUDIENCES — duplicate the best ad set with broader targeting ──
    for (const w of winners.slice(0, 2)) {
      const campaign = cCampaigns.find((c) => c.id === w.s.campaignId);
      if (!(w.s as any).metaAdSetId || !campaign?.metaCampaignId) continue;
      const base = (w.s as any).targeting || {};
      const broadened = {
        age_min: Math.max(18, (base.age_min || 25) - 5),
        age_max: Math.min(65, (base.age_max || 45) + 10),
        geo_locations: base.geo_locations || { countries: ['IL'] },
        // drop interests to let Meta's algorithm find more buyers (broad)
      };
      recos.push({
        id: `expand_${w.s.id}`, severity: 'high', category: 'audience',
        title: `הרחבת קהל מנצח: ${w.s.name}`,
        reason: `קבוצה זו מביאה לידים ב-₪${Math.round(w.cpl)} (מתחת לממוצע ₪${Math.round(avgCpl)}). הרחבת הקהל תביא עוד לידים זולים.`,
        expectedImpact: 'יותר לידים באותו CPL — הגדלת נפח מבלי לייקר.',
        apply: {
          kind: 'expand_audience', objectName: w.s.name,
          sourceMetaAdSetId: (w.s as any).metaAdSetId, campaignMetaId: campaign.metaCampaignId,
          dailyBudget: Math.max(20, Math.round(w.dailyBudget || (w.spend / 7))),
          targeting: broadened, newName: `${w.s.name} — קהל מורחב`,
        },
      });
    }

    // ── B) SHIFT BUDGET — from a laggard to a winner (same total spend, more leads) ──
    if (winners.length > 0 && laggards.length > 0) {
      const win = winners[0], lag = laggards[0];
      if ((win.s as any).metaAdSetId && (lag.s as any).metaAdSetId && win.s.id !== lag.s.id && lag.dailyBudget > 0) {
        const move = Math.round(lag.dailyBudget * 0.4);
        recos.push({
          id: `shift_${lag.s.id}_${win.s.id}`, severity: 'high', category: 'budget',
          title: `הסטת תקציב לקבוצה מנצחת`,
          reason: `"${lag.s.name}" ב-CPL ₪${Math.round(lag.cpl)}, "${win.s.name}" ב-₪${Math.round(win.cpl)}. הסטת ₪${move}/יום תניב יותר לידים באותו תקציב.`,
          expectedImpact: `יותר לידים מאותה הוצאה כוללת.`,
          apply: {
            kind: 'shift_budget', objectName: `${lag.s.name} → ${win.s.name}`,
            fromMetaId: (lag.s as any).metaAdSetId, toMetaId: (win.s as any).metaAdSetId,
            newFromBudget: Math.max(20, lag.dailyBudget - move), newToBudget: win.dailyBudget + move,
          },
        });
      }
    }

    // ── C) REFRESH CREATIVE — fatigued ads (high frequency / dropping CTR) ──
    for (const a of cAds) {
      if (!(a as any).metaAdId || (a.spend || 0) < MIN_SPEND) continue;
      const freq = a.frequency || 0;
      const ctr = a.ctr || 0;
      if (freq >= 4 || (a.impressions > 1000 && ctr > 0 && ctr < 0.8)) {
        recos.push({
          id: `refresh_${a.id}`, severity: 'medium', category: 'creative',
          title: `רענון קריאייטיב: ${a.name}`,
          reason: freq >= 4
            ? `תדירות ${freq.toFixed(1)} — הקהל ראה את המודעה יותר מדי פעמים (שחיקה).`
            : `CTR ${ctr.toFixed(2)}% נמוך — הקריאייטיב לא מושך מספיק.`,
          expectedImpact: 'גרסה רעננה תחזיר CTR ותוריד CPL.',
          apply: { kind: 'refresh_creative', objectName: a.name, sourceAdId: a.id, metaAdSetId: (() => {
            const st = cAdSets.find((s) => s.id === a.adSetId); return (st as any)?.metaAdSetId;
          })() },
        });
      }
    }

    // ── D) A/B TEST — for winning ads, propose a challenger variation ──
    for (const w of winners.slice(0, 1)) {
      const topAd = w.sAds.filter((a) => a.leads > 0).sort((a, b) => a.cpl - b.cpl)[0];
      if (topAd && (topAd as any).metaAdId) {
        recos.push({
          id: `abtest_${topAd.id}`, severity: 'low', category: 'ab_test',
          title: `בדיקת A/B למודעה מנצחת: ${topAd.name}`,
          reason: `המודעה מצליחה — גרסת מתחרה (מסר/CTA שונה) עשויה לנצח אותה ולשפר עוד.`,
          expectedImpact: 'מציאת זווית מנצחת חדשה והורדת CPL נוספת.',
          apply: { kind: 'ab_test', objectName: topAd.name, sourceAdId: topAd.id, metaAdSetId: (w.s as any).metaAdSetId },
        });
      }
    }

    const order = { high: 0, medium: 1, low: 2 };
    recos.sort((a, b) => order[a.severity] - order[b.severity]);
    return NextResponse.json({ recommendations: recos, summary: { totalSpend, totalLeads, avgCpl } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { clientId, action } = body as { clientId?: string; action?: Reco['apply'] };
    if (!action?.kind) return NextResponse.json({ error: 'פעולה לא תקינה' }, { status: 400 });

    const sb = getSupabase();
    let token: string | null = null;
    let adAccountId = '';
    if (clientId) {
      const { data: client } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
      const c = client as any;
      token = await resolveMetaToken(c?.meta_access_token || c?.metaAccessToken);
      adAccountId = c?.meta_ad_account_id || c?.metaAdAccountId || '';
    } else {
      token = await getSystemMetaToken();
    }
    if (!token) return NextResponse.json({ error: 'אין אסימון גישה' }, { status: 400 });
    const creds = { accessToken: token, adAccountId };

    // ── Shift budget: lower the laggard, raise the winner ──
    if (action.kind === 'shift_budget') {
      if (!action.fromMetaId || !action.toMetaId) return NextResponse.json({ error: 'חסרים מזהי קבוצות' }, { status: 400 });
      const r1 = await updateMetaAdSetBudget(creds, action.fromMetaId, action.newFromBudget || 0);
      const r2 = await updateMetaAdSetBudget(creds, action.toMetaId, action.newToBudget || 0);
      if (!r1.success || !r2.success) return NextResponse.json({ error: r1.error || r2.error || 'עדכון תקציב נכשל' }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    // ── Expand audience: duplicate the winning ad set with broader targeting ──
    if (action.kind === 'expand_audience') {
      if (!adAccountId) return NextResponse.json({ error: 'לא נמצא חשבון מודעות ללקוח' }, { status: 400 });
      if (!action.campaignMetaId) return NextResponse.json({ error: 'חסר מזהה קמפיין' }, { status: 400 });
      const r = await createMetaAdSet(creds, {
        campaignId: action.campaignMetaId,
        name: action.newName || 'קהל מורחב',
        status: 'PAUSED', // created paused — you activate when ready
        dailyBudget: Math.round((action.dailyBudget || 50) * 100),
        billingEvent: 'IMPRESSIONS', optimizationGoal: 'LEAD_GENERATION',
        targeting: (action.targeting || { geo_locations: { countries: ['IL'] } }) as any,
      });
      if (!r.success) return NextResponse.json({ error: r.error || 'יצירת הקהל נכשלה' }, { status: 400 });
      return NextResponse.json({ success: true, adSetId: r.metaId, note: 'נוצר קהל מורחב (מושהה) — הפעל כשמוכן' });
    }

    // ── Refresh creative / A/B test: create a new ad variation ──
    if (action.kind === 'refresh_creative' || action.kind === 'ab_test') {
      if (!action.metaAdSetId) return NextResponse.json({ error: 'חסר מזהה Ad Set' }, { status: 400 });
      if (!action.sourceAdId) return NextResponse.json({ error: 'חסרה מודעת מקור' }, { status: 400 });
      const allAds = await adsCol.getAllAsync();
      const src = (allAds as any[]).find((a) => a.id === action.sourceAdId);
      if (!src) return NextResponse.json({ error: 'מודעת המקור לא נמצאה' }, { status: 400 });

      const variation = generateVariation(src, {
        ctr: src.ctr || 0, cpl: src.cpl || 0, frequency: src.frequency || 0,
        impressions: src.impressions || 0, spend: src.spend || 0, leads: src.leads || 0,
      });
      const pageId = src.metaPageId || '';
      const r = await createMetaAd(creds, {
        adSetId: action.metaAdSetId,
        name: `${action.kind === 'ab_test' ? 'A/B' : 'רענון'} — ${variation.strategy}`,
        status: 'PAUSED',
        creative: {
          pageId,
          message: variation.newPrimaryText,
          headline: variation.newHeadline,
          description: variation.newDescription,
          linkUrl: src.ctaLink || '',
          imageUrl: src.mediaUrl || '',
          callToAction: variation.newCtaType || 'LEARN_MORE',
        },
      });
      if (!r.success) return NextResponse.json({ error: r.error || 'יצירת המודעה נכשלה', note: pageId ? undefined : 'חסר Page ID — חבר דף עסקי ללקוח' }, { status: 400 });
      return NextResponse.json({ success: true, adId: r.metaId, variation: variation.explanation, note: 'נוצרה מודעה חדשה (מושהית) — הפעל כשמוכן' });
    }

    return NextResponse.json({ error: 'סוג פעולה לא נתמך' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
