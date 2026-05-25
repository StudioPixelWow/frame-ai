/**
 * POST /api/podcast/create-clip-project
 *
 * Creates a video project from an approved podcast clip.
 * Returns the project ID so the frontend can navigate to /projects/[id]/pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { approvedClips } from '@/lib/db/collections';
import type { ApprovedClip } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `prj_${ts}_${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clipId, episodeId, startTime, endTime, videoUrl, clipTitle } = body;

    if (!clipId || !episodeId) {
      return NextResponse.json({ error: 'חסר clipId או episodeId' }, { status: 400 });
    }

    // Look up the approved clip
    let clip: ApprovedClip | null = null;
    try {
      const allClips = await approvedClips.getAllAsync();
      clip = (allClips as ApprovedClip[]).find(c => c.id === clipId) || null;
    } catch {
      // If collection lookup fails, proceed with provided params
    }

    const clipStartTime = clip?.startTime ?? startTime ?? 0;
    const clipEndTime = clip?.endTime ?? endTime ?? 0;
    const clipDuration = clipEndTime - clipStartTime;
    const title = clip?.title ?? clipTitle ?? `קליפ מפודקאסט`;
    const sourceVideo = clip?.sourceEpisodeVideoId ?? videoUrl ?? '';

    // Create a project in video_projects table
    const sb = getSupabase();
    const id = generateId();
    const now = new Date().toISOString();

    const insertRow: Record<string, unknown> = {
      id,
      name: title,
      status: 'draft',
      project_type: 'podcast-clip',
      description: `קליפ מפרק פודקאסט — ${title}`,
      source_video_key: sourceVideo,
      duration_sec: clipDuration,
      wizard_state: {
        source: 'podcast-clip',
        episodeId,
        clipId,
        startTime: clipStartTime,
        endTime: clipEndTime,
        originalVideoUrl: sourceVideo,
      },
      created_at: now,
      updated_at: now,
    };

    // Insert with auto-drop for missing columns
    let inserted = false;
    let lastErr: string = '';
    let row = { ...insertRow };

    for (let attempt = 0; attempt < 10; attempt++) {
      const { data, error } = await sb
        .from('video_projects')
        .insert(row)
        .select('id')
        .single();

      if (!error) {
        inserted = true;
        break;
      }

      lastErr = error.message;
      const m = error.message.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
      const bad = m?.[1] || m?.[2];
      if (!bad) break;

      if (bad in row) {
        const { [bad]: _, ...rest } = row;
        void _;
        row = rest;
      } else {
        break;
      }
    }

    if (!inserted) {
      console.error('[create-clip-project] ❌ Failed to insert project:', lastErr);
      return NextResponse.json({ error: lastErr || 'שגיאה ביצירת הפרויקט' }, { status: 500 });
    }

    // Update the approved clip status to in_single_clip_flow
    if (clip) {
      try {
        await approvedClips.updateAsync(clipId, {
          status: 'in_single_clip_flow' as any,
          pipelineStateId: id,
        });
      } catch (err) {
        console.warn('[create-clip-project] Could not update clip status:', err);
      }
    }

    console.log(`[create-clip-project] ✅ Created project ${id} for clip ${clipId}`);

    return NextResponse.json({
      success: true,
      projectId: id,
      clipId,
      episodeId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה ביצירת פרויקט קליפ';
    console.error('[create-clip-project] ❌', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
