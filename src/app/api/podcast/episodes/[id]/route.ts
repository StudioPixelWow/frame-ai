/**
 * GET    /api/podcast/episodes/[id] - Fetch single episode with clips count & render status
 * PUT    /api/podcast/episodes/[id] - Update episode metadata
 * DELETE /api/podcast/episodes/[id] - Soft delete episode (set status to 'deleted')
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Fetch episode
    const { data: episode, error: episodeError } = await supabase
      .from('podcast_episodes')
      .select('*')
      .eq('id', id)
      .neq('status', 'deleted')
      .single();

    if (episodeError || !episode) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      );
    }

    // Count clip candidates
    const { count: clipsCount } = await supabase
      .from('podcast_clip_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('episode_id', id);

    // Aggregate render status
    const { data: renders } = await supabase
      .from('podcast_rendered_clips')
      .select('id, status')
      .eq('episode_id', id);

    const renderSummary = {
      total: renders?.length ?? 0,
      completed: renders?.filter((r) => r.status === 'completed').length ?? 0,
      rendering: renders?.filter((r) => r.status === 'rendering').length ?? 0,
      queued: renders?.filter((r) => r.status === 'queued').length ?? 0,
      failed: renders?.filter((r) => r.status === 'failed').length ?? 0,
    };

    return NextResponse.json({
      ...episode,
      clips_count: clipsCount ?? 0,
      render_status: renderSummary,
    });
  } catch (error) {
    console.error('[Episodes] GET by ID failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch episode' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    // Only allow updating specific metadata fields
    const allowedFields: Record<string, string> = {
      title: 'title',
      showName: 'show_name',
      show_name: 'show_name',
      guestNames: 'guest_names',
      guest_names: 'guest_names',
    };

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const [key, dbColumn] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        updatePayload[dbColumn] = body[key];
      }
    }

    if (Object.keys(updatePayload).length <= 1) {
      return NextResponse.json(
        { error: 'No valid fields to update. Allowed: title, showName, guestNames' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('podcast_episodes')
      .update(updatePayload)
      .eq('id', id)
      .neq('status', 'deleted')
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Episodes] PUT failed:', error);
    return NextResponse.json(
      { error: 'Failed to update episode' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Soft delete: set status to 'deleted'
    const { data, error } = await supabase
      .from('podcast_episodes')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .neq('status', 'deleted')
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Episodes] DELETE failed:', error);
    return NextResponse.json(
      { error: 'Failed to delete episode' },
      { status: 500 }
    );
  }
}
