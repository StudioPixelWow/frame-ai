/**
 * POST /api/seo-geo-plans/run-now   { planId?: string }
 *
 * Manually triggers the SEO/GEO daily automation immediately — without waiting
 * for the cron. With a planId, runs just that plan (fast); without, runs all
 * active plans stalest-first within a time budget. Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runActivePlans } from '@/lib/seo/daily-plan-runner';
import { getRequestRole } from '@/lib/auth/api-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const role = getRequestRole(req);
  if (role === 'client') {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const planId = body?.planId as string | undefined;
    const result = await runActivePlans({ planId, timeBudgetMs: planId ? 280_000 : 240_000 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'הרצה נכשלה' }, { status: 500 });
  }
}
