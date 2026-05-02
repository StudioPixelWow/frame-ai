/**
 * POST /api/data/heygen/generate — create a UGC video via HeyGen API
 *
 * Body: { avatarId, voiceId, script, dimension? }
 * Returns: { videoId }
 */

import { NextRequest, NextResponse } from 'next/server';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || '';
const HEYGEN_BASE = 'https://api.heygen.com';

export async function POST(req: NextRequest) {
  if (!HEYGEN_API_KEY) {
    return NextResponse.json({ error: 'HEYGEN_API_KEY not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { avatarId, voiceId, script, dimension } = body;

    if (!avatarId || !voiceId || !script) {
      return NextResponse.json(
        { error: 'avatarId, voiceId, and script are required' },
        { status: 400 }
      );
    }

    const payload = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: avatarId,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: voiceId,
          },
          background: {
            type: 'color',
            value: '#FAFAFA',
          },
        },
      ],
      dimension: dimension || { width: 1080, height: 1920 }, // vertical UGC format
    };

    console.log('[heygen/generate] creating video with avatar:', avatarId, 'voice:', voiceId);

    const res = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
      method: 'POST',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error('[heygen/generate] API error:', res.status, JSON.stringify(json));
      return NextResponse.json(
        { error: json?.error?.message || json?.message || `HeyGen API error: ${res.status}` },
        { status: res.status }
      );
    }

    const videoId = json?.data?.video_id;
    if (!videoId) {
      console.error('[heygen/generate] no video_id in response:', JSON.stringify(json));
      return NextResponse.json({ error: 'No video_id returned from HeyGen' }, { status: 500 });
    }

    console.log('[heygen/generate] video created:', videoId);
    return NextResponse.json({ videoId });
  } catch (err: any) {
    console.error('[heygen/generate] error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Failed to generate video' }, { status: 500 });
  }
}
