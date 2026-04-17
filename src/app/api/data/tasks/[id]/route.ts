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

const TABLE = 'tasks';

type Row = Record<string, unknown> & { id: string };

function rowToTask(r: Row) {
  return {
    id: r.id,
    title: (r.title as string) ?? '',
    assigneeId: (r.assignee_id as string) ?? null,
    employeeId: (r.assignee_id as string) ?? null,                // legacy alias
    assignedEmployeeId: (r.assignee_id as string) ?? null,        // legacy alias
    projectId: (r.project_id as string) ?? null,                  // FK → public.projects
    businessProjectId: (r.business_project_id as string) ?? null, // FK → public.business_projects
    milestoneId: (r.milestone_id as string) ?? null,
    status: (r.status as string) ?? 'pending',
    description: (r.description as string) ?? '',
    dueDate: (r.due_date as string) ?? null,
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
    ['dueDate', 'due_date', true],
    ['assigneeId', 'assignee_id', true],
    ['employeeId', 'assignee_id', true],
    ['assignedEmployeeId', 'assignee_id', true],
    ['projectId', 'project_id', true],                  // FK → public.projects
    ['businessProjectId', 'business_project_id', true],  // FK → public.business_projects
    ['milestoneId', 'milestone_id', true],
  ];
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
    const updateRow = toUpdate(body);
    const { data, error } = await sb.from(TABLE).update(updateRow).eq('id', id).select('*').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'Not found', taskId: id }, { status: 404 });
    return NextResponse.json(rowToTask(data as Row));
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
