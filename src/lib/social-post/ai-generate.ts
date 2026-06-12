/**
 * AI full-post generator (server-side).
 *
 * Generates a FINISHED social-media post — visual + integrated Hebrew typography
 * + brand styling — in one shot using a text-capable image model. No rigid
 * template: the model designs each post differently, grounded in the brand's
 * logo/asset references.
 *
 * Engine ladder (most capable → most compatible):
 *   1. gpt-image-1 /images/edits  — conditions on brand reference images (best).
 *   2. gpt-image-1 /images/generations — text-only.
 *   3. dall-e-3 /images/generations — works without org verification (weaker text).
 */

const OAI = 'https://api.openai.com/v1';

export interface FullPostResult { b64?: string; engine?: string; error?: string }

/** Reads an OpenAI image response → { b64 } on success or { err } with the real message. */
async function readImage(res: Response): Promise<{ b64?: string; err?: string }> {
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    let msg = `${res.status}`;
    try { const j = JSON.parse(t); msg = j?.error?.message || j?.error?.code || msg; } catch { if (t) msg = t.slice(0, 200); }
    return { err: msg };
  }
  const data = await res.json().catch(() => null);
  const b64 = data?.data?.[0]?.b64_json;
  if (b64) return { b64 };
  const url = data?.data?.[0]?.url;
  if (url) {
    try {
      const f = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const buf = Buffer.from(await f.arrayBuffer());
      return { b64: buf.toString('base64') };
    } catch { /* fall through */ }
  }
  return { err: 'no image in response' };
}

/**
 * Generate a finished post.
 * @param prompt      Full design brief (already includes the Hebrew headline/CTA).
 * @param refUrls     Brand reference images (logo + brand assets) for edits mode.
 * @param size        e.g. "1024x1536" portrait, "1024x1024" square.
 */
export async function generateFullPost(
  prompt: string,
  refUrls: string[] = [],
  size: '1024x1536' | '1024x1024' | '1536x1024' = '1024x1536',
): Promise<FullPostResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: 'openai_not_configured' };
  const attempts: string[] = [];

  // ── 1) gpt-image-1 + brand references (edits) ──
  const refs = refUrls.filter(Boolean).slice(0, 4);
  if (refs.length) {
    try {
      const fd = new FormData();
      fd.append('model', 'gpt-image-1');
      let ok = false;
      let i = 0;
      for (const url of refs) {
        try {
          const imgRes = await fetch(url, { signal: AbortSignal.timeout(12000) });
          if (!imgRes.ok) continue;
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length && buf.length < 20 * 1024 * 1024) {
            fd.append('image[]', new Blob([new Uint8Array(buf)], { type: imgRes.headers.get('content-type') || 'image/png' }), `ref${i++}.png`);
            ok = true;
          }
        } catch { /* skip */ }
      }
      if (ok) {
        fd.append('prompt', `${prompt} Use the reference image(s) ONLY for the brand's logo, exact colors and visual language — do not copy their layout.`);
        fd.append('size', size);
        fd.append('quality', 'high');
        fd.append('n', '1');
        const res = await fetch(`${OAI}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: fd, signal: AbortSignal.timeout(115000) });
        const r = await readImage(res);
        if (r.b64) return { b64: r.b64, engine: 'gpt-image-1+refs' };
        attempts.push(`edits: ${r.err}`);
      }
    } catch (e) { attempts.push(`edits: ${e instanceof Error ? e.message : 'failed'}`); }
  }

  // ── 2) gpt-image-1 text-to-image ──
  try {
    const res = await fetch(`${OAI}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size, n: 1, quality: 'high' }),
      signal: AbortSignal.timeout(115000),
    });
    const r = await readImage(res);
    if (r.b64) return { b64: r.b64, engine: 'gpt-image-1' };
    attempts.push(`gpt-image-1: ${r.err}`);
  } catch (e) { attempts.push(`gpt-image-1: ${e instanceof Error ? e.message : 'failed'}`); }

  // ── 3) dall-e-3 fallback ──
  try {
    const res = await fetch(`${OAI}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'dall-e-3', prompt: prompt.slice(0, 3900), size: '1024x1792', n: 1, quality: 'hd', response_format: 'b64_json' }),
      signal: AbortSignal.timeout(115000),
    });
    const r = await readImage(res);
    if (r.b64) return { b64: r.b64, engine: 'dall-e-3' };
    attempts.push(`dall-e-3: ${r.err}`);
  } catch (e) { attempts.push(`dall-e-3: ${e instanceof Error ? e.message : 'failed'}`); }

  const joined = attempts.join(' | ');
  let friendly = joined || 'generation_failed';
  if (/quota|insufficient_quota|429|billing/i.test(joined)) friendly = 'openai_quota';
  else if (/must be verified|verify your organization|not.*access.*gpt-image/i.test(joined)) friendly = 'openai_not_verified';
  else if (/timeout|aborted/i.test(joined)) friendly = 'timeout';
  return { error: friendly };
}
