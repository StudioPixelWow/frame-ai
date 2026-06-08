/**
 * Auto-enrollment — guarantees EVERY active plan/client has an automation status
 * row so it runs on a schedule. New clients are picked up automatically on the
 * next tick (no manual setup). Existing settings are never overwritten.
 */

import { seoPlans } from '@/lib/db';
import { getSb, rid, ensureAutomationTables } from './db';

// Only a REAL, running SEO/GEO program is automated — not every old one-off scan.
// 'active' = an ongoing plan; 'tasks_created'/'plan_generated' = a 60-day plan is live.
const QUALIFY = new Set(['active', 'tasks_created', 'plan_generated']);

export async function loadAutomationPlans(): Promise<any[]> {
  const all = (await seoPlans.getAllAsync()) as any[];
  const qualifying = all.filter((p) => p && p.id && QUALIFY.has(p.status));
  // Dedupe: one plan per client (keep the most recently updated) so repeated
  // scans of the same client don't create duplicate automation rows.
  const byClient = new Map<string, any>();
  for (const p of qualifying) {
    const key = p.clientId || p.id;
    const prev = byClient.get(key);
    if (!prev || new Date(p.updatedAt || 0) > new Date(prev.updatedAt || 0)) byClient.set(key, p);
  }
  return [...byClient.values()];
}

/**
 * Make automation authoritative: enroll qualifying plans, and DISABLE rows whose
 * plan no longer qualifies (old scans) so only real active programs run.
 */
export async function enrollActivePlans(): Promise<{ enrolled: number; total: number; disabled: number }> {
  await ensureAutomationTables();
  const sb = getSb();
  const plans = await loadAutomationPlans();
  const qualifyIds = new Set(plans.map((p) => p.id));
  const { data: existing } = await sb.from('geo_client_automation_status').select('plan_id, automation_enabled');
  const have = new Set((existing || []).map((r: any) => r.plan_id));
  const now = new Date().toISOString();

  // Disable previously-enrolled rows that no longer represent an active program.
  let disabled = 0;
  for (const r of (existing || [])) {
    if (!qualifyIds.has(r.plan_id) && r.automation_enabled) {
      await sb.from('geo_client_automation_status').update({ automation_enabled: false, current_status: 'disabled', next_run_at: null, updated_at: now }).eq('plan_id', r.plan_id);
      disabled++;
    }
  }

  const toAdd = plans.filter((p) => !have.has(p.id));
  let enrolled = 0;
  for (const p of toAdd) {
    const { error } = await sb.from('geo_client_automation_status').insert({
      plan_id: p.id, client_id: p.clientId || null, client_name: p.clientName || '',
      automation_enabled: true, modules_enabled: ['geo_refresh', 'geo_autoapply', 'ai_visibility', 'rank_tracking', 'backlink_tracking', 'visibility_report'], run_frequency: 'daily',
      priority: 5, next_run_at: new Date().toISOString(), current_status: 'active',
      failure_count: 0, monthly_budget_cents: 0, monthly_usage_cents: 0,
      usage_month: `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`,
      updated_at: new Date().toISOString(),
    });
    if (!error) enrolled++;
  }
  return { enrolled, total: plans.length, disabled };
}
