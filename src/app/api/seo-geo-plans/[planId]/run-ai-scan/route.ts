import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import {
  ok,
  err,
  notFound,
  loadPlan,
  updatePlanSafe,
  logActivity,
  generateId,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  // Generate mock AI visibility results
  const now = new Date().toISOString();
  const engines: Array<'chatgpt' | 'gemini' | 'perplexity' | 'claude' | 'copilot'> = [
    'chatgpt',
    'gemini',
    'perplexity',
    'claude',
    'copilot',
  ];

  const results = [];
  let mentionedCount = 0;
  const sentiments = ['positive', 'neutral', 'negative'] as const;

  for (const query of plan.visibilityQueries || []) {
    for (const engine of engines) {
      const mentioned = Math.random() > 0.4;
      const position = mentioned ? Math.floor(Math.random() * 5) + 1 : null;
      const sentiment = mentioned
        ? sentiments[Math.floor(Math.random() * sentiments.length)]
        : 'not_mentioned';

      const result = {
        queryId: query.id,
        query: query.query,
        engine,
        mentioned,
        position,
        context: mentioned
          ? `Found in ${engine} search results at position ${position}. Context snippet about the query and how it relates to the client's business.`
          : `Not mentioned in ${engine} results.`,
        sentiment,
        competitorsMentioned: mentioned ? ['competitor1.com', 'competitor2.com'] : [],
        scannedAt: now,
      };

      results.push(result);
      if (mentioned) mentionedCount++;
    }
  }

  // Calculate visibility score: percentage of queries mentioned across all engines
  const totalChecks = (plan.visibilityQueries?.length || 0) * engines.length;
  const visibilityScore = totalChecks > 0 ? Math.round((mentionedCount / totalChecks) * 100) : 0;

  // Update plan with results
  const updated = await updatePlanSafe(planId, {
    visibilityResults: results,
    visibilityScore,
    status: 'visibility_done',
  });

  if (!updated) return err('Failed to save visibility results', 500);

  logActivity(planId, 'run_ai_scan', {
    resultsCount: results.length,
    visibilityScore,
    queriesScanned: plan.visibilityQueries?.length || 0,
    enginesScanned: engines.length,
  });

  return ok({
    results,
    score: visibilityScore,
    queryCount: plan.visibilityQueries?.length || 0,
  });
});
