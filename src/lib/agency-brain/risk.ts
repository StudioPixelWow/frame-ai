/**
 * Churn / at-risk radar — scores each active client by warning signals
 * (overdue & missed tasks, no recent content activity, no recent report,
 * retainer payment likely overdue) and returns a ranked list with Hebrew
 * reasons. Powers the "לקוחות בסיכון" card in the AI CEO.
 */

import { getSupabase } from '@/lib/db/store';
import { employeeTasks, clientGanttItems } from '@/lib/db';
import { googleAdsReports } from '@/lib/google-ads/db';

export interface ClientRisk {
  clientId: string;
  clientName: string;
  score: number;          // 0-100 (higher = more at risk)
  level: 'high' | 'medium' | 'low';
  reasons: string[];
}

const daysAgo = (n: number) => Date.now() - n * 86400000;

export async function buildClientRisk(): Promise<ClientRisk[]> {
  // Active clients
  let clients: any[] = [];
  try {
    const sb = getSupabase();
    const { data } = await sb.from('clients').select('id, name, status, retainer_amount, retainer_day').eq('status', 'active');
    clients = data || [];
  } catch { return []; }
  if (!clients.length) return [];

  let tasks: any[] = []; let gantt: any[] = []; let reports: any[] = [];
  try { tasks = (await employeeTasks.getAllAsync()) as any[]; } catch { /* ok */ }
  try { gantt = (await clientGanttItems.getAllAsync()) as any[]; } catch { /* ok */ }
  try { reports = (await googleAdsReports.getAllAsync()) as any[]; } catch { /* ok */ }

  const today = new Date(); const dom = today.getDate();
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);

  const out: ClientRisk[] = [];
  for (const c of clients) {
    const reasons: string[] = [];
    let score = 0;

    const cTasks = tasks.filter((t) => t.clientId === c.id);
    const overdue = cTasks.filter((t) => t.status !== 'missed' && !['completed', 'approved'].includes(t.status) && t.dueDate && new Date(t.dueDate).getTime() < startToday.getTime()).length;
    const missed = cTasks.filter((t) => t.status === 'missed').length;
    if (overdue) { score += Math.min(30, overdue * 8); reasons.push(`${overdue} משימות באיחור`); }
    if (missed) { score += Math.min(24, missed * 6); reasons.push(`${missed} משימות לא בוצעו`); }

    // Content activity recency (gantt)
    const cGantt = gantt.filter((g) => g.clientId === c.id);
    const lastGantt = cGantt.reduce((m, g) => Math.max(m, new Date(g.updatedAt || g.createdAt || 0).getTime()), 0);
    if (cGantt.length && lastGantt && lastGantt < daysAgo(14)) {
      score += 20; reasons.push(`אין פעילות תוכן ${Math.round((Date.now() - lastGantt) / 86400000)} ימים`);
    }

    // Report recency
    const cReports = reports.filter((r) => r.clientId === c.id);
    const lastReport = cReports.reduce((m, r) => Math.max(m, new Date(r.createdAt || 0).getTime()), 0);
    if (!lastReport || lastReport < daysAgo(45)) { score += 10; reasons.push('לא קיבל דוח ב-45 ימים האחרונים'); }

    // Retainer payment likely overdue (collection day passed, no recent payment signal)
    const rDay = Number(c.retainer_day) || 0;
    if (Number(c.retainer_amount) > 0 && rDay > 0 && dom > rDay + 3) {
      score += 15; reasons.push(`תשלום ריטיינר (יום ${rDay}) ככל הנראה טרם הוסדר`);
    }

    if (score > 0) {
      out.push({
        clientId: c.id, clientName: c.name || 'לקוח',
        score: Math.min(100, Math.round(score)),
        level: score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low',
        reasons,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
}
