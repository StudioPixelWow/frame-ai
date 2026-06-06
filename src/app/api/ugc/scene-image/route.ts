/**
 * POST /api/ugc/scene-image
 * Body: { prompt?, shotType, vo, direction, businessName, businessType, style,
 *         productName?, productImageUrl?, avatarImageUrl? }
 *
 * Generates one vertical 9:16 UGC-style storyboard scene.
 *
 * Strategy (most capable → most compatible):
 *   1. gpt-image-1 + images/edits — uses the chosen avatar likeness + the REAL
 *      product as visual references (best result). Requires an OpenAI org that is
 *      verified for gpt-image-1.
 *   2. gpt-image-1 + images/generations — text-only (no references).
 *   3. dall-e-3 + images/generations — works WITHOUT org verification, 1024x1792
 *      vertical. References can't be attached, so we describe them in the prompt.
 *
 * If everything fails we return the REAL OpenAI error so the user knows whether
 * it's billing/quota, verification, or something else. Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby caps at 60s — keep our own timeouts under this.

const OAI = 'https://api.openai.com/v1';

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OpenAI לא מוגדר (חסר OPENAI_API_KEY)' }, { status: 503 });

  try {
    const { prompt, shotType, vo, direction, businessName, businessType, style, productName, productImageUrl, avatarImageUrl } = await req.json();
    const scene = direction || vo || shotType || 'scene';
    const hasAvatar = !!avatarImageUrl;
    const hasProduct = !!productImageUrl;

    const builtPrompt = (prompt && String(prompt).trim()) || [
      `Vertical 9:16 UGC-style smartphone shot — handheld, authentic, natural lighting, looks filmed on a phone.`,
      hasAvatar ? `Feature the SAME presenter from the reference image (keep their face, hair, gender and overall look consistent).` : '',
      productName ? `Feature this exact product accurately: ${productName}.` : '',
      `Scene: ${scene}.`,
      shotType ? `Shot type: ${shotType}.` : '',
      businessName ? `Business: ${businessName}${businessType ? ` (${businessType})` : ''}.` : '',
      style ? `Style: ${style}.` : '',
      `No text overlays, no watermark.`,
    ].filter(Boolean).join(' ');

    const attempts: string[] = [];

    // ── Attempt 1: gpt-image-1 edits with avatar + product references ──
    const refs: { url: string; name: string }[] = [];
    if (avatarImageUrl) refs.push({ url: avatarImageUrl, name: 'presenter.png' });
    if (productImageUrl) refs.push({ url: productImageUrl, name: 'product.png' });

    if (refs.length > 0) {
      try {
        const fd = new FormData();
        fd.append('model', 'gpt-image-1');
        let ok = false;
        for (const ref of refs) {
          try {
            const imgRes = await fetch(ref.url, { signal: AbortSignal.timeout(12000) });
            if (!imgRes.ok) continue;
            const buf = Buffer.from(await imgRes.arrayBuffer());
            if (buf.length && buf.length < 20 * 1024 * 1024) {
              fd.append('image[]', new Blob([new Uint8Array(buf)], { type: imgRes.headers.get('content-type') || 'image/png' }), ref.name);
              ok = true;
            }
          } catch { /* skip this ref */ }
        }
        if (ok) {
          fd.append('prompt', `${builtPrompt} Use the reference image(s): keep the presenter's likeness and the product's true design, color and proportions.`);
          fd.append('size', '1024x1536');
          fd.append('quality', 'medium');
          fd.append('n', '1');
          const res = await fetch(`${OAI}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: fd, signal: AbortSignal.timeout(52000) });
          const r = await readImage(res);
          if (r.b64) return NextResponse.json({ image: `data:image/png;base64,${r.b64}`, usedPrompt: builtPrompt, engine: 'gpt-image-1+refs' });
          attempts.push(`gpt-image-1/edits: ${r.err}`);
        }
      } catch (e) { attempts.push(`gpt-image-1/edits: ${e instanceof Error ? e.message : 'failed'}`); }
    }

    // ── Attempt 2: gpt-image-1 text-to-image ──
    try {
      const res = await fetch(`${OAI}/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-image-1', prompt: builtPrompt, size: '1024x1536', n: 1, quality: 'medium' }),
        signal: AbortSignal.timeout(52000),
      });
      const r = await readImage(res);
      if (r.b64) return NextResponse.json({ image: `data:image/png;base64,${r.b64}`, usedPrompt: builtPrompt, engine: 'gpt-image-1' });
      attempts.push(`gpt-image-1: ${r.err}`);
      // If gpt-image-1 is unavailable for this org, fall through to dall-e-3.
    } catch (e) { attempts.push(`gpt-image-1: ${e instanceof Error ? e.message : 'failed'}`); }

    // ── Attempt 3: dall-e-3 (no org verification needed) ──
    try {
      // dall-e-3 can't take image references — bake the description into the prompt.
      const dallePrompt = [
        builtPrompt,
        hasProduct ? `Important: the product should match a real commercial product as closely as possible.` : '',
      ].filter(Boolean).join(' ').slice(0, 3900);
      const res = await fetch(`${OAI}/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt: dallePrompt, size: '1024x1792', n: 1, quality: 'standard', response_format: 'b64_json' }),
        signal: AbortSignal.timeout(52000),
      });
      const r = await readImage(res);
      if (r.b64) return NextResponse.json({ image: `data:image/png;base64,${r.b64}`, usedPrompt: builtPrompt, engine: 'dall-e-3' });
      attempts.push(`dall-e-3: ${r.err}`);
    } catch (e) { attempts.push(`dall-e-3: ${e instanceof Error ? e.message : 'failed'}`); }

    // ── All engines failed — return the clearest reason ──
    const joined = attempts.join(' | ');
    let friendly = 'יצירת התמונה נכשלה.';
    if (/quota|insufficient_quota|429|billing/i.test(joined)) friendly = 'חרגת ממכסת OpenAI / אין יתרה (429) — הוסף קרדיט ב-platform.openai.com ← Billing.';
    else if (/must be verified|verify your organization|not.*access.*gpt-image/i.test(joined)) friendly = 'הארגון ב-OpenAI לא מאומת ל-gpt-image-1, וגם DALL·E נכשל — בדוק את החשבון ב-OpenAI.';
    else if (/timeout|aborted/i.test(joined)) friendly = 'יצירת התמונה ארכה מדי. נסה שוב, או הורד את האיכות.';
    else if (joined) friendly = 'OpenAI: ' + joined.slice(0, 220);
    return NextResponse.json({ error: friendly, detail: joined }, { status: 502 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
  // dall-e-3 may return a url if response_format wasn't honored — fetch & convert.
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
