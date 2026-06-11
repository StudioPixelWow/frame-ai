/**
 * Higgsfield Cloud API client (server-side only).
 *
 * Auth (per the official @higgsfield/client v2 SDK):
 *   Authorization: Key <KEY_ID>:<KEY_SECRET>
 * Configure in Vercel env (any of these work):
 *   HIGGSFIELD_API_KEY     = the API Key ID      (a.k.a HF_API_KEY)
 *   HIGGSFIELD_API_SECRET  = the API Key Secret   (a.k.a HF_SECRET)
 *   HIGGSFIELD_CREDENTIALS = "KEY_ID:KEY_SECRET"  (a.k.a HF_CREDENTIALS, single var)
 *   HIGGSFIELD_BASE_URL    = (optional) override, default https://platform.higgsfield.ai
 *
 * Generation is async/queue-based: POST a job → poll /requests/{request_id}/status
 * until status="completed" → image URLs. Every call surfaces the raw status so we
 * can diagnose failures instead of failing silently.
 */

function creds(): { key: string; secret: string } {
  const combined = process.env.HIGGSFIELD_CREDENTIALS || process.env.HF_CREDENTIALS || '';
  if (combined.includes(':')) {
    const [k, ...rest] = combined.split(':');
    return { key: (k || '').trim(), secret: rest.join(':').trim() };
  }
  return {
    key: (process.env.HIGGSFIELD_API_KEY || process.env.HF_API_KEY || '').trim(),
    secret: (process.env.HIGGSFIELD_API_SECRET || process.env.HF_SECRET || '').trim(),
  };
}
const BASE = () => (process.env.HIGGSFIELD_BASE_URL || 'https://platform.higgsfield.ai').replace(/\/$/, '');

export function higgsfieldConfigured(): boolean { const { key, secret } = creds(); return !!(key && secret); }

function headers(): Record<string, string> {
  const { key, secret } = creds();
  return {
    // Official v2 scheme.
    Authorization: `Key ${key}:${secret}`,
    // Legacy headers kept as a harmless fallback for older gateways.
    'hf-api-key': key,
    'hf-secret': secret,
    'User-Agent': 'frame-ai-server/1.0',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
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
    let errMsg: string | undefined;
    if (!r.ok) {
      const pick = data?.message ?? data?.error ?? data?.detail ?? data;
      let msg: string;
      if (typeof pick === 'string') msg = pick;
      else if (pick == null) msg = '';
      else { try { msg = JSON.stringify(pick); } catch { msg = String(pick); } }
      errMsg = `http_${r.status}${msg ? `: ${msg.slice(0, 400)}` : ''}`;
    }
    return { ok: r.ok, status: r.status, data, error: errMsg };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : 'request_failed' };
  }
}

export interface SoulImageOpts {
  count?: number;            // batch size (default 4 → A/B/C/D)
  size?: string;             // width_and_height, e.g. "1536x2048" (portrait), "1536x1536"
  quality?: '720p' | '1080p' | 'sd' | 'hd';
  referenceImageUrls?: string[]; // brand assets / logo for visual-language conditioning
  negativePrompt?: string;
  seed?: number;
  webhookUrl?: string;
}

// Higgsfield Soul accepts a fixed set of width_and_height strings.
const SOUL_SIZES = ['1536x1536', '1536x2048', '2048x1536'];
function normalizeSize(size?: string): string {
  if (size && SOUL_SIZES.includes(size)) return size;
  if (size === '2048x2048' || !size) return '1536x1536';
  // portrait-ish → 1536x2048, landscape-ish → 2048x1536
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (m) { const w = +m[1], h = +m[2]; return h > w ? '1536x2048' : w > h ? '2048x1536' : '1536x1536'; }
  return '1536x1536';
}
function normalizeQuality(q?: string): string {
  if (q === '720p' || q === 'sd') return '720p';
  return '1080p'; // default / hd
}

