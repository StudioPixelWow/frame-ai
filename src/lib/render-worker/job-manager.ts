/**
 * PixelFrameAI — Render Job Manager
 * File-based render job system. Jobs are stored as JSON files in .frameai/data/render-jobs/
 * The API creates jobs, the worker picks them up and processes them.
 */
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".frameai/data/render-jobs");

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface RenderJobData {
  id: string;
  projectId: string;
  projectName: string;
  status: "queued" | "preparing" | "rendering" | "finalizing" | "completed" | "failed";
  progress: number;
  currentStage: string;

  compositionId: string;
  inputProps: Record<string, unknown>;

  outputPath: string | null;
  outputFormat: string;
  outputDuration: number;
  outputWidth: number;
  outputHeight: number;
  outputCodec: string;
  outputFileSizeBytes?: number;

  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  estimatedDurationSec: number;
  actualDurationSec: number | null;

  error: string | null;
  retryCount: number;

  quality: string;
  premiumMode: boolean;
}

/** Create a new render job and write it to disk */
export function createRenderJobFile(data: Omit<RenderJobData, "id">): RenderJobData {
  const id = `rj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: RenderJobData = { id, ...data };
  const filePath = path.join(DATA_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
  console.log(`[JobManager] Created render job: ${id}`);
  return job;
}

/** Read a render job from disk */
export function readRenderJob(jobId: string): RenderJobData | null {
  const filePath = path.join(DATA_DIR, `${jobId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as RenderJobData;
  } catch {
    return null;
  }
}

/** Update a render job on disk */
export function updateRenderJobFile(jobId: string, updates: Partial<RenderJobData>): RenderJobData | null {
  const job = readRenderJob(jobId);
  if (!job) return null;
  Object.assign(job, updates);
  const filePath = path.join(DATA_DIR, `${jobId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
  return job;
}

/** Delete a render job file */
export function deleteRenderJobFile(jobId: string): boolean {
  const filePath = path.join(DATA_DIR, `${jobId}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/** List all render jobs */
export function listRenderJobs(): RenderJobData[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const jobs: RenderJobData[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
      jobs.push(data);
    } catch {
      // Skip malformed files
    }
  }
  return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
