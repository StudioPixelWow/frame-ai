/**
 * GET  /api/data/project-milestones — list all milestones
 * POST /api/data/project-milestones — create a milestone for a business project
 *
 * Storage: Supabase "business_project_milestones" table.
 * Expected columns:
 *   id, project_id, title, description, due_date,
 *   assigned_employee_id, status, files (jsonb), notes,
 *   created_at, updated_at
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'business_project_milestones';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `mil_${ts}_${rand}`;
}

// Row shape is intentionally open — the real column is business_project_id;
// we fall back to project_id for any legacy rows.
type Row = Record<string, unknown> & { id: string };

function rowToMilestone(r: Row) {
  const projectId = (r.business_project_id as string) || (r.project_id as string) || '';
  const assigneeId = (r.assignee_id as string) || (r.assigned_employee_id as string) || null;
  return {
    id: r.id,
    projectId,
    businessProjectId: projectId,
    title: (r.title as string) ?? '',
    description: (r.description as string) ?? '',
    dueDate: (r.due_date as string) ?? null,
    assigneeId,
    assignedEmployeeId: assigneeId,
    status: (r.status as string) ?? 'pending',
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    startedAt: (r.started_at as string) ?? null,
    submittedAt: (r.submitted_at as string) ?? null,
    completedAt: (r.completed_at as string) ?? null,
    files: Array.isArray(r.files) ? r.files : [],
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

function toInsert(body: Record<string, unknown>, id: string, now: string): Record<string, unknown> {
  const projectId = (body.businessProjectId ?? body.projectId ?? null) as string | null;
  const assigneeId = nullIfEmpty(body.assigneeId ?? body.assignedEmployeeId);
  return {
    id,
    // Write to both column aliases; drop-column loop removes whichever doesn't exist.
    business_project_id: projectId,
    project_id: projectId,
    title: (body.title ?? '') as string,
    description: (body.description ?? '') as string,
    due_date: (body.dueDate ?? null) as string | null,
    assignee_id: assigneeId,
    assigned_employee_id: assigneeId,
    status: (body.status ?? 'pending') as string,
    sort_order: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
    started_at: (body.startedAt ?? null) as string | null,
    submitted_at: (body.submittedAt ?? null) as string | null,
    completed_at: (body.completedAt ?? null) as string | null,
    files: Array.isArray(body.files) ? body.files : [],
    notes: (body.notes ?? '') as string,
    created_at: now,
    updated_at: now,
  };
}

function parseBadColumn(msg: string): string | null {
  const m = msg.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
  return m?.[1] || m?.[2] || null;
}

export async function GET() {
  try {
    const sb = getSupabase();
    // select('*') so we get whatever the real schema uses (business_project_id,
    // sort_order, etc.) without enumerating columns.
    const { data: rows, error } = await sb.from(TABLE).select('*').order('id');
    if (error) {
      console.error('[API] GET /api/data/project-milestones supabase error:', error);
      return NextResponse.json({ error: error.message, code: (error as any).code ?? null }, { status: 500 });
    }
    return NextResponse.json((rows ?? []).map((r) => rowToMilestone(r as Row)));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch milestones: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const now = new Date().toISOString();
    const id = generateId();
    let insertRow = toInsert(body, id, now);
    let selectList = SELECT_COLUMNS;

    let inserted: Row | null = null;
    let lastErr: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const { data, error } = await sb.from(TABLE).insert(insertRow).select(selectList).single();
      if (!error) { inserted = data as Row; break; }
      lastErr = error as any;
      const bad = parseBadColumn(error.message);
      if (!bad) break;
      if (bad in insertRow) {
        const { [bad]: _d, ...rest } = insertRow; void _d;
        insertRow = rest;
      } else if (selectList.includes(bad)) {
        selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
      } else break;
    }

    if (!inserted) {
      console.error('[API] POST /api/data/project-milestones insert error:', lastErr);
      return NextResponse.json({ error: lastErr?.message ?? 'Insert failed' }, { status: 500 });
    }
    return NextResponse.json(rowToMilestone(inserted), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to create milestone: ${msg}` }, { status: 500 });
  }
}
