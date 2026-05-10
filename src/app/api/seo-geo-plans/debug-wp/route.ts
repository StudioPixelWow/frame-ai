import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * DEBUG endpoint — returns wpConnection status for the most recent plan.
 * GET /api/seo-geo-plans/debug-wp
 * GET /api/seo-geo-plans/debug-wp?planId=xxx  (specific plan)
 *
 * DELETE THIS FILE after debugging is complete.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const planId = url.searchParams.get('planId');

    let plan: any;

    if (planId) {
      plan = await seoPlans.getByIdAsync(planId);
    } else {
      // Get all plans and find the most recent one
      const allPlans = await seoPlans.getAllAsync();
      if (allPlans.length === 0) {
        return NextResponse.json({ error: 'No plans found' }, { status: 404 });
      }
      // Sort by createdAt or updatedAt descending
      plan = allPlans.sort((a: any, b: any) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      })[0];
    }

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const wpConn = (plan as any).wpConnection;

    return NextResponse.json({
      planId: plan.id,
      clientName: plan.clientName,
      websiteUrl: plan.websiteUrl,
      status: plan.status,
      hasWpConnection: !!wpConn,
      wpConnection: wpConn ? {
        siteUrl: wpConn.siteUrl || '(missing)',
        username: wpConn.username || '(missing)',
        hasApplicationPassword: !!(wpConn.applicationPassword),
        applicationPasswordLength: wpConn.applicationPassword?.length || 0,
      } : null,
      hasDays: Array.isArray((plan as any).days) && (plan as any).days.length > 0,
      daysCount: Array.isArray((plan as any).days) ? (plan as any).days.length : 0,
      hasAiArticles: Array.isArray((plan as any).aiArticles) && (plan as any).aiArticles.length > 0,
      aiArticlesCount: Array.isArray((plan as any).aiArticles) ? (plan as any).aiArticles.length : 0,
      planTopLevelKeys: Object.keys(plan as any).sort(),
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to query',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}
