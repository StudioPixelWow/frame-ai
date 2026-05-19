/**
 * GET  /api/podcast/clips - List clips for an episode (?episodeId required)
 * POST /api/podcast/clips - Create a clip candidate
 * PUT  /api/podcast/clips - Update a clip candidate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

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
      .from('podcast_clip_candidates')
      .select('*')
      .eq('episode_id', episodeId)
      .order('viral_score', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch clips' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      episodeId,
      title,
      startTime,
      endTime,
      transcriptExcerpt,
      topicTags,
      viralScore,
      engagementScore,
      hookScore,
      reasoning,
      isSelected,
      formatConfig,
      hookPackage,
      brandPresetId,
      viralStyle,
      timelineEdits,
    } = body;

    if (!episodeId || !title || startTime == null || endTime == null) {
      return NextResponse.json(
        { error: 'episodeId, title, startTime, and endTime are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('podcast_clip_candidates')
      .insert({
        episode_id: episodeId,
        title,
        start_time: startTime,
        end_time: endTime,
        transcript_excerpt: transcriptExcerpt || '',
        topic_tags: topicTags || [],
        viral_score: viralScore || 0,
        engagement_score: engagementScore || 0,
        hook_score: hookScore || 0,
        reasoning: reasoning || '',
        is_selected: isSelected || false,
        format_config: formatConfig || null,
        hook_package: hookPackage || null,
        brand_preset_id: brandPresetId || null,
        viral_style: viralStyle || null,
        timeline_edits: timelineEdits || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create clip' },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fieldsToUpdate } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    // Map camelCase to snake_case for known fields
    const updatePayload: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      episodeId: 'episode_id',
      title: 'title',
      startTime: 'start_time',
      endTime: 'end_time',
      transcriptExcerpt: 'transcript_excerpt',
      topicTags: 'topic_tags',
      viralScore: 'viral_score',
      engagementScore: 'engagement_score',
      hookScore: 'hook_score',
      reasoning: 'reasoning',
      isSelected: 'is_selected',
      userAdjustedStart: 'user_adjusted_start',
      userAdjustedEnd: 'user_adjusted_end',
      formatConfig: 'format_config',
      hookPackage: 'hook_package',
      brandPresetId: 'brand_preset_id',
      viralStyle: 'viral_style',
      timelineEdits: 'timeline_edits',
    };

    for (const [key, value] of Object.entries(fieldsToUpdate)) {
      const snakeKey = fieldMap[key] || key;
      updatePayload[snakeKey] = value;
    }

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('podcast_clip_candidates')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update clip' },
      { status: 400 }
    );
  }
}
