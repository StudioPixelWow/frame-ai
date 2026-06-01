/**
 * GET /api/meta-business/overview?datePreset=today[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 *
 * Command-Center overview across ALL clients. Primary metrics come from the synced
 * campaign snapshot in the DB (campaigns/ad-sets/ads collections — the same source
 * the per-client dashboard uses, always populated after a sync). The persisted daily
 * reports (app_meta_daily_reports) are layered on top for trend, health and the
 * time-series chart when they exist. DB-only — no live Meta fan-out.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { campaigns as campaignsCol, adSets as adSetsCol, ads as adsCol } from '@/lib/db/collections';

export const dynamic = 'force-dynamic';

const ALLOWED = ['today', 'yesterday', 'last_7d', 'last_30d', 'this_month', 'last_month', 'maximum', 'custom'];

const num = (v: unknown): number => { const n = Number(v); return isNaN(n) ? 0 : n; };
const isActive = (s: string) => /active|in_progress/i.test(s || '');

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(base: Date, days: number): Date { const d = new Date(base); d.setUTCDate(d.getUTCDate() + days); return d; }

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
    default: return { from: null, to: null };
  }
}
function priorWindow(from: string | null, to: string | null): { from: string | null; to: string | null } {
  if (!from || !to) return { from: null, to: null };
  const f = new Date(from + 'T00:00:00Z'), t = new Date(to + 'T00:00:00Z');
  const lenDays = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const priorTo = addDays(f, -1);
  return { from: isoDate(addDays(priorTo, -(lenDays - 1))), to: isoDate(priorTo) };
}
const inWindow = (date: string, from: string | null, to: string | null) => (!from || date >= from) && (!to || date <= to);

interface Agg { spend: number; leads: number; clicks: number; impressions: number; activeCampaigns: number; }
function aggReports(reports: any[]): Agg {
  const a: Agg = { spend: 0, leads: 0, clicks: 0, impressions: 0, activeCampaigns: 0 };
  const active = new Set<string>();
  for (const r of reports) {
    const s = r.summary || {};
    a.spend += num(s.totalSpend); a.leads += num(s.totalLeads);
    for (const c of (r.campaigns || [])) {
      a.clicks += num(c.clicks); a.impressions += num(c.impressions);
      if (isActive(c.status)) active.add(c.campaignId || c.campaignName);
    }
  }
  a.activeCampaigns = active.size;
  return a;
}
const cplOf = (a: Agg) => (a.leads > 0 ? a.spend / a.leads : 0);
const ctrOf = (a: Agg) => (a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0);
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

    // 1) Clients
    const { data: clientRows } = await sb.from('clients').select('*');
    const clientsById: Record<string, any> = {};
    const isConnected = (c: any) =>
      (c.meta_connection_status === 'connected' || c.metaConnectionStatus === 'connected') &&
      Boolean(c.meta_ad_account_id || c.metaAdAccountId);
    for (const c of (clientRows || []) as any[]) clientsById[c.id] = c;

    // 2) Synced snapshot (DB collections — same source as the per-client dashboard)
    const [allCampaigns, , allAds] = await Promise.all([
      campaignsCol.getAllAsync(), adSetsCol.getAllAsync(), adsCol.getAllAsync(),
    ]);
    const adsByCampaign: Record<string, any[]> = {};
    for (const a of (allAds as any[])) (adsByCampaign[a.campaignId] = adsByCampaign[a.campaignId] || []).push(a);

    // 3) Campaign assignments (shared accounts)
    const assignedToClient: Record<string, Set<string>> = {};
    try {
      const { data: asg } = await sb.from('app_meta_campaign_assignments').select('client_id, meta_campaign_id');
      for (const a of (asg || []) as any[]) {
        if (!a.client_id || !a.meta_campaign_id) continue;
        (assignedToClient[a.client_id] = assignedToClient[a.client_id] || new Set()).add(a.meta_campaign_id);
      }
    } catch { /* table may not exist */ }

    // 4) Daily reports (trend / health / series) — optional
    const reportsByClient: Record<string, any[]> = {};
    const allReports: any[] = [];
    try {
      const { data: reportRows } = await sb.from('app_meta_daily_reports').select('*').order('date', { ascending: false }).limit(1200);
      for (const row of (reportRows || []) as any[]) {
        const rep = row.report_data || row.data || row;
        const cid = row.client_id || rep.clientId;
        if (!cid) continue;
        rep.__date = row.date || rep.date; rep.__clientId = cid;
        (reportsByClient[cid] = reportsByClient[cid] || []).push(rep);
        allReports.push(rep);
      }
    } catch { /* optional */ }

    // Resolve a client's campaigns from the snapshot (by account + assignments).
    const clientCampaigns = (cid: string) => {
      const byAccount = (allCampaigns as any[]).filter(
        (c) => c.clientId === cid && c.metaCampaignId && c.status !== 'completed' && c.status !== 'archived',
      );
      const have = new Set(byAccount.map((c) => c.metaCampaignId));
      const assigned: any[] = [];
      for (const mid of (assignedToClient[cid] || [])) {
        if (have.has(mid)) continue;
        const synced = (allCampaigns as any[]).find((c) => c.metaCampaignId === mid);
        if (synced) assigned.push(synced);
      }
      return [...byAccount, ...assigned];
    };

    const aggSnapshot = (camps: any[]): Agg => {
      const a: Agg = { spend: 0, leads: 0, clicks: 0, impressions: 0, activeCampaigns: 0 };
      for (const c of camps) {
        if (isActive(c.status)) a.activeCampaigns += 1;
        for (const ad of (adsByCampaign[c.id] || [])) {
          a.spend += num(ad.spend); a.leads += num(ad.leads);
          a.clicks += num(ad.clicks); a.impressions += num(ad.impressions);
        }
      }
      return a;
    };

    // Build the full client set: connected clients + any client that has campaigns/reports.
    const clientIds = new Set<string>();
    for (const c of (clientRows || []) as any[]) if (isConnected(c)) clientIds.add(c.id);
    for (const c of (allCampaigns as any[])) if (c.clientId) clientIds.add(c.clientId);
    for (const cid of Object.keys(assignedToClient)) clientIds.add(cid);
    for (const cid of Object.keys(reportsByClient)) clientIds.add(cid);

    const clients: any[] = [];
    const globalCur: Agg = { spend: 0, leads: 0, clicks: 0, impressions: 0, activeCampaigns: 0 };

    for (const cid of clientIds) {
      const cRow = clientsById[cid];
      const name = cRow?.name || cRow?.company || cid;
      const camps = clientCampaigns(cid);
      const snap = aggSnapshot(camps);

      // Prefer date-accurate report aggregates when reports exist for the window.
      const reps = reportsByClient[cid] || [];
      const curReps = reps.filter((r) => inWindow(r.__date, win.from, win.to));
      const priorReps = reps.filter((r) => inWindow(r.__date, prior.from, prior.to));
      const usingReports = curReps.length > 0;
      const cur = usingReports ? aggReports(curReps) : snap;
      const prev = aggReports(priorReps);

      const sortedReps = [...reps].sort((a, b) => (a.__date < b.__date ? 1 : -1));
      const healthSrc = (usingReports ? curReps : sortedReps).sort((a, b) => (a.__date < b.__date ? 1 : -1))[0];

      const cCpl = cplOf(cur), cCtr = ctrOf(cur);
      const zeroLeads = cur.spend > 0 && cur.leads === 0;

      // Health: from report if available, else a simple heuristic from the snapshot.
      let health = healthSrc?.summary?.healthScore != null ? Math.round(num(healthSrc.summary.healthScore)) : 0;
      if (healthSrc?.summary?.healthScore == null) {
        health = 70;
        if (zeroLeads) health = 35;
        else if (cur.leads > 0 && cCpl > 0 && cCpl < 60) health = 82;
        else if (cur.leads > 0) health = 72;
        else if (cur.spend === 0) health = 60;
      }

      const trend = {
        leads: Math.round(pctDelta(cur.leads, prev.leads)),
        spend: Math.round(pctDelta(cur.spend, prev.spend)),
        cpl: prev.leads > 0 && cur.leads > 0 ? Math.round(pctDelta(cCpl, cplOf(prev))) : 0,
        ctr: prev.impressions > 0 && cur.impressions > 0 ? Math.round(pctDelta(cCtr, ctrOf(prev))) : 0,
      };

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
        activeCampaigns: cur.activeCampaigns || snap.activeCampaigns,
        trend,
        stale: false,
        lastDate: healthSrc?.__date || null,
      });

      globalCur.spend += cur.spend; globalCur.leads += cur.leads;
      globalCur.clicks += cur.clicks; globalCur.impressions += cur.impressions;
      globalCur.activeCampaigns += (cur.activeCampaigns || snap.activeCampaigns);
    }

    const rank = { critical: 0, warning: 1, healthy: 2 } as Record<string, number>;
    clients.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.spend - a.spend));

    const activeClients = clients.filter((c) => c.spend > 0 || c.leads > 0 || c.activeCampaigns > 0).length;
    const kpis = {
      activeClients,
      activeCampaigns: globalCur.activeCampaigns,
      leads: globalCur.leads,
      spend: Math.round(globalCur.spend),
      avgCpl: Math.round(cplOf(globalCur) * 10) / 10,
      avgCtr: Math.round(ctrOf(globalCur) * 100) / 100,
    };

    // Time-series (last 30 days from daily reports, if any)
    const seriesFrom = isoDate(addDays(new Date(), -29));
    const byDate: Record<string, { spend: number; leads: number }> = {};
    for (const r of allReports) {
      const d = r.__date;
      if (!d || d < seriesFrom) continue;
      const s = r.summary || {};
      byDate[d] = byDate[d] || { spend: 0, leads: 0 };
      byDate[d].spend += num(s.totalSpend); byDate[d].leads += num(s.totalLeads);
    }
    const series = Object.keys(byDate).sort().map((d) => ({
      date: d, leads: byDate[d].leads, spend: Math.round(byDate[d].spend),
      cpl: byDate[d].leads > 0 ? Math.round((byDate[d].spend / byDate[d].leads) * 10) / 10 : 0,
    }));

    // Insights
    const insights: any[] = [];
    const zeroLeadClients = clients.filter((c) => c.spend > 0 && c.leads === 0);
    const ctrDropClients = clients.filter((c) => c.trend.ctr <= -20);
    const cplWorseClients = clients.filter((c) => c.trend.cpl >= 20 && c.leads > 0);
    const cplBetterClients = clients.filter((c) => c.trend.cpl <= -10 && c.leads > 0);
    if (zeroLeadClients.length) insights.push({ severity: 'critical', icon: '🚫', title: `${zeroLeadClients.length} לקוחות מבזבזים תקציב ללא לידים`, detail: zeroLeadClients.map((c) => c.name).slice(0, 5).join(', '), clientIds: zeroLeadClients.map((c) => c.id) });
    if (ctrDropClients.length) insights.push({ severity: 'warning', icon: '📉', title: `${ctrDropClients.length} לקוחות עם ירידת CTR מעל 20%`, detail: ctrDropClients.map((c) => `${c.name} (${c.trend.ctr}%)`).slice(0, 5).join(', '), clientIds: ctrDropClients.map((c) => c.id) });
    if (cplWorseClients.length) insights.push({ severity: 'warning', icon: '⚠️', title: `${cplWorseClients.length} לקוחות עם עלייה ב-CPL`, detail: cplWorseClients.map((c) => `${c.name} (+${c.trend.cpl}%)`).slice(0, 5).join(', '), clientIds: cplWorseClients.map((c) => c.id) });
    if (cplBetterClients.length) insights.push({ severity: 'positive', icon: '🚀', title: `${cplBetterClients.length} לקוחות שיפרו CPL`, detail: cplBetterClients.map((c) => `${c.name} (${c.trend.cpl}%)`).slice(0, 5).join(', '), clientIds: cplBetterClients.map((c) => c.id) });

    // Attention
    const avgAccountCpl = kpis.avgCpl;
    const attention: any[] = [];
    for (const c of clients) {
      if (c.spend > 0 && c.leads === 0) attention.push({ clientId: c.id, name: c.name, severity: 'critical', reason: 'אין לידים למרות הוצאה', metric: `₪${c.spend.toLocaleString('he-IL')} ללא לידים` });
      else if (avgAccountCpl > 0 && c.leads > 0 && c.cpl > avgAccountCpl * 1.8) attention.push({ clientId: c.id, name: c.name, severity: 'warning', reason: 'CPL גבוה מהממוצע', metric: `₪${c.cpl} מול ממוצע ₪${avgAccountCpl}` });
      if (c.trend.ctr <= -20) attention.push({ clientId: c.id, name: c.name, severity: 'warning', reason: 'ירידת CTR חדה', metric: `${c.trend.ctr}%` });
      if (c.trend.cpl >= 20 && c.leads > 0) attention.push({ clientId: c.id, name: c.name, severity: 'warning', reason: 'CPL מחמיר', metric: `+${c.trend.cpl}%` });
    }
    const sevRank = { critical: 0, warning: 1 } as Record<string, number>;
    attention.sort((a, b) => (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9));

    return NextResponse.json({
      datePreset: preset, range: win,
      hasData: clients.length > 0,
      kpis, clients, series, insights, attention,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg, clients: [], kpis: null, series: [], insights: [], attention: [], hasData: false }, { status: 200 });
  }
}
