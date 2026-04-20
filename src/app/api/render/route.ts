/**
 * POST /api/render — Start a new render job
 * GET  /api/render — List all render jobs
 *
 * POST body: { projectId, projectName, compositionData, remotionProps, quality }
 * Inserts a row into Supabase render_jobs, then processes it via after().
 *
 * Fully stateless / Vercel-compatible. Zero fs usage.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { createRenderJob, listRenderJobs } from "@/lib/render-worker/job-manager";
import { compositionToProps } from "@/lib/video-engine/composition-to-props";
import { processRenderJob } from "@/lib/render-worker/process-job";

const tag = "[Render API]";

export async function GET() {
  try {
    const jobs = await listRenderJobs();
    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch render jobs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, projectName, compositionData, remotionProps, quality } = body as {
      projectId: string;
      projectName: string;
      compositionData: any;
      remotionProps?: any;
      quality: "standard" | "premium" | "max";
    };

    console.log(`${tag} ── POST /api/render ──`);
    console.log(`${tag}   projectId: ${projectId}`);
    console.log(`${tag}   projectName: ${projectName}`);
    console.log(`${tag}   quality: ${quality}`);

    if (!projectId || !compositionData) {
      return NextResponse.json({ error: "projectId and compositionData are required" }, { status: 400 });
    }

    // Build Remotion input props from composition data
    let inputProps = remotionProps;
    if (!inputProps && compositionData) {
      try {
        inputProps = compositionToProps(compositionData);
        console.log(`${tag} ✅ compositionToProps succeeded`);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.warn(`${tag} ⚠️ compositionToProps failed: ${errMsg} — using fallback`);
        const rawVideoUrl = compositionData.videoUrl
          || compositionData.source?.videoUrl
          || compositionData.sourceVideoUrl
          || "";
        inputProps = {
          videoUrl: rawVideoUrl,
          trimStart: compositionData.trimStart ?? compositionData.source?.trimStart ?? 0,
          trimEnd: compositionData.trimEnd ?? compositionData.source?.trimEnd ?? 30,
          format: compositionData.format ?? compositionData.output?.format ?? "9:16",
          segments: compositionData.segments ?? [],
          subtitleStyle: compositionData.subtitleStyle ?? {
            font: "Heebo", fontWeight: 800, fontSize: 48, color: "#FFFFFF",
            highlightColor: "#FFD700", outlineEnabled: true, outlineColor: "#000000",
            outlineThickness: 3, shadow: true, bgEnabled: false, bgColor: "#000000",
            bgOpacity: 0.5, align: "center", position: "bottom", animation: "fade",
            lineBreak: "auto",
          },
          brollPlacements: compositionData.brollPlacements ?? [],
          transition: compositionData.transition ?? { style: "fade", durationMs: 300 },
          music: compositionData.music ?? { enabled: false, trackUrl: "", volume: 0.3, ducking: true, duckingLevel: 0.2, fadeInSec: 1, fadeOutSec: 2 },
          cleanupCuts: compositionData.cleanupCuts ?? [],
          visual: compositionData.visual ?? { colorGrading: "none", zoomEnabled: false, zoomOnSpeech: 1.15, zoomOnTransition: 1.3, cropForVertical: true },
          premium: compositionData.premium ?? { enabled: false, level: "standard", motionEffects: false, colorCorrection: false },
          durationSec: compositionData.durationSec ?? compositionData.timeline?.durationSec ?? 30,
          presetId: compositionData.presetId ?? "viral",
          zoomKeyframes: compositionData.zoomKeyframes ?? [],
          hookBoost: compositionData.hookBoost ?? { active: false, hookEndSec: 0, zoomMultiplier: 1, subtitleFontMultiplier: 1 },
        };
      }
    }

    // Music track URL: keep as-is (no local file pre-generation on serverless)
    // The worker or an external renderer will resolve audio URLs at render time.

    // Validate video URL
    const videoUrl = inputProps?.videoUrl || "";
    if (!videoUrl) {
      return NextResponse.json({
        error: "No video URL available for rendering. Upload a video first.",
      }, { status: 400 });
    }
    if (videoUrl.startsWith("blob:")) {
      return NextResponse.json({
        error: "Video is only available locally (blob URL). Upload it to storage first.",
      }, { status: 400 });
    }

    // ── Generate job ID and persist to Supabase (DB only) ──
    const jobId = `rj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`${tag} Render job created: jobId=${jobId}`);

    await createRenderJob({
      jobId,
      projectId,
      metadata: {
        projectName: projectName || "Untitled",
        compositionId: "PixelFrameEdit",
        inputProps,
        quality: quality || "premium",
        videoUrl: videoUrl.substring(0, 200),
        outputFormat: compositionData.output?.format || "9:16",
        outputWidth: compositionData.output?.width || 1080,
        outputHeight: compositionData.output?.height || 1920,
      },
    });

    console.log(`${tag} ✅ Render job persisted to Supabase: ${jobId}`);

    // ── Trigger background processing via after() ──
    // Runs AFTER the response is sent — Vercel keeps the function alive.
    after(async () => {
      console.log(`${tag} after() triggered — starting processRenderJob(${jobId})`);
      try {
        await processRenderJob(jobId);
      } catch (err) {
        console.error(`${tag} ❌ after() processRenderJob failed:`, err instanceof Error ? err.message : err);
      }
    });

    // Return job shape that the client expects
    return NextResponse.json({
      job: {
        id: jobId,
        status: "queued",
        progress: 0,
        currentStage: "ממתין בתור",
        projectId,
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    console.error(`${tag} ❌ POST /api/render FAILED: ${errMsg}`);
    if (errStack) console.error(`${tag}   stack: ${errStack}`);
    return NextResponse.json(
      { error: errMsg, stack: process.env.NODE_ENV === "development" ? errStack : undefined },
      { status: 500 }
    );
  }
}
