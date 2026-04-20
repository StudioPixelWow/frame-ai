/**
 * Render Worker — Load project/job data from Supabase
 */
import { getDb } from "./update-job";

const tag = "[Worker:Load]";

/** Format name aliases → Remotion format codes */
const FORMAT_ALIASES: Record<string, string> = {
  story: "9:16",
  "9:16": "9:16",
  feed: "1:1",
  "1:1": "1:1",
  landscape: "16:9",
  "16:9": "16:9",
  "4:5": "4:5",
  portrait: "4:5",
};

/** Remotion format → pixel dimensions */
const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export interface ProjectRenderData {
  jobId: string;
  projectId: string;
  compositionId: string;
  inputProps: Record<string, unknown>;
  videoUrl: string;
  format: string;
  width: number;
  height: number;
  durationSec: number;
  quality: string;
  metadata: Record<string, unknown>;
}

export async function loadProjectData(jobId: string): Promise<ProjectRenderData | null> {
  const sb = getDb();

  const { data: job, error } = await sb
    .from("render_jobs")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error || !job) {
    console.error(`${tag} Job ${jobId} not found: ${error?.message || "no row"}`);
    return null;
  }

  if (job.status !== "queued") {
    console.log(`${tag} Job ${jobId} is '${job.status}', not queued — skip`);
    return null;
  }

  const metadata = (job.metadata || {}) as Record<string, unknown>;
  const inputProps = (metadata.inputProps as Record<string, unknown>) || {};
  const compositionId = (metadata.compositionId as string) || "PixelFrameEdit";
  const videoUrl = (inputProps.videoUrl as string) || (metadata.videoUrl as string) || "";

  // Resolve format
  const rawFormat = (inputProps.format as string) || (metadata.outputFormat as string) || "9:16";
  const format = FORMAT_ALIASES[rawFormat] || rawFormat;
  const dims = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS["9:16"];

  const durationSec = (inputProps.durationSec as number) || 30;
  const quality = (metadata.quality as string) || "premium";

  // Log full composition data
  console.log(`${tag} ═══ PROJECT RENDER DATA ═══`);
  console.log(`${tag}   jobId:         ${jobId}`);
  console.log(`${tag}   projectId:     ${job.project_id}`);
  console.log(`${tag}   compositionId: ${compositionId}`);
  console.log(`${tag}   videoUrl:      ${videoUrl.substring(0, 120)}`);
  console.log(`${tag}   format:        ${rawFormat} → ${format} (${dims.width}x${dims.height})`);
  console.log(`${tag}   durationSec:   ${durationSec}`);
  console.log(`${tag}   trimStart:     ${inputProps.trimStart || 0}`);
  console.log(`${tag}   trimEnd:       ${inputProps.trimEnd || 0}`);
  console.log(`${tag}   segments:      ${Array.isArray(inputProps.segments) ? (inputProps.segments as unknown[]).length : 0}`);
  console.log(`${tag}   broll:         ${Array.isArray(inputProps.brollPlacements) ? (inputProps.brollPlacements as unknown[]).length : 0}`);
  console.log(`${tag}   cleanupCuts:   ${Array.isArray(inputProps.cleanupCuts) ? (inputProps.cleanupCuts as unknown[]).length : 0}`);
  console.log(`${tag}   transition:    ${JSON.stringify(inputProps.transition || {})}`);
  console.log(`${tag}   visual:        ${JSON.stringify(inputProps.visual || {})}`);
  console.log(`${tag}   premium:       ${JSON.stringify(inputProps.premium || {})}`);
  console.log(`${tag}   quality:       ${quality}`);
  console.log(`${tag} ═══════════════════════════`);

  return {
    jobId,
    projectId: job.project_id,
    compositionId,
    inputProps,
    videoUrl,
    format,
    width: dims.width,
    height: dims.height,
    durationSec,
    quality,
    metadata,
  };
}
