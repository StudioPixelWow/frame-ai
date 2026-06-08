/**
 * Voice cloning / premium TTS via ElevenLabs. Generates a voiceover track in the
 * client's own (cloned) voice or any ElevenLabs voice, which the assembly can use
 * instead of the avatar's generic audio. Provider-abstracted; requires
 * ELEVENLABS_API_KEY. Without it the UGC module keeps using the HeyGen voice.
 */

import { uploadToStorage } from '@/lib/storage/upload';

const KEY = () => process.env.ELEVENLABS_API_KEY || '';
const BASE = 'https://api.elevenlabs.io/v1';

export function isVoiceCloneConfigured(): boolean { return !!KEY(); }

/** List available ElevenLabs voices (including the account's cloned voices). */
export async function listVoices(): Promise<{ id: string; name: string; category?: string }[]> {
  if (!isVoiceCloneConfigured()) return [];
  try {
    const res = await fetch(`${BASE}/voices`, { headers: { 'xi-api-key': KEY() } });
    const j = await res.json().catch(() => ({}));
    return (j?.voices || []).map((v: any) => ({ id: v.voice_id, name: v.name, category: v.category }));
  } catch { return []; }
}

/** Text → speech (multilingual) → uploaded public MP3 URL. */
export async function generateVoiceover(text: string, voiceId: string): Promise<string | null> {
  if (!isVoiceCloneConfigured()) throw new Error('שיבוט קול לא מוגדר (חסר ELEVENLABS_API_KEY)');
  if (!voiceId) throw new Error('בחר קול');
  const res = await fetch(`${BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: (text || '').slice(0, 4000), model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
  });
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`ElevenLabs ${res.status}: ${t.slice(0, 160)}`); }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('לא התקבל אודיו');
  const up = await uploadToStorage({ buffer: buf, fileName: `ugc/voiceover-${Date.now()}.mp3`, contentType: 'audio/mpeg' });
  return (up as any)?.publicUrl || null;
}
