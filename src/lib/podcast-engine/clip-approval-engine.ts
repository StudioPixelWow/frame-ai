/**
 * Clip Approval Engine — Creates ApprovedClip records from user-approved candidates
 *
 * Critical rules from spec:
 *   - NO clips saved to DB before user approval
 *   - NO processing before approval
 *   - Only after explicit user approval: create ApprovedClip records
 *   - Queue approved clips for processing with concurrency limit
 *
 * Flow:
 *   1. User reviews candidates on UI (candidateStatus='suggested')
 *   2. User approves/rejects/edits each candidate
 *   3. This engine creates ApprovedClip records for approved candidates
 *   4. Approved clips are queued for Single Clip Flow processing
 */

import { approvedClips, podcastClipCandidates, podcastEpisodes } from '@/lib/db/collections';
import type { ApprovedClip, PodcastClipCandidate, ClipCandidateStatus } from '@/lib/db/schema';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uaruggdabeyiuppcvbbi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/** Max concurrent clip processing jobs */
export const MAX_CONCURRENT_CLIPS = 2;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClipApprovalInput {
  candidateId: string;
  /** User may have adjusted the time range */
  startTime?: number;
  endTime?: number;
  /** User may have edited the title */
  title?: string;
}

export interface ApprovalResult {
  success: boolean;
  approvedClipIds: string[];
  totalApproved: number;
  error?: string;
}

// ── Approve candidates ────────────────────────────────────────────────────────

/**
 * Approve a batch of clip candidates.
 * Creates ApprovedClip records and updates candidate statuses.
 * Clips are queued in order for processing through Single Clip Flow.
 */
