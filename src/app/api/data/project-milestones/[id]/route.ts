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
  const assigneeId = (r.assignee_id as string) || null;
  return {
    id: r.id,
    projectId,
    businessProjectId: projectId,
    title: (r.title as string) ?? '',
    description: (r.description as string) ?? '',
    dueDate: (r.due_date as string) ?? null,
    // Expose all common alias names so existing UI code keeps working.
    assigneeId,
    assignedEmployeeId: assigneeId,
    status: (r.status as string) ?? 'pending',
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    startedAt: (r.started_at as string) ?? null,
    submittedAt: (r.submitted_at as string) ?? null,
    approvedAt: (r.approved_at as string) ?? null,
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

function toUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // Business project linkage (canonical column).
  const pid = body.businessProjectId !== undefined ? body.businessProjectId : body.projectId;
  if (pid !== undefined) out.business_project_id = nullIfEmpty(pid);

  // Assignee — canonical column is assignee_id. Do NOT write legacy aliases;
  // that caused drop-column churn and risked silently dropping the value
  // when PostgREST's schema cache was stale.
  const assignee = body.assigneeId !== undefined
    ? body.assigneeId
    : body.assignedEmployeeId;
  if (assignee !== undefined) out.assignee_id = nullIfEmpty(assignee);

  const map: Array<[string, string]> = [
    ['title', 'title'],
    ['description', 'description'],
    ['dueDate', 'due_date'],
    ['status', 'status'],
    ['sortOrder', 'sort_order'],
    ['startedAt', 'started_at'],
    ['submittedAt', 'submitted_at'],
    ['approvedAt', 'approved_at'],
    ['completedAt', 'completed_at'],
    ['files', 'files'],
    ['notes', 'notes'],
  ];
  for (const [k, dbKey] of map) if (body[k] !== undefined) out[dbKey] = body[k];
  out.updated_at = new Date().toISOString();
  return out;
}

/** Columns that must NEVER be silently dropped. If Supabase says one of these
 *  doesn't exist, that's an error worth surfacing, not papering over. */
const PROTECTED_COLUMNS = new Set(['assignee_id', 'business_project_id', 'status']);

const SELECT_COLUMNS =
  'id, project_id, title, description, due_date, assignee_id, status, files, notes, created_at, updated_at';

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

/**
 * Server-side side effect: when a milestone gets a non-null assignee, ensure
 * a task row exists in public.tasks. Dedups by milestone_id. Never throws —
 * logs only, so the PUT itself always completes from the client's perspective.
 *
 * public.tasks columns: id, title, assignee_id, project_id, client_id,
 *                       milestone_id, status, created_at, updated_at
 */
interface EnsureTaskArgs {
  milestoneId: string;
  assigneeId: string | null;
  projectId: string | null;      // maps to tasks.project_id
  title: string;
}

