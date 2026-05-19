/**
 * POST  /api/podcast/render - Submit render for clips (single or batch)
 * GET   /api/podcast/render - Get render status for episode (?episodeId required)
 * PATCH /api/podcast/render - Update render status (worker callback)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clipIds, episodeId, priority, outputFormat } = body;

    if (!clipIds || !Array.isArray(clipIds) || clipIds.length === 0) {
      return NextResponse.json(
        { error: 'clipIds array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!episodeId) {
      return NextResponse.json(
        { error: 'episodeId is required' },
        { status: 400 }
      );
    }

    // Priority levels:
    //   1 = user single clip render (highest)
    //   2 = batch render
    //   3 = background / auto render (lowest)
    const resolvedPriority = priority ?? (clipIds.length === 1 ? 1 : 2);
    const resolvedFormat = outputFormat ?? '16:9';

    // Create a render record for each clip
    const renderRecords = clipIds.map((clipId: string) => ({
      clip_candidate_id: clipId,
      episode_id: episodeId,
      status: 'queued',
      priority: resolvedPriority,
      output_format: resolvedFormat,
      render_config: {},
    }));

    const { data, error } = await supabase
      .from('podcast_rendered_clips')
      .insert(renderRecords)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to submit render batch' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const episodeId = searchParams.get('episodeId');

    if (!episodeId) {
      return NextResponse.json(
        { error: 'episodeId query parameter is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('podcast_rendered_clips')
      .select('*')
      .eq('episode_id', episodeId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch render status' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { renderId, status, outputUrl, error: renderError } = body;

    if (!renderId) {
      return NextResponse.json(
        { error: 'renderId is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['queued', 'rendering', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = { status };

    if (outputUrl) updatePayload.output_url = outputUrl;
    if (renderError) updatePayload.error_message = renderError;
    if (status === 'completed' || status === 'failed') {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('podcast_rendered_clips')
      .update(updatePayload)
      .eq('id', renderId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Render record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update render status' },
      { status: 500 }
    );
  }
}
