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
import { isShotstackConfigured, hostDataUrl, buildTimeline, submitRender, buildCaptions, MUSIC_PRESETS, MUSIC_BEAT } from '@/lib/ugc/video-assembly';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!isShotstackConfigured()) return NextResponse.json({ error: 'Shotstack לא מוגדר — הוסף SHOTSTACK_API_KEY ו-SHOTSTACK_ENV' }, { status: 503 });
  try {
    const { avatarUrl, images, brollVideos, durationSec, format, businessName, brandColor, music, musicUrl, musicVolume, transition, script, captionsOn, logoUrl, ctaText, pip, hookText, hookOn, lang, voiceoverUrl } = await req.json();
    const resolvedMusic = musicUrl || MUSIC_PRESETS[music as string] || '';
    const dur = Number(durationSec) || 30;
    // #11 Multilingual: localize the on-screen text (captions + CTA) to the chosen language.
    const LANG_NAMES: Record<string, string> = { en: 'English', ar: 'Arabic', ru: 'Russian', fr: 'French', es: 'Spanish' };
    let captionScript = String(script || '');
    let localizedCta = ctaText || '';
    if (lang && lang !== 'he' && LANG_NAMES[lang]) {
      try {
        const { generateWithAI } = await import('@/lib/ai/openai-client');
        const out = await generateWithAI(`Translate to ${LANG_NAMES[lang]}. Return JSON only.`, `Translate these for on-screen video text. Return {"script":"...","cta":"..."}\nscript: ${captionScript}\ncta: ${localizedCta}`, { temperature: 0.2, maxTokens: 1200 });
        const d: any = out?.success ? out.data : null;
        const j = typeof d === 'string' ? JSON.parse(d.slice(d.indexOf('{'), d.lastIndexOf('}') + 1)) : d;
        if (j?.script) captionScript = j.script;
        if (j?.cta) localizedCta = j.cta;
      } catch { /* keep original on failure */ }
    }
    const captions = (captionsOn !== false && captionScript) ? buildCaptions(captionScript, 0.4, dur - 0.4) : [];
    const beatSec = MUSIC_BEAT[music as string] || 3.2;
    // #4 Hook: explicit text, else the first line of the (localized) script.
    const hook = (hookOn !== false) ? (hookText || captionScript.split(/[.!?\n]/)[0]?.trim().slice(0, 60) || '') : '';
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
      captions,
      logoUrl: logoUrl || '',
      ctaText: localizedCta,
      pip: !!pip,
      hookText: hook,
      beatSec,
      voiceoverUrl: voiceoverUrl || undefined,
    });

    const { id } = await submitRender(edit);
    return NextResponse.json({ ok: true, renderId: id, brollCount: broll.length, brollType: broll[0]?.type || 'none' });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'הרכבת הווידאו נכשלה' }, { status: 502 });
  }
}
