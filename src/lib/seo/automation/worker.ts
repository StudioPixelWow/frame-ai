/**
 * Automation worker — executes a claimed job, writes a run + logs, applies cost
 * control, and updates the per-client automation status (last/next run, success/
 * failure, current_status). Job handlers reuse the existing GEO engines so the
 * system genuinely runs the GEO work for every client automatically.
 *
 * The default recurring job 'geo_refresh' is deterministic and quota-free
 * (recompute scores + recommendations) → it ALWAYS runs for every client even
 * without OpenAI budget. AI-heavy job types carry a cost estimate and respect
 * the client's monthly budget.
 */

import { seoPlans } from '@/lib/db';
import { getSb, rid, monthKey, ensureAutomationTables } from './db';
import { GeoJobQueueService } from './queue';
import { computeAuthorityScore } from '@/lib/seo/geo-authority/authority-score';
import { saveAuthorityScore, replaceRecommendations } from '@/lib/seo/geo-authority/db';
import { computeAllScores } from '@/lib/seo/geo-authority/scores';
import { saveScore } from '@/lib/seo/geo-authority/advanced-db';

/** estimated cost per job type, in cents (for budget control). */
const JOB_COST_CENTS: Record<string, number> = {
  geo_refresh: 0,        // deterministic, no AI
  geo_autoapply: 0,      // applies existing safe drafts to WP (no AI)
  ai_visibility: 12,     // AI engine calls (controlled query cap)
  visibility_report: 1,  // build + email the monthly client report
  citation_tracker: 8,
  answer_simulation: 6,
  monthly_report: 1,
};

export const FREQ_MS: Record<string, number> = {
  daily: 24 * 3600_000, weekly: 7 * 24 * 3600_000, monthly: 30 * 24 * 3600_000,
};
export function nextRunFrom(frequency: string, from = new Date()): Date {
  return new Date(from.getTime() + (FREQ_MS[frequency] || FREQ_MS.daily));
}

async function log(runId: string, jobId: string, planId: string, level: string, message: string) {
  try { await getSb().from('geo_automation_run_logs').insert({ id: rid('rlog'), run_id: runId, job_id: jobId, plan_id: planId, level, message: message.slice(0, 1000), created_at: new Date().toISOString() }); } catch { /* */ }
}

/* ── Job handlers ── */
const HANDLERS: Record<string, (plan: any, runId: string, jobId: string) => Promise<any>> = {
  // Deterministic GEO refresh: authority score + recommendations + advanced scores.
  async geo_refresh(plan, runId, jobId) {
    const a = computeAuthorityScore(plan);
    await saveAuthorityScore({ planId: plan.id, clientId: plan.clientId, scope: 'site', overall: a.overall, subScores: a.subScores, issues: a.issues });
    await replaceRecommendations(plan.id, plan.clientId || null, a.recommendations);
    await log(runId, jobId, plan.id, 'info', `Authority score = ${a.overall}; ${a.recommendations.length} recommendations`);
    const scores = computeAllScores(plan);
    let n = 0;
    for (const [kind, sc] of Object.entries(scores)) { await saveScore({ planId: plan.id, clientId: plan.clientId, kind, value: sc.value, explanation: sc.explanation, factors: sc.factors, recommendations: sc.recommendations }).catch(() => {}); n++; }
    await log(runId, jobId, plan.id, 'info', `${n} advanced scores persisted`);
    return { authority: a.overall, recommendations: a.recommendations.length, scores: n };
  },

  // Auto-publish: apply existing safe drafts (schema/faq/internal_link) to a
  // WordPress-connected site. Free (no AI). Respects geo_publish_mode='auto'.
  async geo_autoapply(plan, runId, jobId) {
    const { getGeoPublishMode, isAutoApplicableKind } = await import('@/lib/seo/geo-authority/settings');
    if ((await getGeoPublishMode()) !== 'auto') { return { skipped: 'draft_mode' }; }
    if (!plan?.wpConnection?.siteUrl) { return { skipped: 'no_wp' }; }
    const { listDrafts, setDraftStatus } = await import('@/lib/seo/geo-authority/db');
    const { applyDraft } = await import('@/lib/seo/geo-authority/apply');
    const drafts = (await listDrafts(plan.id)).filter((d: any) => d.status === 'draft' && isAutoApplicableKind(d.kind));
    let applied = 0;
    for (const d of drafts.slice(0, 25)) { const out = await applyDraft(plan, d); if (out.applied) { await setDraftStatus(d.id, 'applied'); applied++; } }
    await log(runId, jobId, plan.id, 'info', `auto-applied ${applied}/${drafts.length} drafts to WordPress`);
    return { applied, candidates: drafts.length };
  },

  // Scheduled AI Visibility run — controlled query set × AI engines, measured.
  // Self-limits to ~once per 7 days so daily ticks don't multiply AI cost.
  async ai_visibility(plan, runId, jobId) {
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: recent } = await getSb().from('geo_automation_runs').select('id').eq('plan_id', plan.id).eq('job_type', 'ai_visibility').eq('status', 'completed').gte('created_at', weekAgo).limit(1);
    if (recent && recent.length) { await log(runId, jobId, plan.id, 'info', 'visibility ran in last 7d — skipped'); return { skipped: 'weekly_guard' }; }
    const { runVisibilityRun } = await import('@/lib/seo/geo-visibility/run');
    const limit = Number(process.env.GEO_VISIBILITY_MAX_RUN_QUERIES || 12);
    const out = await runVisibilityRun({ planId: plan.id, runType: 'scheduled', queryLimit: limit });
    await log(runId, jobId, plan.id, 'info', `visibility run: score=${out.score} mentions=${out.mentions} citations=${out.citations} (${out.mocked}/${out.responses} mock)`);
    return out;
  },

  // Monthly client report — build + email (best-effort). Self-limits to once per
  // calendar month so it's safe inside a weekly/daily module set.
  async visibility_report(plan, runId, jobId) {
    const mk = monthKey();
    const monthStart = `${mk}-01T00:00:00Z`;
    const { data: already } = await getSb().from('geo_automation_runs').select('id').eq('plan_id', plan.id).eq('job_type', 'visibility_report').eq('status', 'completed').gte('created_at', monthStart).limit(1);
    if (already && already.length) { await log(runId, jobId, plan.id, 'info', `report already sent for ${mk} — skipped`); return { month: mk, skipped: true }; }
    const { buildVisibilityReport } = await import('@/lib/seo/geo-visibility/report');
    const rep = await buildVisibilityReport(plan.id);
    let emailed = false;
    try {
      const { sendEmail, getSenderEmail, isEmailConfigured } = await import('@/lib/email/email-service');
      if (await isEmailConfigured()) {
        const to = rep.clientEmail || (await getSenderEmail());
        if (to) { await sendEmail({ to, subject: `📡 דוח נראות AI — ${rep.clientName} — ${rep.month}`, html: rep.html }); emailed = true; }
      }
    } catch { /* best-effort */ }
    await log(runId, jobId, plan.id, 'info', `monthly report ${rep.month} emailed=${emailed}`);
    return { month: rep.month, emailed };
  },
};

