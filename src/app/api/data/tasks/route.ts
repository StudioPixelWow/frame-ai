/**
 * GET  /api/data/tasks — list all tasks (filter via ?milestone_id= or ?project_id=)
 * POST /api/data/tasks — create a task
 *
 * Storage: Supabase "tasks" table with flat columns:
 *   id, title, assignee_id, project_id, business_project_id, milestone_id,
 *   status, created_at, updated_at
 *
 * project_id      → FK to public.projects (general projects)
 * business_project_id → FK to public.business_projects (milestone tasks)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole, getRequestRole, getRequestEmployeeId, getRequestClientId } from '@/lib/auth/api-guard';
import { ensureTaskColumns, filterByPresent } from '@/lib/db/ensure-task-columns';

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
  const businessProject = (r.business_project_id as string) || null;
  const client = (r.client_id as string) || null;
  const milestone = (r.milestone_id as string) || null;
  const title = (r.title as string) || '';
  return {
    id: r.id,
    title,
    assigneeId: assignee,
    employeeId: assignee,                      // legacy alias
    assignedEmployeeId: assignee,              // legacy alias
    // Array form for frontend compatibility (Task interface uses assigneeIds: string[])
    assigneeIds: assignee ? [assignee] : [],
    projectId: project,                        // FK → public.projects
    businessProjectId: businessProject,        // FK → public.business_projects
    clientId: client,
    clientName: (r.client_name as string) ?? '',
    milestoneId: milestone,
    status: (r.status as string) ?? 'pending',
    description: (r.description as string) ?? '',
    priority: (r.priority as string) ?? 'medium',
    dueDate: (r.due_date as string) ?? null,
    tags: [] as string[],                      // no DB column yet — return empty
    files: [] as string[],                     // no DB column yet — return empty
    notes: (r.notes as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

function toInsert(body: Record<string, unknown>, id: string, now: string): Record<string, unknown> {
  const title = (body.title ?? '') as string;
  // Support both assigneeId (string) and assigneeIds (array) from frontend
  let assignee = nullIfEmpty(body.assigneeId ?? body.employeeId ?? body.assignedEmployeeId);
  if (!assignee && Array.isArray(body.assigneeIds) && body.assigneeIds.length > 0) {
    assignee = nullIfEmpty(body.assigneeIds[0]);
  }
  // business_project_id and project_id are SEPARATE FK columns.
  // businessProjectId → business_project_id (FK → public.business_projects)
  // projectId         → project_id          (FK → public.projects)
  const businessProject = nullIfEmpty(body.businessProjectId);
  const project = nullIfEmpty(body.projectId);
  const milestone = nullIfEmpty(body.milestoneId);
  const clientId = nullIfEmpty(body.clientId);
  const status = (body.status ?? 'pending') as string;
  const description = (body.description ?? '') as string;
  const priority = nullIfEmpty(body.priority);
  const dueDate = nullIfEmpty(body.dueDate);

  const notes = (body.notes ?? '') as string;
  const clientName = (body.clientName ?? '') as string;

  const row: Record<string, unknown> = {
    id,
    title,
    assignee_id: assignee,
    milestone_id: milestone,
    status,
    description,
    notes,
    created_at: now,
    updated_at: now,
  };
  // Only set nullable FK/text columns when provided — avoids FK violations or unknown column errors
  if (clientId) row.client_id = clientId;
  if (clientName) row.client_name = clientName;
  if (businessProject) row.business_project_id = businessProject;
  if (project) row.project_id = project;
  if (priority) row.priority = priority;
  if (dueDate) row.due_date = dueDate;
  return row;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTaskColumns();
    const sb = getSupabase();
    const role = getRequestRole(req);
    const url = new URL(req.url);
    const milestoneId = url.searchParams.get('milestone_id') || url.searchParams.get('milestoneId');
    const projectId = url.searchParams.get('project_id') || url.searchParams.get('projectId');
    const businessProjectId = url.searchParams.get('business_project_id') || url.searchParams.get('businessProjectId');

    let q = sb.from(TABLE).select('*').order('id');
    if (milestoneId) q = q.eq('milestone_id', milestoneId);
    if (projectId) q = q.eq('project_id', projectId);
    if (businessProjectId) q = q.eq('business_project_id', businessProjectId);

    // Employee: only see tasks assigned to them
    if (role === 'employee') {
      const employeeId = getRequestEmployeeId(req);
      if (employeeId) {
        q = q.eq('assignee_id', employeeId);
      } else {
        return NextResponse.json([]);
      }
    }

    // Client: read-only, only tasks on their projects
    if (role === 'client') {
      const clientId = getRequestClientId(req);
      if (clientId) {
        // Get client's project IDs, then filter tasks
        const { data: projRows } = await sb.from('business_projects').select('id').eq('client_id', clientId);
        const projIds = (projRows ?? []).map((p: any) => p.id as string);
        if (projIds.length > 0) {
          q = q.in('business_project_id', projIds);
        } else {
          return NextResponse.json([]);
        }
      } else {
        return NextResponse.json([]);
      }
    }

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
  // Only admin and employee can create tasks
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

  try {
    const presentCols = await ensureTaskColumns();
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
    const rawRow = toInsert(body, id, now);
    // Filter out columns that don't exist yet (migration may have failed)
    const insertRow = filterByPresent(rawRow, presentCols);
    console.log('Creating task:', JSON.stringify(insertRow));

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
      `[API] POST /api/data/tasks ✅ persisted id=${mapped.id} title="${mapped.title}" assignee_id=${mapped.assigneeId ?? 'null'} project_id=${mapped.projectId ?? 'null'} business_project_id=${mapped.businessProjectId ?? 'null'} milestone_id=${mapped.milestoneId ?? 'null'} status=${mapped.status}`
    );
    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/tasks fatal:', msg);
    return NextResponse.json({ error: `Failed to create task: ${msg}` }, { status: 500 });
  }
}
