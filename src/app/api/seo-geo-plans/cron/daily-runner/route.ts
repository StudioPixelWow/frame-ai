import { NextRequest, NextResponse } from 'next/server';
import { runActivePlans } from '@/lib/seo/daily-plan-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron Job יומי — רץ ב-08:00 ישראל (05:00 UTC)
 * Daily SEO automation cron. Delegates to the shared runner (stalest-first,
 * time-budgeted) so many active plans don't cause a mid-loop timeout that
 * leaves later plans unprocessed.
 */
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    const result = await runActivePlans({ timeBudgetMs: 240_000 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cron job failed', fatal: true }, { status: 500 });
  }
}
