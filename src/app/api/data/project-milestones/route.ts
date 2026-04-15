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

type Row = {
  id: string;
  project_id?: string | null;
  title?: string | null;
  description?: string | null;
  due_date?: string | null;
  assigned_employee_id?: string | null;
  status?: string | null;
  files?: unknown;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function rowToMilestone(r: Row) {
  return {
    id: r.id,
    projectId: r.project_id ?? '',
    title: r.title ?? '',
    description: r.description ?? '',
    dueDate: r.due_date ?? null,
    assignedEmployeeId: r.assigned_employee_id ?? null,
    status: r.status ?? 'pending',
    files: Array.isArray(r.files) ? r.files : [],
    notes: r.notes ?? '',
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

function toInsert(body: Record<string, unknown>, id: string, now: string): Record<string, unknown> {
  return {
    id,
    project_id: (body.projectId ?? null) as string | null,
    title: (body.title ?? '') as string,
    description: (body.description ?? '') as string,
    due_date: (body.dueDate ?? null) as string | null,
    assigned_employee_id: (body.assignedEmployeeId ?? null) as string | null,
    status: (body.status ?? 'pending') as string,
    files: Array.isArray(body.files) ? body.files : [],
    notes: (body.notes ?? '') as string,
    created_at: now,
    updated_at: now,
  };
}

const SELECT_COLUMNS =
  'id, project_id, title, description, due_date, assigned_employee_id, status, files, notes, created_at, updated_at';

function parseBadColumn(msg: string): string | null {
  const m = msg.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
  return m?.[1] || m?.[2] || null;
}

export async function GET() {
  try {
    const sb = getSupabase();
    let selectList = SELECT_COLUMNS;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: rows, error } = await sb.from(TABLE).select(selectList).order('id');
      if (!error) return NextResponse.json((rows ?? []).map((r) => rowToMilestone(r as Row)));
      const bad = parseBadColumn(error.message);
      if (!bad) return NextResponse.json({ error: error.message }, { status: 500 });
      selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
    }
    return NextResponse.json({ error: 'Failed to build valid select list' }, { status: 500 });
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
