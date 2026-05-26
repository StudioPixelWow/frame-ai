import { NextRequest, NextResponse } from 'next/server';
import { GET as dailyProgressScan } from '@/app/api/seo-geo-plans/cron/daily-progress-scan/route';
import { GET as dailyRunner } from '@/app/api/seo-geo-plans/cron/daily-runner/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * TIME BUDGET (total 300s max):
 *   Step 1 (progress scan): max 120s — keyword/AI platform checks
 *   Step 2 (daily runner):  max 150s — task execution (HIGHER PRIORITY)
 *   Buffer: 30s for overhead, logging, DB queries
 *
 * CRITICAL: Step 2 (task runner) ALWAYS runs, even if step 1 fails or times out.
 * This is the most important step — it executes the 60-day plan tasks.
 */
const STEP1_TIMEOUT_MS = 120_000; // 2 minutes for progress scan
const STEP2_TIMEOUT_MS = 150_000; // 2.5 minutes for daily runner

/**
 * Unified Daily SEO Cron — רץ ב-05:00 UTC (08:00 ישראל)
 * שלב 1: סריקת התקדמות (daily-progress-scan) — limited to 120s
 * שלב 2: ביצוע משימות (daily-runner) — ALWAYS runs, up to 150s
 *
 * IMPORTANT: Sub-routes are imported and called directly (not via fetch)
 * to avoid spawning separate serverless functions that timeout independently.
 */
export async function GET(req: NextRequest) {
  const startTs = Date.now();
  const elapsed = () => `${Date.now() - startTs}ms`;

  // Auth check — Vercel sends CRON_SECRET automatically for cron invocations
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error(`[UNIFIED-CRON] ❌ Auth failed (${elapsed()}). Header:`, authHeader ? `present (${authHeader.slice(0, 20)}...)` : 'MISSING');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`[UNIFIED-CRON] ✅ Auth passed`);
  } else {
    console.warn('[UNIFIED-CRON] ⚠️ CRON_SECRET not set — skipping auth check');
  }

  console.log(`[UNIFIED-CRON] ========== STARTING DAILY SEO CRON ==========`);
  console.log(`[UNIFIED-CRON] Time: ${new Date().toISOString()}`);
  console.log(`[UNIFIED-CRON] Budget: step1=${STEP1_TIMEOUT_MS}ms, step2=${STEP2_TIMEOUT_MS}ms`);

  const results: Record<string, any> = {};

  // ── Step 1: Daily progress scan (time-limited) ──
  // This step checks keyword rankings and AI visibility.
  // If it times out, that's OK — step 2 is more important.
  try {
    console.log(`[UNIFIED-CRON] Step 1: Running daily progress scan... (${elapsed()})`);
    const step1Result = await Promise.race([
      (async () => {
        const response = await dailyProgressScan(req);
        return await response.json();
      })(),
      new Promise<{ error: string; timedOut: true }>((_, reject) =>
        setTimeout(() => reject(new Error(`Step 1 timed out after ${STEP1_TIMEOUT_MS}ms`)), STEP1_TIMEOUT_MS)
      ),
    ]);
    results.progressScan = step1Result;
    console.log(`[UNIFIED-CRON] Step 1 complete (${elapsed()}):`, results.progressScan?.plansProcessed || 0, 'plans scanned');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed';
    const isTimeout = msg.includes('timed out');
    results.progressScan = { error: msg, timedOut: isTimeout };
    console.error(`[UNIFIED-CRON] Step 1 ${isTimeout ? 'TIMED OUT' : 'FAILED'} (${elapsed()}):`, msg);
  }

  // ── Step 2: Daily task runner (ALWAYS runs) ──
  // This is the critical step — executes 60-day plan tasks.
  // It MUST run even if step 1 failed or timed out.
  const step2Start = Date.now();
  try {
    console.log(`[UNIFIED-CRON] Step 2: Running daily task runner... (${elapsed()})`);
    const step2Result = await Promise.race([
      (async () => {
        const response = await dailyRunner(req);
        return await response.json();
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Step 2 timed out after ${STEP2_TIMEOUT_MS}ms`)), STEP2_TIMEOUT_MS)
      ),
    ]);
    results.taskRunner = step2Result;
    const step2Duration = Date.now() - step2Start;
    console.log(`[UNIFIED-CRON] Step 2 complete (${step2Duration}ms, total ${elapsed()}):`, results.taskRunner?.plansProcessed || 0, 'plans processed');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed';
    const isTimeout = msg.includes('timed out');
    results.taskRunner = { error: msg, timedOut: isTimeout };
    console.error(`[UNIFIED-CRON] Step 2 ${isTimeout ? 'TIMED OUT' : 'FAILED'} (${elapsed()}):`, msg);
  }

  const durationMs = Date.now() - startTs;
  const step1Ok = !results.progressScan?.error;
  const step2Ok = !results.taskRunner?.error;
  const status = step1Ok && step2Ok ? 'ALL_OK' : step2Ok ? 'SCAN_FAILED_RUNNER_OK' : 'RUNNER_FAILED';

  console.log(`[UNIFIED-CRON] ========== CRON FINISHED ==========`);
  console.log(`[UNIFIED-CRON] Status: ${status}`);
  console.log(`[UNIFIED-CRON] Duration: ${durationMs}ms`);
  console.log(`[UNIFIED-CRON] Step 1 (scan): ${step1Ok ? '✅' : '❌'} ${JSON.stringify(results.progressScan?.error || results.progressScan?.plansProcessed + ' plans')}`);
  console.log(`[UNIFIED-CRON] Step 2 (runner): ${step2Ok ? '✅' : '❌'} ${JSON.stringify(results.taskRunner?.error || results.taskRunner?.plansProcessed + ' plans')}`);

  return NextResponse.json({
    success: step2Ok, // success = runner worked (most important)
    status,
    executedAt: new Date().toISOString(),
    durationMs,
    results,
  }, (!step1Ok || !step2Ok) ? { status: 207 } : {});
}
