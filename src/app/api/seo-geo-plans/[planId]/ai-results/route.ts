import { NextRequest, NextResponse } from 'next/server';
import { ok, loadPlan, notFound, withErrorBoundary } from '@/lib/seo/api-helpers';

export const GET = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  const url = new URL(req.url);
  const engineFilter = url.searchParams.get('engine');

  let results = plan.visibilityResults || [];

  // Filter by engine if provided
  if (engineFilter) {
    results = results.filter((r) => r.engine === engineFilter);
  }

  return ok({
    results,
    score: plan.visibilityScore || 0,
    queryCount: plan.visibilityQueries?.length || 0,
  });
});
