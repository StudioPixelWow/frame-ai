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
  listRenderJobs,
  type RenderJobData,
} from "@/lib/render-worker/job-manager";
import { ensureWorkerRunning, getWorkerStatus } from "@/lib/render-worker/spawn-worker";
import { compositionToProps } from "@/lib/video-engine/composition-to-props";
import path from "path";
import fs from "fs";

export async function GET() {
  try {
    const jobs = listRenderJobs();
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

    if (!projectId || !compositionData) {
      return NextResponse.json({ error: "projectId and compositionData are required" }, { status: 400 });
    }

    // Build Remotion input props from composition data
    let inputProps = remotionProps;
    if (!inputProps && compositionData) {
      try {
        inputProps = compositionToProps(compositionData);
      } catch (e) {
        console.warn("[Render API] Failed to convert composition to props, using raw data:", e);
        inputProps = compositionData;
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

    // Ensure video URLs are absolute paths for rendering (not blob: URLs)
    if (inputProps?.videoUrl && inputProps.videoUrl.startsWith("/")) {
      // Relative path like /uploads/upload-xxx.mp4 — keep as is for bundle serve
      console.log("[Render API] Video URL for render:", inputProps.videoUrl);
    }

    console.log("[Render API] Creating render job for project:", projectId);
    console.log("[Render API] Composition: PixelFrameEdit");
    console.log("[Render API] Input props keys:", Object.keys(inputProps || {}));
    console.log("[Render API] Music track URL:", inputProps?.music?.trackUrl || "(none)");

    // Create the render job file on disk
    const job = createRenderJobFile({
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

    console.log("[Render API] Job created:", job.id);

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
    console.error("[Render API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create render job" },
      { status: 500 }
    );
  }
}
