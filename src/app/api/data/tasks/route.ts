/**
 * GET  /api/data/tasks — list all tasks (filter via ?milestone_id= or ?project_id=)
 * POST /api/data/tasks — create a task
 *
 * Storage: Supabase "tasks" table with flat columns:
 *   id, title, assignee_id, project_id, milestone_id,
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
  const assignee = (r.assignee_id as string) || null;
  const project = (r.project_id as string) || null;
  const milestone = (r.milestone_id as string) || null;
  const title = (r.title as string) || '';
  return {
    id: r.id,
    title,
    assigneeId: assignee,
    employeeId: assignee,           // legacy alias for frontend compat
    assignedEmployeeId: assignee,   // legacy alias for frontend compat
    businessProjectId: project,     // legacy alias for frontend compat
    projectId: project,
    milestoneId: milestone,
    status: (r.status as string) ?? 'pending',
    description: (r.description as string) ?? '',
    dueDate: (r.due_date as string) ?? null,
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

function toInsert(body: Record<string, unknown>, id: string, now: string): Record<string, unknown> {
  const title = (body.title ?? '') as string;
  const assignee = nullIfEmpty(body.assigneeId ?? body.employeeId ?? body.assignedEmployeeId);
  const project = nullIfEmpty(body.businessProjectId ?? body.projectId);
  const milestone = nullIfEmpty(body.milestoneId);
  const status = (body.status ?? 'pending') as string;

  // Use ONLY the actual columns in public.tasks.
  return {
    id,
    title,
    assignee_id: assignee,
    project_id: project,
    milestone_id: milestone,
    status,
    created_at: now,
    updated_at: now,
  };
}

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase();
    const url = new URL(req.url);
    const milestoneId = url.searchParams.get('milestone_id') || url.searchParams.get('milestoneId');
    const projectId = url.searchParams.get('project_id') || url.searchParams.get('business_project_id') || url.searchParams.get('projectId');

    let q = sb.from(TABLE).select('*').order('id');
    if (milestoneId) q = q.eq('milestone_id', milestoneId);
    if (projectId) q = q.eq('project_id', projectId);

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
      const { data: existing, error: existErr } = await sb
        .from(TABLE)
        .select('*')
        .eq('milestone_id', milestoneId)
        .maybeSingle();
      if (!existErr && existing) {
        console.log(`[API] POST /api/data/tasks dedup: existing task for milestone_id=${milestoneId}`);
        return NextResponse.json({ ...rowToTask(existing as Row), _deduped: true }, { status: 200 });
      }
    }

    const now = new Date().toISOString();
    const id = generateId();
    const insertRow = toInsert(body, id, now);
    console.log(`[API] POST /api/data/tasks inserting cols=${Object.keys(insertRow).join(',')} milestoneId=${milestoneId ?? 'null'} assignee=${insertRow.assignee_id ?? 'null'} project=${insertRow.project_id ?? 'null'}`);

    const { data: inserted, error } = await sb.from(TABLE).insert(insertRow).select('*').single();
    if (error) {
      console.error(`[API] POST /api/data/tasks insert error: ${error.message} (code=${(error as any)?.code ?? 'none'}) details=${JSON.stringify((error as any)?.details ?? null)}`);
      return NextResponse.json({ error: error.message, code: (error as any)?.code ?? null }, { status: 500 });
    }
    if (!inserted) {
      console.error('[API] POST /api/data/tasks insert returned no data');
      return NextResponse.json({ error: 'Insert returned no data' }, { status: 500 });
    }

    const mapped = rowToTask(inserted as Row);
    console.log(
      `[API] POST /api/data/tasks ✅ persisted id=${mapped.id} title="${mapped.title}" assignee_id=${mapped.assigneeId ?? 'null'} project_id=${mapped.projectId ?? 'null'} milestone_id=${mapped.milestoneId ?? 'null'} status=${mapped.status}`
    );
    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/tasks fatal:', msg);
    return NextResponse.json({ error: `Failed to create task: ${msg}` }, { status: 500 });
  }
}
