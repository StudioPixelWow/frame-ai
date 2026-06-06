/**
 * POST /api/ugc/scene-image
 * Body: { prompt?, shotType, vo, direction, businessName, businessType, style,
 *         productName?, productImageUrl? }
 *
 * Generates one vertical 9:16 UGC-style storyboard scene. If a product image is
 * provided it is used as a visual REFERENCE (images/edits) so the scene features
 * the REAL product — not a random stand-in. Scenes are product/B-roll focused
 * (the talking presenter comes from the HeyGen avatar, so we don't invent a
 * conflicting full presenter). A custom `prompt` (edited by the user) overrides
 * the auto-built one. Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OpenAI לא מוגדר' }, { status: 503 });
  try {
    const { prompt, shotType, vo, direction, businessName, businessType, style, productName, productImageUrl, avatarImageUrl } = await req.json();
    const scene = direction || vo || shotType || 'scene';
    const hasAvatar = !!avatarImageUrl;
    const builtPrompt = (prompt && String(prompt).trim()) || [
      `Vertical 9:16 UGC-style smartphone shot — handheld, authentic, natural lighting, looks filmed on a phone.`,
      hasAvatar ? `The SAME presenter from the reference image (keep their face, hair, gender and overall look consistent) appears in the scene.` : '',
      productName ? `Feature this exact product accurately: ${productName}.` : '',
      `Scene: ${scene}.`,
      shotType ? `Shot type: ${shotType}.` : '',
      businessName ? `Business: ${businessName}${businessType ? ` (${businessType})` : ''}.` : '',
      style ? `Style: ${style}.` : '',
      `No text overlays, no watermark.`,
    ].filter(Boolean).join(' ');

    // Collect reference images: avatar (presenter likeness) + product. images/edits
    // accepts multiple reference images for gpt-image-1.
    const refs: { url: string; name: string }[] = [];
    if (avatarImageUrl) refs.push({ url: avatarImageUrl, name: 'presenter.png' });
    if (productImageUrl) refs.push({ url: productImageUrl, name: 'product.png' });

    let res: Response;
    if (refs.length > 0) {
      try {
        const fd = new FormData();
        fd.append('model', 'gpt-image-1');
        let ok = false;
        for (const ref of refs) {
          const imgRes = await fetch(ref.url, { signal: AbortSignal.timeout(15000) });
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length && buf.length < 20 * 1024 * 1024) { fd.append('image[]', new Blob([new Uint8Array(buf)], { type: imgRes.headers.get('content-type') || 'image/png' }), ref.name); ok = true; }
        }
        if (ok) {
          fd.append('prompt', `${builtPrompt} Use the reference image(s): keep the presenter's likeness and the product's true design, color and proportions.`);
          fd.append('size', '1024x1536');
          fd.append('quality', 'medium');
          fd.append('n', '1');
          res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: fd, signal: AbortSignal.timeout(110000) });
        } else {
          res = await genText(apiKey, builtPrompt);
        }
      } catch {
        res = await genText(apiKey, builtPrompt);
      }
    } else {
      res = await genText(apiKey, builtPrompt);
    }

    if (!res.ok) {
      const t = await res.text();
      let friendly = `שגיאת OpenAI (${res.status})`;
      if (/quota|429/i.test(t) || res.status === 429) friendly = 'חרגת ממכסת OpenAI (429) — בדוק חיוב/יתרה.';
      else if (/must be verified|organization/i.test(t)) friendly = 'הארגון ב-OpenAI לא מאומת ליצירת תמונות.';
      else if (t.length) friendly = 'OpenAI: ' + t.slice(0, 160);
      return NextResponse.json({ error: friendly }, { status: 502 });
    }
    const data = await res.json().catch(() => null);
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: 'לא התקבלה תמונה' }, { status: 502 });
    return NextResponse.json({ image: `data:image/png;base64,${b64}`, usedPrompt: builtPrompt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed';
    if (/abort|timeout/i.test(msg)) return NextResponse.json({ error: 'היצירה ארכה מדי — נסה שוב' }, { status: 504 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function genText(apiKey: string, prompt: string): Promise<Response> {
  return fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1536', n: 1, quality: 'medium' }),
    signal: AbortSignal.timeout(110000),
  });
}
