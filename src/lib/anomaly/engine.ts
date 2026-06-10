/**
 * Anomaly detection — scans recent metrics per client and flags sudden,
 * meaningful changes the team should know about: AI-visibility drops, ranking
 * crashes, and Google-Ads cost/CPL spikes. Every source is best-effort and
 * guarded, so missing data never breaks the scan. Pure read; no side effects.
 */

import { getSupabase } from '@/lib/db/store';

export type AnomalySeverity = 'high' | 'medium' | 'low';
export type AnomalyDirection = 'up' | 'down';
export interface Anomaly {
  clientId: string | null; clientName: string; channel: 'GEO' | 'SEO' | 'Google Ads';
  metric: string; severity: AnomalySeverity; direction: AnomalyDirection;
  message: string; prev: number | null; current: number | null; changePct: number | null;
}

const pct = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / Math.abs(prev)) * 100);
const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : null);

/** Pull cost/CPL/clicks from a Google Ads report's jsonData, tolerant of shape. */
function adsTotals(j: any): { cost: number | null; cpl: number | null; clicks: number | null } {
  const t = j?.totals || j?.current || j || {};
  const cost = num(t.cost ?? t.spend ?? t.totalCost);
  const conv = num(t.conversions ?? t.leads ?? t.conv);
  const clicks = num(t.clicks);
  const cpl = num(t.cpl ?? t.costPerLead ?? (cost != null && conv ? cost / conv : null));
  return { cost, cpl, clicks };
}

export async function detectClientAnomalies(clientId: string, clientName: string): Promise<Anomaly[]> {
  const sb = getSupabase();
  const out: Anomaly[] = [];

  // ── 1) AI visibility (monthly aggregations) ──
  try {
    const { data } = await sb.from('geo_visibility_monthly_aggregations').select('month,visibility_score,total_mentions,share_of_ai_voice').eq('client_id', clientId).order('month', { ascending: false }).limit(2);
    if (data && data.length === 2) {
      const [cur, prev] = data;
      const dScore = (cur.visibility_score || 0) - (prev.visibility_score || 0);
      if (dScore <= -10) out.push({ clientId, clientName, channel: 'GEO', metric: 'ציון נראות AI', severity: dScore <= -20 ? 'high' : 'medium', direction: 'down', message: `ציון הנראות ב-AI ירד מ-${prev.visibility_score} ל-${cur.visibility_score}.`, prev: prev.visibility_score, current: cur.visibility_score, changePct: Math.round(pct(cur.visibility_score || 0, prev.visibility_score || 0)) });
      const dMen = pct(cur.total_mentions || 0, prev.total_mentions || 0);
      if (dMen <= -30 && (prev.total_mentions || 0) >= 3) out.push({ clientId, clientName, channel: 'GEO', metric: 'אזכורים ב-AI', severity: dMen <= -50 ? 'high' : 'medium', direction: 'down', message: `אזכורי המותג ב-AI צנחו ב-${Math.abs(Math.round(dMen))}% (${prev.total_mentions}→${cur.total_mentions}).`, prev: prev.total_mentions, current: cur.total_mentions, changePct: Math.round(dMen) });
    }
  } catch { /* skip */ }

  // ── 2) Organic ranks (tracked keywords) ──
  try {
    const { data } = await sb.from('geo_tracked_keywords').select('keyword,current_rank,previous_rank').eq('client_id', clientId).limit(300);
    if (data && data.length) {
      const drops = data.filter((k: any) => num(k.current_rank) && num(k.previous_rank) && (k.current_rank - k.previous_rank) >= 5);
      const bigDrops = drops.filter((k: any) => (k.current_rank - k.previous_rank) >= 10);
      if (drops.length) {
        const worst = drops.sort((a: any, b: any) => (b.current_rank - b.previous_rank) - (a.current_rank - a.previous_rank))[0];
        out.push({ clientId, clientName, channel: 'SEO', metric: 'דירוג אורגני', severity: bigDrops.length >= 3 ? 'high' : drops.length >= 3 ? 'medium' : 'low', direction: 'down', message: `${drops.length} ביטויים ירדו בדירוג. הבולט: "${worst.keyword}" ${worst.previous_rank}→${worst.current_rank}.`, prev: worst.previous_rank, current: worst.current_rank, changePct: null });
      }
    }
  } catch { /* skip */ }

  // ── 3) Google Ads (last two reports) ──
  try {
    const { listReportsForClient } = await import('@/lib/google-ads/db');
    const reports = await listReportsForClient(clientId);
    const done = (reports || []).filter((r: any) => r.status === 'ready' || r.status === 'completed' || r.jsonData).slice(0, 2);
    if (done.length === 2) {
      const cur = adsTotals(done[0].jsonData); const prev = adsTotals(done[1].jsonData);
      if (cur.cpl != null && prev.cpl != null && prev.cpl > 0) {
        const d = pct(cur.cpl, prev.cpl);
        if (d >= 30) out.push({ clientId, clientName, channel: 'Google Ads', metric: 'עלות לליד (CPL)', severity: d >= 60 ? 'high' : 'medium', direction: 'up', message: `העלות לליד עלתה ב-${Math.round(d)}% (₪${prev.cpl.toFixed(0)}→₪${cur.cpl.toFixed(0)}).`, prev: Math.round(prev.cpl), current: Math.round(cur.cpl), changePct: Math.round(d) });
      }
      if (cur.cost != null && prev.cost != null && prev.cost > 0) {
        const d = pct(cur.cost, prev.cost);
        if (Math.abs(d) >= 40) out.push({ clientId, clientName, channel: 'Google Ads', metric: 'הוצאה', severity: Math.abs(d) >= 70 ? 'high' : 'medium', direction: d > 0 ? 'up' : 'down', message: `ההוצאה ${d > 0 ? 'קפצה' : 'צנחה'} ב-${Math.abs(Math.round(d))}% (₪${prev.cost.toFixed(0)}→₪${cur.cost.toFixed(0)}).`, prev: Math.round(prev.cost), current: Math.round(cur.cost), changePct: Math.round(d) });
      }
    }
  } catch { /* skip */ }

  return out;
}

export async function detectAllAnomalies(): Promise<{ anomalies: Anomaly[]; clientsScanned: number }> {
  const sb = getSupabase();
  let clients: any[] = [];
  try {
    const { data } = await sb.from('clients').select('id,name,status').limit(500);
    clients = (data || []).map((r: any) => ({ id: r.id, name: r.name || 'לקוח', status: r.status }));
  } catch { /* */ }
  const active = clients.filter((c) => c.status !== 'inactive' && c.status !== 'archived');
  const results = await Promise.all(active.map((c) => detectClientAnomalies(c.id, c.name).catch(() => [] as Anomaly[])));
  const anomalies = results.flat().sort((a, b) => sevRank(b.severity) - sevRank(a.severity));
  return { anomalies, clientsScanned: active.length };
}

function sevRank(s: AnomalySeverity): number { return s === 'high' ? 3 : s === 'medium' ? 2 : 1; }
