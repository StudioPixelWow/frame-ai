import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/seo/scan-pipeline';

export const runtime = 'nodejs';

/**
 * GET /api/seo/scan/status?jobId=xxx
 *
 * Returns full scan job state for real-time UI rendering:
 * - status, progress, stages, logs, metrics, platformStatuses
 * - validation (anti-fake checks)
 * - result (full scan data when completed, only if valid)
 */
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'jobId query parameter required' }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    url: job.url,
    scanType: job.scanType,
    status: job.status,
    progress: job.progress,
    stages: job.stages,
    logs: job.logs,
    metrics: job.metrics,
    platformStatuses: job.platformStatuses,
    startedAt: job.startedAt,
    completedAt: job.completedAt || null,
    totalDurationMs: job.totalDurationMs || null,
    validation: job.validation || null,
    result: job.result || null,
    error: job.error || null,
  });
}
