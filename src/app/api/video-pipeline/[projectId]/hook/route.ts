/**
 * POST /api/video-pipeline/:projectId/hook — save hook selection or skip
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { videoPipelineStates } from '@/lib/db/collections';
import { completeHookSelection } from '@/lib/video-pipeline/pipeline-engine';
import { addAuditEntry } from '@/lib/video-pipeline/pipeline-validator';
import type { HookSelection, VideoPipelineState } from '@/lib/video-pipeline/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ projectId: string }> };

async function findStateByProject(projectId: string) {
  const sb = getSupabase();
  const { data: rows, error } = await sb
    .from('app_video_pipeline_states')
    .select('id, data')
    .eq('data->>projectId', projectId)
    .limit(1);

  if (error || !rows?.length) return null;
  const row = rows[0];
  const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { ...parsed, id: row.id };
}

export async function POST(req: NextRequest, context: Params) {
  const { projectId } = await context.params;

  try {
    const body = await req.json();

    const state = await findStateByProject(projectId);
    if (!state) {
      return NextResponse.json(
        { error: 'מצב צינור לא נמצא עבור הפרויקט' },
        { status: 404 },
      );
    }

    // Handle skip
    if (body.skipped) {
      const updated: VideoPipelineState = {
        ...state,
        hookStatus: 'skipped',
        pipelineStatus: 'ready_for_trim_crop',
        updatedAt: new Date().toISOString(),
      };
      const withAudit = addAuditEntry(updated, 'hook_skipped', state.originalVideoId);
      await videoPipelineStates.updateAsync(state.id, withAudit);
      return NextResponse.json(withAudit);
    }

    // Normal hook selection
    const hook: HookSelection = {
      startTime: body.startTime ?? 0,
      endTime: body.endTime ?? 3,
      duration: body.duration ?? (body.endTime - body.startTime),
      viralScore: body.viralScore ?? 0,
      engagementScore: body.engagementScore ?? 0,
      confidenceScore: body.confidenceScore ?? 0,
      aiRecommended: body.aiRecommended ?? false,
      selectedAt: new Date().toISOString(),
    };

    if (hook.endTime <= hook.startTime) {
      return NextResponse.json(
        { error: 'endTime חייב להיות גדול מ-startTime' },
        { status: 400 },
      );
    }

    // Allow hook selection from multiple valid states
    const allowedStatuses = ['uploaded', 'ready_for_hook_selection', 'hook_selected'];
    let stateForHook = state;
    if (!allowedStatuses.includes(state.pipelineStatus)) {
      return NextResponse.json(
        { error: `לא ניתן לבחור הוק במצב ${state.pipelineStatus}` },
        { status: 400 },
      );
    }

    // Normalize status to allow completeHookSelection
    if (state.pipelineStatus === 'uploaded') {
      stateForHook = { ...state, pipelineStatus: 'ready_for_hook_selection' };
    }

    const updated = completeHookSelection(stateForHook, hook);
    // After hook selection, advance to ready_for_trim_crop
    const finalState: VideoPipelineState = {
      ...updated,
      pipelineStatus: 'ready_for_trim_crop',
    };

    await videoPipelineStates.updateAsync(state.id, finalState);
    return NextResponse.json(finalState);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בשמירת בחירת הוק';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
