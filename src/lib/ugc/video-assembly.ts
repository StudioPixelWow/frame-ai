/**
 * VideoAssemblyService — turns a UGC storyboard into ONE finished clip with
 * speech + motion, using Shotstack (cloud video renderer). Provider-abstracted:
 * the rest of the app only calls these functions, so Shotstack can be swapped
 * later (Creatomate / Remotion / FFmpeg) without touching callers.
 *
 * Pipeline: the HeyGen avatar clip is the BASE (provides the spoken audio +
 * presenter shots); the storyboard images are laid over it as Ken-Burns B-roll
 * cutaways at timed intervals (audio keeps playing underneath), plus a branded
 * intro lower-third. Output respects the chosen aspect (9:16 / 4:5 / 1:1 / 16:9).
 *
 * Shotstack images/videos must be PUBLIC URLs — base64 storyboard frames are
 * uploaded to public storage first.
 */

import { uploadToStorage } from '@/lib/storage/upload';

const ENV = () => (process.env.SHOTSTACK_ENV === 'v1' ? 'v1' : (process.env.SHOTSTACK_ENV || 'stage'));
const KEY = () => process.env.SHOTSTACK_API_KEY || '';
const BASE = () => `https://api.shotstack.io/edit/${ENV()}`;

export function isShotstackConfigured(): boolean { return !!KEY(); }

