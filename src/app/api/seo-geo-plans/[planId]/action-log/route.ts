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
import type { SEOActionEntry, SEOActionType, ActionStatus } from '@/lib/seo/seo-action-log';

// ── GET — Return action log with filters ───────────────────────────────────

async function _GET(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);
  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get('type');
  const statusFilter = url.searchParams.get('status');
  const moduleFilter = url.searchParams.get('module');
  const impactFilter = url.searchParams.get('impact');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const dayFilter = url.searchParams.get('day');
  const phaseFilter = url.searchParams.get('phase');
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  // Read action log from plan
  let actions: SEOActionEntry[] = Array.isArray((plan as any).actionLog)
    ? (plan as any).actionLog
    : [];

  const total = actions.length;

  // Apply filters
  if (typeFilter) {
    actions = actions.filter(a => a.actionType === typeFilter);
  }
  if (statusFilter) {
    actions = actions.filter(a => a.status === statusFilter);
  }
  if (moduleFilter) {
    actions = actions.filter(a => a.module.toLowerCase().includes(moduleFilter.toLowerCase()));
  }
  if (impactFilter) {
    actions = actions.filter(a => a.expectedImpact === impactFilter);
  }
  if (dateFrom) {
    actions = actions.filter(a => a.date >= dateFrom);
  }
  if (dateTo) {
    actions = actions.filter(a => a.date <= dateTo);
  }
  if (dayFilter) {
    const dayNum = parseInt(dayFilter, 10);
    actions = actions.filter(a => a.day === dayNum);
  }
  if (phaseFilter) {
    const phaseNum = parseInt(phaseFilter, 10);
    actions = actions.filter(a => a.phase === phaseNum);
  }

  const filtered = actions.length;

  // Apply pagination
  const paginated = actions.slice(offset, offset + limit);

  return ok({
    actions: paginated,
    total,
    filtered,
  });
}

// ── POST — Manually log an action (admin only) ────────────────────────────

interface ManualLogRequest {
  actionType: SEOActionType;
  module: string;
  description: string;
  pageUrl?: string;
  pageTitle?: string;
  pageId?: number;
  seoReason: string;
  expectedImpact: 'critical' | 'high' | 'medium' | 'low';
  status?: ActionStatus;
  day?: number;
  phase?: number;
}

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

  const { body, error: parseErr } = await parseBody<ManualLogRequest>(req);
  if (parseErr) return parseErr;
  if (!body) return err('Request body is required', 400);

  const { actionType, module, description, pageUrl, pageTitle, pageId, seoReason, expectedImpact, status, day, phase } = body;

  if (!actionType || !module || !description || !seoReason || !expectedImpact) {
    return err('Missing required fields: actionType, module, description, seoReason, expectedImpact', 400);
  }

  // Create new action entry
  const entry: SEOActionEntry = {
    id: generateId('action'),
    planId,
    date: new Date().toISOString(),
    actionType,
    module,
    description,
    pageUrl,
    pageTitle,
    pageId,
    seoReason,
    expectedImpact,
    status: status || 'completed',
    isReversible: false,
    day,
    phase,
  };

  // Append to plan.actionLog
  const actionLog: SEOActionEntry[] = Array.isArray((plan as any).actionLog)
    ? [...(plan as any).actionLog]
    : [];
  actionLog.push(entry);

  const updated = await updatePlanSafe(planId, { actionLog } as any);
  if (!updated) {
    return err('Failed to save action log entry', 500);
  }

  logActivity(planId, 'manual_action_logged', {
    actionId: entry.id,
    actionType,
    module,
  });

  return ok(entry, 201);
}

export const GET = withErrorBoundary(_GET);
export const POST = withErrorBoundary(_POST);
