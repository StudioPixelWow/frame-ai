import { NextRequest, NextResponse } from 'next/server';
import { ok, loadPlan, notFound, withErrorBoundary } from '@/lib/seo/api-helpers';

export const GET = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  const url = new URL(req.url);
  const importanceFilter = url.searchParams.get('importance');

  let gaps = plan.contentGaps || [];

  // Filter by importance if provided
  if (importanceFilter) {
    gaps = gaps.filter((g) => g.importance === importanceFilter);
  }

  return ok({
    gaps,
    total: gaps.length,
  });
});
