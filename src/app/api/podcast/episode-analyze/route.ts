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

// LAZY initialization — avoid crashing the module if env vars aren't ready at import time
let _supabase: ReturnType<typeof getSupabase> | null = null;
function getSb() {
  if (!_supabase) _supabase = getSupabase();
  return _supabase;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

async function findEpisode(episodeId: string) {
  const supabase = getSb();

  // Try relational table first
  const { data, error } = await supabase
    .from('podcast_episodes')
    .select('id, status, source_file_path, audio_file_path, title, show_name, guest_names, language, source_file_size, client_id, metadata')
    .eq('id', episodeId)
    .single();

  if (!error && data) {
    console.log(`[episode-analyze] Found episode in relational table: ${episodeId}, status=${data.status}, audio=${data.audio_file_path || 'NONE'}`);
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

/** Write error status to DB so the frontend polling can detect it */
async function writeErrorToDB(episodeId: string, errorMessage: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    const supabase = getSb();
    const { error } = await supabase.from('podcast_episodes').update({
      status: 'error',
      error_message: errorMessage,
      updated_at: now,
    }).eq('id', episodeId);
    if (error) {
      console.error(`[episode-analyze] Failed to write error to relational DB:`, error.message);
    } else {
      console.log(`[episode-analyze] Error written to DB for ${episodeId}: ${errorMessage.slice(0, 100)}`);
    }
  } catch (dbErr) {
    console.error(`[episode-analyze] writeErrorToDB relational crashed:`, dbErr);
  }

  // JSONB fallback — so polling always sees the error regardless of which table episode lives in
  try {
    await podcastEpisodes.updateAsync(episodeId, {
      status: 'error',
      errorMessage,
      error_message: errorMessage,
      updatedAt: now,
      updated_at: now,
    } as any);
  } catch {}
}

export async function POST(req: NextRequest) {
  let episodeId: string | undefined;

  try {
    const body = await req.json();
    episodeId = body.episodeId;

    console.log(`[episode-analyze] === POST received === episodeId=${episodeId}`);

    if (!episodeId) {
      return NextResponse.json({ error: 'חסר episodeId' }, { status: 400 });
    }

    const supabase = getSb();

    const episode = await findEpisode(episodeId);
    if (!episode) {
      console.error(`[episode-analyze] Episode NOT FOUND in any table: ${episodeId}`);
      return NextResponse.json({ error: 'הפרק לא נמצא' }, { status: 404 });
    }

    console.log(`[episode-analyze] Episode found: id=${episode.id}, status=${episode.status}, source=${episode.source_file_path}, audio=${episode.audio_file_path || 'NONE'}`);

    // Prevent re-analysis if already in progress
    if (episode.status === 'analyzing' || episode.status === 'processing') {
      console.warn(`[episode-analyze] Skipping — already ${episode.status}`);
      return NextResponse.json(
        { error: 'הפרק כבר בתהליך ניתוח' },
        { status: 409 }
      );
    }

    // Mark as analyzing immediately
    const now = new Date().toISOString();
    const initialProgress = {
      stage: 1,
      stageName: 'אימות קובץ',
      percent: 0,
      statusText: 'מתחיל ניתוח פרק...',
      startedAt: now,
    };

    const { data: updateData, error: updateError } = await supabase
      .from('podcast_episodes')
      .update({
        status: 'analyzing',
        error_message: null,
        processing_progress: initialProgress,
        updated_at: now,
      })
      .eq('id', episodeId)
      .select('id, status')
      .single();

    if (updateError) {
      console.error(`[episode-analyze] CRITICAL: Failed to set status=analyzing in relational:`, updateError.message);
    } else {
      console.log(`[episode-analyze] Status set to analyzing OK: id=${updateData?.id} status=${updateData?.status}`);
    }

    // JSONB fallback — so polling always sees analyzing status regardless of which table episode lives in
    try {
      await podcastEpisodes.updateAsync(episodeId, {
        status: 'analyzing',
        errorMessage: null,
        error_message: null,
        processingProgress: initialProgress,
        processing_progress: initialProgress,
        updatedAt: now,
        updated_at: now,
      } as any);
      console.log(`[episode-analyze] JSONB status=analyzing also set`);
    } catch (jsonbErr) {
      // Non-critical
    }

    // Run the analysis inline — the function stays alive for up to maxDuration (300s).
    // The frontend does NOT await this response; it polls via a separate endpoint.
    console.log(`[episode-analyze] Starting analysis for ${episodeId} (source=${episode.source_file_path}, audio=${episode.audio_file_path || 'NONE'})`);
    try {
      const result = await runEpisodeAnalysis(
        episodeId,
        episode.source_file_path,
        episode.audio_file_path || undefined
      );
      console.log(`[episode-analyze] Analysis completed for ${episodeId}: success=${result.success}, candidates=${result.candidateCount}`);

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

      await writeErrorToDB(episodeId, `שגיאת עיבוד: ${errMsg}`);

      return NextResponse.json(
        { error: `שגיאת ניתוח: ${errMsg}`, episodeId },
        { status: 500 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[episode-analyze] OUTER CATCH for episodeId=${episodeId}:`, message);

    // CRITICAL: Write error to DB even for outer exceptions so polling detects it
    if (episodeId) {
      await writeErrorToDB(episodeId, `שגיאה בהפעלת הניתוח: ${message}`);
    }

    return NextResponse.json(
      { error: `שגיאה בהפעלת הניתוח: ${message}` },
      { status: 500 }
    );
  }
}
