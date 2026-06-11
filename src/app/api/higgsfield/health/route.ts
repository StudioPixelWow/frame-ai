/** GET /api/higgsfield/health        → reports whether Higgsfield is configured.
 *  GET /api/higgsfield/health?test=1  → fires a tiny 1-image generation to verify
 *      the credentials + endpoint, returning the RAW response for diagnosis.
 *  Staff only. The ?test=1 call costs ~1 Higgsfield credit. */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { higgsfieldConfigured, startSoulImages, pollSoulJob } from '@/lib/higgsfield/client';

function trim(v: any) { try { const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > 1500 ? s.slice(0, 1500) + '…' : s; } catch { return String(v); } }

export async function GET(req: NextRequest) {
  const configured = higgsfieldConfigured();
  if (!configured) return NextResponse.json({ configured: false, message: 'חסרים HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET ב-Vercel' });

  if (req.nextUrl.searchParams.get('test') !== '1') {
    return NextResponse.json({ configured: true, baseUrl: process.env.HIGGSFIELD_BASE_URL || 'https://platform.higgsfield.ai', message: 'מוגדר. הוסף ?test=1 כדי לבדוק קריאה אמיתית.' });
  }

  // Real probe — start a single tiny generation and report the raw response.
  const start = await startSoulImages('minimal abstract brand color swatch, clean studio background', { count: 1, size: '2048x2048', quality: '720p' });
  let poll: any = null;
  if (start.ok && start.jobs[0]) {
    poll = await pollSoulJob(start.jobs[0], { tries: 18, intervalMs: 3000 }); // ~54s, under maxDuration 60
  }
  return NextResponse.json({
    configured: true,
    started: start.ok,
    error: start.error || null,
    jobs: start.jobs,
    rawStart: trim(start.raw),
    pollStatus: poll?.status || null,
    images: poll?.urls || [],
    rawPoll: poll ? trim(poll.raw) : null,
  });
}
