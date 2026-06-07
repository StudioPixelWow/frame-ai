/**
 * POST /api/ugc/assemble
 * Body: { avatarUrl, images[] (urls or data-urls), durationSec, format{width,height}, businessName?, brandColor? }
 *
 * Assembles a full UGC clip (avatar speech + Ken-Burns B-roll) via Shotstack.
 * Hosts any base64 storyboard frames to public storage first. Returns a render
 * id + the env, which the client polls via /api/ugc/assemble/status. Admin/employee.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { isShotstackConfigured, hostDataUrl, buildTimeline, submitRender, MUSIC_PRESETS } from '@/lib/ugc/video-assembly';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!isShotstackConfigured()) return NextResponse.json({ error: 'Shotstack לא מוגדר — הוסף SHOTSTACK_API_KEY ו-SHOTSTACK_ENV' }, { status: 503 });
  try {
    const { avatarUrl, images, brollVideos, durationSec, format, businessName, brandColor, music, musicUrl, musicVolume, transition } = await req.json();
    const resolvedMusic = musicUrl || MUSIC_PRESETS[music as string] || '';
    if (!avatarUrl) return NextResponse.json({ error: 'חסר וידאו דמות (avatarUrl) — הפק קודם וידאו HeyGen' }, { status: 400 });

    // Prefer real B-roll video clips; otherwise fall back to Ken-Burns still frames.
    const broll: { src: string; type: 'image' | 'video' }[] = [];
    if (Array.isArray(brollVideos) && brollVideos.filter(Boolean).length) {
      for (const u of brollVideos.filter(Boolean)) broll.push({ src: u, type: 'video' });
    } else {
      for (let i = 0; i < (Array.isArray(images) ? images.length : 0); i++) {
        const u = await hostDataUrl(images[i], `scene${i}`);
        if (u) broll.push({ src: u, type: 'image' });
      }
    }

    const edit = buildTimeline({
      avatarUrl,
      broll,
      durationSec: Number(durationSec) || 30,
      format: { width: format?.width || 1080, height: format?.height || 1920 },
      businessName: businessName || '',
      brandColor: brandColor || '#00B5FE',
      musicUrl: resolvedMusic,
      musicVolume: typeof musicVolume === 'number' ? musicVolume : 0.12,
      transition: transition || 'fade',
    });

    const { id } = await submitRender(edit);
    return NextResponse.json({ ok: true, renderId: id, brollCount: broll.length, brollType: broll[0]?.type || 'none' });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'הרכבת הווידאו נכשלה' }, { status: 502 });
  }
}
