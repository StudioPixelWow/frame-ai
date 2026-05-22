/**
 * POST /api/video-pipeline/:projectId/trim-crop — save trim & crop or skip
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { videoPipelineStates } from '@/lib/db/collections';
import { completeTrimCrop } from '@/lib/video-pipeline/pipeline-engine';
import { addAuditEntry } from '@/lib/video-pipeline/pipeline-validator';
import type { TrimCropData, VideoPipelineState } from '@/lib/video-pipeline/types';

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
        trimCropStatus: 'skipped',
        pipelineStatus: 'trim_crop_selected',
        updatedAt: new Date().toISOString(),
      };
      const withAudit = addAuditEntry(updated, 'trim_crop_skipped', state.originalVideoId);
      await videoPipelineStates.updateAsync(state.id, withAudit);
      return NextResponse.json(withAudit);
    }

    // Normal trim & crop
    const trimCropData: TrimCropData = {
      trimStart: body.trimStart ?? 0,
      trimEnd: body.trimEnd ?? 30,
      cropX: body.cropX ?? 0,
      cropY: body.cropY ?? 0,
      cropWidth: body.cropWidth ?? 100,
      cropHeight: body.cropHeight ?? 100,
      targetAspectRatio: body.targetAspectRatio ?? '9:16',
      faceTrackingEnabled: body.faceTrackingEnabled ?? false,
      subjectTrackingEnabled: body.subjectTrackingEnabled ?? false,
      appliedAt: new Date().toISOString(),
    };

    // Auto-generate trimCropVideoId if not provided (client-side trim doesn't produce a new file)
    const trimCropVideoId = body.trimCropVideoId || `trim_${projectId}_${Date.now()}`;

    // Ensure we're in a valid state for trim/crop
    const allowedStatuses = ['ready_for_trim_crop', 'hook_ready', 'hook_selected', 'trim_crop_selected'];
    if (!allowedStatuses.includes(state.pipelineStatus)) {
      return NextResponse.json(
        { error: `לא ניתן לבצע חיתוך במצב ${state.pipelineStatus}` },
        { status: 400 },
      );
    }

    // Normalize state for completeTrimCrop
    const stateForTrimCrop = {
      ...state,
      pipelineStatus: state.pipelineStatus === 'hook_selected' ? 'ready_for_trim_crop' : state.pipelineStatus,
    };

    const updated = completeTrimCrop(stateForTrimCrop, trimCropData, trimCropVideoId);
    await videoPipelineStates.updateAsync(state.id, updated);

    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בשמירת חיתוך ומיקוד';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