/** Kick off a Soul text-to-image generation. Returns the request id(s). */
export async function startSoulImages(prompt: string, opts: SoulImageOpts = {}): Promise<{ ok: boolean; jobs: string[]; raw: any; error?: string; immediateUrls?: string[] }> {
  // Higgsfield wraps all generation fields under a top-level `params` object.
  const params: any = {
    prompt,
    width_and_height: normalizeSize(opts.size),
    quality: normalizeQuality(opts.quality),
    batch_size: opts.count ?? 4,
  };
  if (opts.seed !== undefined) params.seed = opts.seed;
  if (opts.referenceImageUrls?.length) {
    // Soul expects reference images as typed objects.
    params.input_images = opts.referenceImageUrls.map((url) => ({ type: 'image_url', image_url: url }));
  }
  if (opts.negativePrompt) params.negative_prompt = opts.negativePrompt;

  const body: any = { params };
  if (opts.webhookUrl) body.webhook = { url: opts.webhookUrl };

  const res = await hfRequest('/v1/text2image/soul', { method: 'POST', body, timeoutMs: 45000 });
  if (!res.ok) return { ok: false, jobs: [], raw: res.data, error: res.error };

  const d = res.data || {};
  // The pollable id is the TOP-LEVEL request id (maps to /requests/{id}/status).
  // The nested jobs[].id are sub-jobs and are NOT pollable that way — ignore them.
  const requestId = d.request_id || d.id || d.data?.request_id || d.data?.id;
  const jobs: string[] = requestId ? [String(requestId)] : [];

  // Sometimes the POST already returns completed images.
  const immediateUrls = extractImageUrls(d);

  if (jobs.length === 0 && immediateUrls.length === 0) {
    return { ok: false, jobs: [], raw: d, error: 'no_request_id' };
  }
  return { ok: true, jobs: Array.from(new Set(jobs)), raw: d, immediateUrls };
}

/** Extract image URLs from a job-status payload (tolerant of shapes). */
export function extractImageUrls(payload: any): string[] {
  const urls: string[] = [];
  // Control URLs returned by the API that are NOT images.
  const isControl = (u: string) => /\/requests\/[^/]+\/(status|cancel)\b/i.test(u);
  const isImageUrl = (u: string) => /^https?:\/\/.+\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u);
  const pushUrl = (u: any) => { if (typeof u === 'string' && /^https?:\/\//i.test(u) && !isControl(u)) urls.push(u); };
  const visit = (v: any, keyHint?: string) => {
    if (!v) return;
    if (typeof v === 'string') {
      // Skip the status/cancel control keys entirely.
      if (keyHint && /^(status_url|cancel_url|webhook|callback)$/i.test(keyHint)) return;
      // An image file URL, OR a value under an image-result key (url/raw/min/image).
      if (isImageUrl(v)) pushUrl(v);
      else if (keyHint && /^(url|image|image_url|raw|min|thumbnail)$/i.test(keyHint)) pushUrl(v);
    } else if (Array.isArray(v)) v.forEach((x) => visit(x, keyHint));
    else if (typeof v === 'object') for (const k of Object.keys(v)) visit(v[k], k);
  };
  visit(payload);
  return Array.from(new Set(urls));
}

/** Poll a request until it completes (or times out). Uses /requests/{id}/status. */
export async function pollSoulJob(requestId: string, opts: { tries?: number; intervalMs?: number } = {}): Promise<{ done: boolean; urls: string[]; status: string; raw: any }> {
  const tries = opts.tries || 20;
  const interval = opts.intervalMs || 3000;
  let lastRaw: any = null;
  for (let i = 0; i < tries; i++) {
    const res = await hfRequest(`/requests/${requestId}/status`);
    const d = res.data || {};
    lastRaw = d;
    const status = String(d.status || d.state || (res.ok ? 'pending' : 'error')).toLowerCase();
    const urls = extractImageUrls(d);
    if (urls.length || status === 'completed' || status === 'succeeded' || status === 'done') {
      return { done: true, urls, status, raw: d };
    }
    if (status === 'failed' || status === 'error' || status === 'canceled' || status === 'nsfw') {
      return { done: false, urls: [], status, raw: d };
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return { done: false, urls: [], status: 'timeout', raw: lastRaw };
}

/** One-shot helper: generate N images and wait for the URLs. */
export async function generateSoulImages(prompt: string, opts: SoulImageOpts = {}): Promise<{ ok: boolean; urls: string[]; error?: string; raw?: any }> {
  const start = await startSoulImages(prompt, opts);
  if (start.immediateUrls?.length) return { ok: true, urls: start.immediateUrls, raw: start.raw };
  if (!start.ok || !start.jobs.length) return { ok: false, urls: [], error: start.error || 'no_job', raw: start.raw };
  const all: string[] = [];
  let lastStatus = '';
  for (const jobId of start.jobs) {
    const polled = await pollSoulJob(jobId);
    lastStatus = polled.status;
    all.push(...polled.urls);
  }
  return { ok: all.length > 0, urls: Array.from(new Set(all)), raw: start.raw, error: all.length ? undefined : (lastStatus || 'no_images') };
}
