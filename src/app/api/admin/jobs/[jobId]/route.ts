/**
 * Admin: Job Detail + Update
 *
 * GET  /api/admin/jobs/[jobId] — Job detail + recent runs (last 20)
 * PATCH /api/admin/jobs/[jobId] — Update job status (active/paused/disabled)
 *
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
    const supabase = getSupabase();

    // Fetch the job
    const { data: job, error: jobError } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) {
      console.error('[ADMIN/JOBS] Failed to fetch job:', jobError.message);
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Fetch recent runs (last 20)
    const { data: runs, error: runsError } = await supabase
      .from('job_runs')
      .select('*')
      .eq('data->>jobId', jobId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (runsError) {
      console.error('[ADMIN/JOBS] Failed to fetch runs:', runsError.message);
    }

    const recentRuns = (runs ?? []).map((run) => ({
      id: run.id,
      ...run.data,
      created_at: run.created_at,
    }));

    return NextResponse.json({
      job: {
        id: job.id,
        ...job.data,
        created_at: job.created_at,
      },
      recentRuns,
    });
  } catch (error: any) {
    console.error('[ADMIN/JOBS] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { jobId } = await context.params;
    const body = await req.json();
    const supabase = getSupabase();

    // Fetch existing job
    const { data: existing, error: fetchError } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Merge updates into data JSONB
    const updatedData = {
      ...(existing.data ?? {}),
      ...body,
      updatedAt: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('scheduled_jobs')
      .update({ data: updatedData })
      .eq('id', jobId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      job: { id: jobId, ...updatedData },
    });
  } catch (error: any) {
    console.error('[ADMIN/JOBS] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
