/**
 * GET    /api/data/project-milestones/[id]
 * PUT    /api/data/project-milestones/[id]
 * DELETE /api/data/project-milestones/[id]
 *
 * Storage: Supabase "business_project_milestones" table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { insertTimelineEvent, deriveAndUpdateProjectStatus } from '@/lib/timeline';
import { requireRole } from '@/lib/auth/api-guard';

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
    notes: (r.notes as string) ?? (r.description as string) ?? '',
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

  // If caller sends "notes", merge into description (DB has no "notes" column).
  if (body.notes !== undefined && body.description === undefined) {
    body.description = body.notes;
  }

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
  ];
  for (const [k, dbKey] of map) if (body[k] !== undefined) out[dbKey] = body[k];
  out.updated_at = new Date().toISOString();
  return out;
}

/** Columns that must NEVER be silently dropped. If Supabase says one of these
 *  doesn't exist, that's an error worth surfacing, not papering over. */
const PROTECTED_COLUMNS = new Set(['assignee_id', 'business_project_id', 'status', 'description']);

const SELECT_COLUMNS =
  'id, project_id, title, description, due_date, assignee_id, status, created_at, updated_at';

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
 * a task row exists in public.tasks. Always tries INSERT first.
 *
 * public.tasks FK columns:
 *   project_id          → public.projects          (general projects)
 *   business_project_id → public.business_projects  (milestone tasks)
 *
 * Milestone-originated tasks use business_project_id, NOT project_id.
 */
interface EnsureTaskArgs {
  milestoneId: string;
  assigneeId: string | null;
  businessProjectId: string | null;  // maps to tasks.business_project_id
  title: string;
}

async function ensureTaskForMilestone(
  sb: ReturnType<typeof getSupabase>,
  args: EnsureTaskArgs
): Promise<{ action: 'skipped' | 'updated' | 'created'; taskId?: string; error?: string }> {
  const { milestoneId, assigneeId, businessProjectId, title } = args;

  if (!assigneeId) {
    console.log(`[ensureTask] skip — no assignee`);
    return { action: 'skipped' };
  }

  const now = new Date().toISOString();
  const taskId = `tsk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const payload: Record<string, unknown> = {
    id: taskId,
    title: title || 'משימה',
    assignee_id: assigneeId,
    business_project_id: businessProjectId,   // FK → public.business_projects
    milestone_id: milestoneId,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  console.log('TASK PAYLOAD:', JSON.stringify(payload));

  const { data: inserted, error: insertErr } = await sb
    .from('tasks')
    .insert(payload)
    .select('*')
    .single();

  if (!insertErr && inserted) {
    console.log(`[ensureTask] ✅ task created id=${taskId} assignee=${assigneeId} business_project=${businessProjectId} milestone=${milestoneId}`);
    return { action: 'created', taskId };
  }

  const errMsg = insertErr?.message ?? 'no data returned';
  const errCode = (insertErr as any)?.code ?? 'none';
  console.error(`[ensureTask] ❌ INSERT failed: ${errMsg} (code=${errCode})`);

  // If unique violation (23505), try to UPDATE the existing row instead.
  if (errCode === '23505') {
    console.log(`[ensureTask] unique_violation — updating existing row for milestone=${milestoneId}`);
    const { data: ex } = await sb.from('tasks').select('id').eq('milestone_id', milestoneId).maybeSingle();
    if (ex) {
      const { data: uData, error: uErr } = await sb
        .from('tasks')
        .update({
          title: payload.title,
          assignee_id: assigneeId,
          business_project_id: businessProjectId,
          status: 'pending',
          updated_at: now,
        })
        .eq('id', (ex as any).id)
        .select('id')
        .single();
      if (!uErr && uData) {
        console.log(`[ensureTask] ✅ task updated id=${(ex as any).id}`);
        return { action: 'updated', taskId: (ex as any).id };
      }
      console.error(`[ensureTask] ❌ UPDATE also failed: ${uErr?.message ?? 'no data'}`);
      return { action: 'skipped', error: uErr?.message ?? 'update failed' };
    }
  }

  return { action: 'skipped', error: errMsg };
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Only admin and employee can update milestones
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

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
        `[API] PUT /api/data/project-milestones/${id} triggering ensureTask incomingAssignee=${incomingAssignee} resolvedAssignee=${resolvedAssignee ?? 'null'} resolvedBusinessProject=${resolvedProjectId ?? 'null'}`
      );
      console.log(`TASK PAYLOAD: milestoneId=${id} assigneeId=${resolvedAssignee} businessProjectId=${resolvedProjectId} title=${resolvedTitle}`);

      try {
        taskResult = await ensureTaskForMilestone(sb, {
          milestoneId: id,
          assigneeId: resolvedAssignee,
          businessProjectId: resolvedProjectId,
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

    // ── Timeline events + project status derivation (fire-and-forget) ──
    const mapped = rowToMilestone(updated);
    const resolvedProjectId =
      mapped.projectId || mapped.businessProjectId ||
      (body.businessProjectId as string) || (body.projectId as string) || '';

    if (resolvedProjectId) {
      // Status change event
      if (body.status !== undefined) {
        const statusLabel: Record<string, string> = {
          pending: 'בהמתנה',
          in_progress: 'בתהליך',
          submitted: 'הוגש',
          approved: 'אושר',
          returned: 'הוחזר',
        };
        const label = statusLabel[body.status as string] || (body.status as string);

        if (body.status === 'approved') {
          insertTimelineEvent(
            resolvedProjectId,
            'milestone_completed',
            `אבן דרך הושלמה: "${mapped.title}"`,
          );
        } else {
          insertTimelineEvent(
            resolvedProjectId,
            'milestone_status_changed',
            `אבן דרך "${mapped.title}" → ${label}`,
          );
        }
      }

      // Assignment event
      if (incomingAssignee !== undefined && incomingAssignee) {
        insertTimelineEvent(
          resolvedProjectId,
          'milestone_assigned',
          `אבן דרך "${mapped.title}" שויכה לעובד`,
        );
      }

      // Always re-derive project status after any milestone update
      deriveAndUpdateProjectStatus(resolvedProjectId);
    }

    return NextResponse.json({
      ...mapped,
      _task: taskResult,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] PUT /api/data/project-milestones/[id] fatal:', msg);
    return NextResponse.json({ error: `Failed to update: ${msg}` }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Only admin can delete milestones
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

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
