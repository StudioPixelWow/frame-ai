/**
 * POST /api/render — Start a new render job
 * GET  /api/render — List all render jobs
 *
 * POST body: { projectId, projectName, compositionData, remotionProps, quality }
 * Inserts a row into Supabase render_jobs, then spawns the worker.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRenderJob, listRenderJobs } from "@/lib/render-worker/job-manager";
import { ensureWorkerRunning, getWorkerStatus } from "@/lib/render-worker/spawn-worker";
import { compositionToProps } from "@/lib/video-engine/composition-to-props";
import path from "path";
import fs from "fs";

const tag = "[Render API]";

export async function GET() {
  try {
    const jobs = await listRenderJobs();
    const worker = getWorkerStatus();
    return NextResponse.json({ jobs, worker });
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

    // Pre-generate music audio file if needed
    if (inputProps?.music?.enabled && inputProps?.music?.trackUrl) {
      const trackUrl = inputProps.music.trackUrl as string;
      if (trackUrl.startsWith("/api/media/audio")) {
        try {
          const url = new URL(trackUrl, "http://localhost:3000");
          const trackId = url.searchParams.get("trackId") || "";
          if (trackId) {
            const audioDir = path.join(process.cwd(), "public", "media", "audio");
            if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
            try {
              const audioRes = await fetch(`http://localhost:3000${trackUrl}`);
              if (audioRes.ok) {
                const staticFile = path.join(audioDir, `${trackId}_v2.wav`);
                const legacyFile = path.join(audioDir, `${trackId}.wav`);
                if (fs.existsSync(staticFile)) {
                  inputProps.music.trackUrl = `/media/audio/${trackId}_v2.wav`;
                } else if (fs.existsSync(legacyFile)) {
                  inputProps.music.trackUrl = `/media/audio/${trackId}.wav`;
                }
              }
            } catch { /* non-fatal */ }
          }
        } catch { /* non-fatal */ }
      }
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

    // ── Generate job ID and persist to Supabase ──
    const jobId = `rj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`${tag} Render job created: jobId=${jobId}`);

    const job = await createRenderJob({
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

    // Also write a local file for the worker process to pick up
    const jobDir = path.join(process.cwd(), ".frameai", "data", "render-jobs");
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });
    const jobFile = path.join(jobDir, `${jobId}.json`);
    const workerPayload = {
      id: jobId,
      projectId,
      projectName: projectName || "Untitled",
      status: "queued",
      progress: 0,
      currentStage: "ממתין בתור",
      compositionId: "PixelFrameEdit",
      inputProps,
      outputPath: null,
      createdAt: new Date().toISOString(),
      quality: quality || "premium",
      premiumMode: compositionData.premium?.enabled ?? true,
    };
    fs.writeFileSync(jobFile, JSON.stringify(workerPayload, null, 2));
    console.log(`${tag} Worker file written: ${jobFile}`);

    // Ensure the render worker is running
    const workerResult = ensureWorkerRunning();
    console.log(`${tag} Worker status: ${workerResult.started ? "started" : "already running"} PID=${workerResult.pid}`);

    // Return job shape that the client expects
    return NextResponse.json({
      job: {
        id: jobId,
        status: "queued",
        progress: 0,
        currentStage: "ממתין בתור",
        projectId,
      },
      worker: {
        started: workerResult.started,
        pid: workerResult.pid,
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
