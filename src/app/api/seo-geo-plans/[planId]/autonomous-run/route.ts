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
  mergeAllKeywords,
} from '@/lib/seo/api-helpers';
import { executeDaily, getPhaseForDay } from '@/lib/seo/autonomous-seo-orchestrator';
import type { WPConnection } from '@/lib/seo/wordpress-client';
import type { AutomationContext } from '@/lib/seo/seo-automator';

// ── Types ───────────────────────────────────────────────────────────────────

interface AutonomousRunRequest {
  day: number;
  dryRun?: boolean;
  enabledModules?: string[];
}

interface AutonomousRunRecord {
  id: string;
  day: number;
  phase: number;
  phaseName: string;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  actionsExecuted: number;
  actionsPendingApproval: number;
  actionsFailed: number;
  actionsSkipped: number;
  summary: string;
  nextDayFocus: string[];
  enabledModules?: string[];
}

// ── POST — Trigger daily autonomous execution ──────────────────────────────

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

  const { body, error: parseErr } = await parseBody<AutonomousRunRequest>(req);
  if (parseErr) return parseErr;
  if (!body) return err('Request body is required', 400);

  const { day, dryRun = false, enabledModules } = body;

  if (!day || typeof day !== 'number' || day < 1 || day > 60) {
    return err('day חייב להיות מספר בין 1 ל-60', 400);
  }

  // Extract WordPress connection from plan
  const wpConnection = (plan as any).wpConnection as WPConnection | undefined;
  if (!wpConnection) {
    return err('חיבור WordPress נדרש', 400);
  }

  try {
    // Build AutomationContext from plan data
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

    // Execute daily autonomous run
    const result = await executeDaily(planId, day, wpConnection, automationContext, {
      dryRun,
      ...(enabledModules ? { enabledModules } as any : {}),
    });

    // Build run record
    const phaseInfo = getPhaseForDay(day);
    const runRecord: AutonomousRunRecord = {
      id: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      day,
      phase: phaseInfo.phase,
      phaseName: phaseInfo.name,
      dryRun,
      startedAt: result.started,
      completedAt: result.completed,
      durationMs: result.durationMs,
      actionsExecuted: result.actionsExecuted,
      actionsPendingApproval: result.actionsPendingApproval,
      actionsFailed: result.actionsFailed,
      actionsSkipped: result.actionsSkipped,
      summary: result.summary,
      nextDayFocus: result.nextDayFocus,
      enabledModules,
    };

    // Append to plan.autonomousRuns
    const autonomousRuns: AutonomousRunRecord[] = Array.isArray((plan as any).autonomousRuns)
      ? [...(plan as any).autonomousRuns]
      : [];
    autonomousRuns.push(runRecord);

    const updated = await updatePlanSafe(planId, { autonomousRuns } as any);
    if (!updated) {
      return err('Failed to save autonomous run results', 500);
    }

    logActivity(planId, 'autonomous_run', {
      day,
      phase: phaseInfo.phase,
      dryRun,
      actionsExecuted: result.actionsExecuted,
      actionsFailed: result.actionsFailed,
    });

    return ok({
      success: true,
      run: runRecord,
      result: {
        actionsExecuted: result.actionsExecuted,
        actionsPendingApproval: result.actionsPendingApproval,
        actionsFailed: result.actionsFailed,
        actionsSkipped: result.actionsSkipped,
        summary: result.summary,
        nextDayFocus: result.nextDayFocus,
        phase: phaseInfo,
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    console.error('[SEO-API] POST /seo-geo-plans/[planId]/autonomous-run error:', error);
    return err('Failed to execute autonomous run', 500);
  }
}

// ── GET — Return autonomous run history ────────────────────────────────────

async function _GET(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);
  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  const autonomousRuns: AutonomousRunRecord[] = Array.isArray((plan as any).autonomousRuns)
    ? (plan as any).autonomousRuns
    : [];

  // Optional day filter
  const url = new URL(req.url);
  const dayFilter = url.searchParams.get('day');

  let runs = autonomousRuns;
  if (dayFilter) {
    const dayNum = parseInt(dayFilter, 10);
    runs = runs.filter(r => r.day === dayNum);
  }

  return ok({
    runs,
    total: runs.length,
    latestDay: runs.length > 0 ? Math.max(...runs.map(r => r.day)) : 0,
  });
}

export const POST = withErrorBoundary(_POST);
export const GET = withErrorBoundary(_GET);
