import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import {
  ok,
  err,
  notFound,
  logActivity,
  loadPlan,
  updatePlanSafe,
  withErrorBoundary,
  parseBody,
} from '@/lib/seo/api-helpers';

interface TaskUpdateBody {
  status?: string;
  assignedTo?: string;
  completedAt?: string;
}

export const PATCH = withErrorBoundary(async (request: NextRequest, context: { params: Promise<{ taskId: string }> }) => {
  const { taskId } = await context.params;

  const body = await parseBody(request);
  const { status, assignedTo, completedAt } = body as TaskUpdateBody;

  // Load all plans and search for the task
  const plans = await seoPlans.getAll();
  let targetPlan = null;
  let foundTask = null;
  let foundDayIndex = -1;
  let foundTaskIndex = -1;

  for (const plan of plans) {
    if (!plan.days) continue;
    for (let dayIdx = 0; dayIdx < plan.days.length; dayIdx++) {
      const day = plan.days[dayIdx];
      if (!day.tasks) continue;
      for (let taskIdx = 0; taskIdx < day.tasks.length; taskIdx++) {
        const task = day.tasks[taskIdx];
        if (task.id === taskId) {
          targetPlan = plan;
          foundTask = task;
          foundDayIndex = dayIdx;
          foundTaskIndex = taskIdx;
          break;
        }
      }
      if (foundTask) break;
    }
    if (foundTask) break;
  }

  if (!foundTask || !targetPlan) {
    return notFound('Task not found');
  }

  // Update the task in-place
  if (status !== undefined) {
    foundTask.status = status;
  }
  if (assignedTo !== undefined) {
    foundTask.assignedTo = assignedTo;
  }
  if (completedAt !== undefined) {
    foundTask.completedAt = completedAt;
  }

  // If status changed to 'completed', set completedAt and increment plan counter
  if (status === 'completed') {
    foundTask.completedAt = completedAt || new Date().toISOString();
    targetPlan.completedTasks = (targetPlan.completedTasks || 0) + 1;
  }

  // Save the updated plan
  await updatePlanSafe(targetPlan.id, targetPlan);

  await logActivity(`Updated growth task ${taskId}`, {
    taskId,
    planId: targetPlan.id,
    status,
    assignedTo,
  });

  return ok(foundTask);
});
