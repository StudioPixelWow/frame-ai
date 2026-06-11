/**
 * GET /api/proxy-image?url=<external image url>
 *
 * Streams an external image back through our own origin so a <canvas> that draws
 * it stays "clean" (not tainted) and can be exported with toDataURL/toBlob.
 * Used by Creative PixelAI when a creative is opened via deep-link (?src=).
 *
 * Safety: only http/https, only image content-types, size-capped.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'url נדרש' }, { status: 400 });

  let target: URL;
  try { target = new URL(raw); } catch { return NextResponse.json({ error: 'url לא תקין' }, { status: 400 }); }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'פרוטוקול לא נתמך' }, { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'FrameAI-ImageProxy/1.0', Accept: 'image/*' },
      redirect: 'follow',
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: `מקור החזיר ${upstream.status}` }, { status: 502 });
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'הכתובת אינה תמונה' }, { status: 415 });
    }
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'התמונה גדולה מדי' }, { status: 413 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'טעינת התמונה נכשלה' }, { status: 502 });
  }
}
