/**
 * B-roll video generator — turns a storyboard FRAME (image) + its prompt into a
 * short motion clip, via Replicate (which hosts image-to-video models like Kling,
 * Luma, Stable Video Diffusion). Provider-abstracted + async (create prediction →
 * poll), because clip generation takes 1–3 min.
 *
 * Model is configurable via BROLL_VIDEO_MODEL (default: kwaivgi/kling-v1.6-standard).
 * Requires REPLICATE_API_TOKEN. Without it the UGC module falls back to still B-roll.
 */

const TOKEN = () => process.env.REPLICATE_API_TOKEN || '';
const MODEL = () => process.env.BROLL_VIDEO_MODEL || 'kwaivgi/kling-v1.6-standard';

export function isBrollVideoConfigured(): boolean { return !!TOKEN(); }

/** Start an image→video prediction. Returns the prediction id. */
export async function startClip(imageUrl: string, prompt: string): Promise<{ id: string }> {
  if (!isBrollVideoConfigured()) throw new Error('יצירת B-roll וידאו לא מוגדרת (חסר REPLICATE_API_TOKEN)');
  // Generic input that fits most Replicate image-to-video models; extra keys are
  // ignored by models that don't use them.
  const input: Record<string, unknown> = {
    prompt: prompt || 'cinematic product b-roll, smooth camera motion',
    start_image: imageUrl,
    image: imageUrl,
    duration: 5,
    cfg_scale: 0.5,
  };
  const res = await fetch(`https://api.replicate.com/v1/models/${MODEL()}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.id) throw new Error(j?.detail || j?.title || `Replicate failed (${res.status})`);
  return { id: j.id };
}

export interface ClipStatus { status: string; url?: string; error?: string; }

/** Poll a prediction. status: starting | processing | succeeded | failed | canceled. */
export async function getClip(id: string): Promise<ClipStatus> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: { Authorization: `Bearer ${TOKEN()}` } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { status: 'failed', error: j?.detail || `status ${res.status}` };
  let url: string | undefined;
  const out = j?.output;
  if (typeof out === 'string') url = out;
  else if (Array.isArray(out) && out.length) url = out[out.length - 1];
  else if (out?.video) url = out.video;
  return { status: j?.status || 'unknown', url, error: j?.error };
}

export function clipStageLabel(status: string): string {
  switch (status) {
    case 'starting': return 'מתחיל יצירת קליפ…';
    case 'processing': return 'מייצר וידאו מהתמונה…';
    case 'succeeded': return 'מוכן!';
    case 'failed': case 'canceled': return 'נכשל';
    default: return 'מעבד…';
  }
}
