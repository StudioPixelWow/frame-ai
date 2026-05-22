/**
 * POST /api/video-pipeline/:projectId/finalize — finalize pre-edit & lock source
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { videoPipelineStates } from '@/lib/db/collections';
import { completeFinalPreEdit } from '@/lib/video-pipeline/pipeline-engine';
import type { VideoPipelineState } from '@/lib/video-pipeline/types';

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
    const { finalVideoId } = body as { finalVideoId?: string };

    const state = await findStateByProject(projectId);
    if (!state) {
      return NextResponse.json(
        { error: 'מצב צינור לא נמצא עבור הפרויקט' },
        { status: 404 },
      );
    }

    // Already locked?
    if (state.sourceLocked) {
      return NextResponse.json(state);
    }

    // Auto-determine finalVideoId if not provided
    const resolvedFinalVideoId = finalVideoId
      || state.trimCropVideoId
      || state.hookGeneratedVideoId
      || state.originalVideoId;

    if (!resolvedFinalVideoId) {
      return NextResponse.json(
        { error: 'לא ניתן לקבוע את הקובץ הסופי — חסרים מזהי וידאו' },
        { status: 400 },
      );
    }

    // Ensure we're in a valid state — allow from trim_crop_selected or pre_edit_generating
    const allowedStatuses = ['trim_crop_selected', 'pre_edit_generating', 'ready_for_trim_crop', 'hook_ready'];
    if (!allowedStatuses.includes(state.pipelineStatus)) {
      return NextResponse.json(
        { error: `לא ניתן לנעול מקור במצב ${state.pipelineStatus}` },
        { status: 400 },
      );
    }

    // Normalize state for completeFinalPreEdit
    const normalizedState: VideoPipelineState = {
      ...state,
      pipelineStatus: 'trim_crop_selected',
    };

    const updated = completeFinalPreEdit(normalizedState, resolvedFinalVideoId);
    await videoPipelineStates.updateAsync(state.id, updated);

    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בנעילת המקור';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
