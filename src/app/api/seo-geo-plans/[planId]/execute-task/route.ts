import { NextRequest, NextResponse } from 'next/server';
import type { SeoPlan } from '@/lib/db/schema';
import {
  ok,
  err,
  loadPlan,
  updatePlanSafe,
  logActivity,
  parseBody,
  withErrorBoundary,
  mergeAllKeywords,
} from '@/lib/seo/api-helpers';
import {
  executeAutoTask,
  mapPlanTaskToAutoType,
  type AutoTaskType,
  type AutoTaskResult,
  type AutomationContext,
} from '@/lib/seo/seo-automator';
import type { WPConnection } from '@/lib/seo/wordpress-client';

// ── Types ───────────────────────────────────────────────────────────────────

interface ExecuteTaskRequest {
  taskId: string;
  taskTitle: string;
  taskType?: string;
}

interface ExecuteTaskResponse {
  success: boolean;
  taskType?: AutoTaskType;
  taskId?: string;
  pagesAffected?: number;
  changesCount?: number;
  error?: string;
}

// ── Main API handler ────────────────────────────────────────────────────────

async function _POST(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);

  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  const { body, error: parseErr } = await parseBody<ExecuteTaskRequest>(req);
  if (parseErr) return parseErr;

  if (!body) {
    return err('Request body is required', 400);
  }

  const { taskId, taskTitle, taskType: providedTaskType } = body;

  // Validate required fields
  if (!taskId || !taskTitle) {
    return err('Missing required fields: taskId, taskTitle', 400);
  }

  try {
    // Check if WordPress is connected
    const wpConnection = (plan as any).wpConnection as WPConnection | undefined;
    console.log(`[EXECUTE-TASK] planId=${planId}, taskTitle="${taskTitle}", wpConnection=${wpConnection ? 'YES' : 'NO'}`);
    if (!wpConnection) {
      console.error(`[EXECUTE-TASK] No wpConnection found in plan. Plan keys: ${Object.keys(plan as any).join(', ')}`);
      return err('WordPress לא מחובר', 400);
    }

    // Determine automation task type
    let autoTaskType: AutoTaskType | null = null;

    if (providedTaskType) {
      autoTaskType = providedTaskType as AutoTaskType;
    } else {
      autoTaskType = mapPlanTaskToAutoType(taskTitle);
    }

    console.log(`[EXECUTE-TASK] taskTitle="${taskTitle}" → autoTaskType=${autoTaskType}`);
    if (!autoTaskType) {
      return err('לא ניתן לזהות סוג משימה', 400);
    }

    // Build automation context from plan data (matching daily-runner pattern)
    const facts = (plan as any).websiteScan?.websiteFacts || {};
    const profile = (plan as any).businessProfile || {};
    const automationContext: AutomationContext = {
      connection: wpConnection,
      businessName: plan.clientName || facts.business_name?.value || facts.business_name || '',
      businessType: facts.business_type?.value || facts.business_type || profile.business_type || '',
      industry: facts.detected_industry?.value || facts.industry || profile.industry || '',
      products: (() => {
        const p = facts.main_products_or_services?.value || facts.main_products_or_services || profile.main_products_or_services;
        return Array.isArray(p) ? p : [];
      })(),
      location: facts.detected_location?.value || facts.location || profile.location || 'Israel',
      targetKeywords: mergeAllKeywords(plan),
      planId: plan.id,
    };

    // Execute the automation task
    const result = await executeAutoTask(autoTaskType, automationContext);

    // Save result to plan's automation results
    const automationResults = (plan as any).automationResults || [];
    const resultWithMetadata = {
      ...result,
      taskId,
      taskTitle,
      executedAt: new Date().toISOString(),
    };
    automationResults.push(resultWithMetadata);

    // Update plan with results
    const updated = await updatePlanSafe(planId, {
      automationResults,
    } as any);

    if (!updated) {
      return err('Failed to save task results', 500);
    }

    // Update task status to "done" in the plan if tasks exist
    const tasks = (plan as any).tasks || [];
    const taskIndex = tasks.findIndex((t: any) => t.id === taskId);
    if (taskIndex >= 0) {
      tasks[taskIndex] = {
        ...tasks[taskIndex],
        status: 'done',
        completedAt: new Date().toISOString(),
      };
      await updatePlanSafe(planId, { tasks } as any);
    }

    // Log the activity
    logActivity(planId, 'execute_task', {
      taskId,
      taskTitle,
      taskType: autoTaskType,
      success: result.success,
      pagesAffected: result.pagesAffected,
      changesCount: result.changes.length,
    });

    const response: ExecuteTaskResponse = {
      success: result.success,
      taskType: autoTaskType,
      taskId,
      pagesAffected: result.pagesAffected,
      changesCount: result.changes.length,
      error: result.error,
    };

    return ok(response);
  } catch (error) {
    console.error('[SEO-API] POST /seo-geo-plans/[planId]/execute-task error:', error);
    return err('Failed to execute task', 500);
  }
}

export const POST = withErrorBoundary(_POST);
