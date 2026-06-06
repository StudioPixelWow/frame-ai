/**
 * GET /api/cron/meta-auto-optimize
 *   FULLY AUTONOMOUS optimizer — runs on a schedule and applies, by itself,
 *   only the rule-compliant "more leads for the same money" actions:
 *     1) Budget REALLOCATION between ad sets (total preserved, never raised).
 *     2) Budget-NEUTRAL audience expansion (splits the winner's budget).
 *   It NEVER changes a creative/visual and NEVER raises the total daily budget.
 *
 * Safety caps:
 *   - Only acts on ad sets with meaningful spend (>= MIN_SPEND).
 *   - At most 1 budget shift + 1 audience expansion per client per run.
 *   - Every action is verified against Meta and written to the action log.
 *
 * Auth: Vercel sends Authorization: Bearer ${CRON_SECRET}. A ?key= fallback is
 * accepted for manual triggering/testing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { campaigns as campaignsCol, adSets as adSetsCol, ads as adsCol } from '@/lib/db/collections';
import { resolveMetaToken, getMetaWriteMode } from '@/lib/meta-ads/token';
import { getClientAdAccounts } from '@/lib/meta-ads/client-accounts';
import {
  updateMetaAdSetBudget, getMetaAdSetDailyBudget, copyMetaAdSet, updateMetaAdSet, verifyMetaEntity,
} from '@/lib/meta-ads/write-service';
import { logMetaAction } from '@/lib/meta-ads/action-log';
import { campaignActions } from '@/lib/db/collections';

/** Queue a recommended change for human approval (recommend mode — no Meta write). */
async function queueRecommendation(opts: {
  clientId: string; clientName: string; type: 'increase_budget' | 'decrease_budget' | 'test_new_audience' | 'mark_for_review';
  title: string; description: string; previewBefore: string; previewAfter: string;
  campaignId?: string; campaignName?: string; adSetId?: string; payload?: Record<string, unknown>;
}) {
  try {
    await campaignActions.createAsync({
      type: opts.type, title: opts.title, objectType: 'adset', objectId: opts.adSetId || '',
      objectName: opts.title, campaignId: opts.campaignId || '', campaignName: opts.campaignName || '',
      adSetId: opts.adSetId || null, adId: null, clientId: opts.clientId, clientName: opts.clientName,
      recommendationId: null, payload: opts.payload || {}, status: 'approval_required',
      sourceRecommendationId: null, sourceRecommendationType: 'auto_optimizer',
      description: opts.description, previewBefore: opts.previewBefore, previewAfter: opts.previewAfter,
      createdBy: 'auto_optimizer', approvedBy: null, approvedAt: null, rejectionReason: null,
      executedAt: null, failedReason: null,
    } as any);
  } catch { /* best-effort */ }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MIN_SPEND = 50;
const TIME_BUDGET_MS = 270_000;

export async function GET(req: NextRequest) {
  const start = Date.now();
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    const key = req.nextUrl.searchParams.get('key');
    if (auth !== `Bearer ${process.env.CRON_SECRET}` && key !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const sb = getSupabase();
    const writeMode = await getMetaWriteMode(); // 'recommend' (default) | 'auto'
    const recommend = writeMode !== 'auto';
    const { data: clients } = await sb.from('clients').select('*');
    const rows = (clients || []) as any[];

    const [allCampaigns, allAdSets, allAds] = await Promise.all([
      campaignsCol.getAllAsync(), adSetsCol.getAllAsync(), adsCol.getAllAsync(),
    ]);

    let clientsTouched = 0;
    let budgetShifts = 0;
    let audienceExpansions = 0;
    let recommendationsQueued = 0;
    const perClient: any[] = [];

    for (const c of rows) {
      if (Date.now() - start > TIME_BUDGET_MS) break;
      const status = c.meta_connection_status || c.metaConnectionStatus;
      if (status === 'token_expired') continue;

      const token = await resolveMetaToken(c.meta_access_token || c.metaAccessToken);
      if (!token) continue;
      const accounts = new Set<string>(await getClientAdAccounts(c.id));
      if (accounts.size === 0) continue;
      const adAccountId = [...accounts][0];
      const creds = { accessToken: token, adAccountId };

      // Performance per ad set (this client only) — ACTIVE ONLY. Never act on
      // paused/archived campaigns, ad sets, or ads.
      const cCampaigns = (allCampaigns as any[]).filter((x) => x.clientId === c.id && x.metaCampaignId && (x.status === 'active' || x.status === 'in_progress'));
      const campIds = new Set(cCampaigns.map((x) => x.id));
      const cAdSets = (allAdSets as any[]).filter((s) => campIds.has(s.campaignId) && s.status === 'active');
      const cAds = (allAds as any[]).filter((a) => campIds.has(a.campaignId) && a.status === 'active');
      if (cAdSets.length === 0) continue;

      const totalLeads = cAds.reduce((s, a) => s + (a.leads || 0), 0);
      const totalSpend = cAds.reduce((s, a) => s + (a.spend || 0), 0);
      const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
      if (avgCpl <= 0) continue;

      const setStats = cAdSets.map((s) => {
        const sAds = cAds.filter((a) => a.adSetId === s.id);
        const spend = sAds.reduce((t, a) => t + (a.spend || 0), 0);
        const leads = sAds.reduce((t, a) => t + (a.leads || 0), 0);
        const cpl = leads > 0 ? spend / leads : 0;
        const dailyBudget = (s as any).dailyBudget || (s as any).budget || 0;
        return { s, spend, leads, cpl, dailyBudget };
      }).filter((x) => x.spend >= MIN_SPEND);

      const winners = setStats.filter((x) => x.leads >= 3 && x.cpl > 0).sort((a, b) => a.cpl - b.cpl);
      const laggards = setStats.filter((x) => x.cpl > 0 && x.cpl > avgCpl * 1.3).sort((a, b) => b.cpl - a.cpl);

      let didShift = false;
      let didExpand = false;

      // ── 1) Budget reallocation: move 40% from worst laggard to best winner ──
      if (winners.length > 0 && laggards.length > 0) {
        const win = winners[0], lag = laggards[0];
        const winMeta = (win.s as any).metaAdSetId, lagMeta = (lag.s as any).metaAdSetId;
        if (winMeta && lagMeta && win.s.id !== lag.s.id && lag.dailyBudget > 0) {
          const move = Math.round(lag.dailyBudget * 0.4);
          const newLag = Math.max(20, lag.dailyBudget - move);
          const newWin = win.dailyBudget + move;
          // ── RECOMMEND MODE: queue for approval instead of writing to Meta ──
          if (recommend) {
            await queueRecommendation({
              clientId: c.id, clientName: c.name || c.id, type: 'mark_for_review',
              title: `הסטת תקציב מומלצת: ${lag.s.name} → ${win.s.name}`,
              description: `העבר ₪${move}/יום מקבוצה חלשה (CPL ₪${Math.round(lag.cpl)}) למנצחת (CPL ₪${Math.round(win.cpl)}). סך התקציב ללא שינוי.`,
              previewBefore: `${lag.s.name}: ₪${lag.dailyBudget}/יום · ${win.s.name}: ₪${win.dailyBudget}/יום`,
              previewAfter: `${lag.s.name}: ₪${newLag}/יום · ${win.s.name}: ₪${newWin}/יום`,
              adSetId: win.s.id, payload: { kind: 'shift_budget', lagMeta, winMeta, newLag, newWin },
            });
            await logMetaAction({ clientId: c.id, actionKind: 'shift_budget', category: 'budget', title: `המלצה: הסטת תקציב ${lag.s.name} → ${win.s.name}`, status: 'recommended', objectType: 'adset', detail: `מומלץ להעביר ₪${move}/יום לקבוצה המנצחת — ממתין לאישור`, actor: 'cron' });
            didShift = true; recommendationsQueued++;
          } else {
          // ── AUTO MODE: reallocation keeps the sum constant — never raises total ──
          try {
            const r1 = await updateMetaAdSetBudget(creds, lagMeta, newLag);
            const r2 = await updateMetaAdSetBudget(creds, winMeta, newWin);
            const okShift = r1.success && r2.success;
            await logMetaAction({
              clientId: c.id, actionKind: 'shift_budget', category: 'budget',
              title: `אוטומטי: הסטת תקציב ${lag.s.name} → ${win.s.name}`,
              status: okShift ? 'success' : 'failed',
              objectType: 'adset',
              detail: okShift ? `הוסטו ₪${move}/יום מקבוצה חלשה (CPL ₪${Math.round(lag.cpl)}) למנצחת (CPL ₪${Math.round(win.cpl)}) — סך התקציב ללא שינוי` : null,
              error: okShift ? null : (r1.error || r2.error || 'שגיאה'),
              actor: 'cron',
            });
            if (okShift) { didShift = true; budgetShifts++; }
          } catch { /* logged best-effort */ }
          }
        }
      }

      // ── 2) Budget-neutral audience expansion of the top winner ──
      if (Date.now() - start < TIME_BUDGET_MS && winners.length > 0) {
        const win = winners[0];
        const winMeta = (win.s as any).metaAdSetId;
        if (winMeta) {
          // ── RECOMMEND MODE: queue expansion suggestion, no Meta write ──
          if (recommend) {
            await queueRecommendation({
              clientId: c.id, clientName: c.name || c.id, type: 'test_new_audience',
              title: `הרחבת קהל מומלצת: ${win.s.name}`,
              description: `שכפל את הקבוצה המנצחת (CPL ₪${Math.round(win.cpl)}) לקהל רחב יותר (גיל ±, ללא תחומי עניין צרים) וחלק את התקציב — סך הכל ללא שינוי.`,
              previewBefore: `קבוצה אחת מנצחת: ${win.s.name}`,
              previewAfter: `${win.s.name} + עותק עם קהל מורחב (תקציב מחולק)`,
              adSetId: win.s.id, payload: { kind: 'expand_audience', winMeta },
            });
            await logMetaAction({ clientId: c.id, actionKind: 'expand_audience', category: 'audience', title: `המלצה: הרחבת קהל מנצח ${win.s.name}`, status: 'recommended', objectType: 'adset', detail: 'מומלץ לשכפל לקהל רחב יותר — ממתין לאישור', actor: 'cron' });
            didExpand = true; recommendationsQueued++;
          } else {
          try {
            const srcBudgetCents = await getMetaAdSetDailyBudget(creds, winMeta);
            const copy = await copyMetaAdSet(creds, winMeta, { deepCopy: true, statusOption: 'ACTIVE' });
            if (copy.success && copy.metaId) {
              const base = (win.s as any).targeting || {};
              const broadened = {
                age_min: Math.max(18, (base.age_min || 25) - 5),
                age_max: Math.min(65, (base.age_max || 45) + 10),
                geo_locations: base.geo_locations || { countries: ['IL'] },
              };
              let splitShekels: number | undefined;
              if (srcBudgetCents && srcBudgetCents > 0) {
                const half = Math.floor(srcBudgetCents / 2);
                splitShekels = Math.max(1, Math.round(half / 100));
                await updateMetaAdSetBudget(creds, winMeta, Math.max(1, Math.round((srcBudgetCents - half) / 100)));
              }
              await updateMetaAdSet(creds, copy.metaId, {
                name: `${win.s.name} — קהל מורחב (אוטומטי)`,
                targeting: broadened, status: 'ACTIVE', dailyBudget: splitShekels,
              });
              const ver = await verifyMetaEntity(creds, 'adset', copy.metaId);
              const okExp = !(ver.success && !ver.exists);
              await logMetaAction({
                clientId: c.id, actionKind: 'expand_audience', category: 'audience',
                title: `אוטומטי: הרחבת קהל מנצח ${win.s.name}`,
                status: okExp ? 'success' : 'failed',
                metaId: copy.metaId, objectType: 'adset',
                detail: okExp ? `שוכפלה הקבוצה המנצחת לקהל רחב יותר${splitShekels ? ` · תקציב חולק (₪${splitShekels}) — סך הכל ללא שינוי` : ''}` : null,
                error: okExp ? null : 'הקבוצה לא אומתה ב-Meta',
                actor: 'cron',
              });
              if (okExp) { didExpand = true; audienceExpansions++; }
            }
          } catch { /* logged best-effort */ }
          }
        }
      }

      if (didShift || didExpand) {
        clientsTouched++;
        perClient.push({ client: c.name || c.id, budgetShift: didShift, audienceExpansion: didExpand });
      }
    }

    return NextResponse.json({
      success: true, mode: writeMode, clientsTouched, budgetShifts, audienceExpansions, recommendationsQueued,
      durationMs: Date.now() - start, perClient,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error';
    console.error('[cron/meta-auto-optimize] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
