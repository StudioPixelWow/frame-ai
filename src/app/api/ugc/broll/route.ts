/**
 * POST /api/ugc/broll   { image (url or data-url), prompt }
 * Starts an image→video B-roll clip (Replicate). Hosts data-urls to public
 * storage first. Returns { predictionId }. Poll /api/ugc/broll/status?id=.
 * Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { isBrollVideoConfigured, startClip } from '@/lib/ugc/broll-video';
import { hostDataUrl } from '@/lib/ugc/video-assembly';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!isBrollVideoConfigured()) return NextResponse.json({ error: 'יצירת B-roll וידאו לא מוגדרת — הוסף REPLICATE_API_TOKEN' }, { status: 503 });
  try {
    const { image, prompt, model } = await req.json();
    if (!image) return NextResponse.json({ error: 'חסרה תמונת מקור' }, { status: 400 });
    const imageUrl = await hostDataUrl(image, 'broll-src');
    if (!imageUrl) return NextResponse.json({ error: 'העלאת תמונת המקור נכשלה' }, { status: 502 });
    const { id } = await startClip(imageUrl, prompt || '', model);
    return NextResponse.json({ ok: true, predictionId: id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'יצירת הקליפ נכשלה' }, { status: 502 });
  }
}
