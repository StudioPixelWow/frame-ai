import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { executeAutoTask, executeAutomationModule, mapPlanTaskToAutoType, AutomationContext, AutoTaskResult, AutoTaskType } from '@/lib/seo/seo-automator';
import { updatePlanSafe, logActivity, mergeAllKeywords } from '@/lib/seo/api-helpers';
import { sendSeoTaskEmail, sendSeoDailySummaryEmail } from '@/lib/seo/seo-email-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron Job יומי — רץ ב-08:00 ישראל (05:00 UTC)
 * Daily SEO automation cron job
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[SEO-CRON] Daily runner started at', new Date().toISOString());

  try {
    const allPlans = await seoPlans.getAllAsync();
    const activePlans = allPlans.filter((p: any) =>
      (p.status === 'active' || p.status === 'plan_generated') &&
      p.wpConnection?.siteUrl &&
      p.days && Array.isArray(p.days) && p.days.length > 0
    );

    if (activePlans.length === 0) {
      return NextResponse.json({ success: true, message: 'אין תוכניות פעילות', plansProcessed: 0 });
    }

    const summaryResults: any[] = [];

    for (const plan of activePlans) {
      try {
        const planResult = await processPlanDailyTasks(plan);
        summaryResults.push(planResult);
      } catch (error) {
        summaryResults.push({
          planId: plan.id, clientName: plan.clientName, success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true, executedAt: new Date().toISOString(),
      plansProcessed: summaryResults.length, results: summaryResults,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

async function processPlanDailyTasks(plan: any) {
  const planId = plan.id;
  const generatedAt = plan.generatedAt ? new Date(plan.generatedAt) : null;
  if (!generatedAt) return { planId, clientName: plan.clientName, success: false, error: 'No generatedAt' };

  const now = new Date();
  const dayNumber = Math.floor((now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (dayNumber < 1) {
    return { planId, clientName: plan.clientName, success: true, dayNumber, skipped: true };
  }
  if (dayNumber > 60) {
    // Plan completed — mark as 'completed' if not already
    if (plan.status !== 'completed') {
      await updatePlanSafe(planId, { status: 'completed', completedAt: new Date().toISOString() } as any);
      console.log(`[SEO-CRON] Plan ${planId} completed (day ${dayNumber} > 60)`);
    }
    return { planId, clientName: plan.clientName, success: true, dayNumber, skipped: true, completed: true };
  }

  // Auto-activate plan on first cron run
  if (plan.status === 'plan_generated') {
    await updatePlanSafe(planId, { status: 'active', activatedAt: new Date().toISOString() } as any);
    console.log(`[SEO-CRON] Plan ${planId} auto-activated (first cron run, day ${dayNumber})`);
  }

  const todayDay = plan.days.find((d: any) => d.day === dayNumber);
  if (!todayDay?.tasks?.length) {
    return { planId, clientName: plan.clientName, success: true, dayNumber, tasksFound: 0 };
  }

  const facts = plan.websiteScan?.websiteFacts || {};
  const profile = plan.businessProfile || {};
  const context: AutomationContext = {
    connection: plan.wpConnection,
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

    // Check for automationModule (new 18-engine system) first, fall back to legacy title-based detection
    const automationModule = task.automationModule || undefined;
    let autoType: AutoTaskType | null = null;

    if (automationModule) {
      // Map plan's automationModule name to AutoTaskType
      // Handle naming collision: plan uses 'internal_linking', AutoTaskType uses 'auto_internal_linking'
      autoType = (automationModule === 'internal_linking' ? 'auto_internal_linking' : automationModule) as AutoTaskType;
      console.log(`[SEO-CRON] Task "${task.title}" has automationModule="${automationModule}" → autoType="${autoType}"`);
    } else {
      autoType = mapPlanTaskToAutoType(task.title);
    }

    if (!autoType) {
      executionResults.push({ taskId: task.id, taskTitle: task.title, autoType: null, executed: false, reason: 'Manual task' });
      continue;
    }

    try {
      // Extract specific keyword from task title for article tasks
      if (autoType === 'daily_seo_article') {
        const kwMatch = task.title?.match(/—\s*[""״]([^""״]+)[""״]/);
        if (kwMatch?.[1]) {
          context.specificKeyword = kwMatch[1].trim();
          console.log(`[SEO-CRON] Extracted keyword for article: "${context.specificKeyword}"`);
        } else {
          context.specificKeyword = undefined;
        }
      } else {
        context.specificKeyword = undefined;
      }

      // Dispatch: use automationModule dispatcher for new engines, legacy for old ones
      let result: AutoTaskResult;
      if (automationModule) {
        console.log(`[SEO-CRON] Dispatching to executeAutomationModule("${autoType}")`);
        result = await executeAutomationModule(autoType, context, task.automationConfig);
      } else {
        result = await executeAutoTask(autoType, context);
      }

      updatedTasks[i] = { ...task, status: result.success ? 'done' : 'in_progress' };
      executionResults.push({
        taskId: task.id, taskTitle: task.title, autoType, executed: true,
        success: result.success, pagesAffected: result.pagesAffected, changesCount: result.changes.length,
        error: result.error,
      });

      if (result.success && plan.clientEmail) {
        try { await sendSeoTaskEmail(plan, task.title, result); } catch {}
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      executionResults.push({
        taskId: task.id, taskTitle: task.title, autoType, executed: true, success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const updatedDays = plan.days.map((d: any) => d.day === dayNumber ? { ...d, tasks: updatedTasks } : d);
  const automationLog = plan.automationLog || [];
  automationLog.push({
    date: new Date().toISOString(), dayNumber, results: executionResults,
    totalTasks: todayDay.tasks.length,
    executedTasks: executionResults.filter((r: any) => r.executed).length,
    successfulTasks: executionResults.filter((r: any) => r.success).length,
  });

  await updatePlanSafe(planId, { days: updatedDays, automationLog });
  logActivity(planId, 'cron_daily_execution', {
    dayNumber,
    executed: executionResults.filter((r: any) => r.executed).length,
    successful: executionResults.filter((r: any) => r.success).length,
  });

  if (plan.clientEmail) {
    try {
      const completedCount = updatedDays.reduce((sum: number, d: any) =>
        sum + (d.tasks?.filter((t: any) => t.status === 'done').length || 0), 0);
      const totalCount = updatedDays.reduce((sum: number, d: any) =>
        sum + (d.tasks?.length || 0), 0);
      await sendSeoDailySummaryEmail(plan, dayNumber, executionResults, completedCount, totalCount);
    } catch {}
  }

  return {
    planId, clientName: plan.clientName, success: true, dayNumber,
    tasksFound: todayDay.tasks.length,
    tasksExecuted: executionResults.filter((r: any) => r.executed).length,
    tasksSuccessful: executionResults.filter((r: any) => r.success).length,
  };
}
