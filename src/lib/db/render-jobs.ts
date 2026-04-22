/**
 * PixelManageAI — Render Job Persistence
 * Stores render jobs in .frameai/data/render-jobs.json
 */
import { JsonStore } from "./store";

export type RenderStatus = "queued" | "preparing" | "rendering" | "finalizing" | "completed" | "failed";

export interface RenderJob {
  id: string;
  projectId: string;
  projectName: string;
  status: RenderStatus;
  progress: number; // 0-100
  currentStage: string;

  // Input
  compositionId: string;
  inputProps: Record<string, any>;

  // Output
  outputPath: string | null;
  outputFormat: string;
  outputDuration: number;
  outputWidth: number;
  outputHeight: number;
  outputCodec: string;

  // Timing
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  estimatedDurationSec: number;
  actualDurationSec: number | null;

  // Error
  error: string | null;
  retryCount: number;

  // Quality
  quality: "standard" | "premium" | "max";
  premiumMode: boolean;
}

const renderJobStore = new JsonStore<RenderJob>("render-jobs", "render_job");

export function getAllRenderJobs(): RenderJob[] {
  return renderJobStore.getAll();
}

export function getRenderJob(id: string): RenderJob | null {
  return renderJobStore.getById(id) || null;
}

export function getRenderJobByProject(projectId: string): RenderJob | null {
  const jobs = renderJobStore.query(j => j.projectId === projectId);
  // Return the most recent non-failed job, or null
  const sorted = jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return sorted.find(j => j.status !== "failed") || sorted[0] || null;
}

export function createRenderJob(job: Omit<RenderJob, "id">): RenderJob {
  return renderJobStore.create(job);
}

export function updateRenderJob(id: string, updates: Partial<RenderJob>): RenderJob | null {
  return renderJobStore.update(id, updates);
}

export function deleteRenderJob(id: string): boolean {
  return renderJobStore.delete(id);
}
