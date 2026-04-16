/**
 * GET /api/data/heygen/voices — proxy to HeyGen API to list available voices
 */

import { NextResponse } from 'next/server';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || '';
const HEYGEN_BASE = 'https://api.heygen.com';

export async function GET() {
  if (!HEYGEN_API_KEY) {
    return NextResponse.json({ error: 'HEYGEN_API_KEY not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${HEYGEN_BASE}/v2/voices`, {
      headers: { 'X-Api-Key': HEYGEN_API_KEY },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[heygen/voices] API error:', res.status, text);
      return NextResponse.json({ error: `HeyGen API error: ${res.status}` }, { status: res.status });
    }

    const json = await res.json();
    // json.data.voices is the array
    const voices = json?.data?.voices ?? [];
    return NextResponse.json(voices);
  } catch (err: any) {
    console.error('[heygen/voices] fetch error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Failed to fetch voices' }, { status: 500 });
  }
}
