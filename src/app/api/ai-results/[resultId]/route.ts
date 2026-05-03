import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { ok, notFound, withErrorBoundary } from '@/lib/seo/api-helpers';

export const GET = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ resultId: string }> }) => {
  const { resultId } = await context.params;

  // Search across all plans for the result
  let allPlans;
  try {
    allPlans = await seoPlans.getAll();
  } catch (e) {
    console.error('[SEO-API] Failed to fetch all plans:', e);
    return notFound('Result');
  }

  if (!allPlans) return notFound('Result');

  for (const plan of allPlans) {
    const result = plan.visibilityResults?.find((r) => r.queryId === resultId);
    if (result) {
      return ok({
        result,
        planId: plan.id,
        planName: plan.clientName,
        visibilityScore: plan.visibilityScore,
      });
    }
  }

  return notFound('Result');
});
