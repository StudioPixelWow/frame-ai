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
import { updateMetaAdSetBudget, createMetaAd, copyMetaAdSet, updateMetaAdSet, resolveMetaPageId, getMetaAdSetDailyBudget, verifyMetaEntity, expandMetaAdSetPlacements } from '@/lib/meta-ads/write-service';
import { generateVariation } from '@/lib/optimization/variations';
import { logMetaAction } from '@/lib/meta-ads/action-log';

const KIND_LABELS: Record<string, string> = {
  shift_budget: 'הסטת תקציב', expand_audience: 'הרחבת קהל מנצח', refresh_creative: 'רענון קריאייטיב',
  ab_test: 'בדיקת A/B', lookalike: 'קהל Lookalike', retargeting: 'קהל Retargeting',
  ai_winner_clone: 'שכפול AI של מנצח', preventive_refresh: 'רענון מונע', dayparting: 'תזמון לפי שעות',
  expand_placements: 'הרחבת מיקומים',
};
const KIND_CATEGORY: Record<string, string> = {
  shift_budget: 'budget', expand_audience: 'audience', refresh_creative: 'creative', ab_test: 'ab_test',
  lookalike: 'audience', retargeting: 'audience', ai_winner_clone: 'creative', preventive_refresh: 'creative', dayparting: 'budget',
  expand_placements: 'audience',
};

// IRON RULES (per client):
//   1) NEVER change the visual — creative variations reuse the SAME image/video as
//      the source ad and only change the TEXT (allowed, run as A/B tests).
//   2) NEVER increase the TOTAL daily budget — budget may be REALLOCATED between ad
//      sets (sum preserved) but the overall frame the client set must not rise.
// No action kind is fully blocked; instead each is constrained below to honor these.

export const dynamic = 'force-dynamic';

const CPL_GOOD = 40;
const CPL_BAD = 120;
const MIN_SPEND = 50;

