import { NextRequest, NextResponse } from 'next/server';
import {
  ok,
  err,
  loadPlan,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';

async function _GET(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);

  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  const pages = plan.scannedPages || [];

  return ok({
    pages,
    count: pages.length,
  });
}

export const GET = withErrorBoundary(_GET);
