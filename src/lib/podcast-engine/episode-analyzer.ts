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

import { writeFile, mkdir, unlink, stat } from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { tmpdir } from 'os';
import { getFfmpegPath } from '@/lib/ffmpeg-paths';
import { getSupabase } from '@/lib/db/store';
import { transcribeAudio } from './whisper-transcription';
import { segmentTranscript, type TranscriptSegment, type TopicSegment } from './topic-segmentation';
import { analyzeTranscriptForClips, type AIClipSuggestion } from './clip-analyzer';
import { scoreClipCandidates, rankClips, type RawClipCandidate, type ScoredClip } from './clip-scorer';
import { episodeAnalyses, podcastClipCandidates, podcastEpisodes } from '@/lib/db/collections';
import type { EpisodeAnalysis, PodcastClipCandidate } from '@/lib/db/schema';

/**
 * Use the shared Supabase client from store.ts which has the hardcoded
 * fallback URL. The old standalone createClient() used
 * process.env.NEXT_PUBLIC_SUPABASE_URL! which is undefined on the server,
 * causing ALL DB updates (status, progress) to silently fail.
 */
function getAnalyzerSupabase() {
  return getSupabase();
}

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

// ── ETA helpers ──────────────────────────────────────────────────────────────

/** Estimated typical durations per stage in seconds (based on ~1hr podcast). */
const STAGE_ESTIMATED_SECONDS: Record<number, number> = {
  1: 5,    // Validate — very fast
  2: 30,   // Download / prepare file
  3: 90,   // Transcription — Whisper API (largest stage)
  4: 5,    // Topic segmentation — local, fast
  5: 30,   // AI analysis — Claude API
  6: 10,   // Score & save
};

/** Track when each stage actually started so we can compute elapsed time. */
const stageStartTimes: Record<string, number> = {};

/** Compute estimated remaining seconds for a stage based on percent done. */
function computeEstimatedRemaining(stageIndex: number, percent: number, episodeId: string): number | null {
  const stageNum = ANALYSIS_STAGES[stageIndex].stage;
  const key = `${episodeId}_${stageNum}`;

  if (percent <= 0) {
    // Stage just started — record start time and return full estimate
    stageStartTimes[key] = Date.now();
    return STAGE_ESTIMATED_SECONDS[stageNum] ?? null;
  }

  if (percent >= 100) return 0;

  const startedAt = stageStartTimes[key];
  if (startedAt) {
    // Use actual elapsed time to project remaining
    const elapsedSec = (Date.now() - startedAt) / 1000;
    const projectedTotal = (elapsedSec / percent) * 100;
    return Math.max(0, Math.round(projectedTotal - elapsedSec));
  }

  // Fallback: linear estimate from typical duration
  const typicalTotal = STAGE_ESTIMATED_SECONDS[stageNum] ?? 30;
  return Math.max(0, Math.round(typicalTotal * (1 - percent / 100)));
}

// ── Progress helpers ──────────────────────────────────────────────────────────

async function updateEpisodeProgress(
  episodeId: string,
  stageIndex: number,
  percent: number,
  statusText?: string
): Promise<void> {
  const { stage, stageName } = ANALYSIS_STAGES[stageIndex];
  const estimatedRemaining = computeEstimatedRemaining(stageIndex, percent, episodeId);
  const progressData = {
    stage,
    stageName,
    percent: Math.round(percent),
    statusText: statusText || stageName,
    startedAt: new Date().toISOString(),
    estimatedRemaining, // seconds remaining for current stage (null if unknown)
  };
  const now = new Date().toISOString();

  // Write to relational table
  const { error: progressError } = await getAnalyzerSupabase()
    .from('podcast_episodes')
    .update({
      status: 'analyzing',
      processing_progress: progressData,
      updated_at: now,
    })
    .eq('id', episodeId);

  if (progressError) {
    console.error(`[episode-analyzer] ❌ Relational progress update failed for ${episodeId}:`, progressError.message);
  } else {
    console.log(`[episode-analyzer] ✅ Progress updated: stage=${stage} percent=${Math.round(percent)} status=${statusText || stageName}`);
  }

  // ALWAYS also write to JSONB so polling sees updates regardless of which table the episode lives in
  try {
    await podcastEpisodes.updateAsync(episodeId, {
      status: 'analyzing',
      processingProgress: progressData,
      processing_progress: progressData,
      updatedAt: now,
      updated_at: now,
    } as any);
  } catch (jsonbErr) {
    // Non-critical — relational is primary
  }
}

