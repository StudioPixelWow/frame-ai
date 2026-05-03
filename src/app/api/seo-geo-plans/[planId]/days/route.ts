import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { ok, err, notFound, logActivity, loadPlan, withErrorBoundary } from '@/lib/seo/api-helpers';

export const GET = withErrorBoundary(async (request: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;

  const plan = await loadPlan(planId, request);
  if (!plan) {
    return notFound('Plan not found');
  }

  const url = new URL(request.url);
  const phaseFilter = url.searchParams.get('phase');
  const fromDay = url.searchParams.get('from');
  const toDay = url.searchParams.get('to');

  let filteredDays = [...plan.days];

  // Filter by phase
  if (phaseFilter) {
    const phaseNum = parseInt(phaseFilter, 10);
    filteredDays = filteredDays.filter((day) => day.phaseNumber === phaseNum);
  }

  // Filter by day range
  if (fromDay || toDay) {
    const from = fromDay ? parseInt(fromDay, 10) : 1;
    const to = toDay ? parseInt(toDay, 10) : plan.days.length;
    filteredDays = filteredDays.filter((day) => day.dayNumber >= from && day.dayNumber <= to);
  }

  await logActivity(`Fetched days for plan ${planId}`, { planId, count: filteredDays.length });

  return ok({
    days: filteredDays,
    totalDays: filteredDays.length,
    phases: plan.phases,
  });
});
