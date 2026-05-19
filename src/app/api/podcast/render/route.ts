/**
 * POST /api/podcast/render - Submit batch render for clips
 * GET  /api/podcast/render - Get render status for episode (?episodeId required)
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
    const { clipIds, episodeId } = body;

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

    // Create a render record for each clip
    const renderRecords = clipIds.map((clipId: string) => ({
      clip_candidate_id: clipId,
      episode_id: episodeId,
      status: 'queued',
      output_format: '16:9',
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
      .order('created_at', { ascending: false });

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
