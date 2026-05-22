/**
 * Episode Analyzer — Full Episode Analysis + Candidate Detection Engine
 *
 * This is the refactored processing pipeline for the Episode Clip Extraction flow.
 * Key difference from the old pipeline:
 *   - Does NOT save clips as final records
 *   - Saves EpisodeAnalysis with full analysis data
 *   - Saves PodcastClipCandidate with candidateStatus='suggested'
 *   - Updates episode status to 'candidates_ready' / 'awaiting_user_approval'
 *   - NO processing starts — clips only become real after user approval
 *
 * Pipeline stages:
 *   1. Validate — check file exists in Storage
 *   2. Download — download file from Storage to tmp
 *   3. Transcribe — Whisper API (25MB limit)
 *   4. Segment Topics — local vocabulary-shift algorithm
 *   5. AI Analysis — Claude Haiku for clip candidate detection
 *   6. Score & Save — deterministic scoring + save analysis + candidates
 */

import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { transcribeAudio, transcribeChunkedAudio } from './whisper-transcription';
import { splitAudioIntoChunks } from './ffmpeg-service';
import { segmentTranscript, type TranscriptSegment, type TopicSegment } from './topic-segmentation';
import { analyzeTranscriptForClips, type AIClipSuggestion } from './clip-analyzer';
import { scoreClipCandidates, rankClips, type RawClipCandidate, type ScoredClip } from './clip-scorer';
import { episodeAnalyses, podcastClipCandidates } from '@/lib/db/collections';
import type { EpisodeAnalysis, PodcastClipCandidate } from '@/lib/db/schema';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Maximum file size Whisper API accepts (25MB). */
const WHISPER_MAX_FILE_SIZE = 25 * 1024 * 1024;

// ── Stage definitions ─────────────────────────────────────────────────────────

export const ANALYSIS_STAGES = [
  { stage: 1, stageName: 'אימות קובץ' },
  { stage: 2, stageName: 'הכנת קובץ' },
  { stage: 3, stageName: 'תמלול' },
  { stage: 4, stageName: 'פילוח נושאים' },
  { stage: 5, stageName: 'ניתוח AI' },
  { stage: 6, stageName: 'שמירת ניתוח ומועמדים' },
] as const;

// ── Progress helpers ──────────────────────────────────────────────────────────