async function getStatus(planId: string) {
  const { data } = await getSb().from('geo_client_automation_status').select('*').eq('plan_id', planId).maybeSingle();
  return data;
}

async function updateStatus(planId: string, patch: Record<string, unknown>) {
  await getSb().from('geo_client_automation_status').update({ ...patch, updated_at: new Date().toISOString() }).eq('plan_id', planId);
}

/** Process one claimed job end-to-end with run record, cost control, status update. */
export async function processJob(job: any): Promise<{ ok: boolean; status: string; cost: number; error?: string }> {
  await ensureAutomationTables();
  const sb = getSb();
  const runId = rid('run');
  const startedAt = Date.now();
  const status = await getStatus(job.plan_id);

  // ── Cost / budget control (reset monthly) ──
  const cost = JOB_COST_CENTS[job.job_type] ?? 0;
  if (status) {
    const mk = monthKey();
    let usage = status.usage_month === mk ? (status.monthly_usage_cents || 0) : 0;
    if (status.usage_month !== mk) await updateStatus(job.plan_id, { usage_month: mk, monthly_usage_cents: 0 });
    const budget = status.monthly_budget_cents || 0;
    if (budget > 0 && cost > 0 && usage + cost > budget) {
      await GeoJobQueueService.markWaitingForBudget(job.id);
      await updateStatus(job.plan_id, { current_status: 'waiting_for_budget' });
      return { ok: false, status: 'waiting_for_budget', cost: 0 };
    }
  }

  await sb.from('geo_automation_runs').insert({ id: runId, job_id: job.id, plan_id: job.plan_id, client_id: job.client_id, job_type: job.job_type, status: 'running', started_at: new Date().toISOString(), created_at: new Date().toISOString() });
  await updateStatus(job.plan_id, { current_status: 'running' });

  try {
    const plan = await seoPlans.getByIdAsync(job.plan_id);
    if (!plan) throw new Error('Plan not found');
    const handler = HANDLERS[job.job_type];
    if (!handler) throw new Error(`No handler for job_type=${job.job_type}`);

    const result = await handler(plan, runId, job.id);
    const durationMs = Date.now() - startedAt;

    await GeoJobQueueService.completeJob(job.id, result, cost);
    await sb.from('geo_automation_runs').update({ status: 'completed', finished_at: new Date().toISOString(), duration_ms: durationMs, cost_cents: cost, summary: result }).eq('id', runId);

    const freq = status?.run_frequency || 'daily';
    const next = nextRunFrom(freq);
    const mk = monthKey();
    const usage = (status && status.usage_month === mk ? (status.monthly_usage_cents || 0) : 0) + cost;
    await updateStatus(job.plan_id, {
      last_run_at: new Date().toISOString(), last_success_at: new Date().toISOString(),
      next_run_at: next.toISOString(), current_status: 'active', failure_count: 0,
      usage_month: mk, monthly_usage_cents: usage,
    });
    return { ok: true, status: 'completed', cost };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'failed';
    await log(runId, job.id, job.plan_id, 'error', errMsg);
    const { retried } = await GeoJobQueueService.failJob(job, errMsg);
    await sb.from('geo_automation_runs').update({ status: retried ? 'retrying' : 'failed', finished_at: new Date().toISOString(), duration_ms: Date.now() - startedAt }).eq('id', runId);
    await updateStatus(job.plan_id, { last_failure_at: new Date().toISOString(), current_status: retried ? 'active' : 'failed', failure_count: (status?.failure_count || 0) + 1 });
    return { ok: false, status: retried ? 'retrying' : 'failed', cost: 0, error: errMsg };
  }
}

export { JOB_COST_CENTS };
