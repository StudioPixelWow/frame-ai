/**
 * GET /api/cron/geo-automation  — the automation TICK.
 *
 * The heartbeat that makes the GEO system run for every active client without
 * any UI. Each tick:
 *   1. takes a global lock (no overlapping ticks)
 *   2. enrolls any new active plans
 *   3. enqueues due jobs (idempotent per plan/type/day) and advances next_run_at
 *   4. claims & processes a batch within a time budget (with retries + budget)
 *   5. releases the lock
 *
 * Designed to be called frequently (e.g. every 30 min). Because work is queued
 * and time-budgeted PER TICK — not "first N clients only" — every client is
 * eventually processed; nothing is silently skipped forever.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureAutomationTables, getSb, rid } from '@/lib/seo/automation/db';
import { GeoJobQueueService } from '@/lib/seo/automation/queue';
import { enrollActivePlans } from '@/lib/seo/automation/enroll';
import { processJob, nextRunFrom } from '@/lib/seo/automation/worker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TIME_BUDGET_MS = 250_000;
const BATCH = 8;

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    // allow Vercel cron (no header) OR explicit secret
    if (auth && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const started = Date.now();
  const worker = rid('tick');
  await ensureAutomationTables();

  const gotLock = await GeoJobQueueService.acquireLock('geo_automation_tick', 280_000, worker);
  if (!gotLock) return NextResponse.json({ ok: true, skipped: 'locked' });

  const summary: any = { worker, enrolled: 0, enqueued: 0, processed: 0, completed: 0, failed: 0, waiting_budget: 0 };
  try {
    // 1) Enroll new active plans.
    const en = await enrollActivePlans();
    summary.enrolled = en.enrolled; summary.totalActive = en.total;

    // 2) Enqueue due jobs.
    const sb = getSb();
    const nowIso = new Date().toISOString();
    const { data: due } = await sb.from('geo_client_automation_status')
      .select('*').eq('automation_enabled', true).lte('next_run_at', nowIso).limit(500);
    for (const st of (due || [])) {
      const modules: string[] = Array.isArray(st.modules_enabled) ? st.modules_enabled : ['geo_refresh'];
      for (const jobType of modules) {
        const r = await GeoJobQueueService.enqueueJob({ planId: st.plan_id, clientId: st.client_id, jobType, priority: st.priority || 5 });
        if (r.id) summary.enqueued++;
      }
      // Advance next_run so we don't re-enqueue every tick (job idempotency also guards this).
      await sb.from('geo_client_automation_status').update({ next_run_at: nextRunFrom(st.run_frequency || 'daily').toISOString() }).eq('plan_id', st.plan_id);
    }

    // 3) Process claimed jobs within the time budget.
    while (Date.now() - started < TIME_BUDGET_MS) {
      const jobs = await GeoJobQueueService.claimJobs(BATCH, worker);
      if (!jobs.length) break;
      for (const job of jobs) {
        if (Date.now() - started >= TIME_BUDGET_MS) break;
        const res = await processJob(job);
        summary.processed++;
        if (res.status === 'completed') summary.completed++;
        else if (res.status === 'waiting_for_budget') summary.waiting_budget++;
        else summary.failed++;
      }
    }
  } catch (e) {
    summary.error = e instanceof Error ? e.message : 'tick failed';
  } finally {
    await GeoJobQueueService.releaseLock('geo_automation_tick', worker);
  }
  summary.durationMs = Date.now() - started;
  return NextResponse.json({ ok: true, ...summary });
}
