import { NextRequest, NextResponse } from 'next/server';
import { GET as dailyProgressScan } from '@/app/api/seo-geo-plans/cron/daily-progress-scan/route';
import { GET as dailyRunner } from '@/app/api/seo-geo-plans/cron/daily-runner/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Unified Daily SEO Cron — רץ ב-05:00 UTC (08:00 ישראל)
 * שלב 1: סריקת התקדמות (daily-progress-scan)
 * שלב 2: ביצוע משימות (daily-runner)
 *
 * IMPORTANT: Sub-routes are imported and called directly (not via fetch)
 * to avoid spawning separate serverless functions that timeout independently.
 */
export async function GET(req: NextRequest) {
  const startTs = Date.now();

  // Auth check — Vercel sends CRON_SECRET automatically for cron invocations
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[UNIFIED-CRON] ❌ Auth failed. Header:', authHeader ? 'present' : 'missing');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[UNIFIED-CRON] ⚠️ CRON_SECRET not set — skipping auth check');
  }

  console.log('[UNIFIED-CRON] ✅ Starting daily SEO cron at', new Date().toISOString());

  const results: Record<string, any> = {};

  // Step 1: Daily progress scan — called directly (no HTTP fetch)
  try {
    console.log('[UNIFIED-CRON] Step 1: Running daily progress scan...');
    const scanResponse = await dailyProgressScan(req);
    results.progressScan = await scanResponse.json();
    console.log('[UNIFIED-CRON] Step 1 complete:', results.progressScan?.plansProcessed || 0, 'plans scanned');
  } catch (error) {
    results.progressScan = { error: error instanceof Error ? error.message : 'Failed' };
    console.error('[UNIFIED-CRON] Step 1 failed:', error);
  }

  // Step 2: Daily task runner — called directly (no HTTP fetch)
  try {
    console.log('[UNIFIED-CRON] Step 2: Running daily task runner...');
    const runnerResponse = await dailyRunner(req);
    results.taskRunner = await runnerResponse.json();
    console.log('[UNIFIED-CRON] Step 2 complete:', results.taskRunner?.plansProcessed || 0, 'plans processed');
  } catch (error) {
    results.taskRunner = { error: error instanceof Error ? error.message : 'Failed' };
    console.error('[UNIFIED-CRON] Step 2 failed:', error);
  }

  const durationMs = Date.now() - startTs;
  const hasErrors = !!(results.progressScan?.error || results.taskRunner?.error);
  console.log(`[UNIFIED-CRON] ${hasErrors ? '⚠️' : '✅'} Cron finished in ${durationMs}ms. Errors: ${hasErrors}`);

  return NextResponse.json({
    success: !hasErrors,
    executedAt: new Date().toISOString(),
    durationMs,
    results,
  }, hasErrors ? { status: 207 } : {});
}
