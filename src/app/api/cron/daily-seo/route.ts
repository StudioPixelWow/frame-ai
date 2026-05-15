import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Unified Daily SEO Cron — אחד ב-Vercel Hobby (מגבלה: 1 cron)
 * רץ ב-05:00 UTC (08:00 ישראל)
 * שלב 1: סריקת התקדמות (daily-progress-scan)
 * שלב 2: ביצוע משימות (daily-runner)
 */
export async function GET(req: NextRequest) {
  // Auth check
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[UNIFIED-CRON] Starting daily SEO cron at', new Date().toISOString());

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const results: Record<string, any> = {};

  // Step 1: Daily progress scan
  try {
    console.log('[UNIFIED-CRON] Step 1: Running daily progress scan...');
    const scanRes = await fetch(`${baseUrl}/api/seo-geo-plans/cron/daily-progress-scan`, {
      headers: process.env.CRON_SECRET
        ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
        : {},
    });
    results.progressScan = await scanRes.json();
    console.log('[UNIFIED-CRON] Step 1 complete:', results.progressScan?.plansProcessed || 0, 'plans scanned');
  } catch (error) {
    results.progressScan = { error: error instanceof Error ? error.message : 'Failed' };
    console.error('[UNIFIED-CRON] Step 1 failed:', error);
  }

  // Step 2: Daily task runner
  try {
    console.log('[UNIFIED-CRON] Step 2: Running daily task runner...');
    const runnerRes = await fetch(`${baseUrl}/api/seo-geo-plans/cron/daily-runner`, {
      headers: process.env.CRON_SECRET
        ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
        : {},
    });
    results.taskRunner = await runnerRes.json();
    console.log('[UNIFIED-CRON] Step 2 complete:', results.taskRunner?.plansProcessed || 0, 'plans processed');
  } catch (error) {
    results.taskRunner = { error: error instanceof Error ? error.message : 'Failed' };
    console.error('[UNIFIED-CRON] Step 2 failed:', error);
  }

  return NextResponse.json({
    success: true,
    executedAt: new Date().toISOString(),
    results,
  });
}
