/**
 * Agency snapshot — a compact, defensive aggregation of the agency's live state
 * (clients, tasks, collections, reports) used to power the "AI מנכ״ל": a daily
 * brief and free-text "ask the data". Every source is wrapped so one failure
 * never breaks the whole snapshot.
 */

import { getSupabase } from '@/lib/db/store';
import { employeeTasks, clientGanttItems, googleAdsReports } from '@/lib/db';

export interface AgencySnapshot {
  generatedAt: string;
  clients: { total: number; active: number; byType: Record<string, number>; retainerMonthly: number };
  tasks: { total: number; dueToday: number; overdue: number; missed: number; completedLast7: number; topOverdue: { title: string; client: string; due: string }[] };
  collections: { monthlyRetainerClients: number; estMonthlyRetainer: number };
  reports: { googleAdsLast30: number };
  text: string; // compact text rendering for the prompt
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysAgo = (n: number) => Date.now() - n * 86400000;

export async function buildAgencySnapshot(): Promise<AgencySnapshot> {
  const today = startOfToday();
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Clients ──
  let clientsTotal = 0, clientsActive = 0, retainerMonthly = 0, estMonthlyRetainer = 0;
  const byType: Record<string, number> = {};
  try {
    const sb = getSupabase();
    const { data } = await sb.from('clients').select('client_type, status, retainer_amount');
    for (const c of (data || []) as any[]) {
      clientsTotal++;
      if (c.status === 'active') clientsActive++;
      const t = c.client_type || 'marketing'; byType[t] = (byType[t] || 0) + 1;
      const amt = Number(c.retainer_amount) || 0;
      if (amt > 0 && c.status === 'active') { retainerMonthly++; estMonthlyRetainer += amt; }
    }
  } catch { /* ok */ }

  // ── Tasks ──
  let tTotal = 0, dueToday = 0, overdue = 0, missed = 0, completed7 = 0;
  const topOverdue: { title: string; client: string; due: string }[] = [];
  try {
    const tasks = (await employeeTasks.getAllAsync()) as any[];
    const done = new Set(['completed', 'approved']);
    for (const t of tasks) {
      tTotal++;
      if (t.status === 'missed') { missed++; continue; }
      if (t.status === 'completed' && t.updatedAt && new Date(t.updatedAt).getTime() >= daysAgo(7)) completed7++;
      if (done.has(t.status)) continue;
      if (t.dueDate) {
        const d = new Date(t.dueDate).getTime();
        if (!Number.isNaN(d)) {
          if (d < today) { overdue++; if (topOverdue.length < 8) topOverdue.push({ title: t.title || 'משימה', client: t.clientName || '', due: (t.dueDate || '').slice(0, 10) }); }
          else if ((t.dueDate || '').slice(0, 10) === todayStr) dueToday++;
        }
      }
    }
  } catch { /* ok */ }

  // ── Reports ──
  let gaLast30 = 0;
  try {
    const reps = (await googleAdsReports.getAllAsync()) as any[];
    gaLast30 = reps.filter((r) => r.createdAt && new Date(r.createdAt).getTime() >= daysAgo(30)).length;
  } catch { /* ok */ }

  const snap: AgencySnapshot = {
    generatedAt: new Date().toISOString(),
    clients: { total: clientsTotal, active: clientsActive, byType, retainerMonthly },
    tasks: { total: tTotal, dueToday, overdue, missed, completedLast7: completed7, topOverdue },
    collections: { monthlyRetainerClients: retainerMonthly, estMonthlyRetainer: Math.round(estMonthlyRetainer) },
    reports: { googleAdsLast30: gaLast30 },
    text: '',
  };

  snap.text = [
    `תאריך: ${todayStr}`,
    `לקוחות: ${clientsActive} פעילים מתוך ${clientsTotal} (${Object.entries(byType).map(([k, v]) => `${k}:${v}`).join(', ')})`,
    `ריטיינר חודשי: ${retainerMonthly} לקוחות, צפי הכנסה חודשית ~₪${Math.round(estMonthlyRetainer).toLocaleString('he-IL')}`,
    `משימות: ${tTotal} סה״כ · ${dueToday} להיום · ${overdue} באיחור · ${missed} לא בוצעו · ${completed7} הושלמו ב-7 ימים`,
    topOverdue.length ? `משימות באיחור בולטות: ${topOverdue.map((t) => `"${t.title}"${t.client ? ` (${t.client})` : ''}`).join(' · ')}` : '',
    `דוחות Google Ads ב-30 יום: ${gaLast30}`,
  ].filter(Boolean).join('\n');

  return snap;
}
