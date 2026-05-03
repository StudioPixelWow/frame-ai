import { NextRequest, NextResponse } from 'next/server';
import { startScan, type ScanType } from '@/lib/seo/scan-pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/seo/scan/start
 *
 * Starts an async multi-stage scan pipeline.
 * Returns a job ID immediately — client polls /api/seo/scan/status?jobId=xxx
 *
 * Body: { url: string, scanType?: 'quick' | 'deep' }
 * Response: { jobId: string, status: 'queued', scanType }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, scanType = 'quick' } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    const validTypes: ScanType[] = ['quick', 'deep'];
    const type: ScanType = validTypes.includes(scanType) ? scanType : 'quick';

    const jobId = await startScan(url, type);

    return NextResponse.json({
      jobId,
      status: 'queued',
      scanType: type,
      pollUrl: `/api/seo/scan/status?jobId=${jobId}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PIXEL SEO/GEO] Scan start failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
