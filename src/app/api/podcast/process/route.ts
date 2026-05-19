/**
 * POST /api/podcast/process - Trigger processing for an episode
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
    const { episodeId } = body;

    if (!episodeId) {
      return NextResponse.json(
        { error: 'episodeId is required' },
        { status: 400 }
      );
    }

    // Verify episode exists
    const { data: episode, error: fetchError } = await supabase
      .from('podcast_episodes')
      .select('id, status')
      .eq('id', episodeId)
      .single();

    if (fetchError || !episode) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      );
    }

    // Update status to processing with stage 1
    const { data, error } = await supabase
      .from('podcast_episodes')
      .update({
        status: 'processing',
        processing_progress: {
          stage: 1,
          stageName: 'transcription',
          percent: 0,
          startedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', episodeId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // TODO: In production, trigger Railway worker here
    // e.g. await fetch(RAILWAY_WORKER_URL, { method: 'POST', body: JSON.stringify({ episodeId }) })

    return NextResponse.json({
      success: true,
      message: 'Processing started',
      episode: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    );
  }
}
