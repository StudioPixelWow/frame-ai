/**
 * POST /api/data/ugc/compose
 *
 * Queues a Remotion render job for the UGC branded video composition.
 * Takes a HeyGen avatar video URL and composition parameters,
 * creates a render job file that the render worker picks up.
 *
 * GET /api/data/ugc/compose?jobId=xxx
 * Returns the status of a render job.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const RENDER_JOBS_DIR = path.join(PROJECT_ROOT, '.frameai/data/render-jobs');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public/renders');

// Ensure directories exist
[RENDER_JOBS_DIR, OUTPUT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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
    const now = new Date().toISOString();

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

    // Create a render job file — the worker polls for these
    const job = {
      id: jobId,
      compositionId: 'UGCBrandedVideo',
      status: 'queued',
      progress: 0,
      currentStage: 'בתור לרינדור',
      inputProps,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      outputPath: null,
      error: null,
    };

    const jobPath = path.join(RENDER_JOBS_DIR, `${jobId}.json`);
    fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));

    console.log(`[UGC Compose] Created render job: ${jobId}`);

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

    const jobPath = path.join(RENDER_JOBS_DIR, `${jobId}.json`);
    if (!fs.existsSync(jobPath)) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));

    // If completed, use Supabase public URL if available, else fall back to local path
    let videoUrl: string | null = null;
    if (job.status === 'completed') {
      videoUrl = job.publicUrl || job.outputPath || null;
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
      currentStage: job.currentStage || '',
      videoUrl,
      error: job.error || null,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to get job status: ${msg}` }, { status: 500 });
  }
}
