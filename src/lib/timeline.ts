/**
 * Shared helper to insert timeline events into business_project_timeline.
 * Fire-and-forget: never throws, only logs warnings on failure.
 *
 * Action types:
 *   milestone_created, milestone_status_changed, milestone_assigned,
 *   milestone_completed, file_uploaded, payment_created, project_created
 */

import { getSupabase } from '@/lib/db/store';

const TABLE = 'business_project_timeline';

let _tableReady = false;

async function ensureTable(sb: ReturnType<typeof getSupabase>): Promise<boolean> {
  if (_tableReady) return true;

  // Probe SELECT — table was created via DDL in Supabase
  const { error } = await sb.from(TABLE).select('id').limit(1);
  if (!error) { _tableReady = true; return true; }

  const code = (error as any)?.code ?? '';
  if (code === '42P01') {
    console.warn(`[timeline] Table "${TABLE}" not found — timeline events will be skipped.`);
  }
  return false;
}

export async function insertTimelineEvent(
  projectId: string,
  actionType: string,
  description: string,
): Promise<void> {
  try {
    const sb = getSupabase();
    const ok = await ensureTable(sb);
    if (!ok) return;

    const { error } = await sb.from(TABLE).insert({
      project_id: projectId,
      action_type: actionType,
      description,
    });

    if (error) {
      console.warn('[timeline] insert failed:', error.message);
    }
  } catch (err: any) {
    console.warn('[timeline] insertTimelineEvent error:', err?.message);
  }
}

/**
 * Derive project status from milestone statuses and update the project row.
 * Fire-and-forget — never throws.
 *
 * Status mapping:
 *   0 approved → "not_started"  (חדש)
 *   partial    → "in_progress"  (בתהליך)
 *   all approved → "completed"  (הושלם)
 */
export async function deriveAndUpdateProjectStatus(projectId: string): Promise<void> {
  try {
    const sb = getSupabase();

    // Fetch all milestones for this project
    const { data: milestones, error: mErr } = await sb
      .from('business_project_milestones')
      .select('status')
      .or(`business_project_id.eq.${projectId},project_id.eq.${projectId}`);

    if (mErr || !milestones) {
      console.warn('[timeline] failed to fetch milestones for status derivation:', mErr?.message);
      return;
    }

    const total = milestones.length;
    if (total === 0) return;

    const approved = milestones.filter((m: any) => m.status === 'approved').length;
    const submitted = milestones.filter((m: any) => m.status === 'submitted').length;
    const inProgress = milestones.filter((m: any) => m.status === 'in_progress').length;
    const returned = milestones.filter((m: any) => m.status === 'returned').length;
    const pending = milestones.filter((m: any) => m.status === 'pending').length;

    let projectStatus: string;
    let progress: number;

    if (approved === total) {
      projectStatus = 'completed';
      progress = 100;
    } else if (submitted > 0 && inProgress === 0 && pending === 0 && returned === 0) {
      projectStatus = 'awaiting_approval';
      progress = Math.round((approved * 100 + submitted * 75) / total);
    } else if (returned > 0) {
      projectStatus = 'waiting_for_client';
      progress = Math.round((approved * 100 + submitted * 75 + inProgress * 50 + returned * 25) / total);
    } else if (inProgress > 0 || approved > 0 || submitted > 0) {
      projectStatus = 'in_progress';
      progress = Math.round((approved * 100 + submitted * 75 + inProgress * 50 + returned * 25) / total);
    } else {
      projectStatus = 'not_started';
      progress = 0;
    }

    // Update the project row
    const { error: uErr } = await sb
      .from('business_projects')
      .update({
        project_status: projectStatus,
        progress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (uErr) {
      console.warn('[timeline] failed to update project status:', uErr.message);
    } else {
      console.log(`[timeline] project ${projectId} status → ${projectStatus} (${progress}%)`);
    }
  } catch (err: any) {
    console.warn('[timeline] deriveAndUpdateProjectStatus error:', err?.message);
  }
}
