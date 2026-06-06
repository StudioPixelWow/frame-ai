/**
 * POST /api/ugc/scene-image  { shotType, vo, direction, businessName, businessType, style }
 * Generates one vertical 9:16 UGC-style scene image for a storyboard shot
 * (text-to-image via GPT Image). Returns a data URL. Admin/employee only.
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
    const { shotType, vo, direction, businessName, businessType, style } = await req.json();
    const scene = direction || vo || shotType || 'scene';
    const prompt = [
      `Vertical 9:16 UGC-style smartphone shot — handheld, authentic, natural lighting, looks filmed on a phone (not a polished studio ad).`,
      `Scene: ${scene}.`,
      shotType ? `Shot type: ${shotType}.` : '',
      businessName ? `Business: ${businessName}${businessType ? ` (${businessType})` : ''}.` : '',
      style ? `Style: ${style}.` : '',
      `Realistic, candid, no text overlays, no watermark.`,
    ].filter(Boolean).join(' ');

    const callGen = (model: string) => fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt, size: '1024x1536', n: 1, quality: 'medium' }),
      signal: AbortSignal.timeout(110000),
    });

    let res = await callGen('gpt-image-1');
    if (!res.ok) {
      const t = await res.text();
      let friendly = `שגיאת OpenAI (${res.status})`;
      if (/must be verified|verify your organization|organization/i.test(t)) friendly = 'הארגון ב-OpenAI לא מאומת ליצירת תמונות — אמת ב-platform.openai.com ונסה שוב.';
      else if (t.length) friendly = 'OpenAI: ' + t.slice(0, 160);
      return NextResponse.json({ error: friendly }, { status: 502 });
    }
    const data = await res.json().catch(() => null);
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: 'לא התקבלה תמונה' }, { status: 502 });
    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed';
    if (/abort|timeout/i.test(msg)) return NextResponse.json({ error: 'היצירה ארכה מדי — נסה שוב' }, { status: 504 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
