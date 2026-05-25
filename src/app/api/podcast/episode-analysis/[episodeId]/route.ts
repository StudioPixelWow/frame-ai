/**
 * GET /api/podcast/episode-analysis/:episodeId — load analysis + candidates for review
 *
 * Returns:
 *   - EpisodeAnalysis data (topic segments, silences, engagement moments)
 *   - All PodcastClipCandidate records for this episode
 *   - Episode metadata (status, progress)
 */

import { NextRequest, NextResponse } from 'next/server';
import { episodeAnalyses, podcastClipCandidates, podcastEpisodes } from '@/lib/db/collections';
import { getSupabase } from '@/lib/db/store';
import type { EpisodeAnalysis, PodcastClipCandidate } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ episodeId: string }> };

export async function GET(_req: NextRequest, context: Params) {
  const { episodeId } = await context.params;

  try {
    // Get episode info — try relational first, then JSONB fallback
    const supabase = getSupabase();
    let episode: Record<string, any> | null = null;

    const { data, error: epError } = await supabase
      .from('podcast_episodes')
      .select('id, status, title, processing_progress, error_message, source_file_path, duration_seconds')
      .eq('id', episodeId)
      .single();

    if (!epError && data) {
      episode = data;
    } else {
      // JSONB fallback — episode might only exist in app_podcast_episodes
      console.log(`[episode-analysis] Relational lookup failed (${epError?.message}), trying JSONB...`);
      try {
        const items = await podcastEpisodes.getAllAsync();
        const found = (items as Record<string, any>[]).find(ep => ep.id === episodeId);
        if (found) {
          episode = {
            id: found.id,
            status: found.status || 'uploaded',
            title: found.title || 'ללא כותרת',
            processing_progress: found.processingProgress || found.processing_progress || {},
            error_message: found.errorMessage || found.error_message || null,
            source_file_path: found.sourceFilePath || found.source_file_path || '',
            duration_seconds: found.durationSeconds || found.duration_seconds || null,
          };
          console.log(`[episode-analysis] Found episode in JSONB: ${episodeId}`);
        }
      } catch (jsonbErr) {
        console.error(`[episode-analysis] JSONB fallback failed:`, jsonbErr);
      }
    }

    if (!episode) {
      return NextResponse.json({ error: 'הפרק לא נמצא' }, { status: 404 });
    }

    // Generate signed URL for video playback
    let videoUrl = '';
    const filePath = episode.source_file_path;
    if (filePath) {
      const { data: signedData } = await supabase
        .storage
        .from('project-files')
        .createSignedUrl(filePath, 3600); // 1 hour validity
      videoUrl = signedData?.signedUrl || '';
      if (!videoUrl) {
        console.warn(`[episode-analysis] Could not generate signed URL for: ${filePath}`);
      }
    }

    // Get analysis for this episode
    let analysis: EpisodeAnalysis | null = null;
    try {
      const allAnalyses = await episodeAnalyses.getAllAsync();
      console.log(`[episode-analysis] Total analyses in DB: ${(allAnalyses as any[]).length}`);
      analysis = (allAnalyses as EpisodeAnalysis[]).find(
        a => a.episodeId === episodeId
      ) || null;
      console.log(`[episode-analysis] Found analysis for episode: ${!!analysis}`);
    } catch (analysisErr) {
      console.error(`[episode-analysis] Failed to load analyses:`, analysisErr);
    }

    // Get candidates for this episode
    let candidates: PodcastClipCandidate[] = [];
    try {
      const allCandidates = await podcastClipCandidates.getAllAsync();
      console.log(`[episode-analysis] Total candidates in DB: ${(allCandidates as any[]).length}, filtering for episodeId=${episodeId}`);
      if ((allCandidates as any[]).length > 0) {
        const sample = allCandidates[0] as any;
        console.log(`[episode-analysis] Sample candidate keys: ${Object.keys(sample).join(', ')}`);
        console.log(`[episode-analysis] Sample candidate episodeId: "${sample.episodeId}" vs requested: "${episodeId}"`);
      }
      candidates = (allCandidates as PodcastClipCandidate[])
        .filter(c => c.episodeId === episodeId)
        .sort((a, b) => (a.clipIndex ?? 999) - (b.clipIndex ?? 999));
      console.log(`[episode-analysis] Matched candidates: ${candidates.length}`);
    } catch (candidatesErr) {
      console.error(`[episode-analysis] Failed to load candidates:`, candidatesErr);
    }

    return NextResponse.json({
      episode: {
        id: episode.id,
        status: episode.status,
        title: episode.title,
        processingProgress: episode.processing_progress,
        errorMessage: episode.error_message,
        sourceFilePath: videoUrl || episode.source_file_path, // Use signed URL for playback
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
