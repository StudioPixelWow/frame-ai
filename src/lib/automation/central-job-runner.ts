/**
 * Central Job Runner Engine
 *
 * Manages all 15 Vercel cron jobs from a single registry.
 * Handles execution, timeout, retry, logging, and scheduling.
 */

import { ensureTable } from '@/lib/db/store';
import { scheduledJobs, jobRuns } from '@/lib/db/collections';
import type { ScheduledJob, JobRun, JobRunStatus, JobStatus } from '@/lib/db/schema';

// ═══════════════════════════════════════════════════════════
// JOB REGISTRY — all 15 Vercel cron jobs
// ═══════════════════════════════════════════════════════════

type JobRegistryEntry = Omit<
  ScheduledJob,
  'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'lastRunStatus' |
  'lastRunDurationMs' | 'lastRunError' | 'nextRunAt' | 'totalRuns' | 'totalFailures'
>;

const JOB_REGISTRY: JobRegistryEntry[] = [
  {
    name: 'daily-seo',
    displayName: 'SEO יומי — סריקה + הרצת משימות',
    description: 'סריקת דירוגים יומית + הרצת משימות תוכנית 60 יום לכל הלקוחות הפעילים',
    cronExpression: '0 5 * * *',
    endpoint: '/api/cron/daily-seo',
    status: 'active' as JobStatus,
    category: 'seo',
    maxDurationSec: 300,
    retryCount: 1,
    retryDelaySec: 30,
    envVarsRequired: ['CRON_SECRET', 'OPENAI_API_KEY', 'SERPER_API_KEY'],
    dbTablesUsed: ['seo_plans', 'clients', 'client_gantt_items'],
  },
  {
    name: 'meta-sync-all',
    displayName: 'סנכרון Meta — כל החשבונות',
    description: 'סנכרון נתוני קמפיינים מ-Meta Ads API לכל הלקוחות המחוברים',
    cronExpression: '0 * * * *',
    endpoint: '/api/cron/meta-sync-all',
    status: 'active' as JobStatus,
    category: 'meta',
    maxDurationSec: 300,
    retryCount: 1,
    retryDelaySec: 60,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['clients', 'app_meta_campaign_assignments'],
  },
  {
    name: 'daily-meta-optimizer',
    displayName: 'אופטימיזציית Meta יומית',
    description: 'ניתוח ביצועי קמפיינים ואופטימיזציה אוטומטית — תקציב, קהלים, וריאציות',
    cronExpression: '0 6,15 * * *',
    endpoint: '/api/cron/daily-meta-optimizer',
    status: 'active' as JobStatus,
    category: 'meta',
    maxDurationSec: 120,
    retryCount: 0,
    retryDelaySec: 0,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['clients', 'campaigns', 'ad_sets', 'ads'],
  },
  {
    name: 'meta-auto-optimize',
    displayName: 'Meta אופטימיזציה אוטונומית',
    description: 'הזזת תקציבים בין קבוצות מודעות, הרחבת קהלים מנצחים — ללא שינוי קריאייטיב',
    cronExpression: '0 8 * * *',
    endpoint: '/api/cron/meta-auto-optimize',
    status: 'active' as JobStatus,
    category: 'meta',
    maxDurationSec: 300,
    retryCount: 0,
    retryDelaySec: 0,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['clients', 'campaigns', 'ad_sets', 'ads', 'campaign_actions', 'meta_action_log'],
  },
  {
    name: 'meeting-reminders',
    displayName: 'תזכורות פגישות',
    description: 'שליחת תזכורות WhatsApp לפגישות היום ומחר',
    cronExpression: '0 7 * * *',
    endpoint: '/api/cron/meeting-reminders',
    status: 'active' as JobStatus,
    category: 'whatsapp',
    maxDurationSec: 60,
    retryCount: 1,
    retryDelaySec: 10,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['meetings'],
  },
  {
    name: 'weekly-summary',
    displayName: 'סיכום שבועי — כל הלקוחות',
    description: 'יצירת סיכום שבועי לכל לקוח פעיל ושמירה ל-DB',
    cronExpression: '0 8 * * 0',
    endpoint: '/api/cron/weekly-summary',
    status: 'active' as JobStatus,
    category: 'reports',
    maxDurationSec: 120,
    retryCount: 1,
    retryDelaySec: 30,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['clients', 'weekly_summaries'],
  },
  {
    name: 'whatsapp-qr-weekly-digest',
    displayName: 'דייג\'סט שבועי WhatsApp',
    description: 'שליחת סיכום התקדמות שבועי לכל לקוח ב-WhatsApp',
    cronExpression: '0 9 * * 0',
    endpoint: '/api/cron/whatsapp-qr-weekly-digest',
    status: 'active' as JobStatus,
    category: 'whatsapp',
    maxDurationSec: 60,
    retryCount: 0,
    retryDelaySec: 0,
    envVarsRequired: ['CRON_SECRET', 'AGENCY_NAME'],
    dbTablesUsed: ['clients', 'client_gantt_items'],
  },
  {
    name: 'whatsapp-scheduled',
    displayName: 'הודעות WhatsApp מתוזמנות',
    description: 'עיבוד הודעות WhatsApp מתוזמנות מרצפי אוטומציה',
    cronExpression: '*/15 * * * *',
    endpoint: '/api/cron/whatsapp-scheduled',
    status: 'active' as JobStatus,
    category: 'whatsapp',
    maxDurationSec: 60,
    retryCount: 0,
    retryDelaySec: 0,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['whatsapp_scheduled'],
  },
  {
    name: 'social-scheduled',
    displayName: 'פוסטים מתוזמנים — סושייאל',
    description: 'פרסום פוסטים מתוזמנים לפייסבוק ואינסטגרם',
    cronExpression: '*/15 * * * *',
    endpoint: '/api/cron/social-scheduled',
    status: 'active' as JobStatus,
    category: 'social',
    maxDurationSec: 120,
    retryCount: 1,
    retryDelaySec: 15,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['app_social_posts', 'clients'],
  },
  {
    name: 'monthly-client-reports',
    displayName: 'דוחות חודשיים ללקוחות',
    description: 'יצירת דוחות PDF חודשיים ושליחה במייל לכל לקוח פעיל',
    cronExpression: '0 1 1 * *',
    endpoint: '/api/cron/monthly-client-reports',
    status: 'active' as JobStatus,
    category: 'reports',
    maxDurationSec: 300,
    retryCount: 1,
    retryDelaySec: 60,
    envVarsRequired: ['CRON_SECRET', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'],
    dbTablesUsed: ['clients', 'app_reports'],
  },
  {
    name: 'competitor-scan',
    displayName: 'סריקת מתחרים יומית',
    description: 'סריקת מתחרים יומית לכל הלקוחות — עדכון טאב חקר מתחרים',
    cronExpression: '0 9 * * *',
    endpoint: '/api/cron/competitor-scan',
    status: 'active' as JobStatus,
    category: 'seo',
    maxDurationSec: 300,
    retryCount: 0,
    retryDelaySec: 0,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['clients'],
  },
  {
    name: 'geo-monitoring',
    displayName: 'ניטור GEO/AI — Authority Score',
    description: 'צילום מצב נוכחות AI יומי + חישוב ציון סמכות לכל תוכנית SEO פעילה',
    cronExpression: '0 4 * * *',
    endpoint: '/api/cron/geo-monitoring',
    status: 'active' as JobStatus,
    category: 'geo',
    maxDurationSec: 300,
    retryCount: 0,
    retryDelaySec: 0,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['seo_plans', 'geo_ai_monitoring_results'],
  },
  {
    name: 'geo-automation',
    displayName: 'GEO אוטומציה — Heartbeat',
    description: 'טיק אוטומציה GEO כל 30 דקות — הרשמת תוכניות חדשות, הרצת ג\'ובים מתוזמנים',
    cronExpression: '*/30 * * * *',
    endpoint: '/api/cron/geo-automation',
    status: 'active' as JobStatus,
    category: 'geo',
    maxDurationSec: 300,
    retryCount: 0,
    retryDelaySec: 0,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['geo_client_automation_status', 'geo_automation_jobs', 'seo_plans'],
  },
  {
    name: 'google-ads-weekly',
    displayName: 'דוח Google Ads שבועי',
    description: 'יצירת דוח שבועי לכל לקוחות Google Ads מחוברים',
    cronExpression: '0 7 * * 1',
    endpoint: '/api/cron/google-ads/weekly',
    status: 'active' as JobStatus,
    category: 'google-ads',
    maxDurationSec: 300,
    retryCount: 0,
    retryDelaySec: 0,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['clients'],
  },
  {
    name: 'google-ads-monthly',
    displayName: 'דוח Google Ads חודשי',
    description: 'יצירת דוח חודשי לכל לקוחות Google Ads מחוברים',
    cronExpression: '0 7 2 * *',
    endpoint: '/api/cron/google-ads/monthly',
    status: 'active' as JobStatus,
    category: 'google-ads',
    maxDurationSec: 300,
    retryCount: 0,
    retryDelaySec: 0,
    envVarsRequired: ['CRON_SECRET'],
    dbTablesUsed: ['clients'],
  },
];

// ═══════════════════════════════════════════════════════════
// TABLE SETUP
// ═══════════════════════════════════════════════════════════

let _tablesEnsured = false;

export async function ensureJobsTable(): Promise<void> {
  if (_tablesEnsured) return;

  const scheduledJobsDDL = `
    CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const jobRunsDDL = `
    CREATE TABLE IF NOT EXISTS public.job_runs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await ensureTable('scheduled_jobs', scheduledJobsDDL);
  await ensureTable('job_runs', jobRunsDDL);
  _tablesEnsured = true;
  console.log('[JOBS] Tables ensured: scheduled_jobs, job_runs');
}

// ═══════════════════════════════════════════════════════════
// CRON EXPRESSION PARSER
// ═══════════════════════════════════════════════════════════

/**
 * Parse a cron expression and calculate the next run time from `fromDate`.
 * Supports: minute hour dayOfMonth month dayOfWeek
 * Supports: specific values, wildcards (*), comma-separated values, step values (star/N)
 * Uses Israel timezone.
 */
export function calculateNextRun(cronExpression: string, fromDate?: Date): string {
  const now = fromDate || new Date();
  // Work in Israel timezone
  const israelNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));

  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    console.log('[JOBS] Invalid cron expression:', cronExpression);
    // Fallback: 1 hour from now
    return new Date(now.getTime() + 3600_000).toISOString();
  }

  const [minPart, hourPart, domPart, monPart, dowPart] = parts;

  function parseField(field: string, min: number, max: number): number[] {
    const values: Set<number> = new Set();

    for (const segment of field.split(',')) {
      if (segment.includes('/')) {
        // Step value: */N or M/N
        const [range, stepStr] = segment.split('/');
        const step = parseInt(stepStr, 10);
        const start = range === '*' ? min : parseInt(range, 10);
        for (let i = start; i <= max; i += step) {
          values.add(i);
        }
      } else if (segment === '*') {
        for (let i = min; i <= max; i++) values.add(i);
      } else {
        values.add(parseInt(segment, 10));
      }
    }

    return Array.from(values).sort((a, b) => a - b);
  }

  const minutes = parseField(minPart, 0, 59);
  const hours = parseField(hourPart, 0, 23);
  const daysOfMonth = parseField(domPart, 1, 31);
  const months = parseField(monPart, 1, 12);
  const daysOfWeek = parseField(dowPart, 0, 6); // 0 = Sunday

  const hasDomConstraint = domPart !== '*';
  const hasDowConstraint = dowPart !== '*';

  // Start searching from 1 minute after now
  const candidate = new Date(israelNow);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  // Search up to 400 days ahead (covers monthly + yearly patterns)
  const maxIterations = 400 * 24 * 60; // 400 days in minutes
  for (let i = 0; i < maxIterations; i++) {
    const m = candidate.getMinutes();
    const h = candidate.getHours();
    const dom = candidate.getDate();
    const mon = candidate.getMonth() + 1; // JS months are 0-based
    const dow = candidate.getDay(); // 0 = Sunday

    const minuteMatch = minutes.includes(m);
    const hourMatch = hours.includes(h);
    const monthMatch = months.includes(mon);

    // DOM and DOW: if both constrained, either can match (OR logic per POSIX)
    // If only one constrained, that one must match
    let dateMatch: boolean;
    if (hasDomConstraint && hasDowConstraint) {
      dateMatch = daysOfMonth.includes(dom) || daysOfWeek.includes(dow);
    } else if (hasDomConstraint) {
      dateMatch = daysOfMonth.includes(dom);
    } else if (hasDowConstraint) {
      dateMatch = daysOfWeek.includes(dow);
    } else {
      dateMatch = true;
    }

    if (minuteMatch && hourMatch && monthMatch && dateMatch) {
      // Convert Israel time back to UTC for storage
      // Create a date string in Israel timezone, then parse as UTC offset
      const year = candidate.getFullYear();
      const monthStr = String(candidate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(candidate.getDate()).padStart(2, '0');
      const hourStr = String(candidate.getHours()).padStart(2, '0');
      const minStr = String(candidate.getMinutes()).padStart(2, '0');
      const israelDateStr = `${year}-${monthStr}-${dayStr}T${hourStr}:${minStr}:00`;

      // Use Intl to determine Israel's UTC offset at that moment
      const testDate = new Date(israelDateStr + 'Z');
      const utcStr = testDate.toLocaleString('en-US', { timeZone: 'UTC' });
      const ilStr = testDate.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' });
      const utcDate = new Date(utcStr);
      const ilDate = new Date(ilStr);
      const offsetMs = ilDate.getTime() - utcDate.getTime();

      // Subtract offset to get UTC
      const utcResult = new Date(new Date(israelDateStr).getTime() - offsetMs);
      return utcResult.toISOString();
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  // Fallback: 24 hours from now
  console.log('[JOBS] Could not calculate next run for:', cronExpression);
  return new Date(now.getTime() + 86400_000).toISOString();
}

// ═══════════════════════════════════════════════════════════
// REGISTRY ACCESS
// ═══════════════════════════════════════════════════════════

export function getJobRegistry(): JobRegistryEntry[] {
  return JOB_REGISTRY;
}

// ═══════════════════════════════════════════════════════════
// DB SYNC
// ═══════════════════════════════════════════════════════════

/**
 * Upsert all registry jobs into the DB.
 * Preserves existing lastRun* and total* fields.
 * Matches by `name` field inside the JSONB data column.
 */
export async function syncRegistryToDb(): Promise<{ created: number; updated: number }> {
  await ensureJobsTable();

  const existing = await scheduledJobs.getAllAsync();
  const existingByName = new Map<string, ScheduledJob>();
  for (const job of existing) {
    existingByName.set(job.name, job);
  }

  let created = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const entry of JOB_REGISTRY) {
    const existingJob = existingByName.get(entry.name);

    if (existingJob) {
      // Update registry fields but preserve runtime fields
      await scheduledJobs.updateAsync(existingJob.id, {
        displayName: entry.displayName,
        description: entry.description,
        cronExpression: entry.cronExpression,
        endpoint: entry.endpoint,
        status: entry.status,
        category: entry.category,
        maxDurationSec: entry.maxDurationSec,
        retryCount: entry.retryCount,
        retryDelaySec: entry.retryDelaySec,
        envVarsRequired: entry.envVarsRequired,
        dbTablesUsed: entry.dbTablesUsed,
        nextRunAt: calculateNextRun(entry.cronExpression),
        updatedAt: now,
      } as Partial<ScheduledJob>);
      updated++;
    } else {
      // Create new job with defaults
      await scheduledJobs.createAsync({
        name: entry.name,
        displayName: entry.displayName,
        description: entry.description,
        cronExpression: entry.cronExpression,
        endpoint: entry.endpoint,
        status: entry.status,
        category: entry.category,
        maxDurationSec: entry.maxDurationSec,
        retryCount: entry.retryCount,
        retryDelaySec: entry.retryDelaySec,
        envVarsRequired: entry.envVarsRequired,
        dbTablesUsed: entry.dbTablesUsed,
        lastRunAt: null,
        lastRunStatus: null,
        lastRunDurationMs: null,
        lastRunError: null,
        nextRunAt: calculateNextRun(entry.cronExpression),
        totalRuns: 0,
        totalFailures: 0,
        createdAt: now,
        updatedAt: now,
      } as Omit<ScheduledJob, 'id'>);
      created++;
    }
  }

  console.log(`[JOBS] Registry sync complete: ${created} created, ${updated} updated`);
  return { created, updated };
}

// ═══════════════════════════════════════════════════════════
// QUERY HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Get all scheduled jobs from DB.
 */
export async function getAllJobs(): Promise<ScheduledJob[]> {
  await ensureJobsTable();
  return scheduledJobs.getAllAsync();
}

/**
 * Get recent runs for a specific job.
 */
export async function getJobRuns(jobId: string, limit: number = 20): Promise<JobRun[]> {
  await ensureJobsTable();
  const allRuns = await jobRuns.getAllAsync();
  return allRuns
    .filter(r => r.jobId === jobId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════════
// JOB RUN LIFECYCLE
// ═══════════════════════════════════════════════════════════

/**
 * Create a new job_run record. Returns the run ID.
 */
export async function startJobRun(
  jobId: string,
  triggeredBy: 'cron' | 'manual' | 'retry',
  jobName?: string,
  retryAttempt: number = 0
): Promise<string> {
  await ensureJobsTable();
  const now = new Date().toISOString();

  const run = await jobRuns.createAsync({
    jobId,
    jobName: jobName || '',
    status: 'running' as JobRunStatus,
    startedAt: now,
    completedAt: null,
    durationMs: null,
    result: null,
    error: null,
    retryAttempt,
    triggeredBy,
    metadata: null,
    createdAt: now,
  } as Omit<JobRun, 'id'>);

  console.log(`[JOBS] Run started: ${run.id} for job ${jobId} (${triggeredBy}, attempt ${retryAttempt})`);
  return run.id;
}

/**
 * Complete a job run — update both the run record and the parent job's last* fields.
 */
export async function completeJobRun(
  runId: string,
  status: JobRunStatus,
  result: Record<string, any> | null,
  error: string | null
): Promise<void> {
  await ensureJobsTable();
  const now = new Date().toISOString();

  // Get the run to calculate duration and find the parent job
  const run = await jobRuns.getByIdAsync(runId);
  if (!run) {
    console.log('[JOBS] Run not found for completion:', runId);
    return;
  }

  const durationMs = new Date(now).getTime() - new Date(run.startedAt).getTime();

  // Update the run record
  await jobRuns.updateAsync(runId, {
    status,
    completedAt: now,
    durationMs,
    result,
    error,
  } as Partial<JobRun>);

  // Update the parent job's last* fields
  const job = await scheduledJobs.getByIdAsync(run.jobId);
  if (job) {
    const updateData: Partial<ScheduledJob> = {
      lastRunAt: run.startedAt,
      lastRunStatus: status,
      lastRunDurationMs: durationMs,
      lastRunError: error,
      totalRuns: (job.totalRuns || 0) + 1,
      nextRunAt: calculateNextRun(job.cronExpression),
      updatedAt: now,
    };

    if (status === 'failed' || status === 'timeout') {
      updateData.totalFailures = (job.totalFailures || 0) + 1;
    }

    await scheduledJobs.updateAsync(run.jobId, updateData);
  }

  console.log(`[JOBS] Run completed: ${runId} status=${status} duration=${durationMs}ms`);
}

// ═══════════════════════════════════════════════════════════
// JOB EXECUTION
// ═══════════════════════════════════════════════════════════

/**
 * Resolve the base URL for calling endpoints.
 */
function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    // VERCEL_URL doesn't include protocol
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  return 'http://localhost:3000';
}

/**
 * Sleep helper for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a single job by name.
 * Calls the endpoint with CRON_SECRET auth, handles timeout and retry.
 */
export async function runJob(
  jobName: string,
  triggeredBy: 'cron' | 'manual' | 'retry'
): Promise<{ success: boolean; runId: string; status: JobRunStatus; error?: string }> {
  await ensureJobsTable();

  // Find the job in DB
  const allJobs = await scheduledJobs.getAllAsync();
  const job = allJobs.find(j => j.name === jobName);

  if (!job) {
    console.log('[JOBS] Job not found in DB:', jobName);
    // Try the registry
    const registryEntry = JOB_REGISTRY.find(r => r.name === jobName);
    if (!registryEntry) {
      console.log('[JOBS] Job not found in registry either:', jobName);
      return { success: false, runId: '', status: 'failed', error: `Job "${jobName}" not found` };
    }
    // Sync first, then retry
    await syncRegistryToDb();
    return runJob(jobName, triggeredBy);
  }

  if (job.status !== 'active' && triggeredBy === 'cron') {
    console.log(`[JOBS] Skipping non-active job: ${jobName} (status=${job.status})`);
    const runId = await startJobRun(job.id, triggeredBy, job.name);
    await completeJobRun(runId, 'skipped', { reason: `Job status is ${job.status}` }, null);
    return { success: true, runId, status: 'skipped' };
  }

  const maxAttempts = (job.retryCount || 0) + 1;
  let lastError: string | null = null;
  let lastRunId = '';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const currentTriggeredBy = attempt === 0 ? triggeredBy : 'retry' as const;
    const runId = await startJobRun(job.id, currentTriggeredBy, job.name, attempt);
    lastRunId = runId;

    try {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}${job.endpoint}`;
      const cronSecret = process.env.CRON_SECRET || '';

      console.log(`[JOBS] Executing: ${jobName} attempt=${attempt} url=${url}`);

      // AbortController for timeout
      const controller = new AbortController();
      const timeoutMs = (job.maxDurationSec || 300) * 1000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let responseBody: Record<string, any> | null = null;
        try {
          const text = await response.text();
          responseBody = text ? JSON.parse(text) : null;
        } catch {
          responseBody = { rawResponse: 'Could not parse response body' };
        }

        if (response.ok) {
          await completeJobRun(runId, 'completed', responseBody, null);
          console.log(`[JOBS] Success: ${jobName} (attempt ${attempt})`);
          return { success: true, runId, status: 'completed' };
        } else {
          lastError = `HTTP ${response.status}: ${JSON.stringify(responseBody)}`;
          console.log(`[JOBS] Failed: ${jobName} attempt=${attempt} — ${lastError}`);
          await completeJobRun(runId, 'failed', responseBody, lastError);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          lastError = `Timeout after ${job.maxDurationSec}s`;
          console.log(`[JOBS] Timeout: ${jobName} attempt=${attempt}`);
          await completeJobRun(runId, 'timeout', null, lastError);
        } else {
          lastError = fetchError.message || 'Unknown fetch error';
          console.log(`[JOBS] Error: ${jobName} attempt=${attempt} — ${lastError}`);
          await completeJobRun(runId, 'failed', null, lastError);
        }
      }

      // If we have more attempts, wait before retrying
      if (attempt < maxAttempts - 1 && job.retryDelaySec > 0) {
        console.log(`[JOBS] Waiting ${job.retryDelaySec}s before retry...`);
        await sleep(job.retryDelaySec * 1000);
      }
    } catch (outerError: any) {
      // Catch-all — never crash the runner
      lastError = outerError.message || 'Unknown error in runJob';
      console.log(`[JOBS] Critical error in runJob for ${jobName}:`, lastError);
      try {
        await completeJobRun(runId, 'failed', null, lastError);
      } catch {
        console.log('[JOBS] Failed to complete run record after critical error');
      }
    }
  }

  return { success: false, runId: lastRunId, status: 'failed', error: lastError || 'All attempts failed' };
}

// ═══════════════════════════════════════════════════════════
// SCHEDULER — RUN DUE JOBS
// ═══════════════════════════════════════════════════════════

/**
 * Find all jobs where nextRunAt <= now AND status = 'active', run them sequentially.
 * If one job fails, log it and continue to the next.
 */
export async function runDueJobs(): Promise<{
  ran: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<{ jobName: string; status: JobRunStatus; error?: string }>;
}> {
  await ensureJobsTable();

  const now = new Date();
  const allJobs = await scheduledJobs.getAllAsync();

  // Filter for due & active jobs
  const dueJobs = allJobs.filter(job => {
    if (job.status !== 'active') return false;
    if (!job.nextRunAt) return false;
    return new Date(job.nextRunAt) <= now;
  });

  console.log(`[JOBS] Due jobs check: ${dueJobs.length} due out of ${allJobs.length} total`);

  const results: Array<{ jobName: string; status: JobRunStatus; error?: string }> = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  // Run SEQUENTIALLY to avoid overwhelming the server
  for (const job of dueJobs) {
    try {
      console.log(`[JOBS] Running due job: ${job.name}`);
      const result = await runJob(job.name, 'cron');

      results.push({
        jobName: job.name,
        status: result.status,
        error: result.error,
      });

      if (result.status === 'completed') {
        succeeded++;
      } else if (result.status === 'skipped') {
        skipped++;
      } else {
        failed++;
      }
    } catch (err: any) {
      // Failure isolation — never let one job crash the whole runner
      const errorMsg = err.message || 'Unknown error';
      console.log(`[JOBS] Unhandled error running ${job.name}:`, errorMsg);
      results.push({ jobName: job.name, status: 'failed', error: errorMsg });
      failed++;
    }
  }

  console.log(`[JOBS] Run complete: ${dueJobs.length} ran, ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`);

  return {
    ran: dueJobs.length,
    succeeded,
    failed,
    skipped,
    results,
  };
}

/**
 * Run a job by its DB ID (used by the "Run Now" admin button).
 * Looks up the job by ID, then delegates to runJob(name, triggeredBy).
 */
export async function runJobById(
  jobId: string,
  options: { triggeredBy: 'cron' | 'manual' | 'retry' } = { triggeredBy: 'manual' }
): Promise<{ success: boolean; runId: string; status: JobRunStatus; error?: string }> {
  await ensureJobsTable();

  const job = await scheduledJobs.getByIdAsync(jobId);
  if (!job) {
    return { success: false, runId: '', status: 'failed', error: `Job with ID "${jobId}" not found` };
  }

  return runJob(job.name, options.triggeredBy);
}
