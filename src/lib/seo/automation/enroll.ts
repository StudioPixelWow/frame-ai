/**
 * Auto-enrollment — guarantees EVERY active plan/client has an automation status
 * row so it runs on a schedule. New clients are picked up automatically on the
 * next tick (no manual setup). Existing settings are never overwritten.
 */

import { seoPlans } from '@/lib/db';
import { getSb, rid, ensureAutomationTables } from './db';

// A plan is "active for automation" if it has a usable plan (not a bare draft/scan).
const INACTIVE = new Set(['draft', 'scanning']);

export async function loadAutomationPlans(): Promise<any[]> {
  const all = (await seoPlans.getAllAsync()) as any[];
  return all.filter((p) => p && p.id && !INACTIVE.has(p.status) && (p.websiteUrl || p.clientId));
}

/** Ensure a status row exists for each active plan. Returns {enrolled, total}. */
export async function enrollActivePlans(): Promise<{ enrolled: number; total: number }> {
  await ensureAutomationTables();
  const sb = getSb();
  const plans = await loadAutomationPlans();
  const { data: existing } = await sb.from('geo_client_automation_status').select('plan_id');
  const have = new Set((existing || []).map((r: any) => r.plan_id));
  const toAdd = plans.filter((p) => !have.has(p.id));
  let enrolled = 0;
  for (const p of toAdd) {
    const { error } = await sb.from('geo_client_automation_status').insert({
      plan_id: p.id, client_id: p.clientId || null, client_name: p.clientName || '',
      automation_enabled: true, modules_enabled: ['geo_refresh', 'geo_autoapply', 'ai_visibility', 'visibility_report'], run_frequency: 'daily',
      priority: 5, next_run_at: new Date().toISOString(), current_status: 'active',
      failure_count: 0, monthly_budget_cents: 0, monthly_usage_cents: 0,
      usage_month: `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`,
      updated_at: new Date().toISOString(),
    });
    if (!error) enrolled++;
  }
  return { enrolled, total: plans.length };
}
