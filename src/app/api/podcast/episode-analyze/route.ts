/**
 * POST /api/podcast/episode-analyze — trigger episode analysis pipeline
 *
 * Replaces the old /api/podcast/process for the new Episode Clip Extraction flow.
 * Instead of saving clips directly, this:
 *   1. Runs analysis (validate → download → transcribe → segment → AI → score)
 *   2. Saves EpisodeAnalysis record
 *   3. Saves PodcastClipCandidate records with candidateStatus='suggested'
 *   4. Updates episode status to 'candidates_ready'
 *
 * Returns 202 immediately, runs pipeline in background via next/server after().
 */

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { runEpisodeAnalysis } from '@/lib/podcast-engine/episode-analyzer';
import { podcastEpisodes } from '@/lib/db/collections';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

async function findEpisode(episodeId: string) {
  // Try relational table first
  const sb = getSupabase();
  const { data, error } = await sb
    .from('podcast_episodes')
    .select('id, status, source_file_path')
    .eq('id', episodeId)
    .single();

  if (!error && data) return data;

  // JSONB fallback
  try {
    const items = await podcastEpisodes.getAllAsync();
    const found = (items as Record<string, any>[]).find(ep => ep.id === episodeId);
    if (found) {
      return {
        id: found.id,
        status: found.status || 'uploaded',
        source_file_path: found.sourceFilePath || found.source_file_path || '',
      };
    }
  } catch {}

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { episodeId } = body;

    if (!episodeId) {
      return NextResponse.json({ error: 'חסר episodeId' }, { status: 400 });
    }

    const episode = await findEpisode(episodeId);
    if (!episode) {
      return NextResponse.json({ error: 'הפרק לא נמצא' }, { status: 404 });
    }

    // Prevent re-analysis if already in progress
    if (episode.status === 'analyzing' || episode.status === 'processing') {
      return NextResponse.json(
        { error: 'הפרק כבר בתהליך ניתוח' },
        { status: 409 }
      );
    }

    // Mark as analyzing immediately
    const sb2 = getSupabase();
    await sb2
      .from('podcast_episodes')
      .update({
        status: 'analyzing',
        error_message: null,
        processing_progress: {
          stage: 1,
          stageName: 'אימות קובץ',
          percent: 0,
          statusText: 'מתחיל ניתוח פרק...',
          startedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', episodeId);

    // Run in background
    after(async () => {
      await runEpisodeAnalysis(episodeId, episode.source_file_path);
    });

    return NextResponse.json(
      { success: true, message: 'הניתוח התחיל', episodeId },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `שגיאה בהפעלת הניתוח: ${message}` },
      { status: 500 }
    );
  }
}
