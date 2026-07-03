/**
 * Cron: Central Job Runner
 *
 * GET /api/cron/run-jobs
 *
 * THE single endpoint Vercel Cron calls. Checks all registered jobs,
 * runs any that are due, and returns combined results.
 *
 * Auth: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDueJobs, ensureJobsTable, syncRegistryToDb } from '@/lib/automation/central-job-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Auth check
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Ensure tables exist + registry synced on every run
    await ensureJobsTable();
    await syncRegistryToDb();

    const results = await runDueJobs();
    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error('[JOBS] run-jobs error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
