/**
 * Stale-overdue rule (shared across employee + manager + client task views).
 * A task is "stale" when it's still open and its due date passed by more than
 * `hours` (default 48h). Stale tasks are HIDDEN from active task lists/boards
 * (not deleted — they remain in the DB).
 */
export function isStaleOverdue(task: any, hours = 48): boolean {
  if (!task || !task.dueDate) return false;
  const status = task.status;
  const done = status === "completed" || status === "approved";
  if (done) return false;
  const due = new Date(task.dueDate).getTime();
  if (isNaN(due)) return false;
  return Date.now() - due > hours * 3600 * 1000;
}

/** Convenience: keep only non-stale tasks. */
export function hideStale<T>(tasks: T[], hours = 48): T[] {
  return (tasks || []).filter((t) => !isStaleOverdue(t, hours));
}
