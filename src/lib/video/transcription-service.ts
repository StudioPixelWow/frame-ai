/**
 * Audio Transcription Service
 * Generates captions/subtitles from audio files.
 * Based on remotion-best-practices skill:
 * - Uses OpenAI Whisper API for Hebrew transcription
 * - CRITICAL: Never use medium.en model -- Hebrew requires multilingual model
 */

export interface TranscriptionWord {
  word: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  words: TranscriptionWord[];
  segments: {
    id: string;
    text: string;
    startMs: number;
    endMs: number;
    words: TranscriptionWord[];
  }[];
  durationMs: number;
}

/**
 * Transcribe audio using OpenAI Whisper API.
 * For Hebrew audio, the API automatically detects Hebrew.
 * NEVER pass language="en" for Hebrew content.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options?: {
    language?: string;  // ISO 639-1 code, e.g. "he" for Hebrew. Auto-detect if omitted.
    prompt?: string;  // Optional context hint for better accuracy
  }
): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[Transcription] OPENAI_API_KEY is required');
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' });
  formData.append('file', blob, 'audio.mp3');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');
  formData.append('timestamp_granularities[]', 'segment');

  if (options?.language) {
    formData.append('language', options.language);
  }
  if (options?.prompt) {
    formData.append('prompt', options.prompt);
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[Transcription] Whisper API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  const words: TranscriptionWord[] = (data.words || []).map((w: any) => ({
    word: w.word,
    startMs: Math.round((w.start || 0) * 1000),
    endMs: Math.round((w.end || 0) * 1000),
    confidence: 1.0,
  }));

  const segments = (data.segments || []).map((s: any, i: number) => ({
    id: `seg-${i}`,
    text: s.text?.trim() || '',
    startMs: Math.round((s.start || 0) * 1000),
    endMs: Math.round((s.end || 0) * 1000),
    words: words.filter(
      (w) => w.startMs >= Math.round((s.start || 0) * 1000) && w.endMs <= Math.round((s.end || 0) * 1000)
    ),
  }));

  const durationMs = data.duration ? Math.round(data.duration * 1000) :
    segments.length > 0 ? segments[segments.length - 1].endMs : 0;

  return {
    text: data.text || '',
    language: data.language || 'he',
    words,
    segments,
    durationMs,
  };
}

/**
 * Convert transcription result to Remotion-compatible subtitle entries.
 * Groups words into short phrases (3-5 words) for TikTok-style captions.
 */
export function transcriptionToSubtitles(
  transcription: TranscriptionResult,
  wordsPerGroup: number = 4,
): { segId: string; startMs: number; endMs: number; text: string }[] {
  const { words } = transcription;
  if (words.length === 0) return [];

  const subtitles: { segId: string; startMs: number; endMs: number; text: string }[] = [];

  for (let i = 0; i < words.length; i += wordsPerGroup) {
    const group = words.slice(i, i + wordsPerGroup);
    if (group.length === 0) continue;

    subtitles.push({
      segId: `sub-${subtitles.length}`,
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      text: group.map(w => w.word).join(' '),
    });
  }

  return subtitles;
}