async function ensureTaskForMilestone(
  sb: ReturnType<typeof getSupabase>,
  args: EnsureTaskArgs
): Promise<{ action: 'skipped' | 'updated' | 'created'; taskId?: string; error?: string; missing?: string[] }> {
  const { milestoneId, assigneeId, projectId, title } = args;

  console.log(
    `[ensureTask] called milestoneId=${milestoneId} assigneeId=${assigneeId ?? 'null'} projectId=${projectId ?? 'null'} title="${title}"`
  );

  if (!assigneeId) {
    console.log(`[ensureTask] skip — no assignee on milestone=${milestoneId}`);
    return { action: 'skipped' };
  }

  // Fetch client_id from the parent business project.
  let clientId: string | null = null;
  if (projectId) {
    const { data: proj, error: projErr } = await sb
      .from('business_projects')
      .select('client_id')
      .eq('id', projectId)
      .maybeSingle();
    if (projErr) {
      console.warn('[ensureTask] business_projects lookup failed:', projErr.message);
    } else if (proj) {
      clientId = ((proj as any).client_id as string) || null;
    }
    console.log(`[ensureTask] resolved clientId=${clientId ?? 'null'} from project=${projectId}`);
  }

  // Log any missing required values up-front.
  const missing: string[] = [];
  if (!title) missing.push('title');
  if (!assigneeId) missing.push('assignee_id');
  if (!projectId) missing.push('project_id');
  if (!clientId) missing.push('client_id');
  if (!milestoneId) missing.push('milestone_id');
  if (missing.length > 0) {
    console.warn(
      `[ensureTask] ⚠ missing fields on milestone=${milestoneId}: ${missing.join(', ')} — will still proceed with best-effort values`
    );
  }

  // Exact columns matching public.tasks schema.
  const now = new Date().toISOString();
  const fullFields: Record<string, unknown> = {
    title,
    assignee_id: assigneeId,
    project_id: projectId,
    client_id: clientId,
    milestone_id: milestoneId,
    status: 'pending',
    updated_at: now,
  };

  // Dedup: find an existing task for this milestone.
  let existingId: string | null = null;
  const { data: existing, error: existErr } = await sb
    .from('tasks')
    .select('id')
    .eq('milestone_id', milestoneId)
    .maybeSingle();
  if (existErr) {
    console.warn(`[ensureTask] dedup query error: ${existErr.message}`);
  } else if (existing) {
    existingId = (existing as any).id;
    console.log(`[ensureTask] found existing task id=${existingId} for milestone=${milestoneId}`);
  }

  // If a task already exists for this milestone, UPDATE it.
  if (existingId) {
    console.log(`[ensureTask] ➜ updating existing task id=${existingId} milestone=${milestoneId}`);
    const { data: uData, error: uErr } = await sb
      .from('tasks')
      .update(fullFields)
      .eq('id', existingId)
      .select('id')
      .single();
    if (!uErr && uData) {
      console.log(
        `[ensureTask] ✅ task updated id=${existingId} assignee=${assigneeId} project=${projectId} milestone=${milestoneId}`
      );
      return { action: 'updated', taskId: existingId, missing: missing.length ? missing : undefined };
    }
    if (uErr) {
      console.error(`[ensureTask] ❌ task update failed: ${uErr.message} (code=${(uErr as any)?.code ?? 'none'}) details=${JSON.stringify((uErr as any)?.details ?? null)}`);
      return { action: 'skipped', taskId: existingId, error: uErr.message };
    }
    // uData is null without error — row vanished, fall through to INSERT.
    console.warn(`[ensureTask] update returned no data — row may have been deleted, falling through to INSERT`);
  }

  // INSERT a new task. Use .select('*').single() to VERIFY the row was created.
  const taskId = `tsk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const insertRow: Record<string, unknown> = {
    id: taskId,
    ...fullFields,
    created_at: now,
  };

  console.log('TASK PAYLOAD:', JSON.stringify(insertRow));

  const { data: inserted, error: insertErr } = await sb
    .from('tasks')
    .insert(insertRow)
    .select('*')
    .single();

  if (!insertErr && inserted) {
    console.log(
      `[ensureTask] ✅ task INSERT verified id=${taskId} milestone=${milestoneId} returned_keys=${Object.keys(inserted).join(',')}`
    );
    return { action: 'created', taskId, missing: missing.length ? missing : undefined };
  }

  if (!insertErr && !inserted) {
    console.error(`[ensureTask] ❌ INSERT returned no error AND no data. insertRow=${JSON.stringify(insertRow)}`);
    // Verify if the row actually exists.
    const { data: verifyRow } = await sb.from('tasks').select('id').eq('id', taskId).maybeSingle();
    if (verifyRow) {
      console.log(`[ensureTask] ⚠ task row DOES exist id=${taskId} despite no data returned — treating as success`);
      return { action: 'created', taskId, missing: missing.length ? missing : undefined };
    }
    return { action: 'skipped', error: 'insert returned no data despite no error' };
  }

  // Handle unique_violation — a row was inserted between our dedup check and INSERT.
  if ((insertErr as any)?.code === '23505') {
    console.warn('[ensureTask] unique_violation — finding and updating existing task');
    const { data: ex } = await sb.from('tasks').select('id').eq('milestone_id', milestoneId).maybeSingle();
    if (ex) {
      const { data: uData, error: uErr } = await sb
        .from('tasks')
        .update(fullFields)
        .eq('id', (ex as any).id)
        .select('id')
        .single();
      if (!uErr && uData) {
        console.log(`[ensureTask] ✅ task repaired via UPDATE id=${(ex as any).id} milestone=${milestoneId}`);
        return { action: 'updated', taskId: (ex as any).id, missing: missing.length ? missing : undefined };
      }
      console.error(`[ensureTask] ❌ update after unique_violation failed: ${uErr?.message ?? 'no data'}`);
      return { action: 'skipped', taskId: (ex as any).id, error: uErr?.message ?? 'update failed' };
    }
    return { action: 'skipped', error: 'unique_violation but existing row not findable' };
  }

  // Any other error.
  console.error(
    `[ensureTask] ❌ task INSERT failed: ${insertErr!.message} (code=${(insertErr as any)?.code ?? 'none'}) details=${JSON.stringify((insertErr as any)?.details ?? null)} hint=${JSON.stringify((insertErr as any)?.hint ?? null)}`
  );
  return { action: 'skipped', error: insertErr!.message };
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const sb = getSupabase();
    let updateRow = toUpdate(body);
    let selectList = SELECT_COLUMNS;

    const incomingAssignee =
      body.assigneeId !== undefined ? body.assigneeId : body.assignedEmployeeId;
    console.log(
      `[API] PUT /api/data/project-milestones/${id} body_keys=${Object.keys(body).join(',')} assigneeId=${JSON.stringify(body.assigneeId)} assignedEmployeeId=${JSON.stringify(body.assignedEmployeeId)}`
    );
    console.log(
      `[API] PUT /api/data/project-milestones/${id} initial updateRow keys=${Object.keys(updateRow).join(',')} assignee_id=${JSON.stringify(updateRow.assignee_id)} incomingAssignee=${incomingAssignee ?? 'undefined'}`
    );

    let updated: Row | null = null;
    let lastErr: { message: string; code?: string } | null = null;
    let protectedError: string | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      console.log(
        `[API] PUT /api/data/project-milestones/${id} attempt=${attempt} updateRow=${JSON.stringify(updateRow)}`
      );
      const { data, error } = await sb.from(TABLE).update(updateRow).eq('id', id).select('*').maybeSingle();
      if (!error) {
        updated = (data as Row) ?? null;
        console.log(
          `[API] PUT /api/data/project-milestones/${id} ✅ UPDATE succeeded on attempt=${attempt}`
        );
        break;
      }
      lastErr = error as any;
      console.warn(
        `[API] PUT /api/data/project-milestones/${id} attempt=${attempt} supabase error: ${error.message} (code=${(error as any).code ?? 'none'})`
      );
      const bad = parseBadColumn(error.message);
      if (!bad) break;

      if (PROTECTED_COLUMNS.has(bad)) {
        // Refuse to silently drop a required column. Surface the error so
        // the client can see why the save didn't land.
        protectedError = `Supabase does not recognise column "${bad}" on business_project_milestones. ` +
          `The column was added but PostgREST's schema cache is stale. ` +
          `Run NOTIFY pgrst, 'reload schema'; in the SQL editor, or reload the table in the Supabase dashboard.`;
        console.error(`[API] PUT /api/data/project-milestones/${id} ❌ ${protectedError}`);
        break;
      }

      if (bad in updateRow) {
        console.warn(`[API] PUT /api/data/project-milestones/${id} dropping unknown update column "${bad}"`);
        const { [bad]: _d, ...rest } = updateRow; void _d; updateRow = rest;
      } else if (selectList.includes(bad)) {
        selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
      } else {
        break;
      }
    }

    // Post-update verification: re-read the row to prove assignee_id landed.
    // This catches silent failures like RLS policies blocking the write or
    // PostgREST returning a stale cached column value.
    if (updated && body.assigneeId !== undefined) {
      const { data: verify, error: verifyErr } = await sb
        .from(TABLE)
        .select('id, assignee_id')
        .eq('id', id)
        .maybeSingle();
      const verifyAssignee = verify ? (verify as any).assignee_id : null;
      const intended = nullIfEmpty(body.assigneeId);
      if (verifyErr) {
        console.warn(`[API] PUT /api/data/project-milestones/${id} verify error: ${verifyErr.message}`);
      } else if (verifyAssignee !== intended) {
        console.error(
          `[API] PUT /api/data/project-milestones/${id} ❌ VERIFY MISMATCH: intended=${JSON.stringify(intended)} persisted=${JSON.stringify(verifyAssignee)}. ` +
          `This means the UPDATE did not actually write assignee_id. Likely causes: ` +
          `(1) PostgREST schema cache stale — run NOTIFY pgrst, 'reload schema'; ` +
          `(2) RLS policy blocking the update for the service role.`
        );
      } else {
        console.log(`[API] PUT /api/data/project-milestones/${id} ✅ verify: assignee_id=${JSON.stringify(verifyAssignee)} matches intended`);
      }
    }

    if (protectedError) {
      return NextResponse.json(
        { error: protectedError, code: 'schema_cache_stale', column: parseBadColumn(lastErr?.message ?? '') },
        { status: 500 }
      );
    }

    if (lastErr && !updated) {
      console.error('[API] PUT /api/data/project-milestones/[id] update failed:', lastErr);
      return NextResponse.json({ error: lastErr.message }, { status: 400 });
    }
    if (!updated) return NextResponse.json({ error: 'Not found', milestoneId: id }, { status: 404 });

    const savedAssignee =
      (updated.assignee_id as string) || null;
    console.log(
      `[API] PUT /api/data/project-milestones/${id} ✅ UPDATE succeeded. savedAssignee=${savedAssignee ?? 'null'} updated.keys=${Object.keys(updated).join(',')}`
    );
    if (incomingAssignee !== undefined && !savedAssignee && incomingAssignee) {
      console.warn(
        `[API] PUT /api/data/project-milestones/${id} ⚠ assignee_id not reflected in updated row but task creation will still run with incoming value "${incomingAssignee}"`
      );
    }

    // Side effect: if this update set an assignee (and the caller intended
    // assignee changes), ensure a task exists. Pass EXPLICIT args from the
    // request body + the verified milestone row so missing or unmapped DB
    // columns can't cause the helper to short-circuit.
    let taskResult: { action: string; taskId?: string; error?: string; missing?: string[] } | null = null;
    if (incomingAssignee !== undefined) {
      const resolvedAssignee =
        typeof incomingAssignee === 'string' && incomingAssignee.trim() !== ''
          ? incomingAssignee
          : (updated.assignee_id as string) || null;

      // Resolve the business project ID.
      // Priority: (1) explicit from request body, (2) milestone row, (3) re-read.
      const bodyProjectId =
        (body.businessProjectId as string) || (body.projectId as string) || null;
      let resolvedProjectId = bodyProjectId
        || (updated.business_project_id as string)
        || (updated.project_id as string)
        || null;

      // Fallback: if still null, re-read the milestone row explicitly.
      if (!resolvedProjectId) {
        console.warn(`[API] PUT /api/data/project-milestones/${id} ⚠ project_id not in body or row keys=[${Object.keys(updated).join(',')}] — re-reading milestone`);
        const { data: milestoneRow } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
        if (milestoneRow) {
          resolvedProjectId =
            ((milestoneRow as any).business_project_id as string) ||
            ((milestoneRow as any).project_id as string) || null;
        }
      }

      const resolvedTitle = (updated.title as string) || 'משימה';

      console.log(
        `[API] PUT /api/data/project-milestones/${id} triggering ensureTask incomingAssignee=${incomingAssignee} resolvedAssignee=${resolvedAssignee ?? 'null'} resolvedProject=${resolvedProjectId ?? 'null'}`
      );
      console.log(`TASK PAYLOAD: milestoneId=${id} assigneeId=${resolvedAssignee} projectId=${resolvedProjectId} title=${resolvedTitle}`);

      try {
        taskResult = await ensureTaskForMilestone(sb, {
          milestoneId: id,
          assigneeId: resolvedAssignee,
          projectId: resolvedProjectId,
          title: resolvedTitle,
        });
        console.log(`[API] PUT /api/data/project-milestones/${id} ensureTask returned action=${taskResult.action} taskId=${taskResult.taskId ?? 'none'} error=${taskResult.error ?? 'none'}`);
      } catch (e) {
        console.error('[ensureTask] unexpected error:', e);
        taskResult = { action: 'skipped', error: e instanceof Error ? e.message : 'unknown' };
      }
    } else {
      console.log(`[API] PUT /api/data/project-milestones/${id} no assigneeId in body — skipping task side effect`);
    }

    return NextResponse.json({
      ...rowToMilestone(updated),
      _task: taskResult,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] PUT /api/data/project-milestones/[id] fatal:', msg);
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
