/**
 * Clip Processor — Processes a single approved clip through the pipeline
 *
 * This is the "Single Clip Flow" integration for Phase 6.
 * Takes an ApprovedClip record and:
 *   1. Downloads the source episode video from Storage
 *   2. Extracts the clip segment (startTime → endTime)
 *   3. Creates a podcast_clip_candidates record (old format for render pipeline)
 *   4. Marks the clip as completed
 *
 * On Vercel Serverless: no FFmpeg available, so we store the clip metadata
 * and let the existing render pipeline handle the actual video extraction.
 */

import { createClient } from '@supabase/supabase-js';
import {
  markClipProcessing,
  markClipCompleted,
  markClipFailed,
  getNextClipsForProcessing,
} from './clip-approval-engine';
import { approvedClips } from '@/lib/db/collections';
import type { ApprovedClip } from '@/lib/db/schema';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Process a single approved clip ──────────────────────────────────────────

/**
 * Process a single approved clip through the Single Clip Flow.
 * Creates a clip record in the old podcast_clip_candidates format
 * so the existing render pipeline can pick it up.
 */
export async function processApprovedClip(clip: ApprovedClip): Promise<void> {
  console.log(`[clip-processor] Processing clip ${clip.id}: "${clip.title}" (${clip.startTime}s → ${clip.endTime}s)`);

  try {
    // Mark as processing
    await markClipProcessing(clip.id);

    // Update episode status to 'processing_clips' if not already
    await supabase
      .from('podcast_episodes')
      .update({
        status: 'processing_clips',
        updated_at: new Date().toISOString(),
      })
      .eq('id', clip.episodeId);

    // Create a clip record that the existing render pipeline understands.
    // The render pipeline expects podcast_clip_candidates with specific fields.
    // We insert into the existing table format so the render route can find it.
    const clipRecord = {
      episode_id: clip.episodeId,
      title: clip.title,
      start_time: clip.startTime,
      end_time: clip.endTime,
      duration: clip.duration,
      description: clip.description || '',
      transcript_excerpt: clip.transcriptSnippet || '',
      viral_score: clip.viralScore,
      engagement_score: clip.engagementScore,
      hook_score: clip.confidenceScore ?? 0,
      topic_tags: [],
      source_video_id: clip.sourceEpisodeVideoId,
      approved_clip_id: clip.id,
      status: 'ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Try inserting into the relational podcast_clip_candidates table
    const { error: insertError } = await supabase
      .from('podcast_clip_candidates')
      .insert(clipRecord);

    if (insertError) {
      console.warn(`[clip-processor] Could not insert clip to relational table: ${insertError.message}`);
      // The clip metadata is already in the ApprovedClip — the render pipeline
      // can be pointed to use that instead. Mark as ready_for_single_clip_flow.
      await approvedClips.updateAsync(clip.id, {
        status: 'ready_for_single_clip_flow',
        updatedAt: new Date().toISOString(),
      } as Partial<ApprovedClip>);

      // Still mark completed since the data is ready for rendering
      await markClipCompleted(clip.id);
      return;
    }

    // Mark the approved clip as completed
    await markClipCompleted(clip.id);

    console.log(`[clip-processor] Clip ${clip.id} processed successfully`);

    // Check if all clips for this episode are done
    await checkEpisodeCompletion(clip.episodeId);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[clip-processor] Failed to process clip ${clip.id}:`, message);
    await markClipFailed(clip.id, message);
  }
}

// ── Process next batch of clips ─────────────────────────────────────────────

/**
 * Process the next batch of approved clips (respects concurrency limit).
 * Returns the number of clips that were started.
 */
export async function processNextClipBatch(): Promise<number> {
  const nextClips = await getNextClipsForProcessing();

  if (nextClips.length === 0) {
    console.log('[clip-processor] No clips available for processing');
    return 0;
  }

  console.log(`[clip-processor] Starting ${nextClips.length} clip(s) for processing`);

  // Process clips in parallel (within the concurrency limit)
  const results = await Promise.allSettled(
    nextClips.map(clip => processApprovedClip(clip))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  if (failed > 0) {
    console.warn(`[clip-processor] ${failed} clip(s) failed processing`);
  }

  // After processing, check if more clips are waiting
  const moreClips = await getNextClipsForProcessing();
  if (moreClips.length > 0) {
    console.log(`[clip-processor] ${moreClips.length} more clip(s) waiting in queue`);
  }

  return succeeded;
}

// ── Check if all episode clips are done ─────────────────────────────────────

async function checkEpisodeCompletion(episodeId: string): Promise<void> {
  const allClips = await approvedClips.getAllAsync();
  const episodeClips = (allClips as ApprovedClip[]).filter(
    c => c.episodeId === episodeId
  );

  const totalClips = episodeClips.length;
  const completedClips = episodeClips.filter(c => c.status === 'completed').length;
  const failedClips = episodeClips.filter(c => c.status === 'failed').length;

  if (completedClips + failedClips === totalClips) {
    // All clips processed — update episode status
    const finalStatus = failedClips === totalClips ? 'error' : 'processed';
    await supabase
      .from('podcast_episodes')
      .update({
        status: finalStatus,
        processing_progress: {
          stage: 7,
          stageName: 'הושלם',
          percent: 100,
          statusText: `${completedClips} קליפים הושלמו, ${failedClips} נכשלו`,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', episodeId);

    console.log(`[clip-processor] Episode ${episodeId} complete: ${completedClips} succeeded, ${failedClips} failed`);
  }
}
