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
} from '@/lib/seo/api-helpers';

// Allowed fields for PATCH update
const ALLOWED_UPDATE_FIELDS = [
  'clientName',
  'websiteUrl',
  'status',
  'goals',
  'visibilityQueries',
  'visibilityResults',
  'insights',
  'weeks',
  'overallScore',
  'technicalScore',
  'contentScore',
  'visibilityScore',
  'completedTasks',
  'totalTasks',
  'generatedAt',
  'websiteScan',
  'scannedPages',
  'contentGaps',
  'competitors',
  'reports',
  'activityLog',
];

async function GET(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);

  if (error) return error;
  if (!plan) return err('Plan not found', 404);

  return ok(plan);
}

async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);

  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  const { body, error: parseErr } = await parseBody<Record<string, unknown>>(req);
  if (parseErr) return parseErr;

  // Filter update data to only allowed fields
  const updateData: Partial<SeoPlan> = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in (body || {})) {
      updateData[field as keyof SeoPlan] = body![field] as any;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return err('No valid fields to update', 400);
  }

  try {
    const updated = await updatePlanSafe(planId, updateData);
    if (!updated) {
      return err('Failed to update plan', 500);
    }
    logActivity(planId, 'update', { fields: Object.keys(updateData) });
    return ok(updated);
  } catch (error) {
    console.error('[SEO-API] PATCH /seo-geo-plans/[planId] error:', error);
    return err('Failed to update plan', 500);
  }
}

export const GET = withErrorBoundary(GET);
export const PATCH = withErrorBoundary(PATCH);
