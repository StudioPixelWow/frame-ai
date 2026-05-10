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
  wpConnection?: WPConnection;
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

  const { taskId, taskTitle, taskType: providedTaskType, wpConnection: bodyWpConnection } = body;

  // Validate required fields
  if (!taskId || !taskTitle) {
    return err('Missing required fields: taskId, taskTitle', 400);
  }

  try {
    // Check if WordPress is connected — try plan first, then request body, then client record
    let wpConnection = (plan as any).wpConnection as WPConnection | undefined;
    console.log(`[EXECUTE-TASK] planId=${planId}, taskTitle="${taskTitle}", wpConnection from plan=${wpConnection ? 'YES' : 'NO'}, from body=${bodyWpConnection ? 'YES' : 'NO'}`);

    // Fallback 1: Use wpConnection from request body (sent by frontend)
    if (!wpConnection && bodyWpConnection?.siteUrl && bodyWpConnection?.username && bodyWpConnection?.applicationPassword) {
      wpConnection = bodyWpConnection;
      console.log(`[EXECUTE-TASK] Using wpConnection from request body`);
      // Save back to plan for next time
      await updatePlanSafe(planId, { wpConnection: wpConnection as any });
    }

    if (!wpConnection && plan.clientId) {
      // Fallback: load WP credentials from client record
      try {
        const { getClientById } = await import('@/lib/db/client-helpers');
        const client = await getClientById(plan.clientId);
        if (client && (client as any).wpSiteUrl && (client as any).wpUsername && (client as any).wpApplicationPassword) {
          wpConnection = {
            siteUrl: (client as any).wpSiteUrl,
            username: (client as any).wpUsername,
            applicationPassword: (client as any).wpApplicationPassword,
          };
          console.log(`[EXECUTE-TASK] Loaded wpConnection from client record (fallback)`);
          // Save back to plan for next time
          await updatePlanSafe(planId, { wpConnection: wpConnection as any });
        }
      } catch (e) {
        console.warn(`[EXECUTE-TASK] Failed to load wpConnection from client:`, e);
      }
    }

    if (!wpConnection) {
      console.error(`[EXECUTE-TASK] No wpConnection found. Plan keys: ${Object.keys(plan as any).join(', ')}`);
      return err('WordPress לא מחובר — חבר את WordPress מחדש בדף התוכנית', 400);
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

    // Extract specific keyword from task title if it's a daily article task
    // Task titles look like: פרסום מאמר SEO יומי — "keyword" (08:00)
    let specificKeyword: string | undefined;
    if (autoTaskType === 'daily_seo_article') {
      const kwMatch = taskTitle.match(/—\s*[""״]([^""״]+)[""״]/);
      if (kwMatch?.[1]) {
        specificKeyword = kwMatch[1].trim();
        console.log(`[EXECUTE-TASK] Extracted specific keyword from title: "${specificKeyword}"`);
      }
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
      specificKeyword,
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

    // For article tasks: verify the article was actually saved to aiArticles
    if (autoTaskType === 'daily_seo_article' && result.success) {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: freshPlan } = await supabase.from('app_seo_plans').select('data').eq('id', planId).single();
        const freshArticles: any[] = Array.isArray(freshPlan?.data?.aiArticles) ? freshPlan.data.aiArticles : [];
        const savedArticle = freshArticles.find((a: any) => a?.status === 'written' && a?.wpPostUrl);
        if (savedArticle) {
          console.log(`[EXECUTE-TASK] ✅ Article verified in aiArticles: "${savedArticle.title}" → ${savedArticle.wpPostUrl}`);
        } else {
          console.warn(`[EXECUTE-TASK] ⚠️ Article task succeeded but no written article found in aiArticles! Saving fallback...`);
          // Fallback: save article from result changes if available
          const articleChange = result.changes.find((c: any) => c.field === 'מאמר SEO יומי');
          if (articleChange) {
            freshArticles.push({
              id: `daily-article-fallback-${Date.now()}`,
              title: articleChange.pageTitle || taskTitle,
              targetKeyword: specificKeyword || '',
              wordCount: 0,
              status: 'written',
              type: 'daily_seo_article',
              fullArticle: `<p>${articleChange.newValue}</p>`,
              wpPostUrl: articleChange.pageUrl || '',
              wpPostId: articleChange.pageId || 0,
              generatedAt: new Date().toISOString(),
            });
            await updatePlanSafe(planId, { aiArticles: freshArticles } as any);
            console.log(`[EXECUTE-TASK] Fallback article saved to aiArticles`);
          }
        }
      } catch (verifyErr) {
        console.warn(`[EXECUTE-TASK] Article verification failed:`, verifyErr);
      }
    }

    // Update task status to "done" in the plan — tasks are inside days[].tasks[]
    if (result.success) {
      const days = (plan as any).days || [];
      let taskFound = false;
      for (const day of days) {
        if (!Array.isArray(day.tasks)) continue;
        const taskIndex = day.tasks.findIndex((t: any) => t.id === taskId);
        if (taskIndex >= 0) {
          day.tasks[taskIndex] = {
            ...day.tasks[taskIndex],
            status: 'done',
            completedAt: new Date().toISOString(),
          };
          taskFound = true;
          console.log(`[EXECUTE-TASK] ✅ Marked task "${taskTitle}" as done (day ${day.day})`);
          break;
        }
      }
      if (taskFound) {
        await updatePlanSafe(planId, { days } as any);
      } else {
        console.warn(`[EXECUTE-TASK] Task "${taskTitle}" (id=${taskId}) not found in any day — status not updated`);
      }
    } else {
      console.warn(`[EXECUTE-TASK] Task "${taskTitle}" failed — NOT marking as done. Error: ${result.error}`);
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
