/**
 * Admin: Job Run History
 *
 * GET /api/admin/jobs/[jobId]/runs?limit=50&offset=0
 *
 * Returns paginated run history for a job.
 * Auth: admin role only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

function isAdmin(req: NextRequest): boolean {
  const role = req.headers.get('x-app-role');
  return role === 'admin';
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { jobId } = await context.params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase = getSupabase();

    const { data: runs, error, count } = await supabase
      .from('job_runs')
      .select('*', { count: 'exact' })
      .eq('data->>jobId', jobId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[ADMIN/JOBS] Failed to fetch runs:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedRuns = (runs ?? []).map((run) => ({
      id: run.id,
      ...run.data,
      created_at: run.created_at,
    }));

    return NextResponse.json({
      runs: formattedRuns,
      total: count ?? formattedRuns.length,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[ADMIN/JOBS] Runs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
