/**
 * GET /api/cron/geo-monitoring
 *
 * GEO Monitoring Agent (module #14) — scheduled snapshot. For each active SEO
 * plan it records the current AI-visibility state into geo_ai_monitoring_results
 * so the Authority Center can show trend over time (does the brand appear in AI
 * answers, on which queries, with what position). Also recomputes + persists the
 * site Authority Score so the score history accrues.
 *
 * Lightweight and idempotent-per-day. Reads the visibility data already captured
 * on each plan (no new external calls), so it's quota-free and fast.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { getSupabase, ensureTable } from '@/lib/db/store';
import { GEO_DDL_EXTRA, ensureGeoTables, saveAuthorityScore } from '@/lib/seo/geo-authority/db';
import { computeAuthorityScore } from '@/lib/seo/geo-authority/authority-score';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PLANS = 20;
const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export async function GET(_req: NextRequest) {
  await ensureGeoTables();
  try { await ensureTable('geo_ai_monitoring_results', GEO_DDL_EXTRA.geo_ai_monitoring_results); } catch { /* noop */ }
  const sb = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  let plans: any[] = [];
  try { plans = (await seoPlans.getAllAsync()) as any[]; } catch { plans = []; }
  const active = plans.filter((p) => ['active', 'completed', 'tasks_created', 'plan_generated'].includes(p.status)).slice(0, MAX_PLANS);

  let snapshots = 0; let scored = 0;
  for (const plan of active) {
    try {
      const vis = (Array.isArray(plan.visibilityResults) && plan.visibilityResults.length
        ? plan.visibilityResults
        : (plan.baselineAiQueries || [])) as any[];

      // Skip if we already snapshotted this plan today (avoid duplicate daily rows).
      const { data: existing } = await sb.from('geo_ai_monitoring_results')
        .select('id').eq('plan_id', plan.id).gte('checked_at', `${today}T00:00:00Z`).limit(1);
      if (existing && existing.length) continue;

      const rows = vis.slice(0, 30).map((v: any) => ({
        id: rid('gmr'), plan_id: plan.id, query_id: v.queryId || null,
        platform: v.platform || 'unknown', found: !!v.found,
        position: typeof v.position === 'number' ? v.position : null,
        snippet: (v.snippet || v.responseText || '').slice(0, 500),
        checked_at: new Date().toISOString(),
      }));
      if (rows.length) { await sb.from('geo_ai_monitoring_results').insert(rows); snapshots += rows.length; }

      // Accrue Authority Score history.
      const result = computeAuthorityScore(plan);
      await saveAuthorityScore({ planId: plan.id, clientId: plan.clientId, scope: 'site', overall: result.overall, subScores: result.subScores, issues: result.issues });
      scored++;
    } catch { /* per-plan best-effort */ }
  }

  return NextResponse.json({ ok: true, plansProcessed: active.length, snapshots, scored, date: today });
}
