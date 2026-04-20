/**
 * POST /api/render — Create a render job (DB only, no rendering here)
 * GET  /api/render — List all render jobs
 *
 * This route ONLY writes to the database. It does NOT run Remotion.
 * Remotion rendering happens in the external worker:
 *   npm run render:worker   (or: npx tsx src/render-worker/index.ts)
 *
 * Architecture:
 *   1. Client POSTs compositionData → this route creates a "queued" job in Supabase
 *   2. Worker (separate process) polls Supabase for queued jobs
 *   3. Worker runs bundle() + renderMedia() + uploads output
 *   4. Worker updates render_jobs status → "done" + result_url
 *   5. Client polls GET /api/render/[jobId] and sees completion
 */
import { NextRequest, NextResponse } from "next/server";
import { createRenderJob, listRenderJobs } from "@/lib/render-worker/job-manager";
import { getSupabase } from "@/lib/db/store";

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

    // ── Create job in Supabase (DB only — no rendering here) ──
    const jobId = `rj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await createRenderJob({
      jobId,
      projectId,
      metadata: {
        projectName: projectName || "Untitled",
        compositionId: "PixelFrameEdit",
        inputProps,
        quality: quality || "premium",
        videoUrl,
        outputFormat: compositionData.output?.format || "9:16",
        outputWidth: compositionData.output?.width || 1080,
        outputHeight: compositionData.output?.height || 1920,
      },
    });

    console.log(`${tag} ✅ Job created: ${jobId} for project ${projectId}`);

    // Link the render job to the project
    try {
      const sb = getSupabase();
      await sb.from("video_projects").update({
        render_job_id: jobId,
        status: "rendering",
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);
      console.log(`${tag} ✅ Project ${projectId} linked to job ${jobId}`);
    } catch (linkErr) {
      console.warn(`${tag} ⚠️ Could not link job to project:`, linkErr instanceof Error ? linkErr.message : linkErr);
    }

    // ── No rendering here — the external worker picks up queued jobs ──
    // Start worker with: npx tsx src/lib/render-worker/worker.ts

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
