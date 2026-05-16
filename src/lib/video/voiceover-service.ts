/**
 * Hebrew AI Voiceover Service
 * Uses ElevenLabs multilingual_v2 for Hebrew TTS.
 * Based on remotion-best-practices skill guidelines.
 */

// Types
export interface VoiceoverRequest {
  text: string;
  voiceId?: string;  // ElevenLabs voice ID, defaults to a multilingual voice
  stability?: number;  // 0-1, default 0.5
  similarityBoost?: number;  // 0-1, default 0.75
  style?: number;  // 0-1, default 0.3
}

export interface VoiceoverResult {
  audioBuffer: Buffer;
  contentType: string;
  durationEstimateMs: number;
}

// Default voice IDs known to support Hebrew
const DEFAULT_HEBREW_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';  // Rachel - multilingual

/**
 * Generate Hebrew voiceover using ElevenLabs multilingual_v2 model.
 * CRITICAL: Must use eleven_multilingual_v2 for Hebrew support.
 */
export async function generateVoiceover(request: VoiceoverRequest): Promise<VoiceoverResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('[Voiceover] ELEVENLABS_API_KEY is required');
  }

  const voiceId = request.voiceId || DEFAULT_HEBREW_VOICE_ID;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: request.text,
        model_id: 'eleven_multilingual_v2',  // REQUIRED for Hebrew -- never use monolingual
        voice_settings: {
          stability: request.stability ?? 0.5,
          similarity_boost: request.similarityBoost ?? 0.75,
          style: request.style ?? 0.3,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[Voiceover] ElevenLabs API error ${response.status}: ${errorText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  // Rough estimate: Hebrew speech ~130 words/minute
  const wordCount = request.text.split(/\s+/).length;
  const durationEstimateMs = Math.round((wordCount / 130) * 60 * 1000);

  return {
    audioBuffer,
    contentType: 'audio/mpeg',
    durationEstimateMs,
  };
}

/**
 * Generate voiceover for multiple segments and return as array.
 * Useful for generating per-scene audio for Remotion compositions.
 */
export async function generateSegmentVoiceovers(
  segments: { id: string; text: string }[],
  voiceId?: string,
): Promise<{ segmentId: string; audio: VoiceoverResult }[]> {
  const results: { segmentId: string; audio: VoiceoverResult }[] = [];

  for (const segment of segments) {
    if (!segment.text.trim()) continue;

    const audio = await generateVoiceover({
      text: segment.text,
      voiceId,
    });

    results.push({ segmentId: segment.id, audio });
  }

  return results;
}
