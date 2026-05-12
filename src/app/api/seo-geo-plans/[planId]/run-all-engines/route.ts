import { NextRequest, NextResponse } from 'next/server';
import {
  ok,
  err,
  loadPlan,
  updatePlanSafe,
  logActivity,
  withErrorBoundary,
  mergeAllKeywords,
} from '@/lib/seo/api-helpers';
import {
  executeAutomationModule,
  type AutoTaskType,
  type AutomationContext,
} from '@/lib/seo/seo-automator';
import type { WPConnection } from '@/lib/seo/wordpress-client';

// ── All 18 automation engines in execution order ─────────────────────────────

const ALL_ENGINES: { id: string; autoTaskType: AutoTaskType }[] = [
  // Phase 1 — Infrastructure
  { id: 'technical_seo', autoTaskType: 'technical_seo' as AutoTaskType },
  { id: 'auto_internal_linking', autoTaskType: 'auto_internal_linking' as AutoTaskType },
  { id: 'meta_optimization', autoTaskType: 'meta_optimization' as AutoTaskType },
  { id: 'image_seo', autoTaskType: 'image_seo' as AutoTaskType },
  // Phase 2 — Content
  { id: 'faq_schema', autoTaskType: 'faq_schema' as AutoTaskType },
  { id: 'content_refresh', autoTaskType: 'content_refresh' as AutoTaskType },
  { id: 'topic_clusters', autoTaskType: 'topic_clusters' as AutoTaskType },
  { id: 'humanization', autoTaskType: 'humanization' as AutoTaskType },
  // Phase 3 — Visibility
  { id: 'geo_visibility', autoTaskType: 'geo_visibility' as AutoTaskType },
  { id: 'authority_reinforcement', autoTaskType: 'authority_reinforcement' as AutoTaskType },
  { id: 'entity_graph', autoTaskType: 'entity_graph' as AutoTaskType },
  { id: 'local_seo', autoTaskType: 'local_seo' as AutoTaskType },
  // Phase 4 — Advanced
  { id: 'cannibalization', autoTaskType: 'cannibalization' as AutoTaskType },
  { id: 'cta_optimization', autoTaskType: 'cta_optimization' as AutoTaskType },
  { id: 'gsc_intelligence', autoTaskType: 'gsc_intelligence' as AutoTaskType },
  { id: 'ga4_conversion', autoTaskType: 'ga4_conversion' as AutoTaskType },
  // Phase 5 — Monitoring
  { id: 'serp_monitoring', autoTaskType: 'serp_monitoring' as AutoTaskType },
  { id: 'adaptive_strategy', autoTaskType: 'adaptive_strategy' as AutoTaskType },
];

// ── Main API handler ─────────────────────────────────────────────────────────

async function _POST(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);

  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  // Get WordPress connection
  const wpConnection = (plan as any).wpConnection as WPConnection | undefined;
  if (!wpConnection) {
    return err('WordPress לא מחובר — חבר את WordPress קודם', 400);
  }

  // Build automation context
  const facts = (plan as any).websiteScan?.websiteFacts || {};
  const profile = (plan as any).businessProfile || {};
  const automationContext: AutomationContext = {
    connection: wpConnection,
    businessName: plan.clientName || facts.business_name?.value || facts.business_name || '',
    businessType: facts.business_type?.value || facts.business_type || profile.business_type || '',
    industry: facts.detected_industry?.value || facts.industry || profile.industry || '',
    products: (() => {
      const p = facts.main_products_or_services?.value || facts.main_products_or_services || profile.main_products_or_services;
      return Array.isArray(p) ? p : [];
    })(),
    location: facts.detected_location?.value || facts.location || profile.location || 'Israel',
    targetKeywords: mergeAllKeywords(plan),
    planId: plan.id,
  };

  // Run all engines sequentially, collect results
  const results: { engineId: string; success: boolean; error?: string; pagesAffected?: number }[] = [];
  const automationResults = (plan as any).automationResults || [];

  console.log(`[RUN-ALL-ENGINES] Starting all ${ALL_ENGINES.length} engines for plan ${planId}`);

  for (const engine of ALL_ENGINES) {
    try {
      console.log(`[RUN-ALL-ENGINES] Running: ${engine.id}`);
      const result = await executeAutomationModule(engine.autoTaskType, automationContext);

      const resultEntry = {
        ...result,
        taskId: `auto-all-${engine.id}-${Date.now()}`,
        taskTitle: engine.id,
        taskType: engine.autoTaskType,
        executedAt: new Date().toISOString(),
      };
      automationResults.push(resultEntry);

      results.push({
        engineId: engine.id,
        success: result.success,
        error: result.error,
        pagesAffected: result.pagesAffected,
      });

      console.log(`[RUN-ALL-ENGINES] ${engine.id}: ${result.success ? '✅' : '❌'} (${result.pagesAffected || 0} pages)`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[RUN-ALL-ENGINES] ${engine.id} crashed:`, errMsg);
      results.push({ engineId: engine.id, success: false, error: errMsg });

      automationResults.push({
        taskId: `auto-all-${engine.id}-${Date.now()}`,
        taskTitle: engine.id,
        taskType: engine.autoTaskType,
        success: false,
        error: errMsg,
        pagesAffected: 0,
        changes: [],
        executedAt: new Date().toISOString(),
      });
    }
  }

  // Save all results to plan
  await updatePlanSafe(planId, { automationResults } as any);

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  logActivity(planId, 'run_all_engines', {
    total: ALL_ENGINES.length,
    succeeded,
    failed,
  });

  console.log(`[RUN-ALL-ENGINES] Done: ${succeeded}/${ALL_ENGINES.length} succeeded, ${failed} failed`);

  return ok({
    success: true,
    total: ALL_ENGINES.length,
    succeeded,
    failed,
    results,
  });
}

export const POST = withErrorBoundary(_POST);