export async function approveClipCandidates(
  episodeId: string,
  approvals: ClipApprovalInput[],
  sourceEpisodeVideoId: string,
  projectId?: string
): Promise<ApprovalResult> {
  const approvedIds: string[] = [];

  try {
    // Load all candidates for this episode to validate
    const allCandidates = await podcastClipCandidates.getAllAsync();
    const episodeCandidates = (allCandidates as PodcastClipCandidate[]).filter(
      c => c.episodeId === episodeId
    );

    for (let i = 0; i < approvals.length; i++) {
      const approval = approvals[i];

      // Find the candidate
      const candidate = episodeCandidates.find(c => c.id === approval.candidateId);
      if (!candidate) {
        console.warn(`[clip-approval] Candidate not found: ${approval.candidateId}`);
        continue;
      }

      // Use user-adjusted values if provided, otherwise use candidate values
      const startTime = approval.startTime ?? candidate.userAdjustedStart ?? candidate.startTime;
      const endTime = approval.endTime ?? candidate.userAdjustedEnd ?? candidate.endTime;
      const title = approval.title ?? candidate.title;
      const duration = endTime - startTime;

      // Create ApprovedClip record
      const approvedClipData: Omit<ApprovedClip, 'id'> = {
        episodeId,
        projectId: projectId || null,
        clipCandidateId: candidate.id,
        sourceEpisodeVideoId,
        startTime,
        endTime,
        duration,
        title,
        description: candidate.description || candidate.reasoning || '',
        transcriptSnippet: candidate.transcriptExcerpt || '',
        viralScore: candidate.viralScore,
        engagementScore: candidate.engagementScore,
        confidenceScore: candidate.confidenceScore ?? Math.round(
          (candidate.viralScore + candidate.engagementScore + candidate.hookScore) / 3
        ),
        status: 'approved_for_processing',
        queuePosition: i + 1,
        pipelineStateId: null,
        errorMessage: null,
        retryCount: 0,
        approvedAt: new Date().toISOString(),
        processingStartedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await approvedClips.createAsync(approvedClipData as ApprovedClip);
      approvedIds.push(saved.id);

      // Update candidate status to 'approved'
      await podcastClipCandidates.updateAsync(candidate.id, {
        candidateStatus: 'approved' as ClipCandidateStatus,
        updatedAt: new Date().toISOString(),
      } as Partial<PodcastClipCandidate>);
    }

    // Update episode status to 'clips_approved' — try relational first, then JSONB
    console.log(`[clip-approval] Updating episode ${episodeId} status to clips_approved`);

    const { error: relError } = await supabase
      .from('podcast_episodes')
      .update({
        status: 'clips_approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', episodeId);

    if (relError) {
      console.warn(`[clip-approval] Relational update failed: ${relError.message}, trying JSONB...`);
    }

    // Also update JSONB table (episode may live here instead of relational table)
    try {
      const allEpisodes = await podcastEpisodes.getAllAsync();
      const ep = (allEpisodes as any[]).find(e => e.id === episodeId);
      if (ep) {
        await podcastEpisodes.updateAsync(episodeId, {
          status: 'clips_approved',
          updatedAt: new Date().toISOString(),
        } as any);
        console.log(`[clip-approval] JSONB episode status updated to clips_approved`);
      } else {
        console.log(`[clip-approval] Episode not found in JSONB table, relational update was: ${relError ? 'failed' : 'ok'}`);
      }
    } catch (jsonbErr) {
      console.warn(`[clip-approval] JSONB fallback update failed:`, jsonbErr);
    }

    return {
      success: true,
      approvedClipIds: approvedIds,
      totalApproved: approvedIds.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[clip-approval] Error approving clips for episode ${episodeId}:`, message);
    return {
      success: false,
      approvedClipIds: approvedIds,
      totalApproved: approvedIds.length,
      error: message,
    };
  }
}

// ── Reject candidates ─────────────────────────────────────────────────────────

/**
 * Reject specific clip candidates (user explicitly doesn't want them).
 */
export async function rejectClipCandidates(
  episodeId: string,
  candidateIds: string[]
): Promise<void> {
  for (const id of candidateIds) {
    await podcastClipCandidates.updateAsync(id, {
      candidateStatus: 'rejected' as ClipCandidateStatus,
      updatedAt: new Date().toISOString(),
    } as Partial<PodcastClipCandidate>);
  }
}

// ── Update candidate (user edits) ─────────────────────────────────────────────

/**
 * Update a clip candidate with user edits (time range, title, etc.).
 * Does NOT approve — just saves changes with candidateStatus='edited_by_user'.
 */
export async function editClipCandidate(
  candidateId: string,
  updates: {
    startTime?: number;
    endTime?: number;
    title?: string;
    description?: string;
  }
): Promise<PodcastClipCandidate | null> {
  const updateData: Record<string, unknown> = {
    candidateStatus: 'edited_by_user' as ClipCandidateStatus,
    updatedAt: new Date().toISOString(),
  };

  if (updates.startTime !== undefined) {
    updateData.userAdjustedStart = updates.startTime;
  }
  if (updates.endTime !== undefined) {
    updateData.userAdjustedEnd = updates.endTime;
  }
  if (updates.title !== undefined) {
    updateData.title = updates.title;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }

  return await podcastClipCandidates.updateAsync(
    candidateId,
    updateData as Partial<PodcastClipCandidate>
  );
}

// ── Queue management ──────────────────────────────────────────────────────────

/**
 * Get the next batch of approved clips that should be processed.
 * Respects concurrency limit — only returns clips if fewer than
 * MAX_CONCURRENT_CLIPS are currently processing.
 */
export async function getNextClipsForProcessing(): Promise<ApprovedClip[]> {
  const allClips = await approvedClips.getAllAsync();
  const clips = allClips as ApprovedClip[];

  // Count currently processing
  const processingCount = clips.filter(c => c.status === 'processing').length;

  if (processingCount >= MAX_CONCURRENT_CLIPS) {
    return [];
  }

  // Get queued clips sorted by queuePosition
  const availableSlots = MAX_CONCURRENT_CLIPS - processingCount;
  const queuedClips = clips
    .filter(c => c.status === 'approved_for_processing' || c.status === 'queued')
    .sort((a, b) => (a.queuePosition ?? 999) - (b.queuePosition ?? 999))
    .slice(0, availableSlots);

  return queuedClips;
}

/**
 * Mark an approved clip as processing (being fed into Single Clip Flow).
 */
export async function markClipProcessing(
  clipId: string,
  pipelineStateId?: string
): Promise<void> {
  await approvedClips.updateAsync(clipId, {
    status: 'processing',
    pipelineStateId: pipelineStateId || null,
    processingStartedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Partial<ApprovedClip>);
}

/**
 * Mark an approved clip as completed.
 */
export async function markClipCompleted(clipId: string): Promise<void> {
  await approvedClips.updateAsync(clipId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Partial<ApprovedClip>);
}

/**
 * Mark an approved clip as failed.
 */
export async function markClipFailed(clipId: string, errorMessage: string): Promise<void> {
  const clip = await approvedClips.getByIdAsync(clipId);
  if (!clip) return;

  const currentRetry = (clip as ApprovedClip).retryCount || 0;
  await approvedClips.updateAsync(clipId, {
    status: 'failed',
    errorMessage,
    retryCount: currentRetry + 1,
    updatedAt: new Date().toISOString(),
  } as Partial<ApprovedClip>);
}
