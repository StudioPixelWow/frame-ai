/**
 * POST /api/video-pipeline/:projectId/ai-analysis — start AI analysis (validates source first)
 * GET  /api/video-pipeline/:projectId/ai-analysis — get analysis results
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { videoPipelineStates, aiVideoAnalyses } from '@/lib/db/collections';
import { startAIAnalysis } from '@/lib/video-pipeline/pipeline-engine';
import { validateSource } from '@/lib/video-pipeline/pipeline-validator';

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

export async function GET(_req: NextRequest, context: Params) {
  const { projectId } = await context.params;

  try {
    const sb = getSupabase();
    const { data: rows, error } = await sb
      .from('app_ai_video_analyses')
      .select('id, data')
      .eq('data->>projectId', projectId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !rows?.length) {
      return NextResponse.json(
        { error: 'לא נמצאו תוצאות ניתוח עבור הפרויקט' },
        { status: 404 },
      );
    }

    const row = rows[0];
    const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return NextResponse.json({ ...parsed, id: row.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בטעינת ניתוח AI';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: Params) {
  const { projectId } = await context.params;

  try {
    const state = await findStateByProject(projectId);
    if (!state) {
      return NextResponse.json(
        { error: 'מצב צינור לא נמצא עבור הפרויקט' },
        { status: 404 },
      );
    }

    // Validate source before starting analysis
    if (state.finalPreEditVideoId) {
      const validation = validateSource(state, state.finalPreEditVideoId);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.blockedReason ?? 'אימות מקור נכשל' },
          { status: 400 },
        );
      }
    }

    const updated = startAIAnalysis(state);
    await videoPipelineStates.updateAsync(state.id, updated);

    // Create analysis record
    await aiVideoAnalyses.createAsync({
      projectId,
      sourceVideoId: state.finalPreEditVideoId,
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בהתחלת ניתוח AI';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
