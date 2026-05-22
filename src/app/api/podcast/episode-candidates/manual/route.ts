/**
 * POST /api/podcast/episode-candidates/manual — add a manual clip candidate
 *
 * Allows users to manually define a clip with custom time range and title.
 * Sets candidateStatus to 'edited_by_user' and clipIndex to max+1.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { episodeId, title, startTime, endTime, description } = body as {
      episodeId: string;
      title: string;
      startTime: number;
      endTime: number;
      description?: string;
    };

    if (!episodeId || !title || startTime == null || endTime == null) {
      return NextResponse.json(
        { error: 'חסרים שדות חובה: episodeId, title, startTime, endTime' },
        { status: 400 },
      );
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: 'זמן סיום חייב להיות גדול מזמן התחלה' },
        { status: 400 },
      );
    }

    const sb = getSupabase();

    // Find max clipIndex for this episode
    const { data: existing } = await sb
      .from('app_podcast_clip_candidates')
      .select('data')
      .eq('data->>episodeId', episodeId)
      .order('created_at', { ascending: false })
      .limit(100);

    let maxIndex = 0;
    if (existing?.length) {
      for (const row of existing) {
        const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        if (d.clipIndex != null && d.clipIndex > maxIndex) maxIndex = d.clipIndex;
      }
    }

    const candidateId = uuidv4();
    const now = new Date().toISOString();

    const candidate = {
      id: candidateId,
      episodeId,
      title,
      startTime,
      endTime,
      description: description || '',
      transcriptExcerpt: '',
      topicTags: [],
      viralScore: 0,
      engagementScore: 0,
      hookScore: 0,
      confidenceScore: 0,
      reasoning: 'הוסף ידנית על ידי המשתמש',
      candidateStatus: 'edited_by_user',
      clipIndex: maxIndex + 1,
      userAdjustedStart: null,
      userAdjustedEnd: null,
      createdAt: now,
      updatedAt: now,
    };

    const { error: insertErr } = await sb
      .from('app_podcast_clip_candidates')
      .insert({ id: candidateId, data: candidate });

    if (insertErr) {
      console.error('[manual-clip] Insert error:', insertErr);
      return NextResponse.json(
        { error: 'שגיאה בהוספת קליפ ידני' },
        { status: 500 },
      );
    }

    return NextResponse.json(candidate);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בהוספת קליפ ידני';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
