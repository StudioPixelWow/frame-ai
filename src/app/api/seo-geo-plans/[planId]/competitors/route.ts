import { NextRequest, NextResponse } from 'next/server';
import { ok, loadPlan, notFound, withErrorBoundary } from '@/lib/seo/api-helpers';

export const GET = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  // Sort competitors by overlapScore descending
  const sorted = (plan.competitors || []).sort((a, b) => b.overlapScore - a.overlapScore);

  return ok({
    competitors: sorted,
    total: sorted.length,
  });
});
