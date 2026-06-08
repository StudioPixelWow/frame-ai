/**
 * GET  /api/ugc/voice          → list ElevenLabs voices (incl. cloned).
 * POST /api/ugc/voice  { text, voiceId } → generate voiceover MP3 → public URL.
 * Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { isVoiceCloneConfigured, listVoices, generateVoiceover } from '@/lib/ugc/voice-clone';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  return NextResponse.json({ configured: isVoiceCloneConfigured(), voices: await listVoices() });
}

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!isVoiceCloneConfigured()) return NextResponse.json({ error: 'שיבוט קול לא מוגדר — הוסף ELEVENLABS_API_KEY' }, { status: 503 });
  try {
    const { text, voiceId } = await req.json();
    if (!text || !voiceId) return NextResponse.json({ error: 'text ו-voiceId נדרשים' }, { status: 400 });
    const url = await generateVoiceover(String(text), String(voiceId));
    if (!url) return NextResponse.json({ error: 'יצירת הקריינות נכשלה' }, { status: 502 });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'שגיאה' }, { status: 502 });
  }
}
