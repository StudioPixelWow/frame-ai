/**
 * Daily Meta Ads Optimizer Cron
 *
 * Runs daily (06:00 UTC / 09:00 Israel) via Vercel cron.
 * Directly calls the daily-optimize POST handler (no HTTP self-fetch):
 *   1. Sync latest data from Meta for all connected clients
 *   2. Analyze performance + CPL trends
 *   3. Pause underperformers, create new audiences, generate ad variations
 *   4. Generate daily status reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST as dailyOptimize } from '@/app/api/meta-business/daily-optimize/route';

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

  try {
    // Create a fake POST request with empty body for the daily-optimize handler
    const fakeReq = new NextRequest(new URL('/api/meta-business/daily-optimize', req.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await dailyOptimize(fakeReq);
    const data = await response.json();
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
