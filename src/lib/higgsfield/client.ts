/**
 * Higgsfield Cloud API client (server-side only).
 *
 * Auth: API Key ID + Secret sent as `hf-api-key` / `hf-secret` headers (the
 * official Higgsfield SDK scheme). Configure in Vercel env:
 *   HIGGSFIELD_API_KEY     = the API Key ID
 *   HIGGSFIELD_API_SECRET  = the API Key Secret
 *   HIGGSFIELD_BASE_URL    = (optional) override, default https://platform.higgsfield.ai
 *
 * Generation is async/queue-based: POST a job → poll until completed → image URLs.
 * Every call is best-effort and surfaces the raw status so we can diagnose.
 */

const KEY = () => process.env.HIGGSFIELD_API_KEY || process.env.HF_API_KEY || '';
const SECRET = () => process.env.HIGGSFIELD_API_SECRET || process.env.HF_SECRET || '';
const BASE = () => (process.env.HIGGSFIELD_BASE_URL || 'https://platform.higgsfield.ai').replace(/\/$/, '');

export function higgsfieldConfigured(): boolean { return !!(KEY() && SECRET()); }

function headers(): Record<string, string> {
  return { 'hf-api-key': KEY(), 'hf-secret': SECRET(), 'Content-Type': 'application/json', Accept: 'application/json' };
}

export interface HfResult { ok: boolean; status: number; data: any; error?: string }

/** Low-level request with the Higgsfield auth headers. */
export async function hfRequest(path: string, init?: { method?: string; body?: any; timeoutMs?: number }): Promise<HfResult> {
  if (!higgsfieldConfigured()) return { ok: false, status: 0, data: null, error: 'no_credentials' };
  const url = path.startsWith('http') ? path : `${BASE()}${path.startsWith('/') ? '' : '/'}${path}`;
  try {
    const r = await fetch(url, {
      method: init?.method || 'GET',
      headers: headers(),
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init?.timeoutMs || 30000),
    });
    let data: any = null;
    try { data = await r.json(); } catch { try { data = await r.text(); } catch { data = null; } }
    return { ok: r.ok, status: r.status, data, error: r.ok ? undefined : (data?.message || data?.error || `http_${r.status}`) };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : 'request_failed' };
  }
}

export interface SoulImageOpts {
  count?: number;            // batch size (default 4 → A/B/C/D)
  size?: string;             // width_and_height, e.g. "1536x2048" (portrait), "2048x2048"
  quality?: '720p' | '1080p';
  referenceImageUrls?: string[]; // brand assets / logo for visual-language conditioning
  negativePrompt?: string;
  webhookUrl?: string;
}

export interface SoulJob { id: string | null; raw: any }

/** Kick off a Soul text-to-image generation. Returns the job id(s). */
export async function startSoulImages(prompt: string, opts: SoulImageOpts = {}): Promise<{ ok: boolean; jobs: string[]; raw: any; error?: string }> {
  const body: any = {
    prompt,
    width_and_height: opts.size || '1536x2048',
    quality: opts.quality || '1080p',
    batch_size: opts.count ?? 4,
  };
  if (opts.referenceImageUrls?.length) body.reference_images = opts.referenceImageUrls;
  if (opts.negativePrompt) body.negative_prompt = opts.negativePrompt;
  if (opts.webhookUrl) body.webhook = { url: opts.webhookUrl };

  const res = await hfRequest('/v1/text2image/soul', { method: 'POST', body, timeoutMs: 45000 });
  if (!res.ok) return { ok: false, jobs: [], raw: res.data, error: res.error };
  // Response shapes vary: { id }, { jobs:[{id}] }, { data:{ id } } …
  const d = res.data || {};
  const jobs: string[] = [];
  if (d.id) jobs.push(String(d.id));
  if (Array.isArray(d.jobs)) for (const j of d.jobs) if (j?.id) jobs.push(String(j.id));
  if (d.data?.id) jobs.push(String(d.data.id));
  return { ok: true, jobs: Array.from(new Set(jobs)), raw: d };
}

/** Extract image URLs from a job-status payload (tolerant of shapes). */
export function extractImageUrls(payload: any): string[] {
  const urls: string[] = [];
  const visit = (v: any) => {
    if (!v) return;
    if (typeof v === 'string' && /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?|$)/i.test(v)) urls.push(v);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (typeof v === 'object') for (const k of Object.keys(v)) visit(v[k]);
  };
  visit(payload);
  return Array.from(new Set(urls));
}

/** Poll a job until it completes (or times out). */
export async function pollSoulJob(jobId: string, opts: { tries?: number; intervalMs?: number } = {}): Promise<{ done: boolean; urls: string[]; status: string; raw: any }> {
  const tries = opts.tries || 20;
  const interval = opts.intervalMs || 3000;
  for (let i = 0; i < tries; i++) {
    const res = await hfRequest(`/v1/text2image/soul/${jobId}`);
    const d = res.data || {};
    const status = String(d.status || d.state || (res.ok ? 'pending' : 'error')).toLowerCase();
    const urls = extractImageUrls(d);
    if (urls.length || status === 'completed' || status === 'succeeded' || status === 'done') {
      return { done: true, urls, status, raw: d };
    }
    if (status === 'failed' || status === 'error' || status === 'canceled') {
      return { done: false, urls: [], status, raw: d };
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return { done: false, urls: [], status: 'timeout', raw: null };
}

/** One-shot helper: generate N images and wait for the URLs. */
export async function generateSoulImages(prompt: string, opts: SoulImageOpts = {}): Promise<{ ok: boolean; urls: string[]; error?: string; raw?: any }> {
  const start = await startSoulImages(prompt, opts);
  if (!start.ok || !start.jobs.length) return { ok: false, urls: [], error: start.error || 'no_job', raw: start.raw };
  const all: string[] = [];
  for (const jobId of start.jobs) {
    const polled = await pollSoulJob(jobId);
    all.push(...polled.urls);
  }
  return { ok: all.length > 0, urls: Array.from(new Set(all)), raw: start.raw, error: all.length ? undefined : 'no_images' };
}
