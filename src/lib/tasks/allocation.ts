/**
 * Smart task allocation — suggests the best-fit employee for a task by balancing
 * current workload against skill match, availability and the client they already
 * own. Pure & explainable; the manager always confirms. No side effects.
 */

interface EmpLike {
  id: string; name: string; skills?: string[]; workload?: number; tasksCount?: number;
  status?: 'online' | 'busy' | 'offline'; role?: string;
}
interface TaskLike {
  title?: string; description?: string; tags?: string[]; clientId?: string | null;
  contentType?: string; assigneeIds?: string[];
}

export interface AllocationSuggestion {
  employeeId: string; name: string; score: number; reasons: string[]; openTasks: number;
}

const norm = (s: string) => s.toLowerCase().trim();

/**
 * @param task          the task to assign
 * @param employees     candidate employees (with skills/status)
 * @param openTasksByEmp map of employeeId → number of open tasks they currently hold
 * @param clientOwnerId  (optional) employee who normally handles this client
 */
export function suggestAssignees(
  task: TaskLike,
  employees: EmpLike[],
  openTasksByEmp: Record<string, number> = {},
  clientOwnerId?: string | null,
): AllocationSuggestion[] {
  const text = norm(`${task.title || ''} ${task.description || ''} ${(task.tags || []).join(' ')} ${task.contentType || ''}`);
  const maxOpen = Math.max(1, ...employees.map((e) => openTasksByEmp[e.id] ?? e.tasksCount ?? 0));

  const out: AllocationSuggestion[] = employees.map((e) => {
    const reasons: string[] = [];
    let score = 50;

    // 1) Workload balance — lighter load scores higher (up to +30).
    const open = openTasksByEmp[e.id] ?? e.tasksCount ?? 0;
    const loadPts = Math.round((1 - open / maxOpen) * 30);
    score += loadPts;
    if (open <= maxOpen * 0.3) reasons.push('עומס נמוך — פנוי לקבל משימה');
    else if (open >= maxOpen * 0.9) reasons.push('עמוס כרגע');

    // 2) Skill match against the task text (+8 each, up to +24).
    const skills = (e.skills || []).map(norm).filter(Boolean);
    const matched = skills.filter((sk) => sk && text.includes(sk));
    if (matched.length) { score += Math.min(24, matched.length * 8); reasons.push(`התאמת מיומנויות: ${matched.slice(0, 3).join(', ')}`); }

    // 3) Availability.
    if (e.status === 'online') { score += 8; reasons.push('זמין (online)'); }
    else if (e.status === 'offline') { score -= 6; }

    // 4) Already owns this client / already on the task.
    if (clientOwnerId && e.id === clientOwnerId) { score += 12; reasons.push('כבר מטפל בלקוח הזה'); }
    if ((task.assigneeIds || []).includes(e.id)) { score += 6; reasons.push('כבר משויך למשימה'); }

    return { employeeId: e.id, name: e.name, score: Math.max(0, Math.min(100, Math.round(score))), reasons: reasons.slice(0, 4), openTasks: open };
  });

  return out.sort((a, b) => b.score - a.score);
}

/** Build the openTasks map from a flat task list. */
export function buildOpenTaskMap(tasks: { assigneeIds?: string[]; assigneeId?: string | null; status?: string }[]): Record<string, number> {
  const map: Record<string, number> = {};
  const openStatuses = new Set(['new', 'in_progress', 'returned', 'under_review']);
  for (const t of tasks) {
    if (t.status && !openStatuses.has(t.status)) continue;
    const ids = Array.isArray(t.assigneeIds) && t.assigneeIds.length ? t.assigneeIds : (t.assigneeId ? [t.assigneeId] : []);
    for (const id of ids) map[id] = (map[id] || 0) + 1;
  }
  return map;
}
