/**
 * GET  /api/data/tasks — list all tasks (filter via ?milestone_id= or ?business_project_id=)
 * POST /api/data/tasks — create a task
 *
 * Storage: Supabase "tasks" table with flat columns:
 *   id, title, employee_id, business_project_id, milestone_id,
 *   status, created_at, updated_at
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'tasks';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `tsk_${ts}_${rand}`;
}

function nullIfEmpty(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

type Row = Record<string, unknown> & { id: string };

function rowToTask(r: Row) {
  return {
    id: r.id,
    title: (r.title as string) ?? '',
    employeeId: (r.employee_id as string) ?? null,
    assignedEmployeeId: (r.employee_id as string) ?? null, // alias for existing UI
    businessProjectId: (r.business_project_id as string) ?? null,
    projectId: (r.business_project_id as string) ?? null, // alias
    milestoneId: (r.milestone_id as string) ?? null,
    status: (r.status as string) ?? 'pending',
    description: (r.description as string) ?? '',
    dueDate: (r.due_date as string) ?? null,
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

function toInsert(body: Record<string, unknown>, id: string, now: string): Record<string, unknown> {
  return {
    id,
    title: (body.title ?? '') as string,
    employee_id: nullIfEmpty(body.employeeId ?? body.assignedEmployeeId ?? body.assigneeId),
    business_project_id: nullIfEmpty(body.businessProjectId ?? body.projectId),
    milestone_id: nullIfEmpty(body.milestoneId),
    status: (body.status ?? 'pending') as string,
    description: (body.description ?? '') as string,
    due_date: nullIfEmpty(body.dueDate),
    created_at: now,
    updated_at: now,
  };
}

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase();
    const url = new URL(req.url);
    const milestoneId = url.searchParams.get('milestone_id') || url.searchParams.get('milestoneId');
    const projectId = url.searchParams.get('business_project_id') || url.searchParams.get('projectId');

    let q = sb.from(TABLE).select('*').order('id');
    if (milestoneId) q = q.eq('milestone_id', milestoneId);
    if (projectId) q = q.eq('business_project_id', projectId);

    const { data: rows, error } = await q;
    if (error) {
      console.error('[API] GET /api/data/tasks supabase error:', error);
      return NextResponse.json({ error: error.message, code: (error as any).code ?? null }, { status: 500 });
    }
    return NextResponse.json((rows ?? []).map((r) => rowToTask(r as Row)));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch tasks: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    // Dedup: if this call carries milestoneId AND a task already exists for
    // that milestone, return the existing one instead of creating a duplicate.
    const milestoneId = nullIfEmpty(body.milestoneId);
    if (milestoneId) {
      const { data: existing } = await sb.from(TABLE).select('*').eq('milestone_id', milestoneId).maybeSingle();
      if (existing) {
        console.log(`[API] POST /api/data/tasks dedup: task already exists for milestone=${milestoneId}`);
        return NextResponse.json({ ...rowToTask(existing as Row), _deduped: true }, { status: 200 });
      }
    }

    const now = new Date().toISOString();
    const id = generateId();
    let insertRow = toInsert(body, id, now);

    let inserted: Row | null = null;
    let lastErr: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const { data, error } = await sb.from(TABLE).insert(insertRow).select('*').single();
      if (!error) { inserted = data as Row; break; }
      lastErr = error as any;
      const m = error.message.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
      const bad = m?.[1] || m?.[2];
      if (!bad || !(bad in insertRow)) break;
      console.warn(`[API] POST /api/data/tasks dropping unknown column "${bad}"`);
      const { [bad]: _d, ...rest } = insertRow;
      void _d;
      insertRow = rest;
    }

    if (!inserted) {
      console.error('[API] POST /api/data/tasks insert error:', lastErr);
      return NextResponse.json({ error: lastErr?.message ?? 'Insert failed', code: (lastErr as any)?.code ?? null }, { status: 500 });
    }

    return NextResponse.json(rowToTask(inserted), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/tasks fatal:', msg);
    return NextResponse.json({ error: `Failed to create task: ${msg}` }, { status: 500 });
  }
}
