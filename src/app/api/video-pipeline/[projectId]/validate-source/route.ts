/**
 * POST /api/video-pipeline/:projectId/validate-source — validate source video
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
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

export async function POST(req: NextRequest, context: Params) {
  const { projectId } = await context.params;

  try {
    const body = await req.json();
    const { sourceVideoId } = body as { sourceVideoId?: string };

    if (!sourceVideoId) {
      return NextResponse.json(
        { error: 'חסר שדה sourceVideoId' },
        { status: 400 },
      );
    }

    const state = await findStateByProject(projectId);
    if (!state) {
      return NextResponse.json(
        { error: 'מצב צינור לא נמצא עבור הפרויקט' },
        { status: 404 },
      );
    }

    const result = validateSource(state, sourceVideoId);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה באימות המקור';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
