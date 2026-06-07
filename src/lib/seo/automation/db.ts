/**
 * GEO Automation backbone — persistence.
 *
 * A DB-backed job queue + per-client automation status so the GEO system runs
 * for EVERY active client on a schedule, with retries, idempotency, locking,
 * logs, statuses and cost control — independent of any UI. Auto-created via
 * ensureTable; SQL fallback in SUPABASE_MANUAL_SETUP.sql.
 */

import { ensureTable, getSupabase } from '@/lib/db/store';

export const AUTOMATION_DDL: Record<string, string> = {
  // Per-client/per-plan automation state — the single source of truth for
  // "who should run, when did it last run, when next, and why not".
  geo_client_automation_status: `
    CREATE TABLE IF NOT EXISTS public.geo_client_automation_status (
      plan_id text PRIMARY KEY,
      client_id text,
      client_name text,
      automation_enabled boolean DEFAULT true,
      modules_enabled jsonb DEFAULT '["geo_refresh"]',
      run_frequency text DEFAULT 'daily',          -- daily | weekly | monthly
      priority integer DEFAULT 5,                   -- lower = sooner
      last_run_at timestamptz,
      next_run_at timestamptz,
      last_success_at timestamptz,
      last_failure_at timestamptz,
      current_status text DEFAULT 'active',         -- active|paused|running|completed|failed|partially_failed|waiting_for_budget|waiting_for_api_key|disabled
      failure_count integer DEFAULT 0,
      monthly_budget_cents integer DEFAULT 0,       -- 0 = unlimited
      monthly_usage_cents integer DEFAULT 0,
      usage_month text,                             -- 'YYYY-MM' for monthly reset
      updated_at timestamptz DEFAULT now()
    );`,

  // The queue. idempotency_key prevents duplicate jobs for the same plan/type/day.
  geo_automation_jobs: `
    CREATE TABLE IF NOT EXISTS public.geo_automation_jobs (
      id text PRIMARY KEY,
      idempotency_key text UNIQUE,
      plan_id text NOT NULL,
      client_id text,
      job_type text NOT NULL,
      status text DEFAULT 'queued',                 -- queued|running|completed|failed|canceled|waiting_for_budget
      priority integer DEFAULT 5,
      attempts integer DEFAULT 0,
      max_attempts integer DEFAULT 3,
      scheduled_for timestamptz DEFAULT now(),
      locked_at timestamptz,
      locked_by text,
      started_at timestamptz,
      finished_at timestamptz,
      error text,
      cost_cents integer DEFAULT 0,
      result jsonb,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_jobs_status ON public.geo_automation_jobs(status, scheduled_for);
    CREATE INDEX IF NOT EXISTS geo_jobs_plan ON public.geo_automation_jobs(plan_id);`,

  geo_automation_schedules: `
    CREATE TABLE IF NOT EXISTS public.geo_automation_schedules (
      id text PRIMARY KEY,
      plan_id text NOT NULL,
      client_id text,
      job_type text NOT NULL,
      frequency text DEFAULT 'daily',
      enabled boolean DEFAULT true,
      next_run_at timestamptz,
      last_run_at timestamptz,
      priority integer DEFAULT 5,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_sched_plan ON public.geo_automation_schedules(plan_id, job_type);`,

  geo_automation_runs: `
    CREATE TABLE IF NOT EXISTS public.geo_automation_runs (
      id text PRIMARY KEY,
      job_id text,
      plan_id text NOT NULL,
      client_id text,
      job_type text,
      status text,
      started_at timestamptz,
      finished_at timestamptz,
      duration_ms integer,
      cost_cents integer DEFAULT 0,
      summary jsonb,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_runs_plan ON public.geo_automation_runs(plan_id, created_at);`,

  geo_automation_run_logs: `
    CREATE TABLE IF NOT EXISTS public.geo_automation_run_logs (
      id text PRIMARY KEY,
      run_id text,
      job_id text,
      plan_id text,
      level text DEFAULT 'info',
      message text,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_runlogs_run ON public.geo_automation_run_logs(run_id);`,

  geo_job_failures: `
    CREATE TABLE IF NOT EXISTS public.geo_job_failures (
      id text PRIMARY KEY,
      job_id text,
      plan_id text,
      job_type text,
      error text,
      attempt integer,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_failures_plan ON public.geo_job_failures(plan_id, created_at);`,

  // Global advisory locks (e.g. the cron tick) to prevent overlapping runs.
  geo_job_locks: `
    CREATE TABLE IF NOT EXISTS public.geo_job_locks (
      lock_key text PRIMARY KEY,
      locked_by text,
      locked_at timestamptz,
      expires_at timestamptz
    );`,
};

let ensured = false;
export async function ensureAutomationTables(): Promise<void> {
  if (ensured) return;
  for (const [name, ddl] of Object.entries(AUTOMATION_DDL)) {
    try { await ensureTable(name, ddl); } catch { /* SQL fallback documented */ }
  }
  ensured = true;
}

export const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
export const monthKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export function getSb() { return getSupabase(); }
