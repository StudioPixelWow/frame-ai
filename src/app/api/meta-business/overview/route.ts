/**
 * GET /api/meta-business/overview?datePreset=today[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 *
 * Command-Center overview across ALL clients. Reads the persisted daily reports
 * (app_meta_daily_reports) — fast, DB-only, no live Meta fan-out — and aggregates
 * them into: global KPIs, per-client cards (with trend vs the previous period),
 * a global time-series for the chart, computed AI insights, and an attention list.
 *
 * Live per-client data is fetched on drill-in (the existing /campaigns endpoint).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

const ALLOWED = ['today', 'yesterday', 'last_7d', 'last_30d', 'this_month', 'last_month', 'maximum', 'custom'];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Resolve [from, to] (inclusive, YYYY-MM-DD) for a preset. null = unbounded. */
function resolveWindow(preset: string, from?: string | null, to?: string | null): { from: string | null; to: string | null } {
  const now = new Date();
  const today = isoDate(now);
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const y = isoDate(addDays(now, -1)); return { from: y, to: y }; }
    case 'last_7d': return { from: isoDate(addDays(now, -6)), to: today };
    case 'last_30d': return { from: isoDate(addDays(now, -29)), to: today };
    case 'this_month': return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'last_month': {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      return { from: isoDate(first), to: isoDate(last) };
    }
    case 'custom': return { from: from || null, to: to || null };
    case 'maximum':
    default: return { from: null, to: null };
  }
}

/** Immediately-preceding window of equal length (for trend deltas). */
function priorWindow(from: string | null, to: string | null): { from: string | null; to: string | null } {
  if (!from || !to) return { from: null, to: null };
  const f = new Date(from + 'T00:00:00Z');
  const t = new Date(to + 'T00:00:00Z');
  const lenDays = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const priorTo = addDays(f, -1);
  const priorFrom = addDays(priorTo, -(lenDays - 1));
  return { from: isoDate(priorFrom), to: isoDate(priorTo) };
}

function inWindow(date: string, from: string | null, to: string | null): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

interface Agg { spend: number; leads: number; clicks: number; impressions: number; activeCampaigns: number; }
function emptyAgg(): Agg { return { spend: 0, leads: 0, clicks: 0, impressions: 0, activeCampaigns: 0 }; }

/** Aggregate a set of daily-report rows into spend/leads/clicks/impressions/active-campaigns. */
function aggregate(reports: any[]): Agg {
  const a = emptyAgg();
  const activeCampaignIds = new Set<string>();
  for (const r of reports) {
    const s = r.summary || {};
    a.spend += Number(s.totalSpend || 0);
    a.leads += Number(s.totalLeads || 0);
    for (const c of (r.campaigns || [])) {
      a.clicks += Number(c.clicks || 0);
      a.impressions += Number(c.impressions || 0);
      if (c.status === 'active' || c.status === 'in_progress') activeCampaignIds.add(c.campaignId || c.campaignName);
    }
  }
  a.activeCampaigns = activeCampaignIds.size;
  return a;
}

const cpl = (a: Agg) => (a.leads > 0 ? a.spend / a.leads : 0);
const ctr = (a: Agg) => (a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0);
const pctDelta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : (cur > 0 ? 100 : 0));

