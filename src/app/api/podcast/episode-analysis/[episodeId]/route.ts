/**
 * GET /api/podcast/episode-analysis/:episodeId — load analysis + candidates for review
 *
 * Returns:
 *   - EpisodeAnalysis data (topic segments, silences, engagement moments)
 *   - All PodcastClipCandidate records for this episode
 *   - Episode metadata (status, progress)
 */

import { NextRequest, NextResponse } from 'next/server';
import { episodeAnalyses, podcastClipCandidates } from '@/lib/db/collections';
import { createClient } from '@supabase/supabase-js';
import type { EpisodeAnalysis, PodcastClipCandidate } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ episodeId: string }> };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(_req: NextRequest, context: Params) {
  const { episodeId } = await context.params;

  try {
    // Get episode info
    const { data: episode, error: epError } = await supabase
      .from('podcast_episodes')
      .select('id, status, title, processing_progress, error_message, source_file_path, duration_seconds')
      .eq('id', episodeId)
      .single();

    if (epError || !episode) {
      return NextResponse.json({ error: 'הפרק לא נמצא' }, { status: 404 });
    }

    // Get analysis for this episode
    const allAnalyses = await episodeAnalyses.getAllAsync();
    const analysis = (allAnalyses as EpisodeAnalysis[]).find(
      a => a.episodeId === episodeId
    ) || null;

    // Get candidates for this episode
    const allCandidates = await podcastClipCandidates.getAllAsync();
    const candidates = (allCandidates as PodcastClipCandidate[])
      .filter(c => c.episodeId === episodeId)
      .sort((a, b) => (a.clipIndex ?? 999) - (b.clipIndex ?? 999));

    return NextResponse.json({
      episode: {
        id: episode.id,
        status: episode.status,
        title: episode.title,
        processingProgress: episode.processing_progress,
        errorMessage: episode.error_message,
        sourceFilePath: episode.source_file_path,
        durationSeconds: episode.duration_seconds,
      },
      analysis: analysis ? {
        id: analysis.id,
        topicSegments: analysis.topicSegments,
        silences: analysis.silences,
        deadMoments: analysis.deadMoments,
        speakerChanges: analysis.speakerChanges,
        highEngagementMoments: analysis.highEngagementMoments,
        durationSeconds: analysis.durationSeconds,
        analyzedAt: analysis.analyzedAt,
      } : null,
      candidates,
      summary: {
        totalCandidates: candidates.length,
        suggested: candidates.filter(c => c.candidateStatus === 'suggested').length,
        approved: candidates.filter(c => c.candidateStatus === 'approved').length,
        rejected: candidates.filter(c => c.candidateStatus === 'rejected').length,
        edited: candidates.filter(c => c.candidateStatus === 'edited_by_user').length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בטעינת הניתוח';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
