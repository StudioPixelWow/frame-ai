/**
 * GEO Automation Control API.
 *
 * GET  → overview: per-client status, recent runs, failed jobs, queue counts.
 * POST → { action }:
 *        'enroll'                                  ensure all active plans enrolled
 *        'set'      planId, patch{...}             enable/disable, frequency, budget, priority, modules
 *        'run_now'  planId, jobType?              enqueue + run immediately (bypasses daily dedupe)
 *        'retry'    jobId                          re-queue a failed job
 *        'tick'                                    run the tick inline (enqueue+process a batch)
 *
 * Staff only.
 */

import { NextRequest } from 'next/server';
import { ok, err, requireStaff, withErrorBoundary } from '@/lib/seo/api-helpers';
import { getSb, ensureAutomationTables } from '@/lib/seo/automation/db';
import { GeoJobQueueService } from '@/lib/seo/automation/queue';
import { enrollActivePlans } from '@/lib/seo/automation/enroll';
import { processJob } from '@/lib/seo/automation/worker';

async function overview() {
  await ensureAutomationTables();
  const sb = getSb();
  const [statuses, runs, failed, queued] = await Promise.all([
    sb.from('geo_client_automation_status').select('*').eq('automation_enabled', true).order('next_run_at', { ascending: true }).limit(500),
    sb.from('geo_automation_runs').select('*').order('created_at', { ascending: false }).limit(40),
    sb.from('geo_automation_jobs').select('*').eq('status', 'failed').order('finished_at', { ascending: false }).limit(40),
    sb.from('geo_automation_jobs').select('id,status').in('status', ['queued', 'running', 'waiting_for_budget']).limit(1000),
  ]);
  const clients = statuses.data || [];
  const counts = {
    clients: clients.length,
    enabled: clients.filter((c: any) => c.automation_enabled).length,
    running: clients.filter((c: any) => c.current_status === 'running').length,
    failed: clients.filter((c: any) => c.current_status === 'failed').length,
    waiting_budget: clients.filter((c: any) => c.current_status === 'waiting_for_budget').length,
    queued: (queued.data || []).filter((j: any) => j.status === 'queued').length,
    in_flight: (queued.data || []).filter((j: any) => j.status === 'running').length,
  };
  return { counts, clients, runs: runs.data || [], failedJobs: failed.data || [] };
}

export const GET = withErrorBoundary(async (req: NextRequest) => {
  const g = requireStaff(req); if (g) return g;
  return ok(await overview());
});

export const POST = withErrorBoundary(async (req: NextRequest) => {
  const g = requireStaff(req); if (g) return g;
  let body: any = {}; try { body = await req.json(); } catch { /* */ }
  const sb = getSb();

  switch (body.action) {
    case 'enroll': {
      const r = await enrollActivePlans();
      return ok({ ...r, state: await overview() });
    }
    case 'set': {
      if (!body.planId || !body.patch) return err('planId ו-patch נדרשים');
      const allowed = ['automation_enabled', 'run_frequency', 'priority', 'monthly_budget_cents', 'modules_enabled', 'current_status', 'next_run_at'];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (body.patch[k] !== undefined) patch[k] = body.patch[k];
      patch.updated_at = new Date().toISOString();
      await sb.from('geo_client_automation_status').update(patch).eq('plan_id', body.planId);
      return ok({ state: await overview() });
    }
    case 'run_now': {
      if (!body.planId) return err('planId נדרש');
      const jobType = body.jobType || 'geo_refresh';
      const enq = await GeoJobQueueService.enqueueJob({ planId: body.planId, clientId: body.clientId, jobType, priority: 1, idempotencyKey: `manual:${body.planId}:${jobType}:${Date.now()}` });
      if (!enq.id) return err('לא נוצר job');
      const job = await GeoJobQueueService.getJobStatus(enq.id);
      // Claim it (compare-and-set) then process inline for instant feedback.
      const claimed = await sb.from('geo_automation_jobs').update({ status: 'running', started_at: new Date().toISOString(), attempts: 1, locked_by: 'run_now' }).eq('id', enq.id).eq('status', 'queued').select('*');
      const res = claimed.data && claimed.data.length ? await processJob(claimed.data[0]) : { ok: false, status: job?.status };
      return ok({ result: res, state: await overview() });
    }
    case 'retry': {
      if (!body.jobId) return err('jobId נדרש');
      await GeoJobQueueService.retryFailedJob(body.jobId);
      return ok({ state: await overview() });
    }
    case 'tick': {
      // Inline tick: enroll + enqueue due + process a small batch.
      await enrollActivePlans();
      const nowIso = new Date().toISOString();
      const { data: due } = await sb.from('geo_client_automation_status').select('*').eq('automation_enabled', true).lte('next_run_at', nowIso).limit(100);
      for (const st of (due || [])) {
        const modules: string[] = Array.isArray(st.modules_enabled) ? st.modules_enabled : ['geo_refresh'];
        for (const jt of modules) await GeoJobQueueService.enqueueJob({ planId: st.plan_id, clientId: st.client_id, jobType: jt, priority: st.priority || 5 });
      }
      const jobs = await GeoJobQueueService.claimJobs(10, 'manual_tick');
      for (const j of jobs) await processJob(j);
      return ok({ processed: jobs.length, state: await overview() });
    }
    default: return err('action לא נתמך');
  }
});
