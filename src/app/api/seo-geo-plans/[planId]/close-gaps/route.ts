/**
 * POST /api/seo-geo-plans/[planId]/close-gaps
 *
 * סגירת פערים — מעבד יום אחד בכל קריאה.
 * הפרונט קורא שוב ושוב עד done: true.
 *
 * Response shapes:
 *   { done: false, dayProcessed: N, remainingDays: X, completedDays: Y, totalGapDays: Z }
 *   { done: true,  totalDaysProcessed: N }
 *   { noGaps: true, message: "..." }            — nothing to do
 *   409 — another close-gaps run is already active
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { executeAutoTask, executeAutomationModule, mapPlanTaskToAutoType, AutomationContext, AutoTaskResult, AutoTaskType } from '@/lib/seo/seo-automator';
import { updatePlanSafe, logActivity, mergeAllKeywords } from '@/lib/seo/api-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── Timeout wrapper ──────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} took more than ${ms / 1000}s`)), ms)
    ),
  ]);
}

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

    // ── Re-entry guard ────────────────────────────────────────────
    const gc = (plan as any).gapClosing;
    if (gc?.active && gc?.startedAt) {
      const activeMinutes = (Date.now() - new Date(gc.startedAt).getTime()) / 60000;
      if (activeMinutes < 10) {
        // Another request is still processing — reject
        return NextResponse.json(
          { error: 'סגירת פערים כבר פעילה — נסה שוב בעוד מספר דקות', retryAfterMs: 10_000 },
          { status: 409 }
        );
      }
      // Stuck for >10 minutes — auto-reset and continue
      console.log(`[CLOSE-GAPS] Auto-resetting stuck gapClosing (${Math.round(activeMinutes)} minutes)`);
      await updatePlanSafe(planId, {
        gapClosing: { ...gc, active: false, completedAt: new Date().toISOString(), error: 'Timeout — auto-reset after 10 minutes' },
      } as any);
    }

    // ── Compute today's day number ───────────────────────────────
    const generatedAt = new Date(plan.generatedAt);
    const now = new Date();
    const todayDayNumber = Math.min(
      Math.floor((now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      60
    );

    if (todayDayNumber < 1) {
      return NextResponse.json({ error: 'התוכנית עדיין לא התחילה' }, { status: 400 });
    }

    // ── Find all gap days ────────────────────────────────────────
    const allGapDays = (plan.days as any[]).filter((d: any) => {
      if (d.day > todayDayNumber) return false;
      if (!d.tasks || d.tasks.length === 0) return false;
      return d.tasks.some((t: any) => t.status !== 'done');
    });

    if (allGapDays.length === 0) {
      // All caught up — clear gapClosing state if it was lingering
      if (gc?.active || gc?.completedAt) {
        await updatePlanSafe(planId, {
          gapClosing: {
            active: false,
            completedAt: new Date().toISOString(),
            totalDays: gc?.totalDays || 0,
            completedDays: gc?.totalDays || 0,
            currentDay: null,
          },
        } as any);
      }
      return NextResponse.json({
        done: true,
        noGaps: true,
        totalDaysProcessed: gc?.completedDays || 0,
        message: 'אין פערים — כל המשימות עד היום בוצעו',
      });
    }

    // ── Pick the FIRST incomplete day ────────────────────────────
    const gapDay = allGapDays[0];
    const totalGapDays = allGapDays.length;

    // Track cumulative progress across calls
    const previouslyCompleted = gc?.completedDays || 0;
    // totalDays = the total we set at the start of this batch, or the current total if first call
    const batchTotal = gc?.totalDays && gc.totalDays >= totalGapDays
      ? gc.totalDays
      : totalGapDays + previouslyCompleted;

    // ── Mark as active ───────────────────────────────────────────
    const startedAt = gc?.startedAt && previouslyCompleted > 0
      ? gc.startedAt  // preserve original start time across calls
      : new Date().toISOString();

    await updatePlanSafe(planId, {
      gapClosing: {
        active: true,
        startedAt,
        totalDays: batchTotal,
        completedDays: previouslyCompleted,
        currentDay: gapDay.day,
      },
    } as any);

    // ── Build automation context ─────────────────────────────────
    const hasWp = !!(plan.wpConnection?.siteUrl);
    const WP_REQUIRED_MODULES = new Set([
      'internal_linking', 'faq_schema', 'meta_optimization', 'content_refresh',
      'image_seo', 'cta_optimization', 'cannibalization', 'humanization',
    ]);
    const WP_REQUIRED_TYPES = new Set([
      'auto_internal_linking', 'auto_faq_schema', 'auto_meta_optimization',
    ]);

    const facts = plan.websiteScan?.websiteFacts || {};
    const profile = plan.businessProfile || {};
    const context: AutomationContext = {
      connection: plan.wpConnection || { siteUrl: '', username: '', applicationPassword: '' },
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

    // ── Process the single day ───────────────────────────────────
    try {
      const dayResult = await processSingleDay(planId, plan, gapDay, context, hasWp, WP_REQUIRED_MODULES, WP_REQUIRED_TYPES);

      const newCompletedDays = previouslyCompleted + 1;
      const remainingDays = totalGapDays - 1; // we just processed one

      // Save progress — mark as inactive so next call can re-enter
      await updatePlanSafe(planId, {
        gapClosing: {
          active: false,
          startedAt,
          totalDays: batchTotal,
          completedDays: newCompletedDays,
          currentDay: gapDay.day,
          ...(remainingDays === 0 ? { completedAt: new Date().toISOString() } : {}),
        },
      } as any);

      if (remainingDays === 0) {
        // All done
        logActivity(planId, 'close_gaps_completed', {
          totalDays: batchTotal,
          completedDays: newCompletedDays,
        });

        return NextResponse.json({
          done: true,
          totalDaysProcessed: newCompletedDays,
          lastDay: gapDay.day,
          dayResult,
        });
      }

      return NextResponse.json({
        done: false,
        dayProcessed: gapDay.day,
        remainingDays,
        completedDays: newCompletedDays,
        totalGapDays: batchTotal,
        dayResult,
      });

    } catch (err) {
      console.error(`[CLOSE-GAPS] Error processing day ${gapDay.day}:`, err);

      // Reset gapClosing so the next call can retry
      await updatePlanSafe(planId, {
        gapClosing: {
          active: false,
          startedAt,
          totalDays: batchTotal,
          completedDays: previouslyCompleted,
          currentDay: gapDay.day,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      } as any).catch((resetErr) => {
        console.error(`[CLOSE-GAPS] Failed to reset gapClosing state:`, resetErr);
      });

      return NextResponse.json(
        { error: `סגירת פערים נכשלה ביום ${gapDay.day}: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `שגיאה: ${message}` }, { status: 500 });
  }
}


// ── Process a single gap day ─────────────────────────────────────

async function processSingleDay(
  planId: string,
  plan: any,
  gapDay: any,
  context: AutomationContext,
  hasWp: boolean,
  WP_REQUIRED_MODULES: Set<string>,
  WP_REQUIRED_TYPES: Set<string>,
): Promise<{ day: number; tasksProcessed: number; successful: number }> {
  const dayNumber = gapDay.day;
  console.log(`[CLOSE-GAPS] Plan ${planId} — processing day ${dayNumber}`);

  const latestDays = [...plan.days];
  const dayIdx = latestDays.findIndex((d: any) => d.day === dayNumber);
  if (dayIdx === -1) {
    return { day: dayNumber, tasksProcessed: 0, successful: 0 };
  }

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
      const TASK_TIMEOUT_MS = 45_000; // 45s per task — keeps total day under 5 min
      if (automationModule) {
        result = await withTimeout(
          executeAutomationModule(autoType, context, task.automationConfig),
          TASK_TIMEOUT_MS,
          `${automationModule} (day ${dayNumber})`
        );
      } else {
        result = await withTimeout(
          executeAutoTask(autoType, context),
          TASK_TIMEOUT_MS,
          `${autoType} (day ${dayNumber})`
        );
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

  // Update day tasks in DB
  latestDays[dayIdx] = { ...dayData, tasks: updatedTasks };

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
  } as any);

  logActivity(planId, 'close_gaps_day', {
    dayNumber,
    executed: dayResults.filter((r: any) => r.executed).length,
    successful: dayResults.filter((r: any) => r.success).length,
  });

  const successful = dayResults.filter((r: any) => r.success).length;
  console.log(`[CLOSE-GAPS] Plan ${planId} — day ${dayNumber} done: ${successful}/${dayResults.length} tasks succeeded`);

  return { day: dayNumber, tasksProcessed: dayResults.length, successful };
}
