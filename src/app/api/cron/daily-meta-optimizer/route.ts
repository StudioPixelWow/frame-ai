/**
 * Daily Meta Ads Optimizer Cron
 *
 * Runs daily (06:00 UTC / 09:00 Israel) via Vercel cron.
 * Calls /api/meta-business/daily-optimize to:
 *   1. Sync latest data from Meta for all connected clients
 *   2. Analyze performance + CPL trends
 *   3. Pause underperformers, create new audiences, generate ad variations
 *   4. Generate daily status reports
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const startTs = Date.now();

  // Auth check
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[META-CRON] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[META-CRON] Starting daily Meta optimizer at', new Date().toISOString());

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  try {
    const res = await fetch(`${baseUrl}/api/meta-business/daily-optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // all clients
    });

    const data = await res.json();
    const elapsed = Date.now() - startTs;

    console.log(`[META-CRON] Completed in ${elapsed}ms — ${data.clientsProcessed || 0} clients processed`);

    return NextResponse.json({
      success: true,
      elapsed,
      ...data,
    });
  } catch (error) {
    const elapsed = Date.now() - startTs;
    console.error(`[META-CRON] Failed after ${elapsed}ms:`, error);
    return NextResponse.json({
      success: false,
      elapsed,
      error: String(error),
    }, { status: 500 });
  }
}
