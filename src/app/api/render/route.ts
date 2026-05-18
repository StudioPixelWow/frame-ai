/**
 * POST /api/render — Create a render job (queued for Railway worker)
 * GET  /api/render — List all render jobs
 *
 * Architecture (Railway Worker):
 *   1. POST: Client sends compositionData → creates job in DB (status=queued) → returns immediately
 *   2. Railway worker polls render_jobs table, picks up queued jobs, renders via Remotion
 *   3. GET /api/render/[jobId]: Client polls for status updates written by the worker
 *
 * This is fully stateless — no background tasks, no fire-and-forget.
 * Each HTTP request is short-lived and works within Vercel's function timeout.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRenderJob, listRenderJobs, updateRenderJob } from "@/lib/render-worker/job-manager";
import { getSupabase } from "@/lib/db/store";
import { getSignedDownloadUrl } from "@/lib/storage/upload";
import { compositionToProps } from "@/lib/video-engine/composition-to-props";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    // CRITICAL: compositionData is a FinalCompositionData with nested structure
    // (timeline.tracks, subtitles.style, etc.) — use compositionToProps() to
    // properly extract segments, brollPlacements, subtitleStyle from nested paths.
    let inputProps = remotionProps;
    if (!inputProps && compositionData) {
      // Check if this is a FinalCompositionData (has nested structure) or flat props
      const isFinalComposition = !!(compositionData.timeline?.tracks || compositionData.subtitles?.style || compositionData.source?.videoUrl);

      if (isFinalComposition) {
        try {
          inputProps = compositionToProps(compositionData);
          console.log(`${tag} ✅ compositionToProps succeeded — segments: ${inputProps.segments?.length}, broll: ${inputProps.brollPlacements?.length}, videoClips: ${inputProps.videoClips?.length}, subtitleFont: ${inputProps.subtitleStyle?.font}, musicUrl: ${inputProps.music?.trackUrl?.substring(0, 60) || "(none)"}`);
        } catch (convErr) {
          console.error(`${tag} ⚠️ compositionToProps failed, falling back to flat extraction:`, convErr instanceof Error ? convErr.message : convErr);
          // Fallback: try flat keys (legacy path for older clients)
          const rawVideoUrl = compositionData.videoUrl || compositionData.source?.videoUrl || "";
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
            videoClips: compositionData.videoClips ?? [],
            zoomKeyframes: compositionData.zoomKeyframes ?? [],
            hookBoost: compositionData.hookBoost ?? { active: false, hookEndSec: 0, zoomMultiplier: 1, subtitleFontMultiplier: 1 },
          };
        }
      } else {
        // Already flat props (legacy or pre-converted)
        inputProps = compositionData;
        console.log(`${tag} Using flat compositionData as inputProps directly`);
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
    // Guard: reject Supabase bucket base URLs with no actual file path
    // e.g. "https://xxx.supabase.co/storage/v1/object/public/project-files/" — missing filename
    if (videoUrl.includes("/storage/v1/object/") && videoUrl.endsWith("/")) {
      console.error(`${tag} ❌ Video URL is a bucket base URL without a filename: ${videoUrl}`);
      return NextResponse.json({
        error: "כתובת הוידאו שגויה — חסר שם קובץ. נסה להעלות מחדש.",
      }, { status: 400 });
    }
    // Guard: Supabase URL must have a file path after the bucket name
    const bucketMarker = "/object/public/project-files/";
    const bucketIdx = videoUrl.indexOf(bucketMarker);
    if (bucketIdx !== -1) {
      const pathAfterBucket = videoUrl.slice(bucketIdx + bucketMarker.length);
      if (!pathAfterBucket || pathAfterBucket.length < 3) {
        console.error(`${tag} ❌ Video URL has empty/short path after bucket: ${videoUrl} → "${pathAfterBucket}"`);
        return NextResponse.json({
          error: "כתובת הוידאו שגויה — חסר נתיב לקובץ. נסה להעלות מחדש.",
        }, { status: 400 });
      }
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

    // ── Resolve relative music URL to absolute for Railway worker ──
    // The /api/media/audio endpoint only works in the browser. For server-side
    // rendering on Railway, we need an absolute URL the worker can fetch.
    const musicTrackUrl = inputProps?.music?.trackUrl || "";
    if (musicTrackUrl && musicTrackUrl.startsWith("/")) {
      const appBaseUrl = process.env.NEXT_PUBLIC_SITE_URL
        || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
        || "https://frame-ai.vercel.app";
      const absoluteMusicUrl = `${appBaseUrl}${musicTrackUrl}`;
      inputProps = {
        ...inputProps,
        music: { ...inputProps.music, trackUrl: absoluteMusicUrl },
      };
      console.log(`${tag} ✅ Music URL resolved: ${musicTrackUrl} → ${absoluteMusicUrl.substring(0, 80)}`);
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

    // ── Render via Railway worker (Lambda is deprecated) ──
    // Job is created with status=queued above.
    // The Railway worker polls render_jobs table and picks up queued jobs.
    // No Lambda invocation needed — the worker handles everything.
    console.log(`${tag} ✅ Job ${jobId} queued for Railway worker pickup`);

    return NextResponse.json({
      job: { id: jobId, status: "queued", progress: 0, currentStage: "ממתין בתור", projectId },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ POST /api/render FAILED: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
