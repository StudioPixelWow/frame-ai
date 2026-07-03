/**
 * Admin: List All Scheduled Jobs
 *
 * GET /api/admin/jobs
 *
 * Returns all scheduled jobs with their latest run info.
 * Auth: admin role only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

function isAdmin(req: NextRequest): boolean {
  const role = req.headers.get('x-app-role');
  return role === 'admin';
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const supabase = getSupabase();

    // Fetch all jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .order('created_at', { ascending: true });

    if (jobsError) {
      console.error('[ADMIN/JOBS] Failed to fetch jobs:', jobsError.message);
      return NextResponse.json({ error: jobsError.message }, { status: 500 });
    }

    // Fetch latest run for each job
    const jobsWithLatestRun = await Promise.all(
      (jobs ?? []).map(async (job) => {
        const jobData = job.data ?? {};
        const jobId = jobData.jobId ?? job.id;

        const { data: latestRuns } = await supabase
          .from('job_runs')
          .select('*')
          .eq('data->>jobId', jobId)
          .order('created_at', { ascending: false })
          .limit(1);

        const latestRun = latestRuns?.[0] ?? null;

        return {
          id: job.id,
          ...jobData,
          latestRun: latestRun ? { id: latestRun.id, ...latestRun.data, created_at: latestRun.created_at } : null,
          created_at: job.created_at,
        };
      })
    );

    return NextResponse.json({ jobs: jobsWithLatestRun });
  } catch (error: any) {
    console.error('[ADMIN/JOBS] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
