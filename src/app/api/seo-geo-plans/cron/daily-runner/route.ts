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
  // Only enforce auth if CRON_SECRET is configured
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[SEO-CRON] Daily runner started at', new Date().toISOString());

  try {
    // Use filtered query — loading all 95+ plans causes statement timeout
    // Retry once on transient connection errors (e.g. Supabase 522)
    let activePlans: any[];
    try {
      activePlans = (await seoPlans.queryFilteredAsync([
        { column: 'data->>status', op: 'in', value: ['active', 'plan_generated'] },
      ])).filter((p: any) => p.days && Array.isArray(p.days) && p.days.length > 0);
    } catch (dbError: any) {
      const isTransient = dbError?.status === 522 || dbError?.code === 'ECONNRESET' || dbError?.code === 'ETIMEDOUT' || /522|connection|timeout/i.test(dbError?.message || '');
      if (isTransient) {
        console.warn('[SEO-CRON] DB query failed with transient error, retrying in 5s...', dbError?.message || dbError);
        await new Promise(r => setTimeout(r, 5000));
        try {
          activePlans = (await seoPlans.queryFilteredAsync([
            { column: 'data->>status', op: 'in', value: ['active', 'plan_generated'] },
          ])).filter((p: any) => p.days && Array.isArray(p.days) && p.days.length > 0);
          console.log('[SEO-CRON] Retry succeeded — loaded', activePlans.length, 'active plans');
        } catch (retryError: any) {
          console.error('[SEO-CRON] Retry also failed:', retryError?.message || retryError);
          return NextResponse.json({ error: 'DB connection failed after retry', details: retryError?.message }, { status: 503 });
        }
      } else {
        throw dbError;
      }
    }
    // NOTE: WordPress connection is now checked per-task, not per-plan.
    // Non-WP tasks (technical_seo, meta_optimization, etc.) run without WP.

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
  console.log(`[SEO-CRON] Processing plan ${planId} (${plan.clientName}) — status=${plan.status}, generatedAt=${plan.generatedAt || 'MISSING'}, wpConnected=${!!plan.wpConnection?.siteUrl}, totalDays=${plan.days?.length || 0}`);
  if (!generatedAt) {
    console.error(`[SEO-CRON] ❌ Plan ${planId} has no generatedAt — cannot calculate day number. Fix: set generatedAt on the plan.`);
    return { planId, clientName: plan.clientName, success: false, error: 'No generatedAt — set generatedAt timestamp on the plan' };
  }

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

  // ── Catch-up: process ALL days up to today that still have pending tasks ──
  // This handles missed cron runs (Vercel reliability, timeouts, etc.)
  const daysToProcess = plan.days
    .filter((d: any) => d.day <= dayNumber && d.tasks?.some((t: any) => t.status !== 'done'))
    .sort((a: any, b: any) => a.day - b.day);

  if (daysToProcess.length === 0) {
    return { planId, clientName: plan.clientName, success: true, dayNumber, tasksFound: 0 };
  }

  if (daysToProcess.length > 1) {
    console.log(`[SEO-CRON] ⚠️ Catch-up mode: processing ${daysToProcess.length} days with pending tasks (days: ${daysToProcess.map((d: any) => d.day).join(', ')})`);
  }

  // Process all pending days — aggregate results
  let allExecutionResults: any[] = [];
  let totalTasksFound = 0;
  const updatedDaysMap = new Map<number, any>();

  for (const todayDay of daysToProcess) {
    const processingDayNum = todayDay.day;
    console.log(`[SEO-CRON] Processing day ${processingDayNum}/${dayNumber} for plan ${planId}`);

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
        console.log(`[SEO-CRON] Task "${task.title}" has automationModule="${automationModule}" → autoType="${autoType}"`);
      } else {
        autoType = mapPlanTaskToAutoType(task.title);
      }

      if (!autoType) {
        executionResults.push({ taskId: task.id, taskTitle: task.title, autoType: null, executed: false, reason: 'Manual task' });
        continue;
      }

      const needsWp = WP_REQUIRED_MODULES.has(automationModule || '') || WP_REQUIRED_TYPES.has(autoType);
      if (needsWp && !hasWp) {
        console.log(`[SEO-CRON] Skipping "${task.title}" — requires WordPress connection`);
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

    // Store updated tasks for this day
    updatedDaysMap.set(processingDayNum, updatedTasks);
    allExecutionResults = allExecutionResults.concat(executionResults);
    totalTasksFound += todayDay.tasks.length;
  } // end of daysToProcess loop

  // Apply all updated days at once
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
      const completedCount = updatedDays.reduce((sum: number, d: any) =>
        sum + (d.tasks?.filter((t: any) => t.status === 'done').length || 0), 0);
      const totalCount = updatedDays.reduce((sum: number, d: any) =>
        sum + (d.tasks?.length || 0), 0);
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
