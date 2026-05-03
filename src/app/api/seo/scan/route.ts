import { NextRequest, NextResponse } from 'next/server';
import { startScan, getJob, type ScanType } from '@/lib/seo/scan-pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/seo/scan
 *
 * Backward-compatible endpoint. Delegates to the async pipeline.
 *
 * If body includes { async: true }, returns job ID immediately.
 * Otherwise polls until complete (max 55s).
 *
 * Body: { url: string, async?: boolean, scanType?: 'quick' | 'deep' }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, async: asyncMode, scanType = 'quick' } = body;

    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

    const validTypes: ScanType[] = ['quick', 'deep'];
    const type: ScanType = validTypes.includes(scanType) ? scanType : 'quick';
    const jobId = await startScan(url, type);

    if (asyncMode) {
      return NextResponse.json({ jobId, status: 'queued', scanType: type, pollUrl: `/api/seo/scan/status?jobId=${jobId}` });
    }

    // Legacy sync — poll until done
    const maxWait = 55_000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      const job = getJob(jobId);
      if (!job) return NextResponse.json({ error: 'Job disappeared' }, { status: 500 });

      if (job.status === 'completed' && job.result) {
        return NextResponse.json({
          ...job.result,
          _pipeline: { jobId: job.id, stages: job.stages, logs: job.logs, validation: job.validation, totalDurationMs: job.totalDurationMs },
        });
      }
      if (job.status === 'failed') {
        return NextResponse.json({ error: job.error || 'Scan failed', _pipeline: { jobId: job.id, stages: job.stages, logs: job.logs } }, { status: 500 });
      }

      await new Promise(r => setTimeout(r, 500));
    }

    const job = getJob(jobId);
    return NextResponse.json({ error: 'Scan timed out', jobId, status: job?.status, progress: job?.progress }, { status: 408 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
