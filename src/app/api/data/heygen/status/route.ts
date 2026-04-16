/**
 * GET /api/data/heygen/status?videoId=xxx — check video generation status
 *
 * Returns: { status, videoUrl?, thumbnailUrl? }
 */

import { NextRequest, NextResponse } from 'next/server';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || '';
const HEYGEN_BASE = 'https://api.heygen.com';

export async function GET(req: NextRequest) {
  if (!HEYGEN_API_KEY) {
    return NextResponse.json({ error: 'HEYGEN_API_KEY not configured' }, { status: 500 });
  }

  const url = new URL(req.url);
  const videoId = url.searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'videoId query param is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': HEYGEN_API_KEY },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[heygen/status] API error:', res.status, text);
      return NextResponse.json({ error: `HeyGen API error: ${res.status}` }, { status: res.status });
    }

    const json = await res.json();
    const data = json?.data;

    return NextResponse.json({
      status: data?.status ?? 'unknown',
      videoUrl: data?.video_url ?? null,
      thumbnailUrl: data?.thumbnail_url ?? null,
      duration: data?.duration ?? null,
      error: data?.error ?? null,
    });
  } catch (err: any) {
    console.error('[heygen/status] error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Failed to check status' }, { status: 500 });
  }
}
