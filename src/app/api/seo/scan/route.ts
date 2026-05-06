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
const TAG = '[PIXEL-SEO-SCAN]';

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const body = await req.json();
    const { url, async: asyncMode, scanType = 'quick', clientKeywords } = body;

    console.log(`${TAG} [${reqId}] INIT url=${url} scanType=${scanType} async=${!!asyncMode}`);

    if (!url) {
      console.warn(`${TAG} [${reqId}] REJECTED — no URL provided`);
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    const validTypes: ScanType[] = ['quick', 'deep'];
    const type: ScanType = validTypes.includes(scanType) ? scanType : 'quick';
    const jobId = await startScan(url, type, Array.isArray(clientKeywords) ? clientKeywords : undefined);
    console.log(`${TAG} [${reqId}] JOB_CREATED jobId=${jobId} type=${type}`);

    if (asyncMode) {
      return NextResponse.json({ jobId, status: 'queued', scanType: type, pollUrl: `/api/seo/scan/status?jobId=${jobId}` });
    }

    // Legacy sync — poll until done
    const maxWait = 55_000;
    const start = Date.now();
    let pollCount = 0;
    while (Date.now() - start < maxWait) {
      const job = getJob(jobId);
      pollCount++;
      if (!job) {
        console.error(`${TAG} [${reqId}] JOB_DISAPPEARED jobId=${jobId} after ${pollCount} polls`);
        return NextResponse.json({ error: 'Job disappeared' }, { status: 500 });
      }

      if (job.status === 'completed' && job.result) {
        const elapsed = Date.now() - start;
        console.log(`${TAG} [${reqId}] COMPLETED jobId=${jobId} elapsed=${elapsed}ms polls=${pollCount} stages=${job.stages?.length ?? 0}`);
        return NextResponse.json({
          ...job.result,
          _pipeline: { jobId: job.id, stages: job.stages, logs: job.logs, validation: job.validation, totalDurationMs: job.totalDurationMs },
        });
      }
      if (job.status === 'failed') {
        console.error(`${TAG} [${reqId}] FAILED jobId=${jobId} error=${job.error} stages=${JSON.stringify(job.stages?.map(s => `${s.stage}:${s.status}`))}`);
        return NextResponse.json({ error: job.error || 'Scan failed', _pipeline: { jobId: job.id, stages: job.stages, logs: job.logs } }, { status: 500 });
      }

      await new Promise(r => setTimeout(r, 500));
    }

    const job = getJob(jobId);
    console.error(`${TAG} [${reqId}] TIMEOUT jobId=${jobId} status=${job?.status} progress=${job?.progress}`);
    return NextResponse.json({ error: 'Scan timed out', jobId, status: job?.status, progress: job?.progress }, { status: 408 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${TAG} [${reqId}] EXCEPTION: ${msg}`, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
