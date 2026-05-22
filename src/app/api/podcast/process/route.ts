/**
 * POST /api/podcast/process — הפעלת pipeline עיבוד לפרק פודקאסט
 *
 * מקבל { episodeId }, מחזיר 202 מיד, ומריץ 6 שלבי עיבוד ברקע:
 *   1. אימות — בדיקת קובץ ב-Supabase Storage
 *   2. הכנת קובץ — הורדת הקובץ מ-Storage (ללא FFmpeg)
 *   3. תמלול — שליחת הקובץ ישירות ל-Whisper API
 *   4. פילוח נושאים — זיהוי גבולות נושא בתמלול
 *   5. ניתוח AI — זיהוי קליפים מומלצים
 *   6. דירוג קליפים — חישוב ציונים ושמירה ל-DB
 *
 * NOTE: This pipeline runs WITHOUT FFmpeg for Vercel Serverless compatibility.
 * Whisper API accepts video files directly (mp4, webm, etc.) up to 25MB.
 * For files larger than 25MB, the pipeline skips transcription and marks
 * the episode as "uploaded" with a message indicating external processing is needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { transcribeAudio } from '@/lib/podcast-engine/whisper-transcription';
import { writeFile, mkdir, unlink } from 'fs/promises';
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
        try { await supabase.rpc('exec_sql', { [param]: "NOTIFY pgrst, 'reload schema';" }); } catch {}
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
export const maxDuration = 300; // 5 minutes — pipeline needs time for download + ffmpeg + whisper + AI

// ── Stage definitions ─────────────────────────────────────────────────────────

const STAGES = [
  { stage: 1, stageName: 'אימות קובץ' },
  { stage: 2, stageName: 'הכנת קובץ' },
  { stage: 3, stageName: 'תמלול' },
  { stage: 4, stageName: 'פילוח נושאים' },
  { stage: 5, stageName: 'ניתוח AI' },
  { stage: 6, stageName: 'דירוג קליפים' },
] as const;

/** Maximum file size Whisper API accepts (25MB). */
const WHISPER_MAX_FILE_SIZE = 25 * 1024 * 1024;

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
  let tempFilePath: string | null = null;

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

    await updateProgress(episodeId, 0, 100, 'הקובץ אומת בהצלחה');

    // ── Stage 2: הכנת קובץ — הורדת הקובץ מ-Storage ───────────────────────
    // NOTE: No FFmpeg — Whisper API accepts video files directly.
    await updateProgress(episodeId, 1, 0, 'מוריד את הקובץ מהשרת...');

    const { data: fileBlob, error: downloadError } = await supabase
      .storage
      .from('project-files')
      .download(sourceFilePath);

    if (downloadError || !fileBlob) {
      throw new Error(`שגיאה בהורדת הקובץ: ${downloadError?.message ?? 'לא התקבל קובץ'}`);
    }

    const blobArrayBuffer = await fileBlob.arrayBuffer();
    const fileSizeBytes = blobArrayBuffer.byteLength;

    // Write to temp for Whisper API (it needs a file path)
    const tempDir = join(tmpdir(), `podcast-${episodeId}`);
    await mkdir(tempDir, { recursive: true });
    const ext = sourceFilePath.split('.').pop() || 'mp4';
    tempFilePath = join(tempDir, `source.${ext}`);
    await writeFile(tempFilePath, Buffer.from(blobArrayBuffer));

    await updateProgress(episodeId, 1, 100, 'הקובץ הורד בהצלחה');

    // ── Stage 3: תמלול — שליחת הקובץ ישירות ל-Whisper ────────────────────
    await updateProgress(episodeId, 2, 0, 'מתמלל עם Whisper AI...');

    // Check file size — Whisper API limit is 25MB
    if (fileSizeBytes > WHISPER_MAX_FILE_SIZE) {
      const sizeMB = Math.round(fileSizeBytes / 1024 / 1024);
      console.warn(
        `[process] File too large for Whisper API (${sizeMB}MB > 25MB). ` +
        `Marking episode as requiring external processing.`
      );

      // Mark episode as uploaded (not error) with a clear message
      await supabase
        .from('podcast_episodes')
        .update({
          status: 'uploaded',
          processing_progress: {
            stage: 2,
            stageName: 'תמלול',
            percent: 0,
            statusText: `הקובץ גדול מדי לתמלול אוטומטי (${sizeMB}MB). נדרש עיבוד חיצוני או קובץ קטן יותר (עד 25MB).`,
            startedAt: new Date().toISOString(),
          },
          error_message: `הקובץ גדול מדי לעיבוד אוטומטי (${sizeMB}MB). הגבלת Whisper API היא 25MB. ניתן להעלות קובץ אודיו קטן יותר או להמתין לתמיכה בעיבוד חיצוני.`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', episodeId);
      return;
    }

    await updateProgress(episodeId, 2, 20, 'שולח קובץ ל-Whisper AI לתמלול...');

    // Send the file directly to Whisper — it accepts video formats (mp4, webm, etc.)
    const transcriptionResult = await transcribeAudio(tempFilePath, 'he');

    const { text: fullText, segments: transcriptSegments } = transcriptionResult;

    await updateProgress(episodeId, 2, 100, 'התמלול הושלם');

    // Cleanup temp file early — we have the transcription
    if (tempFilePath) {
      await unlink(tempFilePath).catch(() => {});
      tempFilePath = null;
    }

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
  } finally {
    // Always clean up temp files
    if (tempFilePath) {
      await unlink(tempFilePath).catch(() => {});
    }
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

    // Use Next.js after() to keep the function alive after response is sent.
    // This ensures the pipeline runs to completion on Vercel serverless.
    after(async () => {
      await runPipeline(episodeId, episode.source_file_path);
    });

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
