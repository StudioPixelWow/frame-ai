/**
 * POST /api/render — Start a new render job
 * GET  /api/render — List all render jobs
 *
 * POST body: { projectId, projectName, compositionData, remotionProps, quality }
 * Creates a job file on disk. The render worker picks it up and processes it
 * using real Remotion renderMedia().
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createRenderJobFile,
  listRenderJobsAsync,
  type RenderJobData,
} from "@/lib/render-worker/job-manager";
import { ensureWorkerRunning, getWorkerStatus } from "@/lib/render-worker/spawn-worker";
import { compositionToProps } from "@/lib/video-engine/composition-to-props";
import path from "path";
import fs from "fs";

export async function GET() {
  try {
    const jobs = await listRenderJobsAsync();
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

    console.log("[Render API] ── POST /api/render ──");
    console.log("[Render API]   projectId:", projectId);
    console.log("[Render API]   projectName:", projectName);
    console.log("[Render API]   quality:", quality);
    console.log("[Render API]   hasCompositionData:", !!compositionData);
    console.log("[Render API]   compositionData keys:", compositionData ? Object.keys(compositionData) : "(null)");
    console.log("[Render API]   hasRemotionProps:", !!remotionProps);
    if (compositionData?.source) {
      console.log("[Render API]   source.videoUrl:", compositionData.source.videoUrl?.substring(0, 120) || "(empty)");
      console.log("[Render API]   source.trimStart:", compositionData.source.trimStart);
      console.log("[Render API]   source.trimEnd:", compositionData.source.trimEnd);
    }
    if (compositionData?.timeline) {
      console.log("[Render API]   timeline.durationSec:", compositionData.timeline.durationSec);
      console.log("[Render API]   timeline.tracks:", compositionData.timeline.tracks?.map((t: any) => `${t.type}(${t.items?.length || 0})`).join(", ") || "(none)");
    }
    if (compositionData?.metadata) {
      console.log("[Render API]   metadata:", JSON.stringify(compositionData.metadata));
    }

    if (!projectId || !compositionData) {
      console.error("[Render API] ❌ Missing required fields:", { projectId: !!projectId, compositionData: !!compositionData });
      return NextResponse.json({ error: "projectId and compositionData are required" }, { status: 400 });
    }

    // Build Remotion input props from composition data
    let inputProps = remotionProps;
    if (!inputProps && compositionData) {
      try {
        inputProps = compositionToProps(compositionData);
        console.log("[Render API] ✅ compositionToProps succeeded, keys:", Object.keys(inputProps));
        console.log("[Render API]   videoUrl:", inputProps.videoUrl?.substring(0, 120) || "(empty)");
        console.log("[Render API]   segments:", inputProps.segments?.length || 0);
        console.log("[Render API]   brollPlacements:", inputProps.brollPlacements?.length || 0);
        console.log("[Render API]   format:", inputProps.format);
        console.log("[Render API]   durationSec:", inputProps.durationSec);
        console.log("[Render API]   music.enabled:", inputProps.music?.enabled);
        console.log("[Render API]   music.trackUrl:", inputProps.music?.trackUrl?.substring(0, 80) || "(none)");
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.warn("[Render API] ⚠️ compositionToProps failed:", errMsg);
        console.warn("[Render API]   Falling back to raw compositionData as inputProps");
        console.warn("[Render API]   compositionData keys:", Object.keys(compositionData));
        // Try to extract videoUrl from common locations in raw data
        const rawVideoUrl = compositionData.videoUrl
          || compositionData.source?.videoUrl
          || compositionData.sourceVideoUrl
          || "";
        // Build minimal valid inputProps from raw data
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
        console.log("[Render API]   Fallback inputProps videoUrl:", inputProps.videoUrl?.substring(0, 80) || "(empty)");
      }
    }

    // Pre-generate music audio file if needed for render context
    if (inputProps?.music?.enabled && inputProps?.music?.trackUrl) {
      const trackUrl = inputProps.music.trackUrl as string;
      if (trackUrl.startsWith("/api/media/audio")) {
        try {
          // Extract trackId from URL
          const url = new URL(trackUrl, "http://localhost:3000");
          const trackId = url.searchParams.get("trackId") || "";
          if (trackId) {
            const audioDir = path.join(process.cwd(), "public", "media", "audio");
            if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
            // Pre-fetch the audio to ensure it's cached on disk
            const internalUrl = `http://localhost:3000${trackUrl}`;
            console.log("[Render API] Pre-generating music for render:", internalUrl);
            try {
              const audioRes = await fetch(internalUrl);
              if (audioRes.ok) {
                // Audio API caches the file to disk automatically.
                // Now point to the static file for Remotion render.
                const staticFile = path.join(audioDir, `${trackId}_v2.wav`);
                const legacyFile = path.join(audioDir, `${trackId}.wav`);
                if (fs.existsSync(staticFile)) {
                  inputProps.music.trackUrl = `/media/audio/${trackId}_v2.wav`;
                } else if (fs.existsSync(legacyFile)) {
                  inputProps.music.trackUrl = `/media/audio/${trackId}.wav`;
                }
                // Otherwise keep the API URL — the bundle server may resolve it
              }
            } catch (fetchErr) {
              console.warn("[Render API] Could not pre-generate music:", fetchErr);
            }
          }
        } catch (urlErr) {
          console.warn("[Render API] Could not parse music URL:", urlErr);
        }
      }
    }

    // Validate video URL
    const videoUrl = inputProps?.videoUrl || "";
    if (!videoUrl) {
      console.error("[Render API] ❌ No videoUrl in inputProps — render will fail");
      return NextResponse.json({
        error: "No video URL available for rendering. Upload a video first.",
        detail: "inputProps.videoUrl is empty",
        inputPropsKeys: Object.keys(inputProps || {}),
      }, { status: 400 });
    }
    if (videoUrl.startsWith("blob:")) {
      console.error("[Render API] ❌ videoUrl is a blob: URL — not usable for server-side render");
      return NextResponse.json({
        error: "Video is only available locally (blob URL). Upload it to storage first.",
        detail: `videoUrl starts with blob:`,
      }, { status: 400 });
    }

    // Log video URL type
    if (videoUrl.startsWith("/")) {
      console.log("[Render API] Video URL (local path):", videoUrl);
    } else if (videoUrl.startsWith("http")) {
      console.log("[Render API] Video URL (remote):", videoUrl.substring(0, 120));
    } else {
      console.warn("[Render API] ⚠️ Video URL has unexpected format:", videoUrl.substring(0, 80));
    }

    console.log("[Render API] ── Creating Render Job ──");
    console.log("[Render API]   project:", projectId);
    console.log("[Render API]   composition: PixelFrameEdit");
    console.log("[Render API]   inputProps keys:", Object.keys(inputProps || {}));
    console.log("[Render API]   videoUrl:", videoUrl.substring(0, 120));
    console.log("[Render API]   segments:", inputProps?.segments?.length || 0);
    console.log("[Render API]   music.trackUrl:", inputProps?.music?.trackUrl || "(none)");

    // Create the render job (file + Supabase)
    const job = await createRenderJobFile({
      projectId,
      projectName: projectName || "Untitled",
      status: "queued",
      progress: 0,
      currentStage: "ממתין בתור",

      compositionId: "PixelFrameEdit",
      inputProps: inputProps,

      outputPath: null,
      outputFormat: compositionData.output?.format || "9:16",
      outputDuration: compositionData.metadata?.estimatedRenderDurationSec || 30,
      outputWidth: compositionData.output?.width || 1080,
      outputHeight: compositionData.output?.height || 1920,
      outputCodec: "h264",

      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      estimatedDurationSec: compositionData.metadata?.estimatedRenderDurationSec || 30,
      actualDurationSec: null,

      error: null,
      retryCount: 0,

      quality: quality || "premium",
      premiumMode: compositionData.premium?.enabled ?? true,
    });

    console.log("[Render API] ✅ Saved render job:", job.id);
    // Verify the file was actually written — log exact path
    const verifyDir = path.join(process.cwd(), ".frameai", "data", "render-jobs");
    const verifyFile = path.join(verifyDir, `${job.id}.json`);
    const fileExists = fs.existsSync(verifyFile);
    console.log(`[Render API]   verify: ${verifyFile} exists=${fileExists}`);
    console.log(`[Render API]   cwd=${process.cwd()} NODE_ENV=${process.env.NODE_ENV}`);
    if (!fileExists) {
      // Also check /tmp path
      const tmpFile = path.join("/tmp", ".frameai", "data", "render-jobs", `${job.id}.json`);
      console.log(`[Render API]   /tmp check: ${tmpFile} exists=${fs.existsSync(tmpFile)}`);
    }

    // Ensure the render worker is running
    const workerResult = ensureWorkerRunning();
    console.log("[Render API] Worker status:", workerResult.started ? "started" : "already running", "PID:", workerResult.pid);

    return NextResponse.json({
      job,
      worker: {
        started: workerResult.started,
        pid: workerResult.pid,
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    console.error("[Render API] ❌ POST /api/render FAILED");
    console.error("[Render API]   error:", errMsg);
    if (errStack) console.error("[Render API]   stack:", errStack);
    return NextResponse.json(
      { error: errMsg, stack: process.env.NODE_ENV === "development" ? errStack : undefined },
      { status: 500 }
    );
  }
}
