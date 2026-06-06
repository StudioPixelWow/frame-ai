/**
 * Shared SEO/GEO daily plan runner logic — used by the cron (daily-runner) and
 * by the manual "run now" endpoint.
 *
 * Scale fix: with many active plans the cron used to time out mid-loop (one
 * serverless invocation, 2s sleeps + AI per task), so later plans never ran and
 * their "last run" never advanced. We now:
 *   - order plans by STALENESS (oldest last-run first) so every run makes progress
 *     on whatever is most behind, and
 *   - stop gracefully before a time budget, leaving the rest for the next run.
 * Per-plan catch-up still processes ALL missed days, so nothing is lost.
 */

import { seoPlans } from '@/lib/db';
import { executeAutoTask, executeAutomationModule, mapPlanTaskToAutoType, AutomationContext, AutoTaskResult, AutoTaskType } from '@/lib/seo/seo-automator';
import { updatePlanSafe, logActivity, mergeAllKeywords } from '@/lib/seo/api-helpers';
import { sendSeoTaskEmail, sendSeoDailySummaryEmail } from '@/lib/seo/seo-email-service';

/** Most-recent automation-log timestamp for a plan (0 if never run). */
function lastRunMs(plan: any): number {
  const log = plan.automationLog;
  if (Array.isArray(log) && log.length) {
    const last = log[log.length - 1]?.date;
    const t = last ? new Date(last).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  }
  return plan.activatedAt ? new Date(plan.activatedAt).getTime() : 0;
}

export async function loadActivePlans(): Promise<any[]> {
  const run = async () => (await seoPlans.queryFilteredAsync([
    { column: 'data->>status', op: 'in', value: ['active', 'plan_generated'] },
  ])).filter((p: any) => p.days && Array.isArray(p.days) && p.days.length > 0);
  try {
    return await run();
  } catch (dbError: any) {
    const errMsg = dbError?.message || String(dbError);
    const isTransient = dbError?.status === 522 || dbError?.code === 'ECONNRESET' || dbError?.code === 'ETIMEDOUT' || /522|connection|timeout/i.test(errMsg);
    if (!isTransient) throw dbError;
    await new Promise(r => setTimeout(r, 5000));
    return await run();
  }
}

/**
 * Run active plans, stalest-first, within a time budget.
 * @param opts.timeBudgetMs stop starting new plans after this elapsed time.
 * @param opts.planId       process only this plan (manual run-now).
 */
