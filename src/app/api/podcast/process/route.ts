/**
 * POST /api/podcast/process — הפעלת pipeline עיבוד לפרק פודקאסט
 *
 * מקבל { episodeId }, מחזיר 202 מיד, ומריץ 6 שלבי עיבוד ברקע:
 *   1. אימות — בדיקת קובץ ב-Supabase Storage
 *   2. חילוץ אודיו — הורדת וידאו וחילוץ שמע
 *   3. תמלול — תמלול מקוטע עם Whisper
 *   4. פילוח נושאים — זיהוי גבולות נושא בתמלול
 *   5. ניתוח AI — זיהוי קליפים מומלצים
 *   6. דירוג קליפים — חישוב ציונים ושמירה ל-DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractAudio, splitAudioIntoChunks } from '@/lib/podcast-engine/ffmpeg-service';
import { transcribeChunkedAudio } from '@/lib/podcast-engine/whisper-transcription';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { segmentTranscript, type TranscriptSegment } from '@/lib/podcast-engine/topic-segmentation';
import { analyzeTranscriptForClips, type AIClipSuggestion } from '@/lib/podcast-engine/clip-analyzer';
import { scoreClipCandidates, rankClips, type RawClipCandidate } from '@/lib/podcast-engine/clip-scorer';
import { podcastEpisodes } from '@/lib/db';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Auto-migration: create podcast_episodes table if missing ────────────
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS public.podcast_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, client_id UUID, title TEXT NOT NULL, show_name TEXT,
  guest_names TEXT[], language TEXT DEFAULT 'he', source_file_path TEXT NOT NULL,
  source_file_size BIGINT, duration_seconds INTEGER, audio_file_path TEXT,
  status TEXT DEFAULT 'uploaded', processing_progress JSONB DEFAULT '{}',
  error_message TEXT, metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);`;

let _tableCreationAttempted = false;

async function ensureTable(): Promise<boolean> {
  if (_tableCreationAttempted) return false;
  _tableCreationAttempted = true;

  for (const param of ['sql', 'query', 'sql_text']) {
    try {
      const { error } = await supabase.rpc('exec_sql', { [param]: CREATE_TABLE_SQL });
      if (!error) {
        console.log('[podcast-process] Auto-created podcast_episodes table');
        await supabase.rpc('exec_sql', { [param]: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});
        return true;
      }
      if (error.message?.includes('already exists')) return true;
      if (error.message?.includes('argument') || error.message?.includes('Could not find')) continue;
    } catch { continue; }
  }
  return false;
}

// ── Detect storage mode (same logic as episodes route) ────────────────────
type StorageMode = 'relational' | 'jsonb';
let _processMode: StorageMode | null = null;

async function detectProcessMode(): Promise<StorageMode> {
  if (_processMode) return _processMode;
  try {
    const { error } = await supabase.from('podcast_episodes').select('id').limit(0);
    if (!error) {
      _processMode = 'relational';
      return 'relational';
    }

    // Table missing — try to create it
    const created = await ensureTable();
    if (created) {
      const { error: retryError } = await supabase.from('podcast_episodes').select('id').limit(0);
      if (!retryError) {
        _processMode = 'relational';
        return 'relational';
      }
    }
  } catch {}
  _processMode = 'jsonb';
  return 'jsonb';
}

async function findEpisode(episodeId: string): Promise<{ id: string; status: string; source_file_path: string } | null> {
  const mode = await detectProcessMode();

  if (mode === 'relational') {
    const { data, error } = await supabase
      .from('podcast_episodes')
      .select('id, status, source_file_path')
      .eq('id', episodeId)
      .single();
    if (!error && data) return data;
  }

  // Try JSONB fallback
  try {
    const items = await podcastEpisodes.getAllAsync();
    const found = (items as Record<string, any>[]).find(
      (ep) => ep.id === episodeId
    );
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

export const dynamic = 'force-dynamic';

// ── Stage definitions ─────────────────────────────────────────────────────────

const STAGES = [
  { stage: 1, stageName: 'אימות קובץ' },
  { stage: 2, stageName: 'חילוץ אודיו' },
  { stage: 3, stageName: 'תמלול' },
  { stage: 4, stageName: 'פילוח נושאים' },
  { stage: 5, stageName: 'ניתוח AI' },
  { stage: 6, stageName: 'דירוג קליפים' },
] as const;

// ── Progress helper ─────────────────────────────────────────────────────────

async function updateProgress(
  episodeId: string,
  stageIndex: number,
  percent: number,
  statusText?: string
): Promise<void> {
  const { stage, stageName } = STAGES[stageIndex];
  await supabase
    .from('podcast_episodes')
    .update({
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

async function markError(episodeId: string, errorMessage: string): Promise<void> {
  await supabase
    .from('podcast_episodes')
    .update({
      status: 'error',
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', episodeId);
}

async function markCompleted(episodeId: string): Promise<void> {
  await supabase
    .from('podcast_episodes')
    .update({
      status: 'processed',
      processing_progress: {
        stage: 6,
        stageName: 'הושלם',
        percent: 100,
        startedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', episodeId);
}

// ── Pipeline ────────────────────────────────────────────────────────────────

async function runPipeline(episodeId: string, sourceFilePath: string): Promise<void> {
  try {
    // ── Stage 1: אימות — בדיקת קובץ ב-Storage ────────────────────────────
    await updateProgress(episodeId, 0, 0, 'מאתר את הקובץ בשרת...');

    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('project-files')
      .list('', {
        search: sourceFilePath.split('/').pop() ?? '',
      });

    if (fileError || !fileData || fileData.length === 0) {
      throw new Error(`קובץ לא נמצא ב-Storage: ${sourceFilePath}`);
    }

    // Get file metadata
    const fileMetadata = fileData[0] as unknown as Record<string, unknown>;
    const fileSizeBytes = fileMetadata.metadata
      ? (fileMetadata.metadata as Record<string, unknown>).size as number
      : undefined;

    await updateProgress(episodeId, 0, 100, 'הקובץ אומת בהצלחה');

    // ── Stage 2: חילוץ אודיו — הורדת הוידאו וחילוץ שמע ───────────────────
    await updateProgress(episodeId, 1, 0, 'מוריד את הקובץ מהשרת...');

    // Download the source file from Storage
    const { data: fileBlob, error: downloadError } = await supabase
      .storage
      .from('project-files')
      .download(sourceFilePath);

    if (downloadError || !fileBlob) {
      throw new Error(`שגיאה בהורדת הקובץ: ${downloadError?.message ?? 'לא התקבל קובץ'}`);
    }

    await updateProgress(episodeId, 1, 30, 'מחלץ אודיו מתוך הוידאו...');

    // Write blob to temp file for ffmpeg processing
    const tempDir = join(tmpdir(), `podcast-${episodeId}`);
    await mkdir(tempDir, { recursive: true });
    const ext = sourceFilePath.split('.').pop() || 'mp4';
    const tempVideoPath = join(tempDir, `source.${ext}`);
    const blobArrayBuffer = await fileBlob.arrayBuffer();
    await writeFile(tempVideoPath, Buffer.from(blobArrayBuffer));

    // Extract audio from video using ffmpeg
    const extractedAudioPath = await extractAudio(tempVideoPath, tempDir);
    const audioFileBuffer = await readFile(extractedAudioPath);

    // Cleanup temp video file
    await unlink(tempVideoPath).catch(() => {});

    // Save extracted audio path on the episode
    const audioFilePath = sourceFilePath.replace(/\.[^.]+$/, '.mp3');
    const { error: audioUploadError } = await supabase
      .storage
      .from('project-files')
      .upload(audioFilePath, audioFileBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (audioUploadError) {
      throw new Error(`שגיאה בהעלאת קובץ אודיו: ${audioUploadError.message}`);
    }

    await supabase
      .from('podcast_episodes')
      .update({ audio_file_path: audioFilePath })
      .eq('id', episodeId);

    await updateProgress(episodeId, 1, 100, 'האודיו חולץ בהצלחה');

    // ── Stage 3: תמלול — תמלול מקוטע עם Whisper ──────────────────────────
    await updateProgress(episodeId, 2, 0, 'מחלק אודיו למקטעים לתמלול...');

    // Split extracted audio into chunks for Whisper API (max 25MB each)
    const audioChunks = await splitAudioIntoChunks(extractedAudioPath, 600, tempDir);

    await updateProgress(episodeId, 2, 20, `מתמלל ${audioChunks.length} מקטעי אודיו עם Whisper AI...`);

    const transcriptionResult = await transcribeChunkedAudio(audioChunks, 'he');

    const { text: fullText, segments: transcriptSegments } = transcriptionResult;

    await updateProgress(episodeId, 2, 100, 'התמלול הושלם');

    // ── Stage 4: פילוח נושאים — זיהוי גבולות נושא בתמלול ────────────────
    await updateProgress(episodeId, 3, 0, 'מנתח נושאים ומזהה מעברים בשיחה...');

    const topicSegments = segmentTranscript(transcriptSegments as unknown as TranscriptSegment[]);

    await updateProgress(episodeId, 3, 100, `זוהו ${topicSegments.length} נושאים`);

    // ── Stage 5: ניתוח AI — זיהוי קליפים מומלצים ──────────────────────────
    await updateProgress(episodeId, 4, 0, 'AI מנתח את התמלול לזיהוי רגעים ויראליים...');

    const aiClips: AIClipSuggestion[] = await analyzeTranscriptForClips(
      fullText,
      topicSegments
    );

    await updateProgress(episodeId, 4, 100, `נמצאו ${aiClips.length} קליפים מומלצים`);

    // ── Stage 6: דירוג קליפים — חישוב ציונים ושמירה ל-DB ─────────────────
    await updateProgress(episodeId, 5, 0, 'מחשב ציוני ויראליות ומדרג קליפים...');

    // Map AI suggestions to RawClipCandidate for scoring
    const rawCandidates: RawClipCandidate[] = aiClips.map((clip, idx) => ({
      id: `candidate_${String(idx + 1).padStart(3, '0')}`,
      startTime: clip.startTime,
      endTime: clip.endTime,
      transcript: fullText.slice(0, 500), // excerpt for reference
      title: clip.title,
      topicTags: clip.topicTags,
      hookStrengthEstimate: clip.hookStrengthEstimate,
      emotionalArcEstimate: clip.engagementEstimate,
      standaloneValueEstimate: clip.engagementEstimate,
      viralEstimate: clip.viralEstimate,
      topicRelevanceEstimate: 0.7,  // default — no separate estimate from AI
      audioQualityEstimate: 0.8,    // default — not measured yet
    }));

    const scoredClips = scoreClipCandidates(rawCandidates);
    const rankedClips = rankClips(scoredClips);

    await updateProgress(episodeId, 5, 50, 'שומר תמלול וקליפים ל-DB...');

    // Save transcript to podcast_transcripts
    const { error: transcriptInsertError } = await supabase
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
      });

    if (transcriptInsertError) {
      throw new Error(`שגיאה בשמירת התמלול: ${transcriptInsertError.message}`);
    }

    // Save clip candidates to podcast_clip_candidates
    const clipRows = rankedClips.map((clip) => {
      // Extract the matching transcript text for this clip's time range
      const clipSegments = (transcriptSegments as unknown as TranscriptSegment[]).filter(
        (seg) => seg.start >= clip.startTime && seg.end <= clip.endTime
      );
      const transcriptExcerpt = clipSegments.map((s) => s.word || (s as unknown as { text: string }).text).join(' ');

      return {
        episode_id: episodeId,
        title: clip.title,
        start_time: clip.startTime,
        end_time: clip.endTime,
        transcript_excerpt: transcriptExcerpt || null,
        topic_tags: clip.topicTags,
        viral_score: Math.round(clip.viralScore * 100),
        engagement_score: Math.round(clip.engagementScore * 100),
        hook_score: Math.round(clip.hookScore * 100),
        reasoning: (clip as unknown as AIClipSuggestion).reasoning ?? '',
        is_selected: false,
      };
    });

    if (clipRows.length > 0) {
      const { error: clipsInsertError } = await supabase
        .from('podcast_clip_candidates')
        .insert(clipRows);

      if (clipsInsertError) {
        throw new Error(`שגיאה בשמירת קליפים: ${clipsInsertError.message}`);
      }
    }

    await updateProgress(episodeId, 5, 100, 'כל הקליפים נשמרו בהצלחה');

    // ── Done ─────────────────────────────────────────────────────────────────
    await markCompleted(episodeId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[process] שגיאה בעיבוד פרק ${episodeId}:`, message);
    await markError(episodeId, message);
  }
}

// ── POST handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { episodeId } = body;

    if (!episodeId) {
      return NextResponse.json(
        { error: 'חסר episodeId' },
        { status: 400 }
      );
    }

    // Verify episode exists (checks both relational and JSONB)
    const episode = await findEpisode(episodeId);

    if (!episode) {
      console.error(`[process] Episode not found: ${episodeId}`);
      return NextResponse.json(
        { error: 'הפרק לא נמצא' },
        { status: 404 }
      );
    }

    if (episode.status === 'processing') {
      return NextResponse.json(
        { error: 'הפרק כבר בתהליך עיבוד' },
        { status: 409 }
      );
    }

    // Mark as processing immediately
    await supabase
      .from('podcast_episodes')
      .update({
        status: 'processing',
        error_message: null,
        processing_progress: {
          stage: 1,
          stageName: 'אימות קובץ',
          percent: 0,
          statusText: 'מתחיל עיבוד...',
          startedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', episodeId);

    // Fire-and-forget: run the pipeline in the background
    // Using void to explicitly mark as intentionally not awaited
    void runPipeline(episodeId, episode.source_file_path);

    return NextResponse.json(
      {
        success: true,
        message: 'העיבוד התחיל',
        episodeId,
      },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `שגיאה בהפעלת העיבוד: ${message}` },
      { status: 500 }
    );
  }
}
