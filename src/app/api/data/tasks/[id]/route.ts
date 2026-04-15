/**
 * GET    /api/data/tasks/[id]
 * PUT    /api/data/tasks/[id]
 * DELETE /api/data/tasks/[id]
 *
 * Supabase "tasks" table (flat columns).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'tasks';

type Row = Record<string, unknown> & { id: string };

function rowToTask(r: Row) {
  return {
    id: r.id,
    title: (r.title as string) ?? '',
    employeeId: (r.employee_id as string) ?? null,
    assignedEmployeeId: (r.employee_id as string) ?? null,
    businessProjectId: (r.business_project_id as string) ?? null,
    projectId: (r.business_project_id as string) ?? null,
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
    ['employeeId', 'employee_id', true],
    ['assignedEmployeeId', 'employee_id', true],
    ['assigneeId', 'employee_id', true],
    ['businessProjectId', 'business_project_id', true],
    ['projectId', 'business_project_id', true],
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
  try {
    const { id } = await context.params;
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

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