async function markEpisodeError(episodeId: string, errorMessage: string): Promise<void> {
  const now = new Date().toISOString();

  // Relational table
  await getAnalyzerSupabase()
    .from('podcast_episodes')
    .update({
      status: 'error',
      error_message: errorMessage,
      updated_at: now,
    })
    .eq('id', episodeId);

  // JSONB fallback
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

async function markEpisodeCandidatesReady(episodeId: string, candidateCount: number): Promise<void> {
  const now = new Date().toISOString();
  const progressData = {
    stage: 6,
    stageName: 'מוכן לבחירה',
    percent: 100,
    statusText: `נמצאו ${candidateCount} קליפים מומלצים — ממתין לאישור`,
    startedAt: now,
  };

  // Relational table
  await getAnalyzerSupabase()
    .from('podcast_episodes')
    .update({
      status: 'candidates_ready',
      processing_progress: progressData,
      updated_at: now,
    })
    .eq('id', episodeId);

  // JSONB fallback
  try {
    await podcastEpisodes.updateAsync(episodeId, {
      status: 'candidates_ready',
      processingProgress: progressData,
      processing_progress: progressData,
      updatedAt: now,
      updated_at: now,
    } as any);
  } catch {}
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
  sourceFilePath: string,
  audioFilePath?: string
): Promise<AnalysisResult> {
  let tempDir: string | null = null;

  try {
    // ── Stage 1: Validate — generate signed URL (no download) ────────────
    await updateEpisodeProgress(episodeId, 0, 0, 'מאתר את הקובץ בשרת...');

    // Generate a signed URL — this validates the file exists AND gives us
    // a URL we can download the file from.
    const sb = getAnalyzerSupabase();
    const { data: signedData, error: signedError } = await sb
      .storage
      .from('project-files')
      .createSignedUrl(sourceFilePath, 1800); // 30 minute validity

    if (signedError || !signedData?.signedUrl) {
      // Fallback: check if file exists via list
      const { data: fileData, error: fileError } = await sb
        .storage
        .from('project-files')
        .list('', { search: sourceFilePath.split('/').pop() ?? '' });

      if (fileError || !fileData || fileData.length === 0) {
        throw new Error(`קובץ לא נמצא ב-Storage: ${sourceFilePath}`);
      }
      throw new Error(`לא ניתן ליצור קישור לקובץ: ${signedError?.message ?? 'שגיאה לא ידועה'}`);
    }

    const signedUrl = signedData.signedUrl;
    console.log(`[episode-analyzer] Signed URL generated for ${sourceFilePath}`);

    await updateEpisodeProgress(episodeId, 0, 100, 'הקובץ אומת בהצלחה');

    // ── Stage 2: Download file for Whisper ─────────────────────────────────
    // Strategy:
    //   a) If audioFilePath exists — client already extracted audio (small MP3).
    //      Just download that and send to Whisper.
    //   b) If no audioFilePath and video ≤25MB — send video directly to Whisper.
    //   c) If no audioFilePath and video >25MB — error with clear message
    //      (client should have extracted audio; this is a fallback).
    await updateEpisodeProgress(episodeId, 1, 0, 'מוריד את הקובץ מהשרת...');

    tempDir = join(tmpdir(), `episode-analysis-${episodeId}`);
    await mkdir(tempDir, { recursive: true });

    let whisperFilePath: string | undefined;

    if (audioFilePath) {
      // ── Path A: Pre-extracted audio from client-side WASM ffmpeg ──
      console.log(`[episode-analyzer] Using pre-extracted audio: ${audioFilePath}`);
      await updateEpisodeProgress(episodeId, 1, 20, 'מוריד קובץ אודיו מוכן...');

      // Generate signed URL for the audio file
      const { data: audioSignedData, error: audioSignedError } = await sb
        .storage
        .from('project-files')
        .createSignedUrl(audioFilePath, 1800);

      if (audioSignedError || !audioSignedData?.signedUrl) {
        console.warn(`[episode-analyzer] Audio signed URL failed, falling back to video:`, audioSignedError?.message);
        // Fall through to video download below
      } else {
        // Download the small audio file
        const audioResponse = await fetch(audioSignedData.signedUrl);
        if (!audioResponse.ok) {
          console.warn(`[episode-analyzer] Audio download failed (${audioResponse.status}), falling back to video`);
        } else {
          const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
          const audioSizeMB = Math.round(audioBuffer.length / 1024 / 1024);
          console.log(`[episode-analyzer] Audio downloaded: ${audioSizeMB}MB`);

          if (audioBuffer.length <= WHISPER_MAX_FILE_SIZE) {
            whisperFilePath = join(tempDir, 'audio.mp3');
            await writeFile(whisperFilePath, audioBuffer);
            await updateEpisodeProgress(episodeId, 1, 100, `קובץ אודיו מוכן (${audioSizeMB}MB)`);

            // Skip the video download entirely — go straight to Stage 3
            // (whisperFilePath is set, so the code below won't run)
          } else {
            console.warn(`[episode-analyzer] Pre-extracted audio too large (${audioSizeMB}MB), falling back to video`);
          }
        }
      }
    }

    // If whisperFilePath was NOT set above (no audio file, or it failed), try the video
    if (!whisperFilePath) {
      console.log(`[episode-analyzer] No pre-extracted audio — downloading video via streaming + server-side ffmpeg extraction`);
      await updateEpisodeProgress(episodeId, 1, 20, 'מוריד את הווידאו מהשרת...');

      // STREAM download to disk — avoids loading entire file into memory (prevents OOM on 500MB+ files)
      let downloadResponse: Response;
      try {
        downloadResponse = await fetch(signedUrl);
        if (!downloadResponse.ok) {
          throw new Error(`HTTP ${downloadResponse.status}: ${downloadResponse.statusText}`);
        }
      } catch (dlErr) {
        const msg = dlErr instanceof Error ? dlErr.message : String(dlErr);
        throw new Error(`שגיאה בהורדת הקובץ: ${msg}`);
      }

      const fileExt = sourceFilePath.split('.').pop()?.toLowerCase() || 'mp4';
      const downloadedPath = join(tempDir, `source.${fileExt}`);

      // Stream response body to disk — memory usage stays low regardless of file size
      if (!downloadResponse.body) {
        throw new Error('שגיאה: גוף התשובה ריק — אין מה להוריד');
      }

      const nodeStream = Readable.fromWeb(downloadResponse.body as any);
      const writeStream = createWriteStream(downloadedPath);
      await pipeline(nodeStream, writeStream);

      const fileStat = await stat(downloadedPath);
      const fileSizeMB = Math.round(fileStat.size / 1024 / 1024);
      console.log(`[episode-analyzer] Video streamed to disk: ${fileSizeMB}MB (${fileExt})`);
      await updateEpisodeProgress(episodeId, 1, 50, `וידאו הורד (${fileSizeMB}MB) — מחלץ אודיו...`);

      if (fileStat.size <= WHISPER_MAX_FILE_SIZE) {
        // Video is small enough — send directly to Whisper, no extraction needed
        whisperFilePath = downloadedPath;
        console.log(`[episode-analyzer] Video ≤25MB — sending directly to Whisper`);
        await updateEpisodeProgress(episodeId, 1, 100, `קובץ מוכן לתמלול (${fileSizeMB}MB)`);
      } else {
        // Video too large for Whisper — extract audio with server-side ffmpeg
        console.log(`[episode-analyzer] Video ${fileSizeMB}MB > 25MB — extracting audio with ffmpeg`);
        await updateEpisodeProgress(episodeId, 1, 60, `מחלץ אודיו מהווידאו (${fileSizeMB}MB)...`);

        const audioOutputPath = join(tempDir, 'extracted_audio.mp3');
        const ffmpegBin = getFfmpegPath();
        console.log(`[episode-analyzer] Using ffmpeg binary: ${ffmpegBin}`);

        const execFileAsync = promisify(execFile);
        try {
          await execFileAsync(ffmpegBin, [
            '-y',
            '-i', downloadedPath,
            '-vn',                    // Strip video
            '-acodec', 'libmp3lame',
            '-ar', '16000',           // 16kHz sample rate (optimal for Whisper)
            '-ac', '1',               // Mono
            '-b:a', '48k',            // 48kbps — ~22MB/hour, under Whisper's 25MB limit
            audioOutputPath,
          ], { timeout: 180_000 }); // 3 minute timeout for extraction
        } catch (ffErr) {
          const msg = ffErr instanceof Error ? ffErr.message : String(ffErr);
          console.error(`[episode-analyzer] ffmpeg extraction failed:`, msg);
          throw new Error(`שגיאה בחילוץ אודיו מהווידאו: ${msg}`);
        }

        // Delete the large video file immediately to free disk space
        await unlink(downloadedPath).catch(() => {});

        const audioStat = await stat(audioOutputPath);
        const audioSizeMB = (audioStat.size / 1024 / 1024).toFixed(1);
        console.log(`[episode-analyzer] Audio extracted: ${audioSizeMB}MB`);

        if (audioStat.size > WHISPER_MAX_FILE_SIZE) {
          throw new Error(
            `קובץ האודיו שחולץ גדול מדי (${audioSizeMB}MB). ` +
            `מגבלת Whisper API היא 25MB. נסה להשתמש בהקלטה קצרה יותר.`
          );
        }

        whisperFilePath = audioOutputPath;
        await updateEpisodeProgress(episodeId, 1, 100, `אודיו חולץ בהצלחה (${audioSizeMB}MB)`);
      }
    }

    // ── Stage 3: Transcribe — Whisper API ────────────────────────────────
    await updateEpisodeProgress(episodeId, 2, 0, 'מתמלל עם Whisper AI...');

    let fullText: string;
    let transcriptSegments: unknown[];

    await updateEpisodeProgress(episodeId, 2, 20, 'שולח קובץ ל-Whisper AI לתמלול...');

    const transcriptionResult = await transcribeAudio(whisperFilePath, 'he');
    fullText = transcriptionResult.text;
    transcriptSegments = transcriptionResult.segments;

    await updateEpisodeProgress(episodeId, 2, 100, 'התמלול הושלם');

    // Cleanup temp files early to free disk
    if (tempDir) {
      await unlink(whisperFilePath).catch(() => {});
    }

    // ── Stage 4: Segment Topics ──────────────────────────────────────────
    await updateEpisodeProgress(episodeId, 3, 0, 'מנתח נושאים ומזהה מעברים בשיחה...');

    const segmentCount = transcriptSegments.length;
    await updateEpisodeProgress(episodeId, 3, 20, `מפצל ${segmentCount} סגמנטים למילים בודדות...`);

    // Whisper returns TranscriptionSegment (text, start, end) — segmentTranscript
    // now handles both word-level and sentence-level segments automatically
    const topicSegments = segmentTranscript(
      transcriptSegments.map((seg: any) => ({
        text: seg.text,
        word: seg.word,
        start: seg.start,
        end: seg.end,
        confidence: seg.confidence,
      }))
    );

    await updateEpisodeProgress(episodeId, 3, 60, `מחשב מרחקי אוצר מילים בין חלקי השיחה...`);
    await updateEpisodeProgress(episodeId, 3, 100, `זוהו ${topicSegments.length} נושאים בפרק`);

    // ── Stage 5: AI Analysis — Claude for clip candidate detection ───────
    await updateEpisodeProgress(episodeId, 4, 0, 'מכין את התמלול לניתוח AI...');
    await updateEpisodeProgress(episodeId, 4, 15, `שולח ${topicSegments.length} נושאים ו-${fullText.length.toLocaleString()} תווים לניתוח...`);
    await updateEpisodeProgress(episodeId, 4, 30, 'AI מזהה רגעים ויראליים, הוקים חזקים ונקודות עניין...');

    const aiClips: AIClipSuggestion[] = await analyzeTranscriptForClips(
      fullText,
      topicSegments
    );

    await updateEpisodeProgress(episodeId, 4, 80, `AI סיים — נמצאו ${aiClips.length} רגעים מעניינים`);
    await updateEpisodeProgress(episodeId, 4, 100, `${aiClips.length} קליפים מומלצים מוכנים לדירוג`);

    // ── Stage 6: Score & Save — save analysis + candidates ───────────────
    await updateEpisodeProgress(episodeId, 5, 0, 'מתחיל דירוג ושמירת תוצאות...');
    await updateEpisodeProgress(episodeId, 5, 10, `מחשב ציוני ויראליות, engagement והוק ל-${aiClips.length} קליפים...`);

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
    await updateEpisodeProgress(episodeId, 5, 20, `${rankedClips.length} קליפים דורגו — שומר תמלול...`);

    // Save transcript to podcast_transcripts
    const { data: transcriptRow, error: transcriptInsertError } = await sb
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

    await updateEpisodeProgress(episodeId, 5, 35, 'תמלול נשמר — מזהה שתיקות ורגעים מתים...');

    // Detect silences (segments with long gaps) — works with any segment that has start/end
    const silences = detectSilences(
      transcriptSegments.map((seg: any) => ({ word: seg.text || seg.word || '', start: seg.start, end: seg.end }))
    );

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
    const durationSeconds = transcriptSegments.length > 0
      ? Math.ceil((transcriptSegments[transcriptSegments.length - 1] as any).end || 0)
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
      const clipSegments = (transcriptSegments as any[]).filter(
        (seg: any) => seg.start >= clip.startTime && seg.end <= clip.endTime
      );
      const transcriptExcerpt = clipSegments.map((s: any) => s.text || s.word || '').join(' ');

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
    // Cleanup entire temp directory
    if (tempDir) {
      const { rm } = await import('fs/promises');
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

// ── Silence detection ─────────────────────────────────────────────────────────

function detectSilences(
  segments: Array<{ start: number; end: number; word?: string }>,
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
