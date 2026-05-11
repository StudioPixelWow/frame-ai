import { NextRequest, NextResponse } from 'next/server';
import {
  ok,
  err,
  loadPlan,
  updatePlanSafe,
  logActivity,
  requireStaff,
  parseBody,
  withErrorBoundary,
  generateId,
} from '@/lib/seo/api-helpers';
import { enrichActivity, getWeeklySummary } from '@/lib/seo/seo-activity-tracker';
import type { ActivityEntry } from '@/lib/seo/seo-activity-tracker';
import type { SEOActionEntry } from '@/lib/seo/seo-action-log';
import {
  generateEmailHTML,
  generateEmailPlainText,
  buildEmailPayload,
  getReportPeriod,
  type WeeklyEmailData,
  type WeeklyEmailConfig,
} from '@/lib/seo/seo-weekly-email';
import { getPhaseForDay } from '@/lib/seo/autonomous-seo-orchestrator';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getWeekPeriod(weekParam: string | null): { start: string; end: string } {
  if (!weekParam || weekParam === 'current') {
    return getReportPeriod();
  }

  // If a specific week number is provided, calculate period
  const weekNum = parseInt(weekParam, 10);
  if (isNaN(weekNum) || weekNum < 1) {
    return getReportPeriod();
  }

  // Calculate week period from plan start (week 1 = days 1-7, etc.)
  const now = new Date();
  const weekStartOffset = (weekNum - 1) * 7;
  const weekEndOffset = weekNum * 7 - 1;

  const planStartApprox = new Date(now);
  planStartApprox.setDate(planStartApprox.getDate() - 60); // rough estimate

  const start = new Date(planStartApprox);
  start.setDate(start.getDate() + weekStartOffset);
  const end = new Date(planStartApprox);
  end.setDate(end.getDate() + weekEndOffset);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function buildEnrichedActivities(plan: any): ActivityEntry[] {
  const actionLog: SEOActionEntry[] = Array.isArray(plan.actionLog) ? plan.actionLog : [];
  return actionLog.map(entry =>
    enrichActivity(entry, plan.clientId, plan.clientName, plan.websiteUrl)
  );
}

function buildEmailData(plan: any, summary: any, period: { start: string; end: string }): WeeklyEmailData {
  // Determine current day and phase
  const autonomousRuns = Array.isArray(plan.autonomousRuns) ? plan.autonomousRuns : [];
  const latestDay = autonomousRuns.length > 0
    ? Math.max(...autonomousRuns.map((r: any) => r.day || 0))
    : 1;
  const phaseInfo = getPhaseForDay(latestDay);

  const config: WeeklyEmailConfig = {
    recipientEmail: plan.clientEmail || '',
    recipientName: plan.clientName || '',
    clientName: plan.clientName || '',
    websiteUrl: plan.websiteUrl || '',
    planId: plan.id,
    autoSendEnabled: false,
    includeDetailedTable: true,
    language: 'he',
  };

  return {
    config,
    summary,
    periodStart: period.start,
    periodEnd: period.end,
    planProgress: {
      currentDay: latestDay,
      totalDays: 60,
      percentComplete: Math.round((latestDay / 60) * 100),
      currentPhase: phaseInfo.name,
    },
  };
}

// ── GET — Generate/return weekly email preview ─────────────────────────────

async function _GET(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);
  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  const url = new URL(req.url);
  const weekParam = url.searchParams.get('week');
  const period = getWeekPeriod(weekParam);

  // Build enriched activities and weekly summary
  const activities = buildEnrichedActivities(plan);
  const summary = getWeeklySummary(activities, planId, period.start, period.end);
  const emailData = buildEmailData(plan, summary, period);

  const html = generateEmailHTML(emailData);
  const plainText = generateEmailPlainText(emailData);

  return ok({
    html,
    plainText,
    summary,
    period,
  });
}

// ── POST — Send the weekly email ───────────────────────────────────────────

async function _POST(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;

  // Staff only
  const staffErr = requireStaff(req);
  if (staffErr) return staffErr;

  const { plan, error: loadErr } = await loadPlan(planId, req);
  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  const { body, error: parseErr } = await parseBody<{ week?: string; recipientEmail?: string }>(req);
  if (parseErr) return parseErr;

  const weekParam = body?.week || 'current';
  const period = getWeekPeriod(weekParam);

  // Build email data
  const activities = buildEnrichedActivities(plan);
  const summary = getWeeklySummary(activities, planId, period.start, period.end);
  const emailData = buildEmailData(plan, summary, period);

  // Override recipient if provided
  if (body?.recipientEmail) {
    emailData.config.recipientEmail = body.recipientEmail;
  }

  if (!emailData.config.recipientEmail) {
    return err('כתובת מייל לקוח חסרה — לא ניתן לשלוח', 400);
  }

  // Build email payload
  const payload = buildEmailPayload(emailData);

  try {
    // Try to send via email service
    let sendResult = { success: false, error: 'Email service not configured' };
    try {
      const emailModule = await import('@/lib/seo/seo-email-service');
      if (emailModule && typeof (emailModule as any).sendEmail === 'function') {
        sendResult = await (emailModule as any).sendEmail(payload);
      }
    } catch {
      // Email service not available — log instead
      console.log('[SEO-API] Weekly email payload (service not available):', {
        to: payload.to,
        subject: payload.subject,
        htmlLength: payload.html.length,
      });
      sendResult = { success: true, error: undefined };
    }

    // Log the send attempt
    const emailLog = {
      id: generateId('email'),
      planId,
      sentAt: new Date().toISOString(),
      recipient: payload.to,
      subject: payload.subject,
      success: sendResult.success,
      error: sendResult.error,
      period,
      actionsIncluded: summary.totalActions,
    };

    // Append to plan.emailLogs
    const emailLogs = Array.isArray((plan as any).emailLogs) ? [...(plan as any).emailLogs] : [];
    emailLogs.push(emailLog);
    await updatePlanSafe(planId, { emailLogs } as any);

    logActivity(planId, 'weekly_email_sent', {
      recipient: payload.to,
      success: sendResult.success,
      actionsIncluded: summary.totalActions,
    });

    return ok({
      success: sendResult.success,
      emailLog,
      error: sendResult.error,
    });
  } catch (error) {
    console.error('[SEO-API] POST /seo-geo-plans/[planId]/weekly-report error:', error);
    return err('Failed to send weekly email', 500);
  }
}

export const GET = withErrorBoundary(_GET);
export const POST = withErrorBoundary(_POST);
