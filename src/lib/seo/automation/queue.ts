/**
 * GeoJobQueueService — a DB-backed job queue (no external infra required, swap-
 * able later for Inngest/QStash). Provides enqueue (idempotent), recurring
 * scheduling, atomic claim with locking, completion, retry-on-fail, cancel, and
 * status queries. Every method is safe to call concurrently: claims use a
 * compare-and-set update so two cron ticks never run the same job.
 */

import { ensureAutomationTables, getSb, rid } from './db';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled' | 'waiting_for_budget';

export interface EnqueueInput {
  planId: string; clientId?: string | null; jobType: string;
  priority?: number; maxAttempts?: number; scheduledFor?: Date;
  /** stable key → at most one job per (plan, type, day). Defaults to that. */
  idempotencyKey?: string;
}

const dayKey = (d = new Date()) => d.toISOString().split('T')[0];

export const GeoJobQueueService = {
  /** Enqueue a job. Idempotent: duplicate idempotency_key is ignored (no-op). */
  async enqueueJob(input: EnqueueInput): Promise<{ id: string | null; duplicate: boolean }> {
    await ensureAutomationTables();
    const sb = getSb();
    const key = input.idempotencyKey || `${input.planId}:${input.jobType}:${dayKey(input.scheduledFor || new Date())}`;
    const id = rid('job');
    const row = {
      id, idempotency_key: key, plan_id: input.planId, client_id: input.clientId ?? null,
      job_type: input.jobType, status: 'queued' as JobStatus, priority: input.priority ?? 5,
      attempts: 0, max_attempts: input.maxAttempts ?? 3,
      scheduled_for: (input.scheduledFor || new Date()).toISOString(), created_at: new Date().toISOString(),
    };
    // onConflict on the unique idempotency_key → ignore duplicates.
    const { data, error } = await sb.from('geo_automation_jobs').upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true }).select('id');
    if (error) return { id: null, duplicate: false };
    const inserted = Array.isArray(data) && data.length > 0;
    return { id: inserted ? id : null, duplicate: !inserted };
  },

  /** Upsert a recurring schedule for a plan+jobType. */
  async scheduleRecurringJob(planId: string, clientId: string | null, jobType: string, frequency: string, nextRunAt: Date, priority = 5) {
    await ensureAutomationTables();
    const sb = getSb();
    const { data: existing } = await sb.from('geo_automation_schedules').select('id').eq('plan_id', planId).eq('job_type', jobType).maybeSingle();
    if (existing?.id) {
      await sb.from('geo_automation_schedules').update({ frequency, next_run_at: nextRunAt.toISOString(), enabled: true, priority }).eq('id', existing.id);
      return existing.id;
    }
    const id = rid('sched');
    await sb.from('geo_automation_schedules').insert({ id, plan_id: planId, client_id: clientId, job_type: jobType, frequency, next_run_at: nextRunAt.toISOString(), enabled: true, priority, created_at: new Date().toISOString() });
    return id;
  },

  /**
   * Claim up to `limit` queued jobs atomically. Each claim is a compare-and-set:
   * UPDATE … WHERE id=? AND status='queued' → only the winner gets the row.
   */
  async claimJobs(limit: number, workerId: string): Promise<any[]> {
    await ensureAutomationTables();
    const sb = getSb();
    const nowIso = new Date().toISOString();
    const { data: candidates } = await sb.from('geo_automation_jobs')
      .select('*').eq('status', 'queued').lte('scheduled_for', nowIso)
      .order('priority', { ascending: true }).order('scheduled_for', { ascending: true }).limit(limit * 3);
    const claimed: any[] = [];
    for (const job of (candidates || [])) {
      if (claimed.length >= limit) break;
      const { data: won } = await sb.from('geo_automation_jobs')
        .update({ status: 'running', locked_at: nowIso, locked_by: workerId, started_at: nowIso, attempts: (job.attempts || 0) + 1 })
        .eq('id', job.id).eq('status', 'queued').select('*');
      if (won && won.length) claimed.push(won[0]);
    }
    return claimed;
  },

  async completeJob(jobId: string, result: any, costCents = 0) {
    const sb = getSb();
    await sb.from('geo_automation_jobs').update({ status: 'completed', finished_at: new Date().toISOString(), result, cost_cents: costCents, error: null }).eq('id', jobId);
  },

  /** Fail a job → retry (re-queue) if attempts remain, else mark failed. */
  async failJob(job: any, errMsg: string) {
    const sb = getSb();
    await sb.from('geo_job_failures').insert({ id: rid('fail'), job_id: job.id, plan_id: job.plan_id, job_type: job.job_type, error: errMsg.slice(0, 1000), attempt: job.attempts, created_at: new Date().toISOString() });
    const canRetry = (job.attempts || 1) < (job.max_attempts || 3);
    if (canRetry) {
      const backoffMin = Math.pow(2, job.attempts || 1) * 5; // 10, 20, 40 min
      await sb.from('geo_automation_jobs').update({ status: 'queued', locked_at: null, locked_by: null, scheduled_for: new Date(Date.now() + backoffMin * 60000).toISOString(), error: errMsg.slice(0, 1000) }).eq('id', job.id);
      return { retried: true };
    }
    await sb.from('geo_automation_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error: errMsg.slice(0, 1000) }).eq('id', job.id);
    return { retried: false };
  },

  async markWaitingForBudget(jobId: string) {
    await getSb().from('geo_automation_jobs').update({ status: 'waiting_for_budget', locked_at: null, locked_by: null }).eq('id', jobId);
  },

  async cancelJob(jobId: string) {
    await getSb().from('geo_automation_jobs').update({ status: 'canceled', finished_at: new Date().toISOString() }).eq('id', jobId);
  },

  async retryFailedJob(jobId: string) {
    await getSb().from('geo_automation_jobs').update({ status: 'queued', attempts: 0, locked_at: null, locked_by: null, scheduled_for: new Date().toISOString(), error: null }).eq('id', jobId);
  },

  async getJobStatus(jobId: string) {
    const { data } = await getSb().from('geo_automation_jobs').select('*').eq('id', jobId).maybeSingle();
    return data;
  },

  async getFailedJobs(limit = 50) {
    const { data } = await getSb().from('geo_automation_jobs').select('*').eq('status', 'failed').order('finished_at', { ascending: false }).limit(limit);
    return data || [];
  },

  async getNextRuns(limit = 50) {
    const { data } = await getSb().from('geo_client_automation_status').select('*').eq('automation_enabled', true).order('next_run_at', { ascending: true }).limit(limit);
    return data || [];
  },

  async getClientAutomationStatus(planId: string) {
    const { data } = await getSb().from('geo_client_automation_status').select('*').eq('plan_id', planId).maybeSingle();
    return data;
  },

  /* ── Global advisory lock (tick) — prevents overlapping cron invocations ── */
  async acquireLock(key: string, ttlMs: number, owner: string): Promise<boolean> {
    await ensureAutomationTables();
    const sb = getSb();
    const now = Date.now();
    const { data: existing } = await sb.from('geo_job_locks').select('*').eq('lock_key', key).maybeSingle();
    if (existing) {
      const exp = existing.expires_at ? new Date(existing.expires_at).getTime() : 0;
      if (exp > now) return false; // still held
      const { data: won } = await sb.from('geo_job_locks').update({ locked_by: owner, locked_at: new Date(now).toISOString(), expires_at: new Date(now + ttlMs).toISOString() }).eq('lock_key', key).eq('locked_by', existing.locked_by).select('lock_key');
      return !!(won && won.length);
    }
    const { error } = await sb.from('geo_job_locks').insert({ lock_key: key, locked_by: owner, locked_at: new Date(now).toISOString(), expires_at: new Date(now + ttlMs).toISOString() });
    return !error;
  },

  async releaseLock(key: string, owner: string) {
    await getSb().from('geo_job_locks').update({ expires_at: new Date(0).toISOString() }).eq('lock_key', key).eq('locked_by', owner);
  },
};
