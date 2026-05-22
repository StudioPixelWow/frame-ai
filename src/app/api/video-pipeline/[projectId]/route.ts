/**
 * GET  /api/video-pipeline/:projectId — load pipeline state
 * POST /api/video-pipeline/:projectId — initialize pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { videoPipelineStates } from '@/lib/db/collections';
import { initializePipeline } from '@/lib/video-pipeline/pipeline-engine';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ projectId: string }> };

/** Helper: find pipeline state row by projectId */
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

export async function GET(_req: NextRequest, context: Params) {
  const { projectId } = await context.params;

  try {
    const state = await findStateByProject(projectId);
    if (!state) {
      return NextResponse.json(
        { error: 'מצב צינור לא נמצא עבור הפרויקט' },
        { status: 404 },
      );
    }
    return NextResponse.json(state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: Params) {
  const { projectId } = await context.params;

  try {
    const body = await req.json();
    const { originalVideoId } = body as { originalVideoId?: string };

    if (!originalVideoId) {
      return NextResponse.json(
        { error: 'חסר שדה originalVideoId' },
        { status: 400 },
      );
    }

    // Check if pipeline already exists
    const existing = await findStateByProject(projectId);
    if (existing) {
      return NextResponse.json(
        { error: 'צינור כבר קיים עבור פרויקט זה' },
        { status: 409 },
      );
    }

    const state = initializePipeline(projectId, originalVideoId);
    const saved = await videoPipelineStates.createAsync(state);

    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה באתחול הצינור';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
