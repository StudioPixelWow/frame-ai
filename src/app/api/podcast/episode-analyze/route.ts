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
 * Runs the analysis inline (synchronous) within maxDuration=300s.
 * The frontend fires this request without awaiting the response and polls
 * the episode status via a separate endpoint. No after() needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runEpisodeAnalysis } from '@/lib/podcast-engine/episode-analyzer';
import { podcastEpisodes } from '@/lib/db/collections';
// getSupabase removed — using service role createClient directly to bypass RLS

// Use service role key — same as episode-analyzer.ts — to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

async function findEpisode(episodeId: string) {
  // Try relational table first — use service role to bypass RLS
  const { data, error } = await supabase
    .from('podcast_episodes')
    .select('id, status, source_file_path, audio_file_path')
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
        audio_file_path: found.audioFilePath || found.audio_file_path || null,
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

    // Mark as analyzing immediately — use service role to bypass RLS
    const { error: updateError } = await supabase
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

    if (updateError) {
      console.error(`[episode-analyze] Failed to set status=analyzing:`, updateError.message);
    }

    // Run the analysis inline — the function stays alive for up to maxDuration (300s).
    // The frontend does NOT await this response; it polls via a separate endpoint.
    console.log(`[episode-analyze] Starting analysis inline for ${episodeId}`);
    try {
      const result = await runEpisodeAnalysis(
        episodeId,
        episode.source_file_path,
        episode.audio_file_path || undefined
      );
      console.log(`[episode-analyze] Analysis completed for ${episodeId}:`, result.success);

      return NextResponse.json(
        {
          success: true,
          message: 'הניתוח הושלם',
          episodeId,
          candidateCount: result.candidateCount ?? 0,
        },
        { status: 200 }
      );
    } catch (analysisErr) {
      const errMsg = analysisErr instanceof Error ? analysisErr.message : String(analysisErr);
      console.error(`[episode-analyze] Analysis FAILED for ${episodeId}:`, errMsg);

      // Write error to DB so frontend polling can detect it
      try {
        await supabase.from('podcast_episodes').update({
          status: 'error',
          error_message: `שגיאת עיבוד: ${errMsg}`,
          updated_at: new Date().toISOString(),
        }).eq('id', episodeId);
      } catch (dbErr) {
        console.error(`[episode-analyze] Failed to write error to DB:`, dbErr);
      }

      return NextResponse.json(
        { error: `שגיאת ניתוח: ${errMsg}`, episodeId },
        { status: 500 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `שגיאה בהפעלת הניתוח: ${message}` },
      { status: 500 }
    );
  }
}
