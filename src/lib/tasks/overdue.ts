/**
 * Overdue gantt sweep
 * --------------------
 * Monthly gantt items whose publish date passed by more than 2 days WITHOUT
 * being completed are moved to the "missed" (לא בוצע) status, and their linked
 * employee tasks are moved to "missed" too — so they drop out of the employee's
 * to-do list instead of lingering there forever.
 *
 * Cheap to call: if nothing is overdue it does zero writes. It's invoked lazily
 * from the employee-tasks and gantt-items list endpoints so the state is always
 * current without depending on a cron.
 */

import { clientGanttItems, employeeTasks } from '@/lib/db';
import type { ClientGanttItem, EmployeeTask } from '@/lib/db/schema';

export const OVERDUE_DAYS = 2;

// Gantt statuses that are already resolved — never auto-mark these as missed.
const SAFE_GANTT = new Set([
  'approved', 'scheduled', 'published', 'cancelled', 'missed', 'submitted_for_approval',
]);
// Employee-task statuses that mean work is effectively done/in-review — leave alone.
const SAFE_TASK = new Set(['completed', 'approved', 'under_review']);

let lastRun = 0;
const MIN_INTERVAL_MS = 60 * 1000; // throttle: at most once a minute per server instance

export async function sweepOverdueGantt(force = false): Promise<{ marked: number; tasksMissed: number }> {
  const now = Date.now();
  if (!force && now - lastRun < MIN_INTERVAL_MS) return { marked: 0, tasksMissed: 0 };
  lastRun = now;

  let items: ClientGanttItem[] = [];
  try { items = (await clientGanttItems.getAllAsync()) as ClientGanttItem[]; } catch { return { marked: 0, tasksMissed: 0 }; }

  const cutoffMs = OVERDUE_DAYS * 86400000;
  const overdue = items.filter((it) => {
    if (!it?.date || it.ganttType !== 'monthly') return false;
    if (SAFE_GANTT.has(it.status)) return false;
    const dayEnd = new Date(`${(it.date || '').slice(0, 10)}T23:59:59`).getTime();
    if (Number.isNaN(dayEnd)) return false;
    return now - dayEnd > cutoffMs;
  });
  if (overdue.length === 0) return { marked: 0, tasksMissed: 0 };

  let tasks: EmployeeTask[] = [];
  try { tasks = (await employeeTasks.getAllAsync()) as EmployeeTask[]; } catch { /* ok */ }

  const iso = new Date().toISOString();
  let marked = 0;
  let tasksMissed = 0;
  for (const it of overdue) {
    try {
      await clientGanttItems.updateAsync(it.id, { status: 'missed', updatedAt: iso } as Partial<ClientGanttItem>);
      marked++;
      const linked = tasks.filter((t) => t.ganttItemId === it.id && !SAFE_TASK.has(t.status));
      for (const t of linked) {
        await employeeTasks.updateAsync(t.id, { status: 'missed', updatedAt: iso } as Partial<EmployeeTask>);
        tasksMissed++;
      }
    } catch (e) {
      console.warn('[overdue-sweep] failed for gantt', it.id, e instanceof Error ? e.message : e);
    }
  }
  if (marked) console.log(`[overdue-sweep] marked ${marked} gantt items + ${tasksMissed} employee tasks as missed`);
  return { marked, tasksMissed };
}
