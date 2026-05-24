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
import { runEpisodeAnalysis } from '@/lib/podcast-engine/episode-analyzer';
import { podcastEpisodes } from '@/lib/db/collections';
import { getSupabase } from '@/lib/db/store';

// Use getSupabase() which already uses SUPABASE_SERVICE_ROLE_KEY
const supabase = getSupabase();

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

async function findEpisode(episodeId: string) {
  // Try relational table first
  const { data, error } = await supabase
    .from('podcast_episodes')
    .select('id, status, source_file_path, audio_file_path, title, show_name, guest_names, language, source_file_size, client_id, metadata')
    .eq('id', episodeId)
    .single();

  if (!error && data) {
    console.log(`[episode-analyze] Found episode in relational table: ${episodeId}`);
    return data;
  }

  console.warn(`[episode-analyze] Relational lookup failed: ${error?.message}. Trying JSONB...`);

  // JSONB fallback — if found, COPY to relational table so all status updates work
  try {
    const items = await podcastEpisodes.getAllAsync();
    const found = (items as Record<string, any>[]).find(ep => ep.id === episodeId);
    if (found) {
      console.log(`[episode-analyze] Found episode in JSONB. Migrating to relational table...`);
      const row = {
        id: found.id,
        title: found.title || 'Untitled',
        status: found.status || 'uploaded',
        source_file_path: found.sourceFilePath || found.source_file_path || '',
        source_file_size: found.sourceFileSize || found.source_file_size || null,
        audio_file_path: found.audioFilePath || found.audio_file_path || null,
        show_name: found.showName || found.show_name || null,
        guest_names: found.guestNames || found.guest_names || null,
        language: found.language || 'he',
        client_id: found.clientId || found.client_id || null,
        processing_progress: found.processingProgress || found.processing_progress || {},
        metadata: found.metadata || {},
      };

      // Upsert into relational table so all subsequent updates work
      const { error: upsertErr } = await supabase
        .from('podcast_episodes')
        .upsert(row, { onConflict: 'id' });

      if (upsertErr) {
        console.error(`[episode-analyze] Failed to migrate episode to relational table:`, upsertErr.message);
        // Still return the data — updates might fail but at least the analysis can try
      } else {
        console.log(`[episode-analyze] Episode migrated to relational table successfully`);
      }

      return {
        id: row.id,
        status: row.status,
        source_file_path: row.source_file_path,
        audio_file_path: row.audio_file_path,
      };
    }
  } catch (e) {
    console.error(`[episode-analyze] JSONB fallback failed:`, e);
  }

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
    const { data: updateData, error: updateError } = await supabase
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
      .eq('id', episodeId)
      .select('id, status')
      .single();

    if (updateError) {
      console.error(`[episode-analyze] Failed to set status=analyzing:`, updateError.message);
    } else {
      console.log(`[episode-analyze] Status set to analyzing:`, updateData?.id, updateData?.status);
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
