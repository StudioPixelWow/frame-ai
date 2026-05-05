import { NextRequest, NextResponse } from 'next/server';
import { ok, err, loadPlan, notFound, updatePlanSafe, logActivity, withErrorBoundary } from '@/lib/seo/api-helpers';
import { generate60DayPlan } from '@/lib/seo/plan-engine';
import type { PlanInput } from '@/lib/seo/plan-engine';

/**
 * Extract keywords from plan data (websiteScan H1/H2 tags, business profile, or visibility queries)
 */
function extractKeywords(plan: any): string[] {
  const keywords = new Set<string>();

  // Extract from H1 and H2 tags
  if (plan.websiteScan?.h1Tags && Array.isArray(plan.websiteScan.h1Tags)) {
    plan.websiteScan.h1Tags.forEach((tag: string) => {
      if (tag && typeof tag === 'string') {
        keywords.add(tag.trim());
      }
    });
  }

  if (plan.websiteScan?.h2Tags && Array.isArray(plan.websiteScan.h2Tags)) {
    plan.websiteScan.h2Tags.forEach((tag: string) => {
      if (tag && typeof tag === 'string') {
        keywords.add(tag.trim());
      }
    });
  }

  // Extract from business profile main products/services
  if (plan.websiteScan?.websiteFacts?.main_products_or_services && Array.isArray(plan.websiteScan.websiteFacts.main_products_or_services)) {
    plan.websiteScan.websiteFacts.main_products_or_services.forEach((service: string) => {
      if (service && typeof service === 'string') {
        keywords.add(service.trim());
      }
    });
  }

  // Fallback: extract from visibility queries (up to 10 unique queries)
  if (plan.visibilityQueries && Array.isArray(plan.visibilityQueries) && keywords.size === 0) {
    plan.visibilityQueries.slice(0, 10).forEach((q: any) => {
      if (q.query && typeof q.query === 'string') {
        keywords.add(q.query.trim());
      }
    });
  }

  return Array.from(keywords).slice(0, 20);
}

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  // Build PlanInput from plan data
  const planInput: PlanInput = {
    clientName: plan.clientName,
    websiteUrl: plan.websiteUrl,
    websiteScan: plan.websiteScan
      ? {
          url: plan.websiteScan.url,
          hasSSL: plan.websiteScan.hasSSL,
          loadTimeMs: plan.websiteScan.loadTimeMs,
          mobileOptimized: plan.websiteScan.mobileOptimized,
          metaTitle: plan.websiteScan.metaTitle,
          metaDescription: plan.websiteScan.metaDescription,
          h1Tags: plan.websiteScan.h1Tags,
          totalPages: plan.websiteScan.totalPages,
          indexedPages: plan.websiteScan.indexedPages,
          brokenLinks: plan.websiteScan.brokenLinks,
          hasRobotsTxt: plan.websiteScan.hasRobotsTxt,
          hasSitemap: plan.websiteScan.hasSitemap,
          domainAuthority: plan.websiteScan.domainAuthority,
          structuredData: plan.websiteScan.structuredData,
          openGraph: plan.websiteScan.openGraph,
          canonicalTags: plan.websiteScan.canonicalTags,
          techStack: plan.websiteScan.techStack,
          cmsDetected: plan.websiteScan.cmsDetected,
          issues: plan.websiteScan.issues.map((issue) => ({
            type: issue.type,
            category: issue.category,
            title: issue.title,
            description: issue.description,
            impact: issue.impact,
          })),
        }
      : null,
    scannedPages: plan.scannedPages || [],
    visibilityResults: (plan.visibilityResults || []).map((result) => ({
      queryId: result.queryId,
      query: result.query,
      results: [
        {
          engine: result.engine,
          mentioned: result.mentioned,
          position: result.position,
          sentiment: result.sentiment,
        },
      ],
    })),
    visibilityQueries: (plan.visibilityQueries || []).map((q) => ({
      id: q.id,
      query: q.query,
      category: q.category,
      intent: q.intent,
      importance: q.importance,
    })),
    competitors: (plan.competitors || []).map((c) => c.domain),
    contentGaps: (plan.contentGaps || []).map((gap) => ({
      query: gap.query,
      category: gap.category,
      intent: gap.intent,
      importance: gap.importance,
    })),
    goals: (plan.goals || []).map((g) => ({
      id: g.id,
      type: g.type,
      label: g.label,
      targetMetric: g.targetMetric,
      currentValue: g.currentValue,
      targetValue: g.targetValue,
      priority: g.priority,
    })),
    targetKeywords: extractKeywords(plan),
    targetLocation: 'Israel',
    targetLanguage: 'Hebrew',
    insights: (plan.insights || []).map((insight) => ({
      id: insight.id,
      category: insight.category,
      title: insight.title,
      description: insight.description,
      impact: insight.impact,
      action: insight.suggestedAction,
    })),
  };

  // Call plan engine
  const generatedPlan = generate60DayPlan(planInput);

  // Update plan with generated data
  const updated = await updatePlanSafe(planId, {
    days: generatedPlan.days,
    phases: generatedPlan.phases,
    totalTasks: generatedPlan.totalTasks,
    totalHours: generatedPlan.totalHours,
    status: 'plan_generated',
    generatedAt: new Date().toISOString(),
  });

  if (!updated) return err('Failed to save generated plan', 500);

  logActivity(planId, 'generate_60_day_plan', {
    totalDays: generatedPlan.days.length,
    totalTasks: generatedPlan.totalTasks,
    totalHours: generatedPlan.totalHours,
    phases: generatedPlan.phases.length,
  });

  return ok({
    days: generatedPlan.days,
    phases: generatedPlan.phases,
    totalTasks: generatedPlan.totalTasks,
    totalHours: generatedPlan.totalHours,
    generatedAt: new Date().toISOString(),
  });
});