/** Upload a base64 data URL (storyboard frame) to public storage → public URL. */
export async function hostDataUrl(dataUrl: string, name: string): Promise<string | null> {
  try {
    if (!dataUrl) return null;
    if (/^https?:\/\//.test(dataUrl)) return dataUrl; // already a URL
    const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return null;
    const contentType = m[1] || 'image/png';
    const buffer = Buffer.from(m[2], 'base64');
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const res = await uploadToStorage({ buffer, fileName: `ugc/broll/${name}-${Date.now()}.${ext}`, contentType });
    return (res as any)?.publicUrl || null;
  } catch { return null; }
}

export interface BrollItem { src: string; type: 'image' | 'video'; }
export interface AssembleInput {
  avatarUrl: string;            // HeyGen rendered clip (has the voice)
  broll: BrollItem[];           // public URLs (images and/or video clips) for B-roll
  durationSec: number;          // total length (avatar clip length)
  format: { width: number; height: number };
  businessName?: string;
  brandColor?: string;
  musicUrl?: string;            // background soundtrack (optional)
  musicVolume?: number;         // 0..1 (default 0.12 so the voice stays clear)
  transition?: string;          // B-roll transition style
  captions?: { text: string; start: number; length: number }[]; // auto captions
  logoUrl?: string;             // brand logo for intro/outro cards
  ctaText?: string;             // outro call-to-action
  pip?: boolean;                // #1 presenter-in-scene: small talking avatar over B-roll
  hookText?: string;            // #4 big animated hook in the first ~3s
  beatSec?: number;             // #3 beat-synced cut length (from music BPM)
}

// #3 Approx tempo (seconds per cut) per music preset — cuts land on the beat feel.
export const MUSIC_BEAT: Record<string, number> = { none: 3.2, energetic: 2.0, upbeat: 2.4, calm: 4.0, corporate: 3.0 };

// Royalty-free soundtrack presets (Shotstack hosted sample assets).
export const MUSIC_PRESETS: Record<string, string> = {
  none: '',
  energetic: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/lit.mp3',
  upbeat: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/moment.mp3',
  calm: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/ambisax.mp3',
  corporate: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/berlin.mp3',
};
export const TRANSITIONS = ['fade', 'slideLeft', 'slideRight', 'zoom', 'wipeLeft', 'carouselLeft'];

const KEN_BURNS = ['zoomIn', 'zoomOut', 'slideLeft', 'slideRight', 'slideUp'];

/** Build a Shotstack edit JSON from the assembly input. */
export function buildTimeline(input: AssembleInput) {
  const T = Math.max(6, Math.min(120, input.durationSec || 30));
  const { width, height } = input.format;

  // B-roll layout: keep the avatar open for the first 4s, then alternate
  // ~3.2s B-roll cutaways with ~2s of avatar between them, leaving the last 2.5s
  // on the avatar (call-to-action / sign-off).
  // #3 Beat-synced cut length (from the chosen music's tempo), else default.
  const CLIP = Math.max(1.6, Math.min(4.5, input.beatSec || 3.2));
  const OPEN = 4, GAP = input.pip ? 0 : 2, TAIL = 2.5; // #1 PIP → continuous B-roll (no avatar gaps)
  const brollClips: any[] = [];
  const pipClips: any[] = []; // #1 small presenter overlay shown during B-roll
  let t = OPEN;
  let idx = 0;
  const items = (input.broll || []).filter((b) => b && b.src);
  const tr = (TRANSITIONS.includes(input.transition || '') ? input.transition : 'fade') as string;
  // PIP overlay placement: small avatar bottom-right.
  const pipScale = 0.34;
  const pipOffset = { x: 0.33, y: -0.33 };
  while (items.length && t + CLIP <= T - TAIL) {
    const it = items[idx % items.length];
    if (it.type === 'video') {
      brollClips.push({ asset: { type: 'video', src: it.src, volume: 0 }, start: +t.toFixed(2), length: CLIP, transition: { in: tr, out: tr }, fit: 'cover' });
    } else {
      brollClips.push({ asset: { type: 'image', src: it.src }, start: +t.toFixed(2), length: CLIP, effect: KEN_BURNS[idx % KEN_BURNS.length], transition: { in: tr, out: tr }, fit: 'cover' });
    }
    if (input.pip) {
      // Keep the talking presenter visible (muted copy — audio comes from the base track).
      pipClips.push({ asset: { type: 'video', src: input.avatarUrl, volume: 0 }, start: +t.toFixed(2), length: CLIP, fit: 'cover', scale: pipScale, offset: pipOffset, transition: { in: 'fade', out: 'fade' } });
    }
    t += CLIP + GAP; idx++;
  }

  // #4 Big animated hook in the first ~3s (pattern interrupt).
  const hookClips = input.hookText ? [{
    asset: { type: 'title', text: input.hookText, style: 'blockbuster', size: 'large', position: 'center', color: '#ffffff', background: input.brandColor || '#00B5FE' },
    start: 0.2, length: 2.8, transition: { in: 'zoom', out: 'fade' },
  }] : [];

  // ── Branded intro + outro cards (HTML) with optional logo ──
  const brand = input.brandColor || '#00B5FE';
  const esc = (s: string) => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cardCss = `.c{width:${width}px;height:${height}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;background:${brand};font-family:'Heebo',Arial,sans-serif} .c h1{color:#fff;font-size:${Math.round(width / 14)}px;font-weight:800;margin:0;text-align:center;padding:0 8%} .c p{color:#ffffffdd;font-size:${Math.round(width / 26)}px;margin:0;text-align:center} .c img{max-width:46%;max-height:32%;object-fit:contain}`;
  const logoTag = input.logoUrl ? `<img src="${input.logoUrl}"/>` : '';
  const cardClips: any[] = [];
  const INTRO = input.businessName ? 2.2 : 0;
  const OUTRO = (input.businessName || input.ctaText) ? 2.6 : 0;
  if (INTRO) cardClips.push({ asset: { type: 'html', html: `<div class="c">${logoTag}<h1>${esc(input.businessName || '')}</h1></div>`, css: cardCss, width, height, background: 'transparent' }, start: 0, length: INTRO, transition: { out: 'fade' }, fit: 'cover' });
  if (OUTRO) cardClips.push({ asset: { type: 'html', html: `<div class="c">${logoTag}<h1>${esc(input.businessName || '')}</h1>${input.ctaText ? `<p>${esc(input.ctaText)}</p>` : ''}</div>`, css: cardCss, width, height, background: 'transparent' }, start: +(T - OUTRO).toFixed(2), length: OUTRO, transition: { in: 'fade' }, fit: 'cover' });

  // ── Auto captions from the script (timed title clips at the bottom) ──
  const captionClips = (input.captions || []).map((c) => ({
    asset: { type: 'title', text: c.text, style: 'subtitle', size: 'small', position: 'bottom', color: '#ffffff', background: '#000000' },
    start: +c.start.toFixed(2), length: +c.length.toFixed(2), transition: { in: 'fade', out: 'fade' },
  }));

  const soundtrack = input.musicUrl ? { soundtrack: { src: input.musicUrl, effect: 'fadeInFadeOut', volume: input.musicVolume ?? 0.12 } } : {};

  return {
    timeline: {
      background: '#000000',
      ...soundtrack,
      tracks: [
        ...(cardClips.length ? [{ clips: cardClips }] : []),       // top: branded intro/outro
        ...(hookClips.length ? [{ clips: hookClips }] : []),       // #4 hook
        ...(captionClips.length ? [{ clips: captionClips }] : []), // #2 captions
        ...(pipClips.length ? [{ clips: pipClips }] : []),         // #1 presenter PIP overlay
        ...(brollClips.length ? [{ clips: brollClips }] : []),     // B-roll
        { clips: [{ asset: { type: 'video', src: input.avatarUrl, volume: 1 }, start: 0, length: T, fit: 'cover' }] }, // base: avatar + audio
      ],
    },
    output: { format: 'mp4', size: { width, height }, fps: 30 },
  };
}

/** Split a script into timed caption chunks across [from, to] seconds. */
export function buildCaptions(script: string, from: number, to: number): { text: string; start: number; length: number }[] {
  const clean = (script || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 6) chunks.push(words.slice(i, i + 6).join(' '));
  const span = Math.max(1, to - from);
  const totalChars = chunks.reduce((a, c) => a + c.length, 0) || 1;
  let cursor = from;
  return chunks.map((text) => {
    const len = Math.max(1.2, (text.length / totalChars) * span);
    const start = cursor; cursor += len;
    return { text, start, length: Math.min(len, to - start) };
  }).filter((c) => c.length > 0.4);
}

/** Submit a render. Returns the render id. */
export async function submitRender(edit: any): Promise<{ id: string }> {
  if (!isShotstackConfigured()) throw new Error('Shotstack לא מוגדר (חסר SHOTSTACK_API_KEY)');
  const res = await fetch(`${BASE()}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY() },
    body: JSON.stringify(edit),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.response?.id) throw new Error(j?.message || `Shotstack render failed (${res.status})`);
  return { id: j.response.id };
}

export interface RenderStatus { status: string; url?: string; error?: string; }

/** Poll a render's status. Shotstack: queued → fetching → rendering → saving → done | failed. */
export async function getRenderStatus(id: string): Promise<RenderStatus> {
  const res = await fetch(`${BASE()}/render/${id}`, { headers: { 'x-api-key': KEY() } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { status: 'failed', error: j?.message || `status ${res.status}` };
  const r = j?.response || {};
  return { status: r.status || 'unknown', url: r.url, error: r.error };
}

/** Friendly Hebrew stage label for a Shotstack status. */
export function stageLabel(status: string): string {
  switch (status) {
    case 'queued': return 'בתור עיבוד…';
    case 'fetching': return 'אוסף את הקליפים והתמונות…';
    case 'rendering': return 'מרכיב את הסרטון (דמות + B‑roll + קול)…';
    case 'saving': return 'כמעט מוכן — שומר…';
    case 'done': return 'מוכן!';
    case 'failed': return 'נכשל';
    default: return 'מעבד…';
  }
}
