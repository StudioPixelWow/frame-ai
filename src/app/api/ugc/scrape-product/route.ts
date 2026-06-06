/**
 * POST /api/ugc/scrape-product  { url }
 *
 * Paste a product/landing-page URL → the server fetches the page and an AI
 * extracts the brief fields (name, description, selling points, price, images,
 * suggested audience). Same principle as Sparkiz's "paste a link", built on our
 * own OpenAI. Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { generateWithAI } from '@/lib/ai/openai-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  try {
    let { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'url נדרש' }, { status: 400 });
    if (!/^https?:\/\//.test(url)) url = `https://${url}`;

    // Fetch the page (server-side, with a browser UA + timeout).
    let html = '';
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PixelManageAI/1.0)' },
        signal: AbortSignal.timeout(15000),
      });
      html = await res.text();
    } catch (e) {
      return NextResponse.json({ error: `לא ניתן לטעון את העמוד: ${e instanceof Error ? e.message : 'שגיאה'}` }, { status: 502 });
    }

    // Extract candidate images (og:image + <img src>) before stripping tags.
    const images: string[] = [];
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (og?.[1]) images.push(og[1]);
    const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const src of imgMatches) {
      if (images.length >= 8) break;
      if (/\.(png|jpe?g|webp)(\?|$)/i.test(src) && !/(logo|icon|sprite|pixel|tracking)/i.test(src)) {
        images.push(src.startsWith('http') ? src : new URL(src, url).href);
      }
    }

    // Title + meta description as anchors.
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';

    // Strip to readable text (capped) for the AI.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);

    let data: any = {};
    try {
      const out = await generateWithAI(
        'אתה מחלץ פרטי מוצר/עסק מעמוד אינטרנט לצורך תסריט UGC. החזר JSON תקין בלבד, בעברית.',
        `כותרת: ${title}\nתיאור מטא: ${metaDesc}\nתוכן העמוד:\n${text}\n\nהחזר JSON: {"businessName":"שם המוצר/העסק","businessType":"נדל״ן/מסעדה/חנות/קליניקה/שירות/לוגיסטיקה/אולם/אחר","description":"תיאור קצר","sellingPoints":"3-5 נקודות מכירה מופרדות בפסיק","price":"מחיר אם מופיע אחרת ריק","targetAudience":"קהל יעד משוער"}`,
        { temperature: 0.3, maxTokens: 600 },
      );
      data = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
    } catch {
      data = { businessName: title, description: metaDesc, sellingPoints: '', businessType: 'אחר', targetAudience: '' };
    }

    return NextResponse.json({
      success: true,
      prefill: {
        businessName: data.businessName || title || '',
        businessType: data.businessType || 'אחר',
        description: data.description || metaDesc || '',
        sellingPoints: data.sellingPoints || '',
        targetAudience: data.targetAudience || '',
        price: data.price || '',
      },
      images: [...new Set(images)].slice(0, 8),
      sourceUrl: url,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
