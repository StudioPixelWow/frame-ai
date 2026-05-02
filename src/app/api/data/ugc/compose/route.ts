/**
 * POST /api/data/ugc/compose
 *
 * Queues a Remotion render job for the UGC branded video composition.
 * Takes a HeyGen avatar video URL and composition parameters,
 * creates a render job in Supabase that the render worker picks up.
 *
 * GET /api/data/ugc/compose?jobId=xxx
 * Returns the status of a render job (from Supabase).
 *
 * Fully stateless / Vercel-compatible. Zero fs usage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRenderJob, readRenderJob } from '@/lib/render-worker/job-manager';

function generateJobId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `ugc_${ts}_${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      avatarVideoUrl,
      durationSec,
      format = '9:16',
      visualStyle = 'cinematic-dark',
      scenes = [],
      logoUrl = null,
      productImageUrl = null,
      brandName = '',
      tagline = '',
      musicUrl = null,
      musicVolume = 20,
      platform = 'generic',
      ctaText = '',
      ctaUrl = '',
      watermarkEnabled = false,
    } = body;

    if (!avatarVideoUrl) {
      return NextResponse.json(
        { error: 'avatarVideoUrl is required' },
        { status: 400 }
      );
    }

    if (!durationSec || durationSec <= 0) {
      return NextResponse.json(
        { error: 'durationSec must be positive' },
        { status: 400 }
      );
    }

    const jobId = generateJobId();

    // Build the inputProps for the UGCBrandedVideo Remotion composition
    const inputProps = {
      avatarVideoUrl,
      durationSec,
      format,
      visualStyle,
      scenes,
      logoUrl,
      productImageUrl,
      brandName,
      tagline,
      musicUrl,
      musicVolume,
      platform,
      ctaText,
      ctaUrl,
      watermarkEnabled,
    };

    // Persist to Supabase — the worker polls render_jobs for queued jobs
    await createRenderJob({
      jobId,
      projectId: `ugc-${jobId}`,
      metadata: {
        compositionId: 'UGCBrandedVideo',
        inputProps,
      },
    });

    console.log(`[UGC Compose] Created render job in Supabase: ${jobId}`);

    return NextResponse.json({
      jobId,
      status: 'queued',
      message: 'Render job queued successfully',
    }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[UGC Compose] Error creating job:', msg);
    return NextResponse.json({ error: `Failed to create render job: ${msg}` }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await readRenderJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // If completed, use result_url
    let videoUrl: string | null = null;
    if (job.status === 'completed') {
      videoUrl = job.result_url || null;
    }

    return NextResponse.json({
      jobId: job.job_id,
      status: job.status,
      progress: job.progress || 0,
      currentStage: job.stage || '',
      videoUrl,
      error: job.error || null,
      createdAt: job.created_at,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to get job status: ${msg}` }, { status: 500 });
  }
}
