/**
 * GET    /api/data/project-milestones/[id]
 * PUT    /api/data/project-milestones/[id]
 * DELETE /api/data/project-milestones/[id]
 *
 * Storage: Supabase "business_project_milestones" table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'business_project_milestones';

type Row = Record<string, unknown> & { id: string };

function rowToMilestone(r: Row) {
  const projectId = (r.business_project_id as string) || (r.project_id as string) || '';
  return {
    id: r.id,
    projectId,
    businessProjectId: projectId,
    title: (r.title as string) ?? '',
    description: (r.description as string) ?? '',
    dueDate: (r.due_date as string) ?? null,
    assignedEmployeeId: (r.assigned_employee_id as string) ?? null,
    status: (r.status as string) ?? 'pending',
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    files: Array.isArray(r.files) ? r.files : [],
    notes: (r.notes as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

function toUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // Keep business_project_id in sync if caller supplies either alias.
  const pid = body.businessProjectId !== undefined ? body.businessProjectId : body.projectId;
  if (pid !== undefined) {
    out.business_project_id = pid;
    out.project_id = pid;
  }
  const map: Array<[string, string]> = [
    ['title', 'title'],
    ['description', 'description'],
    ['dueDate', 'due_date'],
    ['assignedEmployeeId', 'assigned_employee_id'],
    ['status', 'status'],
    ['sortOrder', 'sort_order'],
    ['files', 'files'],
    ['notes', 'notes'],
  ];
  for (const [k, dbKey] of map) if (body[k] !== undefined) out[dbKey] = body[k];
  out.updated_at = new Date().toISOString();
  return out;
}

const SELECT_COLUMNS =
  'id, project_id, title, description, due_date, assigned_employee_id, status, files, notes, created_at, updated_at';

function parseBadColumn(msg: string): string | null {
  const m = msg.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
  return m?.[1] || m?.[2] || null;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found', milestoneId: id }, { status: 404 });
    return NextResponse.json(rowToMilestone(data as Row));
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
    let updateRow = toUpdate(body);
    let selectList = SELECT_COLUMNS;

    let updated: Row | null = null;
    let lastErr: { message: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data, error } = await sb.from(TABLE).update(updateRow).eq('id', id).select('*').maybeSingle();
      if (!error) { updated = (data as Row) ?? null; break; }
      lastErr = error as any;
      const bad = parseBadColumn(error.message);
      if (!bad) break;
      if (bad in updateRow) { const { [bad]: _d, ...rest } = updateRow; void _d; updateRow = rest; }
      else if (selectList.includes(bad)) selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
      else break;
    }

    if (lastErr && !updated) return NextResponse.json({ error: lastErr.message }, { status: 400 });
    if (!updated) return NextResponse.json({ error: 'Not found', milestoneId: id }, { status: 404 });
    return NextResponse.json(rowToMilestone(updated));
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
