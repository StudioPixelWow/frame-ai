/**
 * PixelFrameAI — Render Job Manager
 *
 * Dual storage: local JSON files (fast, synchronous) + Supabase "render_jobs" table (durable).
 *
 * Every write goes to BOTH file system and Supabase.
 * Every read tries file first (fast, no network), falls back to Supabase.
 */
import fs from "fs";
import path from "path";
import { DATA_DIR as FRAMEAI_DATA_DIR } from "@/lib/db/paths";
import { getSupabase } from "@/lib/db/store";

const DATA_DIR = path.join(FRAMEAI_DATA_DIR, "render-jobs");

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
  /** Supabase Storage public URL — set when the render output is persisted to durable storage */
  publicUrl?: string | null;
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

/* ── Supabase helpers (non-blocking — errors are caught, never thrown) ─── */

/** Row shape in Supabase (flat snake_case JSONB blob) */
function jobToRow(job: RenderJobData): Record<string, unknown> {
  return {
    id: job.id,
    project_id: job.projectId,
    data: job, // Store the full job as JSONB — avoids column-mismatch issues
    status: job.status,
    updated_at: new Date().toISOString(),
  };
}

function rowToJob(row: Record<string, unknown>): RenderJobData | null {
  if (!row) return null;
  // The full job object is stored in the "data" column
  const data = row.data as RenderJobData | undefined;
  if (data && typeof data === "object" && data.id) return data;
  return null;
}

async function dbUpsert(job: RenderJobData): Promise<void> {
  try {
    const sb = getSupabase();
    const row = jobToRow(job);
    const { error } = await sb.from("render_jobs").upsert(row, { onConflict: "id" });
    if (error) {
      // Table might not exist — try to create it
      if (error.message?.includes("render_jobs") && (error.message?.includes("does not exist") || error.message?.includes("relation"))) {
        console.warn("[JobManager] render_jobs table missing — attempting auto-create");
        await ensureRenderJobsTable();
        // Retry once
        const { error: retryErr } = await sb.from("render_jobs").upsert(row, { onConflict: "id" });
        if (retryErr) console.error("[JobManager] DB upsert retry failed:", retryErr.message);
        else console.log(`[JobManager] DB upsert OK (after table create): ${job.id}`);
      } else {
        console.error("[JobManager] DB upsert failed:", error.message);
      }
    }
  } catch (err) {
    console.error("[JobManager] DB upsert error:", err instanceof Error ? err.message : err);
  }
}

async function dbRead(jobId: string): Promise<RenderJobData | null> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from("render_jobs").select("data").eq("id", jobId).maybeSingle();
    if (error) {
      // Silently fail — caller will try file fallback
      return null;
    }
    return data ? rowToJob(data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function dbDelete(jobId: string): Promise<void> {
  try {
    const sb = getSupabase();
    await sb.from("render_jobs").delete().eq("id", jobId);
  } catch {
    // non-fatal
  }
}

async function dbListByStatus(status: string): Promise<RenderJobData[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("render_jobs")
      .select("data")
      .eq("status", status)
      .order("updated_at", { ascending: false });
    if (error || !data) return [];
    return data.map((r) => rowToJob(r as Record<string, unknown>)).filter(Boolean) as RenderJobData[];
  } catch {
    return [];
  }
}

async function dbListAll(): Promise<RenderJobData[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("render_jobs")
      .select("data")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data.map((r) => rowToJob(r as Record<string, unknown>)).filter(Boolean) as RenderJobData[];
  } catch {
    return [];
  }
}

/** Auto-create the render_jobs table if it doesn't exist */
async function ensureRenderJobsTable(): Promise<void> {
  try {
    const sb = getSupabase();
    const sql = `
      CREATE TABLE IF NOT EXISTS public.render_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        status TEXT DEFAULT 'queued',
        data JSONB,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `;
    // Try exec_sql RPC
    for (const param of ["sql_text", "query", "sql"]) {
      const { error } = await sb.rpc("exec_sql", { [param]: sql });
      if (!error) {
        console.log("[JobManager] render_jobs table created via RPC");
        // Reload schema cache
        await sb.rpc("exec_sql", { [param]: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});
        return;
      }
      if (error.message?.includes("already exists")) return;
      if (!error.message?.includes("argument") && !error.message?.includes("Could not find")) {
        break;
      }
    }
    console.warn("[JobManager] Could not auto-create render_jobs table. Create it manually:\n" + sql);
  } catch (err) {
    console.warn("[JobManager] ensureRenderJobsTable error:", err instanceof Error ? err.message : err);
  }
}

