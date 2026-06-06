/**
 * POST /api/seo-geo-plans/geo-scan   { planId }
 *
 * Manually runs a GEO/AI-visibility scan for one plan immediately — queries the
 * connected AI platforms for the plan's keywords, detects brand citation, and
 * persists the real GEO score. Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { getRequestRole } from '@/lib/auth/api-guard';
import { processDailySnapshot } from '@/app/api/seo-geo-plans/cron/daily-progress-scan/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  }
  try {
    const { planId } = await req.json().catch(() => ({}));
    if (!planId) return NextResponse.json({ error: 'planId נדרש' }, { status: 400 });
    const plan = await seoPlans.getByIdAsync(planId);
    if (!plan) return NextResponse.json({ error: 'התוכנית לא נמצאה' }, { status: 404 });
    const result = await processDailySnapshot(plan);
    return NextResponse.json({ success: true, result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'הסריקה נכשלה' }, { status: 500 });
  }
}
