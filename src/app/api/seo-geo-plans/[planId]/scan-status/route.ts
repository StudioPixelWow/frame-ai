import { NextRequest, NextResponse } from 'next/server';
import {
  ok,
  err,
  loadPlan,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';

async function GET(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);

  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  const statusResponse = {
    status: plan.status,
    hasScan: !!plan.websiteScan,
    scannedAt: plan.websiteScan?.scannedAt || null,
    totalPages: plan.websiteScan?.totalPages || 0,
    issues: plan.websiteScan?.issues?.length || 0,
  };

  return ok(statusResponse);
}

export const GET = withErrorBoundary(GET);
