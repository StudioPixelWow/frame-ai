/**
 * GET /api/podcast/episode-queue?episodeId=xxx — get approved clips queue status
 * POST /api/podcast/episode-queue — trigger processing of next queued clips
 *
 * Shows all approved clips for an episode with their processing status.
 * POST triggers the next batch of clips to start processing (respects concurrency limit).
 */

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { approvedClips } from '@/lib/db/collections';
import {
  getNextClipsForProcessing,
  MAX_CONCURRENT_CLIPS,
} from '@/lib/podcast-engine/clip-approval-engine';
import { processNextClipBatch } from '@/lib/podcast-engine/clip-processor';
import type { ApprovedClip } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for clip processing

export async function GET(req: NextRequest) {
  const episodeId = req.nextUrl.searchParams.get('episodeId');

  if (!episodeId) {
    return NextResponse.json({ error: 'חסר episodeId' }, { status: 400 });
  }

  try {
    const allClips = await approvedClips.getAllAsync();
    const episodeClips = (allClips as ApprovedClip[])
      .filter(c => c.episodeId === episodeId)
      .sort((a, b) => (a.queuePosition ?? 999) - (b.queuePosition ?? 999));

    const processing = episodeClips.filter(c => c.status === 'processing').length;
    const queued = episodeClips.filter(c =>
      c.status === 'approved_for_processing' || c.status === 'queued'
    ).length;
    const completed = episodeClips.filter(c => c.status === 'completed').length;
    const failed = episodeClips.filter(c => c.status === 'failed').length;

    return NextResponse.json({
      episodeId,
      clips: episodeClips,
      summary: {
        total: episodeClips.length,
        processing,
        queued,
        completed,
        failed,
        maxConcurrent: MAX_CONCURRENT_CLIPS,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בטעינת התור';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const nextClips = await getNextClipsForProcessing();

    if (nextClips.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'אין קליפים בתור לעיבוד',
        startedCount: 0,
      });
    }

    const clipCount = nextClips.length;

    // Use after() to process clips in the background
    // Returns 202 immediately so the client isn't blocked
    after(async () => {
      try {
        const processed = await processNextClipBatch();
        console.log(`[episode-queue] Background processing completed: ${processed} clips`);
      } catch (err) {
        console.error('[episode-queue] Background processing error:', err);
      }
    });

    return NextResponse.json({
      success: true,
      message: `${clipCount} קליפים נכנסו לתור עיבוד`,
      startedCount: clipCount,
      startedClipIds: nextClips.map(c => c.id),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בהפעלת העיבוד';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
