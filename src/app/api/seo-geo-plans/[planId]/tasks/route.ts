import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { ok, err, notFound, logActivity, loadPlan, withErrorBoundary } from '@/lib/seo/api-helpers';

interface EnrichedTask {
  id: string;
  day: number;
  phase: number;
  [key: string]: any;
}

export const GET = withErrorBoundary(async (request: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;

  const result = await loadPlan(planId, request);
  if (result.error) return result.error;
  const plan = result.plan;
  if (!plan) {
    return notFound('Plan not found');
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const typeFilter = url.searchParams.get('type');
  const impactFilter = url.searchParams.get('impact');
  const dayFilter = url.searchParams.get('day');

  // Flatten days into tasks array with enrichment
  let tasks: EnrichedTask[] = [];
  for (const day of (plan.days || [])) {
    for (const task of (day.tasks || [])) {
      tasks.push({
        ...task,
        day: day.dayNumber,
        phase: day.phaseNumber,
      });
    }
  }

  // Apply filters
  if (statusFilter) {
    tasks = tasks.filter((task) => task.status === statusFilter);
  }

  if (typeFilter) {
    tasks = tasks.filter((task) => task.type === typeFilter);
  }

  if (impactFilter) {
    tasks = tasks.filter((task) => task.impact === impactFilter);
  }

  if (dayFilter) {
    const dayNum = parseInt(dayFilter, 10);
    tasks = tasks.filter((task) => task.day === dayNum);
  }

  // Calculate status counts
  const byStatus = {
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    skipped: tasks.filter((t) => t.status === 'skipped').length,
  };

  await logActivity(`Fetched tasks for plan ${planId}`, { planId, count: tasks.length });

  return ok({
    tasks,
    total: tasks.length,
    byStatus,
  });
});