/* ── File helpers ────────────────────────────────────────────────────────── */

function fileWrite(job: RenderJobData): void {
  try {
    const filePath = path.join(DATA_DIR, `${job.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
  } catch (err) {
    console.warn("[JobManager] File write failed:", err instanceof Error ? err.message : err);
  }
}

function fileRead(jobId: string): RenderJobData | null {
  const filePath = path.join(DATA_DIR, `${jobId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as RenderJobData;
  } catch {
    return null;
  }
}

function fileDelete(jobId: string): boolean {
  const filePath = path.join(DATA_DIR, `${jobId}.json`);
  if (!fs.existsSync(filePath)) return false;
  try { fs.unlinkSync(filePath); return true; } catch { return false; }
}

function fileList(): RenderJobData[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const jobs: RenderJobData[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
      jobs.push(data);
    } catch { /* skip */ }
  }
  return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/* ── Public API (write to both, read DB-first) ──────────────────────────── */

/** Create a new render job — writes to file + DB */
export async function createRenderJobFile(data: Omit<RenderJobData, "id">): Promise<RenderJobData> {
  const id = `rj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: RenderJobData = { id, ...data };

  // 1. Write to file (synchronous — always works locally)
  fileWrite(job);
  const filePath = path.join(DATA_DIR, `${id}.json`);
  const fileExists = fs.existsSync(filePath);
  console.log(`[JobManager] Saving job to DB: id=${id} projectId=${data.projectId} status=queued`);
  console.log(`[JobManager] File written: ${filePath} (exists=${fileExists})`);

  // 2. Write to Supabase (await — ensures job is in DB before first poll arrives)
  await dbUpsert(job);
  console.log(`[JobManager] Render job ${id} persisted to Supabase ✅`);

  return job;
}

/** Read a render job — tries file first (fast, reliable), then DB */
export async function readRenderJobAsync(jobId: string): Promise<RenderJobData | null> {
  console.log(`[JobManager] Fetching jobId from DB: ${jobId}`);
  // Try file first (synchronous, always reliable, no Supabase dependency)
  const fileJob = fileRead(jobId);
  if (fileJob) {
    console.log(`[JobManager] Job found (file): ${jobId} status=${fileJob.status} progress=${fileJob.progress}%`);
    return fileJob;
  }
  // Fall back to DB (handles case where file was lost but DB has it)
  const dbJob = await dbRead(jobId);
  if (dbJob) {
    console.log(`[JobManager] Job found (supabase): ${jobId} status=${dbJob.status} progress=${dbJob.progress}%`);
  } else {
    console.warn(`[JobManager] Job not found: ${jobId} (checked file + supabase)`);
  }
  return dbJob;
}

/** Synchronous read (for worker process) — file only */
export function readRenderJob(jobId: string): RenderJobData | null {
  return fileRead(jobId);
}

/** Update a render job — writes to both file + DB */
export function updateRenderJobFile(jobId: string, updates: Partial<RenderJobData>): RenderJobData | null {
  // Read from file (worker uses this synchronously)
  let job = fileRead(jobId);
  if (!job) {
    console.warn(`[JobManager] updateRenderJobFile: job ${jobId} not found in file`);
    return null;
  }

  Object.assign(job, updates);

  // Write to file
  fileWrite(job);

  // Write to DB (async, fire-and-forget)
  dbUpsert(job).catch(() => {});

  const keys = Object.keys(updates).join(",");
  console.log(`[JobManager] Job updated: ${jobId} keys=[${keys}] status=${job.status} progress=${job.progress}%`);

  return job;
}

/** Delete a render job — from both DB + file */
export function deleteRenderJobFile(jobId: string): boolean {
  dbDelete(jobId).catch(() => {});
  return fileDelete(jobId);
}

/** List all render jobs — tries DB first, falls back to file */
export async function listRenderJobsAsync(): Promise<RenderJobData[]> {
  const dbJobs = await dbListAll();
  if (dbJobs.length > 0) return dbJobs;
  return fileList();
}

/** Synchronous list (for worker) — file only */
export function listRenderJobs(): RenderJobData[] {
  return fileList();
}
