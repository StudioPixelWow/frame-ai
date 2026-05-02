/**
 * GET /api/data/heygen/avatars — proxy to HeyGen API to list available avatars
 */

import { NextResponse } from 'next/server';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || '';
const HEYGEN_BASE = 'https://api.heygen.com';

export async function GET() {
  if (!HEYGEN_API_KEY) {
    return NextResponse.json({ error: 'HEYGEN_API_KEY not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${HEYGEN_BASE}/v2/avatars`, {
      headers: { 'X-Api-Key': HEYGEN_API_KEY },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[heygen/avatars] API error:', res.status, text);
      return NextResponse.json({ error: `HeyGen API error: ${res.status}` }, { status: res.status });
    }

    const json = await res.json();
    // json.data.avatars is the array
    const avatars = json?.data?.avatars ?? [];
    return NextResponse.json(avatars);
  } catch (err: any) {
    console.error('[heygen/avatars] fetch error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Failed to fetch avatars' }, { status: 500 });
  }
}
