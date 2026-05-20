/**
 * POST /api/seo-geo-plans/[planId]/close-gaps
 *
 * סגירת פערים — מריץ את כל הימים שפוספסו מיום 1 עד היום.
 * מחזיר 202 ומריץ ברקע. הפרונט יכול לפולל את הסטטוס מה-plan.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { executeAutoTask, executeAutomationModule, mapPlanTaskToAutoType, AutomationContext, AutoTaskResult, AutoTaskType } from '@/lib/seo/seo-automator';
import { updatePlanSafe, logActivity, mergeAllKeywords } from '@/lib/seo/api-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;

  try {
    const plan = await seoPlans.getByIdAsync(planId);
    if (!plan) {
      return NextResponse.json({ error: 'תוכנית לא נמצאה' }, { status: 404 });
    }

    if (!plan.generatedAt || !plan.days || !Array.isArray(plan.days) || plan.days.length === 0) {
      return NextResponse.json({ error: 'תוכנית ללא ימים או ללא תאריך התחלה' }, { status: 400 });
    }

    const generatedAt = new Date(plan.generatedAt);
    const now = new Date();
    const todayDayNumber = Math.min(
      Math.floor((now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      60
    );

    if (todayDayNumber < 1) {
      return NextResponse.json({ error: 'התוכנית עדיין לא התחילה' }, { status: 400 });
    }

    // Find days with pending tasks (not done) from day 1 to today
    const gapDays = (plan.days as any[]).filter((d: any) => {
      if (d.day > todayDayNumber) return false;
      if (!d.tasks || d.tasks.length === 0) return false;
      return d.tasks.some((t: any) => t.status !== 'done');
    });

    if (gapDays.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'אין פערים — כל המשימות עד היום בוצעו',
        gapDaysCount: 0,
      });
    }

    // Mark plan as gap-closing
    await updatePlanSafe(planId, {
      gapClosing: {
        active: true,
        startedAt: new Date().toISOString(),
        totalDays: gapDays.length,
        completedDays: 0,
        currentDay: gapDays[0].day,
      },
    } as any);

    // Fire-and-forget
    void runGapCloser(planId, plan, gapDays, todayDayNumber);

    return NextResponse.json(
      {
        success: true,
        message: `סגירת פערים התחילה — ${gapDays.length} ימים עם משימות ממתינות`,
        gapDaysCount: gapDays.length,
        dayNumbers: gapDays.map((d: any) => d.day),
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `שגיאה: ${message}` }, { status: 500 });
  }
}

// ── Background gap closer ─────────────────────────────────────────

async function runGapCloser(
  planId: string,
  plan: any,
  gapDays: any[],
  todayDayNumber: number
): Promise<void> {
  const hasWp = !!(plan.wpConnection?.siteUrl);
  const WP_REQUIRED_MODULES = new Set([
    'internal_linking', 'faq_schema', 'meta_optimization', 'content_refresh',
    'image_seo', 'cta_optimization', 'cannibalization', 'humanization',
  ]);
  const WP_REQUIRED_TYPES = new Set([
    'auto_internal_linking', 'auto_faq_schema', 'auto_meta_optimization',
  ]);
  // NOTE: daily_seo_article removed — articles can be generated without WP (just won't publish)

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

  let latestDays = [...plan.days];
  let completedDaysCount = 0;
  const allResults: any[] = [];

  for (const gapDay of gapDays) {
    const dayNumber = gapDay.day;
    console.log(`[CLOSE-GAPS] Plan ${planId} — processing day ${dayNumber}`);

    // Update progress
    await updatePlanSafe(planId, {
      gapClosing: {
        active: true,
        startedAt: plan.gapClosing?.startedAt || new Date().toISOString(),
        totalDays: gapDays.length,
        completedDays: completedDaysCount,
        currentDay: dayNumber,
      },
    } as any);

    // Find the day in our latest copy
    const dayIdx = latestDays.findIndex((d: any) => d.day === dayNumber);
    if (dayIdx === -1) continue;

    const dayData = latestDays[dayIdx];
    const updatedTasks = [...(dayData.tasks || [])];
    const dayResults: any[] = [];

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
        // Mark unrecognized tasks as done when explicitly closing gaps —
        // the user requested to catch up, so mark non-automatable tasks as completed
        updatedTasks[i] = {
          ...task,
          status: 'done',
          completedAt: new Date().toISOString(),
          executionResult: '✅ סומן כבוצע (משימה ידנית — סגירת פערים)',
        };
        dayResults.push({ taskId: task.id, taskTitle: task.title, executed: true, success: true, reason: 'Marked done (manual task)' });
        continue;
      }

      const needsWp = WP_REQUIRED_MODULES.has(automationModule || '') || WP_REQUIRED_TYPES.has(autoType);
      if (needsWp && !hasWp) {
        // Still mark as done when closing gaps — can't automate but user wants to catch up
        updatedTasks[i] = {
          ...task,
          status: 'done',
          completedAt: new Date().toISOString(),
          executionResult: '⚠️ סומן כבוצע (דורש WordPress — סגירת פערים)',
        };
        dayResults.push({ taskId: task.id, taskTitle: task.title, executed: true, success: true, reason: 'Marked done (requires WP)' });
        continue;
      }

      try {
        // Extract keyword for article tasks
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

        dayResults.push({
          taskId: task.id, taskTitle: task.title, autoType, executed: true,
          success: result.success, changesCount: result.changes.length,
        });

        // Brief delay between tasks
        await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        updatedTasks[i] = {
          ...task,
          status: 'failed',
          executionResult: `❌ ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
        dayResults.push({
          taskId: task.id, taskTitle: task.title, autoType, executed: true,
          success: false, error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update day tasks
    latestDays[dayIdx] = { ...dayData, tasks: updatedTasks };
    completedDaysCount++;
    allResults.push({ day: dayNumber, results: dayResults });

    // Save after each day
    const automationLog = plan.automationLog || [];
    automationLog.push({
      date: new Date().toISOString(),
      dayNumber,
      source: 'close-gaps',
      results: dayResults,
      totalTasks: dayData.tasks.length,
      executedTasks: dayResults.filter((r: any) => r.executed).length,
      successfulTasks: dayResults.filter((r: any) => r.success).length,
    });

    await updatePlanSafe(planId, {
      days: latestDays,
      automationLog,
      gapClosing: {
        active: true,
        startedAt: plan.gapClosing?.startedAt || new Date().toISOString(),
        totalDays: gapDays.length,
        completedDays: completedDaysCount,
        currentDay: dayNumber,
      },
    } as any);

    logActivity(planId, 'close_gaps_day', {
      dayNumber,
      executed: dayResults.filter((r: any) => r.executed).length,
      successful: dayResults.filter((r: any) => r.success).length,
    });

    // Delay between days
    await new Promise(r => setTimeout(r, 3000));
  }

  // Mark gap closing as complete
  await updatePlanSafe(planId, {
    gapClosing: {
      active: false,
      startedAt: plan.gapClosing?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalDays: gapDays.length,
      completedDays: completedDaysCount,
      currentDay: null,
    },
  } as any);

  logActivity(planId, 'close_gaps_completed', {
    totalDays: gapDays.length,
    completedDays: completedDaysCount,
  });

  console.log(`[CLOSE-GAPS] Plan ${planId} — completed. ${completedDaysCount}/${gapDays.length} days processed.`);
}