export async function GET(req: NextRequest) {
  try {
    const presetParam = req.nextUrl.searchParams.get('datePreset') || 'today';
    const preset = ALLOWED.includes(presetParam) ? presetParam : 'today';
    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');

    const win = resolveWindow(preset, from, to);
    const prior = priorWindow(win.from, win.to);

    const sb = getSupabase();

    // Clients (names + connection)
    const { data: clientRows } = await sb.from('clients').select('*');
    const clientsById: Record<string, any> = {};
    const isConnected = (c: any) =>
      (c.meta_connection_status === 'connected' || c.metaConnectionStatus === 'connected') &&
      Boolean(c.meta_ad_account_id || c.metaAdAccountId);
    for (const c of (clientRows || []) as any[]) clientsById[c.id] = c;

    // Daily reports — recent slice across all clients (DB-only, fast).
    const { data: reportRows, error: repErr } = await sb
      .from('app_meta_daily_reports')
      .select('*')
      .order('date', { ascending: false })
      .limit(1200);

    if (repErr) {
      return NextResponse.json({ error: repErr.message, clients: [], kpis: null, series: [], insights: [], attention: [] }, { status: 200 });
    }

    // Group reports by client.
    const reportsByClient: Record<string, any[]> = {};
    const allReports: any[] = [];
    for (const row of (reportRows || []) as any[]) {
      const rep = row.report_data || row.data || row;
      const cid = row.client_id || rep.clientId;
      if (!cid) continue;
      rep.__date = row.date || rep.date;
      rep.__clientId = cid;
      (reportsByClient[cid] = reportsByClient[cid] || []).push(rep);
      allReports.push(rep);
    }

    // ── Per-client cards ────────────────────────────────────────────────
    const clients: any[] = [];
    const globalCur = emptyAgg();
    for (const cid of Object.keys(reportsByClient)) {
      const cRow = clientsById[cid];
      const name = cRow?.name || cRow?.company || cid;
      const reps = reportsByClient[cid];
      const curReps = reps.filter((r) => inWindow(r.__date, win.from, win.to));
      const priorReps = reps.filter((r) => inWindow(r.__date, prior.from, prior.to));

      // Fall back to the latest known report if nothing in-window (so cards aren't blank).
      const sortedDesc = [...reps].sort((a, b) => (a.__date < b.__date ? 1 : -1));
      const stale = curReps.length === 0;
      const effectiveReps = curReps.length > 0 ? curReps : (sortedDesc[0] ? [sortedDesc[0]] : []);

      const cur = aggregate(effectiveReps);
      const prev = aggregate(priorReps);

      // Health: latest in-window report's healthScore (else most recent overall).
      const healthSrc = (curReps.length > 0 ? curReps : sortedDesc).sort((a, b) => (a.__date < b.__date ? 1 : -1))[0];
      const health = Math.round(Number(healthSrc?.summary?.healthScore ?? 0));

      const cCpl = cpl(cur), cCtr = ctr(cur);
      const trend = {
        leads: Math.round(pctDelta(cur.leads, prev.leads)),
        spend: Math.round(pctDelta(cur.spend, prev.spend)),
        cpl: prev.leads > 0 && cur.leads > 0 ? Math.round(pctDelta(cCpl, cpl(prev))) : 0,
        ctr: prev.impressions > 0 && cur.impressions > 0 ? Math.round(pctDelta(cCtr, ctr(prev))) : 0,
      };

      const zeroLeads = cur.spend > 0 && cur.leads === 0;
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (zeroLeads || health < 50) status = 'critical';
      else if (health < 75 || trend.cpl > 20 || trend.ctr < -20) status = 'warning';

      clients.push({
        id: cid, name,
        connected: cRow ? isConnected(cRow) : true,
        status, health,
        leads: cur.leads,
        spend: Math.round(cur.spend),
        cpl: Math.round(cCpl * 10) / 10,
        ctr: Math.round(cCtr * 100) / 100,
        activeCampaigns: cur.activeCampaigns,
        trend, stale,
        lastDate: healthSrc?.__date || null,
      });

      // accumulate global (only real in-window activity, not the stale fallback)
      if (!stale) {
        globalCur.spend += cur.spend; globalCur.leads += cur.leads;
        globalCur.clicks += cur.clicks; globalCur.impressions += cur.impressions;
        globalCur.activeCampaigns += cur.activeCampaigns;
      }
    }

    // sort: critical → warning → healthy, then by spend desc
    const rank = { critical: 0, warning: 1, healthy: 2 } as Record<string, number>;
    clients.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.spend - a.spend));

    // ── Global KPIs ─────────────────────────────────────────────────────
    const activeClients = clients.filter((c) => !c.stale && (c.spend > 0 || c.leads > 0)).length;
    const kpis = {
      activeClients,
      activeCampaigns: globalCur.activeCampaigns,
      leads: globalCur.leads,
      spend: Math.round(globalCur.spend),
      avgCpl: Math.round(cpl(globalCur) * 10) / 10,
      avgCtr: Math.round(ctr(globalCur) * 100) / 100,
    };

    // ── Global time-series (last 30 days, aggregated across clients) ─────
    const seriesFrom = isoDate(addDays(new Date(), -29));
    const byDate: Record<string, { spend: number; leads: number }> = {};
    for (const r of allReports) {
      const d = r.__date;
      if (!d || d < seriesFrom) continue;
      const s = r.summary || {};
      byDate[d] = byDate[d] || { spend: 0, leads: 0 };
      byDate[d].spend += Number(s.totalSpend || 0);
      byDate[d].leads += Number(s.totalLeads || 0);
    }
    const series = Object.keys(byDate).sort().map((d) => ({
      date: d,
      leads: byDate[d].leads,
      spend: Math.round(byDate[d].spend),
      cpl: byDate[d].leads > 0 ? Math.round((byDate[d].spend / byDate[d].leads) * 10) / 10 : 0,
    }));

    // ── AI insights (computed from real aggregates) ─────────────────────
    const insights: any[] = [];
    const zeroLeadClients = clients.filter((c) => !c.stale && c.spend > 0 && c.leads === 0);
    const ctrDropClients = clients.filter((c) => c.trend.ctr <= -20);
    const cplWorseClients = clients.filter((c) => c.trend.cpl >= 20 && c.leads > 0);
    const cplBetterClients = clients.filter((c) => c.trend.cpl <= -10 && c.leads > 0);

    if (zeroLeadClients.length > 0) insights.push({
      severity: 'critical', icon: '🚫', title: `${zeroLeadClients.length} לקוחות מבזבזים תקציב ללא לידים`,
      detail: zeroLeadClients.map((c) => c.name).slice(0, 5).join(', '),
      clientIds: zeroLeadClients.map((c) => c.id),
    });
    if (ctrDropClients.length > 0) insights.push({
      severity: 'warning', icon: '📉', title: `${ctrDropClients.length} לקוחות עם ירידת CTR מעל 20%`,
      detail: ctrDropClients.map((c) => `${c.name} (${c.trend.ctr}%)`).slice(0, 5).join(', '),
      clientIds: ctrDropClients.map((c) => c.id),
    });
    if (cplWorseClients.length > 0) insights.push({
      severity: 'warning', icon: '⚠️', title: `${cplWorseClients.length} לקוחות עם עלייה ב-CPL`,
      detail: cplWorseClients.map((c) => `${c.name} (+${c.trend.cpl}%)`).slice(0, 5).join(', '),
      clientIds: cplWorseClients.map((c) => c.id),
    });
    if (cplBetterClients.length > 0) insights.push({
      severity: 'positive', icon: '🚀', title: `${cplBetterClients.length} לקוחות שיפרו CPL`,
      detail: cplBetterClients.map((c) => `${c.name} (${c.trend.cpl}%)`).slice(0, 5).join(', '),
      clientIds: cplBetterClients.map((c) => c.id),
    });

    // ── Attention center (per-client actionable flags) ──────────────────
    const avgAccountCpl = kpis.avgCpl;
    const attention: any[] = [];
    for (const c of clients) {
      if (c.stale) continue;
      if (c.spend > 0 && c.leads === 0) {
        attention.push({ clientId: c.id, name: c.name, severity: 'critical', reason: 'אין לידים למרות הוצאה', metric: `₪${c.spend.toLocaleString('he-IL')} ללא לידים` });
      } else if (avgAccountCpl > 0 && c.leads > 0 && c.cpl > avgAccountCpl * 1.8) {
        attention.push({ clientId: c.id, name: c.name, severity: 'warning', reason: 'CPL גבוה מהממוצע', metric: `₪${c.cpl} מול ממוצע ₪${avgAccountCpl}` });
      }
      if (c.trend.ctr <= -20) {
        attention.push({ clientId: c.id, name: c.name, severity: 'warning', reason: 'ירידת CTR חדה', metric: `${c.trend.ctr}%` });
      }
      if (c.trend.cpl >= 20 && c.leads > 0) {
        attention.push({ clientId: c.id, name: c.name, severity: 'warning', reason: 'CPL מחמיר', metric: `+${c.trend.cpl}%` });
      }
    }
    const sevRank = { critical: 0, warning: 1 } as Record<string, number>;
    attention.sort((a, b) => (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9));

    return NextResponse.json({
      datePreset: preset,
      range: win,
      hasData: allReports.length > 0,
      kpis,
      clients,
      series,
      insights,
      attention,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg, clients: [], kpis: null, series: [], insights: [], attention: [], hasData: false }, { status: 200 });
  }
}
