import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/seo/scan-pipeline';

export const runtime = 'nodejs';

/**
 * GET /api/seo/scan/results?jobId=xxx
 *
 * Returns scan results ONLY if validation passed.
 * If scan is invalid, returns 403 with reason.
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

  if (job.status !== 'completed') {
    return NextResponse.json({
      error: 'Scan not yet completed',
      status: job.status,
      progress: job.progress,
    }, { status: 202 });
  }

  if (!job.validation?.passed) {
    return NextResponse.json({
      error: 'Scan validation failed — results blocked',
      validation: job.validation,
      message: job.validation?.invalidReason || 'הסריקה אינה אמינה מספיק',
    }, { status: 403 });
  }

  return NextResponse.json({
    result: job.result,
    validation: job.validation,
    metrics: job.metrics,
  });
}
