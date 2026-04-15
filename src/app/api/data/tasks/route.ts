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
  const employee = (r.employee_id as string) || (r.assigned_employee_id as string) || (r.assignee_id as string) || null;
  const project = (r.business_project_id as string) || (r.project_id as string) || null;
  const milestone = (r.milestone_id as string) || (r.business_project_milestone_id as string) || null;
  const title = (r.title as string) || (r.name as string) || '';
  return {
    id: r.id,
    title,
    employeeId: employee,
    assignedEmployeeId: employee,
    businessProjectId: project,
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
  const employee = nullIfEmpty(body.employeeId ?? body.assignedEmployeeId ?? body.assigneeId);
  const project = nullIfEmpty(body.businessProjectId ?? body.projectId);
  const milestone = nullIfEmpty(body.milestoneId);
  const status = (body.status ?? 'pending') as string;

  // Write under every common snake_case alias. The drop-unknown-column loop
  // in POST will remove whichever aliases don't exist in the real schema,
  // leaving the canonical column populated. This is what prevents the fields
  // from coming back NULL when the DB uses e.g. assigned_employee_id.
  return {
    id,
    title,
    name: title, // some schemas use "name" instead of "title"
    employee_id: employee,
    assigned_employee_id: employee,
    assignee_id: employee,
    business_project_id: project,
    project_id: project,
    milestone_id: milestone,
    business_project_milestone_id: milestone,
    status,
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
    // Try whichever column name the real schema uses.
    const milestoneId = nullIfEmpty(body.milestoneId);
    if (milestoneId) {
      for (const col of ['milestone_id', 'business_project_milestone_id']) {
        const { data: existing, error: existErr } = await sb
          .from(TABLE)
          .select('*')
          .eq(col, milestoneId)
          .maybeSingle();
        if (existErr) {
          // Column doesn't exist — try the next alias.
          continue;
        }
        if (existing) {
          console.log(`[API] POST /api/data/tasks dedup: existing task for ${col}=${milestoneId}`);
          return NextResponse.json({ ...rowToTask(existing as Row), _deduped: true }, { status: 200 });
        }
        break; // column exists, no row — proceed to insert
      }
    }

    const now = new Date().toISOString();
    const id = generateId();
    let insertRow = toInsert(body, id, now);
    console.log(`[API] POST /api/data/tasks inserting cols=${Object.keys(insertRow).join(',')} milestoneId=${milestoneId ?? 'null'} employee=${insertRow.employee_id ?? 'null'} project=${insertRow.business_project_id ?? 'null'}`);

    let inserted: Row | null = null;
    let lastErr: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 15; attempt++) {
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

    const mapped = rowToTask(inserted);
    console.log(
      `[API] POST /api/data/tasks ✅ persisted id=${mapped.id} title="${mapped.title}" employee_id=${mapped.employeeId ?? 'null'} business_project_id=${mapped.businessProjectId ?? 'null'} milestone_id=${mapped.milestoneId ?? 'null'} status=${mapped.status}`
    );
    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/tasks fatal:', msg);
    return NextResponse.json({ error: `Failed to create task: ${msg}` }, { status: 500 });
  }
}