async function updateEpisodeProgress(
  episodeId: string,
  stageIndex: number,
  percent: number,
  statusText?: string
): Promise<void> {
  const { stage, stageName } = ANALYSIS_STAGES[stageIndex];
  await supabase
    .from('podcast_episodes')
    .update({
      status: 'analyzing',
      processing_progress: {
        stage,
        stageName,
        percent: Math.round(percent),
        statusText: statusText || stageName,
        startedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', episodeId);
}

async function markEpisodeError(episodeId: string, errorMessage: string): Promise<void> {
  await supabase
    .from('podcast_episodes')
    .update({
      status: 'error',
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', episodeId);
}

async function markEpisodeCandidatesReady(episodeId: string, candidateCount: number): Promise<void> {
  await supabase
    .from('podcast_episodes')
    .update({
      status: 'candidates_ready',
      processing_progress: {
        stage: 6,
        stageName: 'מוכן לבחירה',
        percent: 100,
        statusText: `נמצאו ${candidateCount} קליפים מומלצים — ממתין לאישור`,
        startedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', episodeId);
}

// ── Analysis result type ──────────────────────────────────────────────────────

export interface AnalysisResult {
  success: boolean;
  episodeId: string;
  analysisId?: string;
  candidateCount?: number;
  error?: string;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

/**
 * Run the full episode analysis pipeline.
 * This does NOT create final clip records — only analysis + suggested candidates.
 */
export async function runEpisodeAnalysis(
  episodeId: string,
  sourceFilePath: string
): Promise<AnalysisResult> {
  let tempFilePath: string | null = null;

  try {
    // ── Stage 1: Validate — check file exists in Storage ──────────────────
    await updateEpisodeProgress(episodeId, 0, 0, 'מאתר את הקובץ בשרת...');

    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('project-files')
      .list('', {
        search: sourceFilePath.split('/').pop() ?? '',
      });

    if (fileError || !fileData || fileData.length === 0) {
      throw new Error(`קובץ לא נמצא ב-Storage: ${sourceFilePath}`);
    }

    await updateEpisodeProgress(episodeId, 0, 100, 'הקובץ אומת בהצלחה');

    // ── Stage 2: Download — download file from Storage to tmp ─────────────
    await updateEpisodeProgress(episodeId, 1, 0, 'מוריד את הקובץ מהשרת...');

    const { data: fileBlob, error: downloadError } = await supabase
      .storage
      .from('project-files')
      .download(sourceFilePath);

    if (downloadError || !fileBlob) {
      throw new Error(`שגיאה בהורדת הקובץ: ${downloadError?.message ?? 'לא התקבל קובץ'}`);
    }

    const blobArrayBuffer = await fileBlob.arrayBuffer();
    const fileSizeBytes = blobArrayBuffer.byteLength;

    // Write to temp for Whisper API
    const tempDir = join(tmpdir(), `episode-analysis-${episodeId}`);
    await mkdir(tempDir, { recursive: true });
    const ext = sourceFilePath.split('.').pop() || 'mp4';
    tempFilePath = join(tempDir, `source.${ext}`);
    await writeFile(tempFilePath, Buffer.from(blobArrayBuffer));

    await updateEpisodeProgress(episodeId, 1, 100, 'הקובץ הורד בהצלחה');

    // ── Stage 3: Transcribe — Whisper API ────────────────────────────────
    await updateEpisodeProgress(episodeId, 2, 0, 'מתמלל עם Whisper AI...');

    let fullText: string;
    let transcriptSegments: unknown[];

    // Auto-chunk large files (Whisper API limit is 25MB)
    if (fileSizeBytes > WHISPER_MAX_FILE_SIZE) {
      const sizeMB = Math.round(fileSizeBytes / 1024 / 1024);
      const CHUNK_DURATION_SEC = 10 * 60; // 10 minutes per chunk

      await updateEpisodeProgress(episodeId, 2, 5, `הקובץ גדול (${sizeMB}MB) — מפצל לקטעים לתמלול...`);

      const chunks = await splitAudioIntoChunks(tempFilePath, CHUNK_DURATION_SEC, tempDir);

      await updateEpisodeProgress(episodeId, 2, 15, `מתמלל ${chunks.length} קטעים עם Whisper AI...`);

      const transcriptionResult = await transcribeChunkedAudio(chunks, 'he');
      fullText = transcriptionResult.text;
      transcriptSegments = transcriptionResult.segments;

      // Cleanup chunk files
      for (const chunk of chunks) {
        await unlink(chunk.path).catch(() => {});
      }
    } else {
      await updateEpisodeProgress(episodeId, 2, 20, 'שולח קובץ ל-Whisper AI לתמלול...');

      const transcriptionResult = await transcribeAudio(tempFilePath, 'he');
      fullText = transcriptionResult.text;
      transcriptSegments = transcriptionResult.segments;
    }

    await updateEpisodeProgress(episodeId, 2, 100, 'התמלול הושלם');

    // Cleanup temp file early
    if (tempFilePath) {
      await unlink(tempFilePath).catch(() => {});
      tempFilePath = null;
    }

    // ── Stage 4: Segment Topics ──────────────────────────────────────────
    await updateEpisodeProgress(episodeId, 3, 0, 'מנתח נושאים ומזהה מעברים בשיחה...');

    const topicSegments = segmentTranscript(transcriptSegments as unknown as TranscriptSegment[]);

    await updateEpisodeProgress(episodeId, 3, 100, `זוהו ${topicSegments.length} נושאים`);

    // ── Stage 5: AI Analysis — Claude for clip candidate detection ───────
    await updateEpisodeProgress(episodeId, 4, 0, 'AI מנתח את התמלול לזיהוי רגעים ויראליים...');

    const aiClips: AIClipSuggestion[] = await analyzeTranscriptForClips(
      fullText,
      topicSegments
    );

    await updateEpisodeProgress(episodeId, 4, 100, `נמצאו ${aiClips.length} קליפים מומלצים`);

    // ── Stage 6: Score & Save — save analysis + candidates ───────────────
    await updateEpisodeProgress(episodeId, 5, 0, 'מחשב ציונים ושומר ניתוח...');

    // Map AI suggestions to RawClipCandidate for scoring
    const rawCandidates: RawClipCandidate[] = aiClips.map((clip, idx) => ({
      id: `candidate_${String(idx + 1).padStart(3, '0')}`,
      startTime: clip.startTime,
      endTime: clip.endTime,
      transcript: fullText.slice(0, 500),
      title: clip.title,
      topicTags: clip.topicTags,
      hookStrengthEstimate: clip.hookStrengthEstimate,
      emotionalArcEstimate: clip.engagementEstimate,
      standaloneValueEstimate: clip.engagementEstimate,
      viralEstimate: clip.viralEstimate,
      topicRelevanceEstimate: 0.7,
      audioQualityEstimate: 0.8,
    }));

    const scoredClips = scoreClipCandidates(rawCandidates);
    const rankedClips = rankClips(scoredClips);

    // Save transcript to podcast_transcripts
    const { data: transcriptRow, error: transcriptInsertError } = await supabase
      .from('podcast_transcripts')
      .insert({
        episode_id: episodeId,
        provider: 'whisper',
        language: 'he',
        full_text: fullText,
        segments: transcriptSegments,
        speaker_labels: null,
        chunk_index: 0,
        chunk_start_time: 0,
      })
      .select('id')
      .single();

    if (transcriptInsertError) {
      throw new Error(`שגיאה בשמירת התמלול: ${transcriptInsertError.message}`);
    }

    const transcriptId = transcriptRow?.id || null;

    await updateEpisodeProgress(episodeId, 5, 30, 'שומר ניתוח פרק...');

    // Detect silences (segments with long gaps)
    const silences = detectSilences(transcriptSegments as unknown as TranscriptSegment[]);

    // Detect dead moments (low-keyword-density segments)
    const deadMoments = detectDeadMoments(topicSegments);

    // Detect high engagement moments (from AI clips)
    const highEngagementMoments = aiClips.map(clip => ({
      start: clip.startTime,
      end: clip.endTime,
      score: Math.round(clip.viralEstimate * 100),
      reason: clip.reasoning,
    }));

    // Calculate duration from transcript
    const allSegs = transcriptSegments as unknown as TranscriptSegment[];
    const durationSeconds = allSegs.length > 0
      ? Math.ceil(allSegs[allSegs.length - 1].end)
      : 0;

    // Save EpisodeAnalysis via JSONB collection
    const analysisData: Omit<EpisodeAnalysis, 'id'> = {
      episodeId,
      transcriptId,
      fullText,
      topicSegments: topicSegments.map(seg => ({
        id: seg.id,
        startTime: seg.startTime,
        endTime: seg.endTime,
        label: seg.label,
        keywords: seg.keywords,
        wordCount: seg.wordCount,
      })),
      silences,
      deadMoments,
      speakerChanges: [], // Not yet detected — future enhancement
      highEngagementMoments,
      durationSeconds,
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedAnalysis = await episodeAnalyses.createAsync(analysisData as EpisodeAnalysis);

    await updateEpisodeProgress(episodeId, 5, 60, 'שומר קליפים מומלצים...');

    // Save clip candidates with candidateStatus='suggested'
    // These are NOT final clips — they are suggestions waiting for user approval
    const savedCandidateIds: string[] = [];

    for (let i = 0; i < rankedClips.length; i++) {
      const clip = rankedClips[i];
      const aiClip = aiClips.find(
        ac => ac.startTime === clip.startTime && ac.endTime === clip.endTime
      );

      // Extract transcript excerpt for this clip's time range
      const clipSegments = allSegs.filter(
        seg => seg.start >= clip.startTime && seg.end <= clip.endTime
      );
      const transcriptExcerpt = clipSegments.map(s => s.word || (s as unknown as { text: string }).text).join(' ');

      const candidateData: Omit<PodcastClipCandidate, 'id'> = {
        episodeId,
        title: clip.title,
        startTime: clip.startTime,
        endTime: clip.endTime,
        transcriptExcerpt: transcriptExcerpt || '',
        topicTags: clip.topicTags,
        viralScore: Math.round(clip.viralScore * 100),
        engagementScore: Math.round(clip.engagementScore * 100),
        hookScore: Math.round(clip.hookScore * 100),
        reasoning: aiClip?.reasoning ?? '',
        isSelected: false,
        // New fields for episode clip extraction flow
        candidateStatus: 'suggested',
        clipIndex: i + 1,
        description: aiClip?.reasoning ?? null,
        hookSentence: null,
        topic: clip.topicTags[0] ?? null,
        confidenceScore: Math.round(clip.overallScore * 100),
        reasonForSelection: aiClip?.reasoning ?? null,
        previewThumbnail: null,
        userAdjustedStart: null,
        userAdjustedEnd: null,
        formatConfig: null,
        hookPackage: null,
        brandPresetId: null,
        viralStyle: null,
        timelineEdits: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await podcastClipCandidates.createAsync(candidateData as PodcastClipCandidate);
      savedCandidateIds.push(saved.id);
    }

    await updateEpisodeProgress(episodeId, 5, 100, `${rankedClips.length} קליפים מומלצים נשמרו`);

    // Mark episode as candidates_ready
    await markEpisodeCandidatesReady(episodeId, rankedClips.length);

    return {
      success: true,
      episodeId,
      analysisId: savedAnalysis.id,
      candidateCount: rankedClips.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[episode-analyzer] שגיאה בניתוח פרק ${episodeId}:`, message);
    await markEpisodeError(episodeId, message);
    return { success: false, episodeId, error: message };
  } finally {
    if (tempFilePath) {
      await unlink(tempFilePath).catch(() => {});
    }
  }
}

// ── Silence detection ─────────────────────────────────────────────────────────

function detectSilences(
  segments: TranscriptSegment[],
  minGapSeconds = 2.0
): Array<{ start: number; end: number; duration: number }> {
  const silences: Array<{ start: number; end: number; duration: number }> = [];

  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap >= minGapSeconds) {
      silences.push({
        start: segments[i - 1].end,
        end: segments[i].start,
        duration: gap,
      });
    }
  }

  return silences;
}

// ── Dead moment detection ─────────────────────────────────────────────────────

function detectDeadMoments(
  topicSegments: TopicSegment[],
  minWordCount = 10,
  maxKeywords = 2
): Array<{ start: number; end: number; reason: string }> {
  const deadMoments: Array<{ start: number; end: number; reason: string }> = [];

  for (const seg of topicSegments) {
    // Very short segments with few keywords = likely dead air or filler
    if (seg.wordCount <= minWordCount && seg.keywords.length <= maxKeywords) {
      deadMoments.push({
        start: seg.startTime,
        end: seg.endTime,
        reason: `קטע קצר עם מעט תוכן (${seg.wordCount} מילים, ${seg.keywords.length} מילות מפתח)`,
      });
    }
  }

  return deadMoments;
}
