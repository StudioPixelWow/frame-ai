import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Unified Daily SEO Cron — אחד ב-Vercel Hobby (מגבלה: 1 cron)
 * רץ ב-05:00 UTC (08:00 ישראל)
 * שלב 1: סריקת התקדמות (daily-progress-scan)
 * שלב 2: ביצוע משימות (daily-runner)
 *
 * NOTE: On Vercel Hobby plan, function timeout is 10-60s.
 * The sub-routes are called directly (not via fetch) to avoid
 * spawning separate serverless functions that could independently timeout.
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
  console.log('[UNIFIED-CRON] ENV check: CRON_SECRET=', process.env.CRON_SECRET ? 'SET' : 'NOT SET',
    'NEXT_PUBLIC_APP_URL=', process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
    'VERCEL_URL=', process.env.VERCEL_URL || 'NOT SET');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  console.log('[UNIFIED-CRON] baseUrl =', baseUrl);

  const results: Record<string, any> = {};
  const authHeaders: Record<string, string> = process.env.CRON_SECRET
    ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
    : {};

  // Step 1: Daily progress scan
  try {
    console.log('[UNIFIED-CRON] Step 1: Running daily progress scan...');
    const scanRes = await fetch(`${baseUrl}/api/seo-geo-plans/cron/daily-progress-scan`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(55000), // 55s timeout to leave room for step 2
    });
    if (!scanRes.ok) {
      const text = await scanRes.text();
      results.progressScan = { error: `HTTP ${scanRes.status}: ${text.slice(0, 200)}` };
      console.error('[UNIFIED-CRON] Step 1 HTTP error:', scanRes.status, text.slice(0, 200));
    } else {
      results.progressScan = await scanRes.json();
      console.log('[UNIFIED-CRON] Step 1 complete:', results.progressScan?.plansProcessed || 0, 'plans scanned');
    }
  } catch (error) {
    results.progressScan = { error: error instanceof Error ? error.message : 'Failed' };
    console.error('[UNIFIED-CRON] Step 1 failed:', error);
  }

  // Step 2: Daily task runner
  try {
    console.log('[UNIFIED-CRON] Step 2: Running daily task runner...');
    const runnerRes = await fetch(`${baseUrl}/api/seo-geo-plans/cron/daily-runner`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(120000), // 2min timeout — runner may process multiple tasks
    });
    if (!runnerRes.ok) {
      const text = await runnerRes.text();
      results.taskRunner = { error: `HTTP ${runnerRes.status}: ${text.slice(0, 200)}` };
      console.error('[UNIFIED-CRON] Step 2 HTTP error:', runnerRes.status, text.slice(0, 200));
    } else {
      results.taskRunner = await runnerRes.json();
      console.log('[UNIFIED-CRON] Step 2 complete:', results.taskRunner?.plansProcessed || 0, 'plans processed');
    }
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
