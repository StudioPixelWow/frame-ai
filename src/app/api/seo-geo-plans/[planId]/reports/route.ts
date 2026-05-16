import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { ok, err, notFound, logActivity, loadPlan, withErrorBoundary } from '@/lib/seo/api-helpers';

export const GET = withErrorBoundary(async (request: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;

  const result = await loadPlan(planId, request);
  if (result.error) return result.error;
  const plan = result.plan;
  if (!plan) {
    return notFound('Plan not found');
  }

  const reports = plan.reports || [];

  await logActivity(`Fetched reports for plan ${planId}`, { planId, count: reports.length });

  return ok({
    reports,
    total: reports.length,
  });
});
