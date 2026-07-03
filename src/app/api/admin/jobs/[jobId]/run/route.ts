/**
 * Admin: Manual "Run Now"
 *
 * POST /api/admin/jobs/[jobId]/run
 *
 * Runs a specific job immediately (triggeredBy: 'manual').
 * Auth: admin role only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runJobById } from '@/lib/automation/central-job-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAdmin(req: NextRequest): boolean {
  const role = req.headers.get('x-app-role');
  return role === 'admin';
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { jobId } = await context.params;

    const result = await runJobById(jobId, { triggeredBy: 'manual' });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[ADMIN/JOBS] Run-now error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
