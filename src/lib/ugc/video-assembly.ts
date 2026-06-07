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
}

const KEN_BURNS = ['zoomIn', 'zoomOut', 'slideLeft', 'slideRight', 'slideUp'];

/** Build a Shotstack edit JSON from the assembly input. */
export function buildTimeline(input: AssembleInput) {
  const T = Math.max(6, Math.min(120, input.durationSec || 30));
  const { width, height } = input.format;

  // B-roll layout: keep the avatar open for the first 4s, then alternate
  // ~3.2s B-roll cutaways with ~2s of avatar between them, leaving the last 2.5s
  // on the avatar (call-to-action / sign-off).
  const OPEN = 4, CLIP = 3.2, GAP = 2, TAIL = 2.5;
  const brollClips: any[] = [];
  let t = OPEN;
  let idx = 0;
  const items = (input.broll || []).filter((b) => b && b.src);
  while (items.length && t + CLIP <= T - TAIL) {
    const it = items[idx % items.length];
    if (it.type === 'video') {
      // Real B-roll clip — muted so the avatar's voice keeps playing underneath.
      brollClips.push({ asset: { type: 'video', src: it.src, volume: 0 }, start: +t.toFixed(2), length: CLIP, transition: { in: 'fade', out: 'fade' }, fit: 'cover' });
    } else {
      brollClips.push({ asset: { type: 'image', src: it.src }, start: +t.toFixed(2), length: CLIP, effect: KEN_BURNS[idx % KEN_BURNS.length], transition: { in: 'fade', out: 'fade' }, fit: 'cover' });
    }
    t += CLIP + GAP; idx++;
  }

  // Branded intro lower-third (first 3.2s).
  const titleClips = input.businessName ? [{
    asset: { type: 'title', text: input.businessName, style: 'subtitle', size: 'medium', position: 'bottom', color: '#ffffff', background: input.brandColor || '#00B5FE' },
    start: 0.4, length: 3, transition: { in: 'slideUp', out: 'fade' },
  }] : [];

  return {
    timeline: {
      background: '#000000',
      tracks: [
        ...(titleClips.length ? [{ clips: titleClips }] : []),  // top: title
        ...(brollClips.length ? [{ clips: brollClips }] : []),  // mid: B-roll cutaways
        { clips: [{ asset: { type: 'video', src: input.avatarUrl, volume: 1 }, start: 0, length: T, fit: 'cover' }] }, // base: avatar + audio
      ],
    },
    output: { format: 'mp4', size: { width, height }, fps: 30 },
  };
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
