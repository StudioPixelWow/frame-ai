/**
 * POST /api/render — Create a render job + invoke Remotion Lambda
 * GET  /api/render — List all render jobs
 *
 * Architecture (Serverless-compatible Remotion Lambda):
 *   1. POST: Client sends compositionData → creates job in DB → invokes Lambda → saves renderId/bucketName → returns immediately
 *   2. GET /api/render/[jobId]: Client polls → each poll checks Lambda progress via getRenderProgress → updates DB → returns status
 *   3. When Lambda is done, the GET handler finalizes (saves S3 output URL to DB)
 *
 * This is fully stateless — no background tasks, no fire-and-forget.
 * Each HTTP request is short-lived and works within Vercel's function timeout.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRenderJob, listRenderJobs, updateRenderJob } from "@/lib/render-worker/job-manager";
import { getSupabase } from "@/lib/db/store";
import { invokeLambdaRender } from "@/lib/lambda-render/invoke-renderer";
import { getSignedDownloadUrl } from "@/lib/storage/upload";

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

    // ── Guard: only ONE render at a time (globally) to avoid AWS rate limits ──
    try {
      const existingJobs = await listRenderJobs();
      const activeJob = existingJobs.find(
        (j: any) => ["queued", "preparing", "rendering", "processing"].includes(j.status)
      );
      if (activeJob) {
        console.warn(`${tag} ⚠️ Blocking new render — active job ${activeJob.job_id} exists (project=${activeJob.project_id}, status=${activeJob.status})`);
        return NextResponse.json({
          job: {
            id: activeJob.job_id,
            status: activeJob.status,
            progress: activeJob.progress || 0,
            currentStage: activeJob.stage || "כבר ברינדור",
            projectId: activeJob.project_id,
          },
          duplicate: true,
          message: "A render is already in progress. Please wait for it to finish.",
        });
      }
    } catch (dupErr) {
      console.warn(`${tag} Could not check for duplicates:`, dupErr instanceof Error ? dupErr.message : dupErr);
    }

    // ── Replace Supabase public URL with signed URL for Lambda access ──
    if (videoUrl.includes("supabase.co/storage/")) {
      console.log(`${tag} Generating signed URL for video...`);
      const signedUrl = await getSignedDownloadUrl(videoUrl, 3600);
      inputProps = { ...inputProps, videoUrl: signedUrl };
      console.log(`${tag} ✅ Signed URL ready`);
    }

    // ── Create job in Supabase ──
    const jobId = `rj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await createRenderJob({
      jobId,
      projectId,
      metadata: {
        projectName: projectName || "Untitled",
        compositionId: "PixelManageEdit",
        inputProps,
        quality: quality || "premium",
        videoUrl,
        outputFormat: compositionData.output?.format || "9:16",
        outputWidth: compositionData.output?.width || 1080,
        outputHeight: compositionData.output?.height || 1920,
      },
    });

    console.log(`${tag} ✅ Job created: ${jobId}`);

    // Link the render job to the project
    try {
      const sb = getSupabase();
      await sb.from("video_projects").update({
        render_job_id: jobId,
        status: "rendering",
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);
    } catch (linkErr) {
      console.warn(`${tag} ⚠️ Could not link job to project:`, linkErr instanceof Error ? linkErr.message : linkErr);
    }

    // ── Invoke Remotion Lambda (synchronous — just the invoke, no polling) ──
    const lambdaEnabled = !!process.env.REMOTION_LAMBDA_FUNCTION_NAME;

    if (lambdaEnabled) {
      try {
        const { renderId, bucketName } = await invokeLambdaRender({
          jobId,
          projectId,
          compositionId: "PixelManageEdit",
          inputProps: inputProps as Record<string, unknown>,
          quality: quality || "premium",
        });

        // Save renderId + bucketName so the GET poll handler can check progress
        await updateRenderJob(jobId, {
          status: "rendering",
          progress: 5,
          stage: "Lambda הופעל",
          metadata: {
            projectName: projectName || "Untitled",
            compositionId: "PixelManageEdit",
            quality: quality || "premium",
            videoUrl,
            renderId,
            bucketName,
          },
        });

        console.log(`${tag} ✅ Lambda invoked: renderId=${renderId}, bucketName=${bucketName}`);

        return NextResponse.json({
          job: {
            id: jobId,
            status: "rendering",
            progress: 5,
            currentStage: "Lambda הופעל",
            projectId,
          },
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`${tag} ❌ Lambda invoke failed: ${errMsg}`);

        await updateRenderJob(jobId, {
          status: "error",
          error: errMsg,
          stage: "שגיאת Lambda",
        });

        return NextResponse.json({
          job: { id: jobId, status: "failed", progress: 0, currentStage: "שגיאה", projectId },
          error: errMsg,
        }, { status: 500 });
      }
    }

    // Legacy fallback
    return NextResponse.json({
      job: { id: jobId, status: "queued", progress: 0, currentStage: "ממתין בתור", projectId },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ POST /api/render FAILED: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
