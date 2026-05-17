import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/daily-seo/test
 * Diagnostic endpoint — shows what the cron WOULD see without executing anything.
 * Use to debug why cron didn't fire or didn't process plans.
 */
export async function GET(req: NextRequest) {
  const now = new Date();

  // Check env vars
  const envCheck = {
    CRON_SECRET: process.env.CRON_SECRET ? 'SET' : 'NOT SET',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
    VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'unknown',
    computedBaseUrl: process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  };

  // Check plans
  let planDiagnostics: any[] = [];
  try {
    const allPlans = await seoPlans.getAllAsync();
    planDiagnostics = allPlans.map((p: any) => {
      const generatedAt = p.generatedAt ? new Date(p.generatedAt) : null;
      const dayNumber = generatedAt
        ? Math.floor((now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : null;

      const todayDay = dayNumber && p.days ? p.days.find((d: any) => d.day === dayNumber) : null;

      return {
        planId: p.id,
        clientName: p.clientName,
        status: p.status,
        hasWpConnection: !!p.wpConnection?.siteUrl,
        wpSiteUrl: p.wpConnection?.siteUrl || null,
        hasDays: Array.isArray(p.days) && p.days.length > 0,
        daysCount: Array.isArray(p.days) ? p.days.length : 0,
        generatedAt: p.generatedAt || null,
        dayNumber,
        dayNumberValid: dayNumber !== null && dayNumber >= 1 && dayNumber <= 60,
        todayHasTasks: !!todayDay?.tasks?.length,
        todayTaskCount: todayDay?.tasks?.length || 0,
        todayTaskTitles: (todayDay?.tasks || []).map((t: any) => t.title),
        wouldBeProcessed:
          (p.status === 'active' || p.status === 'plan_generated') &&
          !!p.wpConnection?.siteUrl &&
          Array.isArray(p.days) && p.days.length > 0,
        reasonSkipped: (() => {
          const reasons: string[] = [];
          if (p.status !== 'active' && p.status !== 'plan_generated') reasons.push(`status="${p.status}" (need active/plan_generated)`);
          if (!p.wpConnection?.siteUrl) reasons.push('no wpConnection.siteUrl');
          if (!Array.isArray(p.days) || p.days.length === 0) reasons.push('days array empty/missing');
          if (dayNumber !== null && (dayNumber < 1 || dayNumber > 60)) reasons.push(`dayNumber=${dayNumber} (outside 1-60)`);
          if (!todayDay?.tasks?.length) reasons.push(`no tasks for day ${dayNumber}`);
          return reasons.length > 0 ? reasons : ['none — would be processed'];
        })(),
      };
    });
  } catch (err) {
    planDiagnostics = [{ error: err instanceof Error ? err.message : 'Failed to load plans' }];
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    timestampIsrael: now.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
    env: envCheck,
    totalPlans: planDiagnostics.length,
    plansWouldProcess: planDiagnostics.filter((p: any) => p.wouldBeProcessed).length,
    plans: planDiagnostics,
  });
}
