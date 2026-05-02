/**
 * GET    /api/data/tasks/[id]
 * PUT    /api/data/tasks/[id]
 * DELETE /api/data/tasks/[id]
 *
 * Supabase "tasks" table (flat columns).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole, getRequestRole, getRequestEmployeeId } from '@/lib/auth/api-guard';
import { ensureTaskColumns, filterByPresent } from '@/lib/db/ensure-task-columns';
import { employeeTasks, clientGanttItems } from '@/lib/db';
import type { EmployeeTask } from '@/lib/db/schema';

const TABLE = 'tasks';

type Row = Record<string, unknown> & { id: string };

function rowToTask(r: Row) {
  const assignee = (r.assignee_id as string) || null;
  return {
    id: r.id,
    title: (r.title as string) ?? '',
    assigneeId: assignee,
    employeeId: assignee,                                          // legacy alias
    assignedEmployeeId: assignee,                                  // legacy alias
    assigneeIds: assignee ? [assignee] : [],                       // array form for frontend
    projectId: (r.project_id as string) ?? null,                   // FK → public.projects
    businessProjectId: (r.business_project_id as string) ?? null,  // FK → public.business_projects
    clientId: (r.client_id as string) ?? null,
    clientName: (r.client_name as string) ?? '',
    milestoneId: (r.milestone_id as string) ?? null,
    status: (r.status as string) ?? 'pending',
    description: (r.description as string) ?? '',
    priority: (r.priority as string) ?? 'medium',
    dueDate: (r.due_date as string) ?? null,
    ganttItemId: (r.gantt_item_id as string) ?? null,
    tags: [] as string[],
    files: [] as string[],
    notes: (r.notes as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

function nullIfEmpty(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function toUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const map: Array<[string, string, boolean]> = [
    ['title', 'title', false],
    ['status', 'status', false],
    ['description', 'description', false],
    ['notes', 'notes', false],
    ['priority', 'priority', false],
    ['dueDate', 'due_date', true],
    ['clientId', 'client_id', true],
    ['clientName', 'client_name', false],
    ['assigneeId', 'assignee_id', true],
    ['employeeId', 'assignee_id', true],
    ['assignedEmployeeId', 'assignee_id', true],
    ['projectId', 'project_id', true],                  // FK → public.projects
    ['businessProjectId', 'business_project_id', true],  // FK → public.business_projects
    ['milestoneId', 'milestone_id', true],
    ['ganttItemId', 'gantt_item_id', true],
  ];
  // Support assigneeIds array → assignee_id (first entry)
  if (Array.isArray(body.assigneeIds) && body.assigneeIds.length > 0 && body.assigneeId === undefined) {
    out.assignee_id = nullIfEmpty(body.assigneeIds[0]);
  }
  for (const [k, dbKey, nullable] of map) {
    if (body[k] !== undefined) {
      out[dbKey] = nullable ? nullIfEmpty(body[k]) : body[k];
    }
  }
  out.updated_at = new Date().toISOString();
  return out;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureTaskColumns();
    const { id } = await context.params;
    const sb = getSupabase();
    const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found', taskId: id }, { status: 404 });
    return NextResponse.json(rowToTask(data as Row));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch: ${msg}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Client cannot edit tasks
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

  try {
    const presentCols = await ensureTaskColumns();
    const { id } = await context.params;
    const role = getRequestRole(req);

    // Employee can only update tasks assigned to them
    if (role === 'employee') {
      const empId = getRequestEmployeeId(req);
      const sb2 = getSupabase();
      const { data: existing } = await sb2.from(TABLE).select('assignee_id').eq('id', id).maybeSingle();
      if (existing && (existing as any).assignee_id !== empId) {
        return NextResponse.json({ error: 'אין הרשאה לערוך משימה של עובד אחר' }, { status: 403 });
      }
    }

    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const sb = getSupabase();
    const rawUpdate = toUpdate(body);
    // Filter out columns that don't exist yet (migration may have failed)
    const updateRow = filterByPresent(rawUpdate, presentCols);
    const { data, error } = await sb.from(TABLE).update(updateRow).eq('id', id).select('*').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'Not found', taskId: id }, { status: 404 });

    const result = rowToTask(data as Row);

    // ── Cross-sync: approved/completed → gantt item + employee task ──
    const newStatus = result.status;
    if (newStatus === 'approved' || newStatus === 'completed') {
      try {
        const ganttItemId = result.ganttItemId;
        const ganttStatus = newStatus === 'completed' ? 'published' : 'approved';

        // 1. Direct gantt sync if global task has gantt_item_id
        if (ganttItemId) {
          const ganttUpdate: Record<string, unknown> = { status: ganttStatus };
          if (body.files && Array.isArray(body.files) && body.files.length > 0) {
            ganttUpdate.attachedFiles = body.files;
          }
          if (result.description) {
            ganttUpdate.approvedContent = result.description;
          }
          await clientGanttItems.updateAsync(ganttItemId, ganttUpdate);
          console.log(`[Global→Gantt Sync] Gantt item ${ganttItemId} → ${ganttStatus}`);
        }

        // 2. Sync to matching employee task (by ganttItemId or title+client)
        const allEmpTasks = await employeeTasks.getAllAsync() as EmployeeTask[];
        const match = ganttItemId
          ? allEmpTasks.find(et => et.ganttItemId === ganttItemId)
          : allEmpTasks.find(et => et.title === result.title && et.clientId === result.clientId);
        if (match) {
          const empUpdate: Record<string, unknown> = { status: newStatus };
          if (body.files) empUpdate.files = body.files;
          await employeeTasks.updateAsync(match.id, empUpdate);
          console.log(`[Global→EmpTask Sync] Employee task ${match.id} → ${newStatus}`);

          // If global task had no ganttItemId but employee task does, sync gantt too
          if (!ganttItemId && match.ganttItemId) {
            const ganttUpdate: Record<string, unknown> = { status: ganttStatus };
            if (result.description) ganttUpdate.approvedContent = result.description;
            await clientGanttItems.updateAsync(match.ganttItemId, ganttUpdate);
            console.log(`[Global→Gantt Sync] via empTask: Gantt ${match.ganttItemId} → ${ganttStatus}`);
          }
        }
      } catch (syncErr) {
        console.warn('[Global→Gantt Sync] Non-critical sync error:', syncErr);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to update: ${msg}` }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Only admin can delete tasks
  const delErr = requireRole(req, 'admin');
  if (delErr) return delErr;
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { error } = await sb.from(TABLE).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to delete: ${msg}` }, { status: 500 });
  }
}