type ApplyKind =
  | 'shift_budget'      // move budget from a weak ad set to a winning one
  | 'expand_audience'   // duplicate a winning ad set with broader targeting
  | 'refresh_creative'  // create a fresh ad variation under a fatigued ad set
  | 'ab_test'           // create a parallel ad variation as an A/B challenger
  | 'lookalike'         // build a custom audience from leads + a lookalike
  | 'retargeting'       // build a page-engagement retargeting audience
  | 'ai_winner_clone'   // AI-analyzed clone of the best creative
  | 'dayparting'        // info-only: shift budget toward best hours
  | 'preventive_refresh' // refresh creative BEFORE fatigue hits
  | 'expand_placements'; // broaden placements to FB+IG (no visual/budget change)

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
    fromMetaId?: string; toMetaId?: string; newFromBudget?: number; newToBudget?: number;
    sourceMetaAdSetId?: string; campaignMetaId?: string; dailyBudget?: number;
    targeting?: Record<string, unknown>; newName?: string;
    sourceAdId?: string; metaAdSetId?: string;
    pageId?: string;            // for retargeting
    audienceName?: string;      // for lookalike/retargeting
    infoOnly?: boolean;         // dayparting = advice, no API action
  };
}

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });

    const { data: clientRow } = await getSupabase().from('clients').select('*').eq('id', clientId).maybeSingle();
    const client = clientRow as any;

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

    // ── E) LOOKALIKE FROM LEADS — if the client has captured leads, build a LAL ──
    try {
      const { leads: leadsCol } = await import('@/lib/db/collections');
      const allLeads = await leadsCol.getAllAsync();
      const clientLeads = (allLeads as any[]).filter((l) =>
        (l.convertedClientId === clientId || l.clientId === clientId) && (l.email || l.phone));
      if (clientLeads.length >= 100) {
        recos.push({
          id: `lookalike_${clientId}`, severity: 'high', category: 'audience',
          title: `קהל Lookalike מ-${clientLeads.length} לידים`,
          reason: `נאספו ${clientLeads.length} לידים עם פרטי קשר. קהל דומה (Lookalike 1%) מאתר אנשים שמתנהגים כמו מי שכבר המיר.`,
          expectedImpact: 'אחד הכלים החזקים ביותר ללידים זולים בנפח גבוה.',
          apply: { kind: 'lookalike', objectName: 'Lookalike מלידים', audienceName: `לידים ${new Date().toISOString().slice(0,10)}` },
        });
      } else if (clientLeads.length > 0) {
        recos.push({
          id: `lookalike_wait_${clientId}`, severity: 'low', category: 'audience',
          title: `Lookalike — ממתין ל-100 לידים`,
          reason: `יש ${clientLeads.length} לידים. Meta דורש מינימום ~100 ליצירת Lookalike איכותי.`,
          expectedImpact: 'כשיצטברו 100 לידים — נבנה קהל דומה.',
          apply: { kind: 'lookalike', objectName: 'Lookalike (ממתין)', infoOnly: true },
        });
      }
    } catch { /* leads table optional */ }

    // ── F) RETARGETING — page engagers who didn't convert ──
    if (client?.fb_page_id || client?.fbPageId) {
      recos.push({
        id: `retarget_${clientId}`, severity: 'medium', category: 'audience',
        title: 'קהל Retargeting — מתעניינים שלא המירו',
        reason: 'מי שעקב/הגיב/צפה בדף אך לא השאיר פרטים — קהל חם שממיר זול במיוחד.',
        expectedImpact: 'בדרך כלל ה-CPL הנמוך ביותר מכל הקהלים.',
        apply: { kind: 'retargeting', objectName: 'Retargeting מתעניינים', pageId: client.fb_page_id || client.fbPageId, audienceName: 'מתעניינים בדף' },
      });
    }

    // ── G) AI WINNER ANALYSIS — clone the best creative in its winning style ──
    const bestAd = cAds.filter((a) => a.leads >= 2 && a.cpl > 0).sort((a, b) => a.cpl - b.cpl)[0];
    if (bestAd && (bestAd as any).metaAdId) {
      const st = cAdSets.find((s) => s.id === bestAd.adSetId);
      recos.push({
        id: `aiwinner_${bestAd.id}`, severity: 'medium', category: 'creative',
        title: `שכפול AI של המודעה המנצחת: ${bestAd.name}`,
        reason: `מודעה זו מביאה לידים ב-₪${Math.round(bestAd.cpl)}. ה-AI ינתח למה היא עובדת וייצר עוד בסגנון הזה.`,
        expectedImpact: 'הרחבת ההצלחה — עוד וריאציות בזווית המנצחת.',
        apply: { kind: 'ai_winner_clone', objectName: bestAd.name, sourceAdId: bestAd.id, metaAdSetId: (st as any)?.metaAdSetId },
      });
    }

    // ── H) PREVENTIVE CREATIVE REFRESH — frequency climbing toward fatigue (2.5-4) ──
    for (const a of cAds) {
      if (!(a as any).metaAdId || (a.spend || 0) < MIN_SPEND) continue;
      const f = a.frequency || 0;
      if (f >= 2.5 && f < 4) {
        const st = cAdSets.find((s) => s.id === a.adSetId);
        recos.push({
          id: `prevent_${a.id}`, severity: 'low', category: 'creative',
          title: `רענון מונע: ${a.name}`,
          reason: `תדירות ${f.toFixed(1)} ומטפסת. רענון עכשיו, לפני שתגיע ל-4 ותתחיל שחיקה.`,
          expectedImpact: 'מניעת ירידת ביצועים לפני שהיא קורית.',
          apply: { kind: 'preventive_refresh', objectName: a.name, sourceAdId: a.id, metaAdSetId: (st as any)?.metaAdSetId },
        });
      }
    }

    // ── J) EXPAND PLACEMENTS — ad sets restricted to a single platform ──
    for (const x of setStats) {
      const sa = x.s as any;
      if (!sa.metaAdSetId) continue;
      const plats: string[] = Array.isArray(sa.placements) ? sa.placements : [];
      const known = ['facebook', 'instagram', 'audience_network', 'messenger'];
      const isPlatformList = plats.some((p) => known.includes(p));
      if (isPlatformList && !plats.includes('instagram')) {
        recos.push({
          id: `placements_${x.s.id}`, severity: 'medium', category: 'audience',
          title: `הרחבת מיקומים: ${x.s.name}`,
          reason: `הקבוצה מוגבלת למיקומים (${plats.join(', ')}). הרחבה לפייסבוק+אינסטגרם (פיד/סטורי/רילס) פותחת עוד מלאי זול.`,
          expectedImpact: 'יותר חשיפות זולות ועוד לידים — ללא שינוי ויזואל או תקציב.',
          apply: { kind: 'expand_placements', objectName: x.s.name, metaAdSetId: sa.metaAdSetId },
        });
      }
    }

    // ── I) DAY-PARTING (advice only — needs hourly breakdown to act) ──
    if (totalSpend > 500) {
      recos.push({
        id: `daypart_${clientId}`, severity: 'low', category: 'budget',
        title: 'תזמון לפי שעות (Day-parting)',
        reason: 'הוצאה משמעותית — כדאי לבדוק באילו שעות ה-CPL הנמוך ביותר ולהסיט תקציב אליהן.',
        expectedImpact: 'יותר לידים מאותו תקציב ע"י ריכוז בשעות החמות.',
        apply: { kind: 'dayparting', objectName: 'תזמון שעות', infoOnly: true },
      });
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
    const { clientId, action, activate } = body as { clientId?: string; action?: Reco['apply']; activate?: boolean };
    if (!action?.kind) return NextResponse.json({ error: 'פעולה לא תקינה' }, { status: 400 });

    // When activate=true, new objects go LIVE immediately (no manual un-pause).
    const liveStatus: 'ACTIVE' | 'PAUSED' = activate ? 'ACTIVE' : 'PAUSED';
    const liveWord = activate ? 'פעיל' : 'מושהה';

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

    const actionTitle = `${KIND_LABELS[action.kind] || action.kind}${action.objectName ? `: ${action.objectName}` : ''}`;
    const category = KIND_CATEGORY[action.kind] || undefined;

    // Helpers that also write to the optimization action log so every attempt is
    // recorded (for the client report) with Meta's real outcome.
    const metaErr = async (r: any, fallback: string) => {
      const msg = `${fallback}: ${r?.error || 'שגיאה'}${r?.errorCode ? ` (קוד ${r.errorCode})` : ''}`;
      await logMetaAction({ clientId, actionKind: action.kind, category, title: actionTitle, status: 'failed', error: msg });
      return NextResponse.json({ error: msg, meta: r }, { status: 400 });
    };
    const ok = async (extra: Record<string, unknown> = {}, opts: { detail?: string; objectType?: string } = {}) => {
      const metaId = (extra.adSetId || extra.adId || extra.audienceId || null) as string | null;
      await logMetaAction({ clientId, actionKind: action.kind, category, title: actionTitle, status: 'success', metaId, objectType: opts.objectType || null, detail: opts.detail || (extra.note as string) || null });
      return NextResponse.json({ success: true, ...extra });
    };
    const infoOnly = async (note: string) => {
      await logMetaAction({ clientId, actionKind: action.kind, category, title: actionTitle, status: 'info', detail: note });
      return NextResponse.json({ success: true, note });
    };

    // ── Shift budget: REALLOCATE between ad sets (total preserved, never raised) ──
    if (action.kind === 'shift_budget') {
      if (!action.fromMetaId || !action.toMetaId) return NextResponse.json({ error: 'חסרים מזהי קבוצות' }, { status: 400 });

      // IRON RULE: the new total must not exceed the current total — reallocation only.
      const [curFrom, curTo] = await Promise.all([
        getMetaAdSetDailyBudget(creds, action.fromMetaId),
        getMetaAdSetDailyBudget(creds, action.toMetaId),
      ]);
      const curTotalCents = (curFrom || 0) + (curTo || 0);
      const wantTotalCents = Math.round((action.newFromBudget || 0) * 100) + Math.round((action.newToBudget || 0) * 100);
      if (curTotalCents > 0 && wantTotalCents > curTotalCents + 1) {
        return await metaErr(
          { error: `הפעולה הייתה מעלה את סך התקציב היומי (מ-₪${(curTotalCents / 100).toFixed(0)} ל-₪${(wantTotalCents / 100).toFixed(0)}) — חסום לפי כלל הברזל. מותרת רק הזזה בין קבוצות.` },
          'הסטת תקציב חסומה',
        );
      }

      const r1 = await updateMetaAdSetBudget(creds, action.fromMetaId, action.newFromBudget || 0);
      const r2 = await updateMetaAdSetBudget(creds, action.toMetaId, action.newToBudget || 0);
      if (!r1.success || !r2.success) return await metaErr(r1.success ? r2 : r1, 'עדכון תקציב נכשל');

      // VERIFY: read both budgets back from Meta and confirm they actually changed.
      const wantFrom = Math.round((action.newFromBudget || 0) * 100);
      const wantTo = Math.round((action.newToBudget || 0) * 100);
      const [gotFrom, gotTo] = await Promise.all([
        getMetaAdSetDailyBudget(creds, action.fromMetaId),
        getMetaAdSetDailyBudget(creds, action.toMetaId),
      ]);
      const within = (a: number | null, b: number) => a != null && Math.abs(a - b) <= 1; // ±1 agora rounding
      if (!within(gotFrom, wantFrom) || !within(gotTo, wantTo)) {
        return await metaErr(
          { error: `Meta אישרה את הבקשה אך הקריאה החוזרת לא תואמת — ייתכן תקציב ברמת קמפיין (CBO). התקבל ${gotFrom}/${gotTo} אגורות, ציפינו ${wantFrom}/${wantTo}` },
          'עדכון התקציב לא אומת מול Meta',
        );
      }
      return await ok({ note: 'התקציב הוסט מהקבוצה החלשה למנצחת (אומת מול Meta)' }, {
        detail: `הוסט תקציב (מאומת): ₪${(gotFrom! / 100).toFixed(0)} → חלשה, ₪${(gotTo! / 100).toFixed(0)} → מנצחת`,
        objectType: 'adset',
      });
    }

    // ── Expand audience: COPY the winning ad set (inherits objective/optimization/
    //    promoted_object/creatives), then broaden targeting on the copy. ──
    //    This avoids "Invalid parameter (code 100)" that creating a fresh
    //    LEAD_GENERATION ad set causes when the campaign isn't a lead campaign.
    if (action.kind === 'expand_audience') {
      if (!adAccountId) return NextResponse.json({ error: 'לא נמצא חשבון מודעות ללקוח' }, { status: 400 });
      if (!action.sourceMetaAdSetId) return NextResponse.json({ error: 'חסר מזהה קבוצת מודעות מקור' }, { status: 400 });

      // Read the source ad set's current daily budget BEFORE copying so we can keep
      // the TOTAL constant (split it) instead of adding new spend.
      const srcBudgetCents = await getMetaAdSetDailyBudget(creds, action.sourceMetaAdSetId);

      // 1) Duplicate the winning ad set (deep copy so it carries its creatives;
      //    falls back to a shallow copy automatically if Meta rejects).
      const copy = await copyMetaAdSet(creds, action.sourceMetaAdSetId, {
        deepCopy: true, statusOption: liveStatus,
      });
      if (!copy.success || !copy.metaId) return await metaErr(copy, 'שכפול הקבוצה המנצחת נכשל');

      const notes: string[] = [`שוכפל קהל מנצח (${liveWord}) עם הרחבת טירגוט`];
      if (copy.error) notes.push(copy.error); // e.g. shallow-copy warning ("הוסף קריאייטיב")

      // IRON RULE: never increase the total daily budget. For an ABO ad set (it has
      // its own budget), SPLIT it — the expanded copy gets half, the source keeps the
      // rest, so the combined total equals the original. For CBO (no ad-set budget),
      // the campaign budget governs both, so we leave budgets untouched.
      let splitBudgetShekels: number | undefined;
      if (srcBudgetCents && srcBudgetCents > 0) {
        const half = Math.floor(srcBudgetCents / 2);
        splitBudgetShekels = Math.max(1, Math.round(half / 100));
        const sourceRemainShekels = Math.max(1, Math.round((srcBudgetCents - half) / 100));
        await updateMetaAdSetBudget(creds, action.sourceMetaAdSetId, sourceRemainShekels); // reduce source
        notes.push(`התקציב חולק: ₪${sourceRemainShekels} למקור · ₪${splitBudgetShekels} לקהל המורחב (סך הכל ללא שינוי)`);
      }

      // 2) Broaden the targeting + name + status (+ split budget for ABO) on the copy.
      const upd = await updateMetaAdSet(creds, copy.metaId, {
        name: action.newName || undefined,
        targeting: action.targeting,
        status: liveStatus,
        dailyBudget: splitBudgetShekels,
      });
      if (!upd.success) {
        notes.push(`הרחבת הטירגוט נכשלה — הרחב ידנית בלוח Meta. (${upd.error || ''})`);
      }
      // VERIFY the new ad set actually exists in Meta.
      const ver = await verifyMetaEntity(creds, 'adset', copy.metaId);
      if (ver.success && !ver.exists) {
        return await metaErr({ error: 'הקבוצה לא נמצאה ב-Meta לאחר היצירה' }, 'שכפול הקבוצה לא אומת');
      }
      notes.push(ver.exists ? `אומת ב-Meta (${liveWord})` : 'נוצר; אימות מלא לא הושלם');
      return await ok({ adSetId: copy.metaId, note: notes.join(' · ') }, {
        detail: `שוכפלה קבוצת המודעות המנצחת עם קהל מורחב (${liveWord})`,
        objectType: 'adset',
      });
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
      // Need a Page ID to build a creative. Resolve it automatically:
      // synced ad → client record → live Meta (ad set / ad / account pages).
      let pageId = src.metaPageId || '';
      if (!pageId && clientId) {
        const { data: cl } = await sb.from('clients').select('fb_page_id, meta_page_id').eq('id', clientId).maybeSingle();
        pageId = (cl as any)?.fb_page_id || (cl as any)?.meta_page_id || '';
      }
      if (!pageId) {
        pageId = await resolveMetaPageId(creds, { adSetId: action.metaAdSetId, adId: (src as any).metaAdId });
      }
      if (!pageId) {
        return NextResponse.json({ error: 'לא ניתן ליצור מודעה — לא נמצא דף עסקי. חבר דף בכרטיס הלקוח (ערוצי פרסום) ונסה שוב.' }, { status: 400 });
      }
      const r = await createMetaAd(creds, {
        adSetId: action.metaAdSetId,
        name: `${action.kind === 'ab_test' ? 'A/B' : 'רענון'} — ${variation.strategy}`,
        status: liveStatus,
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
      if (!r.success) return await metaErr(r, 'יצירת המודעה נכשלה');
      if (r.metaId) {
        const ver = await verifyMetaEntity(creds, 'ad', r.metaId);
        if (ver.success && !ver.exists) return await metaErr({ error: 'המודעה לא נמצאה ב-Meta לאחר היצירה' }, 'יצירת המודעה לא אומתה');
      }
      return await ok({ adId: r.metaId, variation: variation.explanation, note: `נוצרה מודעה חדשה (${liveWord})` }, {
        detail: `נוצרה מודעה חדשה ומאומתת (${action.kind === 'ab_test' ? 'בדיקת A/B' : 'רענון'}): ${variation.strategy} — ${liveWord}`,
        objectType: 'ad',
      });
    }

    // ── Expand placements: broaden to FB+IG (no visual/budget change) ──
    if (action.kind === 'expand_placements') {
      if (!action.metaAdSetId) return NextResponse.json({ error: 'חסר מזהה Ad Set' }, { status: 400 });
      const r = await expandMetaAdSetPlacements(creds, action.metaAdSetId);
      if (!r.success) return await metaErr(r, 'הרחבת מיקומים נכשלה');
      return await ok({ adSetId: action.metaAdSetId, note: 'המיקומים הורחבו לפייסבוק + אינסטגרם (פיד/סטורי/רילס)' }, {
        detail: 'הורחבו מיקומים לפייסבוק+אינסטגרם — ללא שינוי ויזואל או תקציב',
        objectType: 'adset',
      });
    }

    // ── Info-only (day-parting) — nothing to execute via API ──
    if (action.kind === 'dayparting' || action.infoOnly) {
      return await infoOnly('המלצה לעיון — בצע ידנית בלוח הזמנים של הקמפיין');
    }

    if (!adAccountId) return NextResponse.json({ error: 'לא נמצא חשבון מודעות ללקוח' }, { status: 400 });

    // ── Lookalike from leads: build custom audience → lookalike ──
    if (action.kind === 'lookalike') {
      const { leads: leadsCol } = await import('@/lib/db/collections');
      const { createCustomAudienceFromLeads, createLookalikeAudience } = await import('@/lib/meta-ads/write-service');
      const allLeads = await leadsCol.getAllAsync();
      const contacts = (allLeads as any[])
        .filter((l) => (l.convertedClientId === clientId || l.clientId === clientId) && (l.email || l.phone))
        .map((l) => ({ email: l.email || undefined, phone: l.phone || undefined }));
      if (contacts.length < 100) return NextResponse.json({ error: `נדרשים 100+ לידים (יש ${contacts.length})` }, { status: 400 });

      const ca = await createCustomAudienceFromLeads(creds, `${action.audienceName || 'לידים'} (מקור)`, contacts);
      if (!ca.success || !ca.metaId) return await metaErr(ca, 'יצירת קהל המקור נכשלה');
      const lal = await createLookalikeAudience(creds, `Lookalike — ${action.audienceName || 'לידים'}`, ca.metaId);
      if (!lal.success) return await metaErr(lal, 'יצירת Lookalike נכשלה');
      return await ok({ audienceId: lal.metaId, note: 'נוצר קהל Lookalike — שייך אותו ל-Ad Set חדש' }, {
        detail: `נבנה קהל Lookalike מ-${contacts.length} לידים`, objectType: 'audience',
      });
    }

    // ── Retargeting: page engagement audience ──
    if (action.kind === 'retargeting') {
      const { createEngagementAudience } = await import('@/lib/meta-ads/write-service');
      if (!action.pageId) return NextResponse.json({ error: 'חסר Page ID' }, { status: 400 });
      const r = await createEngagementAudience(creds, action.audienceName || 'מתעניינים בדף', action.pageId);
      if (!r.success) return await metaErr(r, 'יצירת קהל Retargeting נכשלה');
      return await ok({ audienceId: r.metaId, note: 'נוצר קהל Retargeting — שייך אותו ל-Ad Set חדש' }, {
        detail: 'נבנה קהל Retargeting ממתעניינים בדף', objectType: 'audience',
      });
    }

    // ── AI winner clone / preventive refresh → same path as refresh_creative ──
    if (action.kind === 'ai_winner_clone' || action.kind === 'preventive_refresh') {
      if (!action.metaAdSetId || !action.sourceAdId) return NextResponse.json({ error: 'חסרים פרטי מודעת מקור' }, { status: 400 });
      const allAds = await adsCol.getAllAsync();
      const src = (allAds as any[]).find((a) => a.id === action.sourceAdId);
      if (!src) return NextResponse.json({ error: 'מודעת המקור לא נמצאה' }, { status: 400 });
      const variation = generateVariation(src, {
        ctr: src.ctr || 0, cpl: src.cpl || 0, frequency: src.frequency || 0,
        impressions: src.impressions || 0, spend: src.spend || 0, leads: src.leads || 0,
      });
      let pageId2 = src.metaPageId || '';
      if (!pageId2 && clientId) {
        const { data: cl } = await sb.from('clients').select('fb_page_id, meta_page_id').eq('id', clientId).maybeSingle();
        pageId2 = (cl as any)?.fb_page_id || (cl as any)?.meta_page_id || '';
      }
      if (!pageId2) {
        pageId2 = await resolveMetaPageId(creds, { adSetId: action.metaAdSetId, adId: (src as any).metaAdId });
      }
      if (!pageId2) {
        return NextResponse.json({ error: 'לא ניתן ליצור מודעה — לא נמצא דף עסקי. חבר דף בכרטיס הלקוח ונסה שוב.' }, { status: 400 });
      }
      const r = await createMetaAd(creds, {
        adSetId: action.metaAdSetId,
        name: `${action.kind === 'ai_winner_clone' ? 'AI-Clone' : 'רענון-מונע'} — ${variation.strategy}`,
        status: liveStatus,
        creative: { pageId: pageId2, message: variation.newPrimaryText, headline: variation.newHeadline, description: variation.newDescription, linkUrl: src.ctaLink || '', imageUrl: src.mediaUrl || '', callToAction: variation.newCtaType || 'LEARN_MORE' },
      });
      if (!r.success) return await metaErr(r, 'יצירת המודעה נכשלה');
      if (r.metaId) {
        const ver = await verifyMetaEntity(creds, 'ad', r.metaId);
        if (ver.success && !ver.exists) return await metaErr({ error: 'המודעה לא נמצאה ב-Meta לאחר היצירה' }, 'יצירת המודעה לא אומתה');
      }
      return await ok({ adId: r.metaId, variation: variation.explanation, note: `נוצרה מודעה חדשה (${liveWord})` }, {
        detail: `נוצרה מודעה חדשה ומאומתת (${action.kind === 'ai_winner_clone' ? 'שכפול AI' : 'רענון מונע'}): ${variation.strategy} — ${liveWord}`,
        objectType: 'ad',
      });
    }

    return NextResponse.json({ error: 'סוג פעולה לא נתמך' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