export async function runActivePlans(opts: { timeBudgetMs?: number; planId?: string } = {}) {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 240_000;

  let activePlans = await loadActivePlans();
  if (opts.planId) {
    activePlans = activePlans.filter((p: any) => p.id === opts.planId);
  } else {
    // Stalest first → every run advances whatever is most behind.
    activePlans.sort((a, b) => lastRunMs(a) - lastRunMs(b));
  }

  if (activePlans.length === 0) {
    return { success: true, plansProcessed: 0, results: [] as any[], message: 'אין תוכניות פעילות' };
  }

  const summaryResults: any[] = [];
  let skippedForTime = 0;
  for (let i = 0; i < activePlans.length; i++) {
    if (!opts.planId && Date.now() - start > budget) { skippedForTime = activePlans.length - i; break; }
    const plan = activePlans[i];
    try {
      summaryResults.push(await processPlanDailyTasks(plan));
    } catch (error) {
      summaryResults.push({ planId: plan.id, clientName: plan.clientName, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return {
    success: true, executedAt: new Date().toISOString(),
    plansProcessed: summaryResults.length, skippedForTime, results: summaryResults,
  };
}

export async function processPlanDailyTasks(plan: any) {
  const planId = plan.id;
  const generatedAt = plan.generatedAt ? new Date(plan.generatedAt) : null;
  if (!generatedAt) {
    return { planId, clientName: plan.clientName, success: false, error: 'No generatedAt — set generatedAt timestamp on the plan' };
  }

  const now = new Date();
  const dayNumber = Math.floor((now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (dayNumber < 1) return { planId, clientName: plan.clientName, success: true, dayNumber, skipped: true };
  if (dayNumber > 60) {
    if (plan.status !== 'completed') {
      await updatePlanSafe(planId, { status: 'completed', completedAt: new Date().toISOString() } as any);
    }
    return { planId, clientName: plan.clientName, success: true, dayNumber, skipped: true, completed: true };
  }

  if (plan.status === 'plan_generated') {
    await updatePlanSafe(planId, { status: 'active', activatedAt: new Date().toISOString() } as any);
  }

  // Catch-up: process ALL days up to today that still have pending tasks.
  const daysToProcess = plan.days
    .filter((d: any) => d.day <= dayNumber && d.tasks?.some((t: any) => t.status !== 'done'))
    .sort((a: any, b: any) => a.day - b.day);

  if (daysToProcess.length === 0) {
    return { planId, clientName: plan.clientName, success: true, dayNumber, tasksFound: 0 };
  }

  let allExecutionResults: any[] = [];
  let totalTasksFound = 0;
  const updatedDaysMap = new Map<number, any>();

  for (const todayDay of daysToProcess) {
    const hasWp = !!(plan.wpConnection?.siteUrl);
    const WP_REQUIRED_MODULES = new Set([
      'internal_linking', 'faq_schema', 'meta_optimization', 'content_refresh',
      'image_seo', 'cta_optimization', 'cannibalization', 'humanization',
    ]);
    const WP_REQUIRED_TYPES = new Set(['auto_internal_linking', 'auto_faq_schema', 'auto_meta_optimization']);

    const facts = plan.websiteScan?.websiteFacts || {};
    const profile = plan.businessProfile || {};
    const context: AutomationContext = {
      connection: plan.wpConnection || { siteUrl: '', username: '', appPassword: '' },
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

    const executionResults: any[] = [];
    const updatedTasks = [...todayDay.tasks];

    for (let i = 0; i < updatedTasks.length; i++) {
      const task = updatedTasks[i];
      if (task.status === 'done') continue;

      const automationModule = task.automationModule || undefined;
      let autoType: AutoTaskType | null = null;
      if (automationModule) {
        autoType = (automationModule === 'internal_linking' ? 'auto_internal_linking' : automationModule) as AutoTaskType;
      } else {
        autoType = mapPlanTaskToAutoType(task.title);
      }

      if (!autoType) {
        executionResults.push({ taskId: task.id, taskTitle: task.title, autoType: null, executed: false, reason: 'Manual task' });
        continue;
      }

      const needsWp = WP_REQUIRED_MODULES.has(automationModule || '') || WP_REQUIRED_TYPES.has(autoType);
      if (needsWp && !hasWp) {
        executionResults.push({ taskId: task.id, taskTitle: task.title, autoType, executed: false, reason: 'Requires WordPress — not connected' });
        continue;
      }

      try {
        if (autoType === 'daily_seo_article') {
          const kwMatch = task.title?.match(/—\s*[""״]([^""״]+)[""״]/);
          context.specificKeyword = kwMatch?.[1]?.trim() || undefined;
        } else {
          context.specificKeyword = undefined;
        }

        let result: AutoTaskResult;
        if (automationModule) {
          result = await executeAutomationModule(autoType, context, task.automationConfig);
        } else {
          result = await executeAutoTask(autoType, context);
        }

        updatedTasks[i] = {
          ...task,
          status: result.success ? 'done' : 'failed',
          completedAt: result.success ? new Date().toISOString() : undefined,
          executionResult: result.success
            ? `✅ ${result.pagesAffected || 0} עמודים עודכנו, ${result.changes.length} שינויים`
            : `❌ ${result.error || 'Unknown error'}`,
        };
        executionResults.push({
          taskId: task.id, taskTitle: task.title, autoType, executed: true,
          success: result.success, pagesAffected: result.pagesAffected, changesCount: result.changes.length, error: result.error,
        });

        if (result.success && plan.clientEmail) {
          try { await sendSeoTaskEmail(plan, task.title, result); } catch {}
        }
        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        executionResults.push({ taskId: task.id, taskTitle: task.title, autoType, executed: true, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    updatedDaysMap.set(todayDay.day, updatedTasks);
    allExecutionResults = allExecutionResults.concat(executionResults);
    totalTasksFound += todayDay.tasks.length;
  }

  const updatedDays = plan.days.map((d: any) => {
    const updated = updatedDaysMap.get(d.day);
    return updated ? { ...d, tasks: updated } : d;
  });

  const automationLog = plan.automationLog || [];
  automationLog.push({
    date: new Date().toISOString(), dayNumber,
    daysProcessed: daysToProcess.map((d: any) => d.day),
    results: allExecutionResults,
    totalTasks: totalTasksFound,
    executedTasks: allExecutionResults.filter((r: any) => r.executed).length,
    successfulTasks: allExecutionResults.filter((r: any) => r.success).length,
  });

  await updatePlanSafe(planId, { days: updatedDays, automationLog });
  logActivity(planId, 'cron_daily_execution', {
    dayNumber,
    daysProcessed: daysToProcess.map((d: any) => d.day),
    executed: allExecutionResults.filter((r: any) => r.executed).length,
    successful: allExecutionResults.filter((r: any) => r.success).length,
  });

  if (plan.clientEmail) {
    try {
      const completedCount = updatedDays.reduce((sum: number, d: any) => sum + (d.tasks?.filter((t: any) => t.status === 'done').length || 0), 0);
      const totalCount = updatedDays.reduce((sum: number, d: any) => sum + (d.tasks?.length || 0), 0);
      await sendSeoDailySummaryEmail(plan, dayNumber, allExecutionResults, completedCount, totalCount);
    } catch {}
  }

  return {
    planId, clientName: plan.clientName, success: true, dayNumber,
    daysProcessed: daysToProcess.map((d: any) => d.day),
    tasksFound: totalTasksFound,
    tasksExecuted: allExecutionResults.filter((r: any) => r.executed).length,
    tasksSuccessful: allExecutionResults.filter((r: any) => r.success).length,
  };
}
