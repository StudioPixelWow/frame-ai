/**
 * PixelManageAI — Render Job Manager
 *
 * Source of truth: Supabase "render_jobs" table.
 * No file-based storage. No in-memory maps.
 *
 * Table schema (see /api/data/migrate-render-jobs):
 *   job_id      TEXT PRIMARY KEY
 *   project_id  TEXT
 *   status      TEXT NOT NULL DEFAULT 'queued'
 *   progress    INTEGER NOT NULL DEFAULT 0
 *   stage       TEXT
 *   result_url  TEXT
 *   error       TEXT
 *   metadata    JSONB DEFAULT '{}'
 *   created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
 *   updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
 */
import { getSupabase } from "@/lib/db/store";

const tag = "[JobManager]";

/* ── Types ──────────────────────────────────────────────────────────────── */

/** The row shape that lives in Supabase */
export interface RenderJobRow {
  job_id: string;
  project_id: string;
  status: string;
  progress: number;
  stage: string | null;
  result_url: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/* ── Create ─────────────────────────────────────────────────────────────── */

export async function createRenderJob(opts: {
  jobId: string;
  projectId: string;
  metadata?: Record<string, unknown>;
}): Promise<RenderJobRow> {
  const sb = getSupabase();
  const now = new Date().toISOString();

  const row: RenderJobRow = {
    job_id: opts.jobId,
    project_id: opts.projectId,
    status: "queued",
    progress: 0,
    stage: "created",
    result_url: null,
    error: null,
    metadata: opts.metadata ?? {},
    created_at: now,
    updated_at: now,
  };

  console.log(`${tag} INSERT render_jobs: job_id=${row.job_id} project_id=${row.project_id} status=queued`);

  const { error } = await sb.from("render_jobs").insert(row);

  if (error) {
    console.error(`${tag} ❌ INSERT FAILED: ${error.message}`);
    throw new Error(`Failed to persist render job: ${error.message}`);
  }

  console.log(`${tag} ✅ Render job persisted: ${row.job_id}`);
  return row;
}

/* ── Read ───────────────────────────────────────────────────────────────── */

export async function readRenderJob(jobId: string): Promise<RenderJobRow | null> {
  const sb = getSupabase();
  console.log(`${tag} SELECT render_jobs WHERE job_id='${jobId}'`);

  const { data, error } = await sb
    .from("render_jobs")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) {
    console.error(`${tag} ❌ SELECT failed: ${error.message}`);
    return null;
  }

  if (!data) {
    console.warn(`${tag} Job not found: ${jobId}`);
    return null;
  }

  console.log(`${tag} ✅ Job found: ${jobId} status=${data.status} progress=${data.progress}%`);
  return data as RenderJobRow;
}

/* ── Update ─────────────────────────────────────────────────────────────── */

export async function updateRenderJob(
  jobId: string,
  updates: Partial<Pick<RenderJobRow, "status" | "progress" | "stage" | "result_url" | "error" | "metadata">>
): Promise<RenderJobRow | null> {
  const sb = getSupabase();

  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  console.log(`${tag} UPDATE render_jobs SET ${Object.keys(payload).join(",")} WHERE job_id='${jobId}'`);

  const { data, error } = await sb
    .from("render_jobs")
    .update(payload)
    .eq("job_id", jobId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error(`${tag} ❌ UPDATE failed: ${error.message}`);
    return null;
  }

  if (!data) {
    console.warn(`${tag} UPDATE returned no row for ${jobId}`);
    return null;
  }

  console.log(`${tag} ✅ Job updated: ${jobId} status=${data.status} progress=${data.progress}%`);
  return data as RenderJobRow;
}

/* ── Delete ─────────────────────────────────────────────────────────────── */

export async function deleteRenderJob(jobId: string): Promise<boolean> {
  const sb = getSupabase();
  const { error } = await sb.from("render_jobs").delete().eq("job_id", jobId);
  if (error) {
    console.error(`${tag} ❌ DELETE failed: ${error.message}`);
    return false;
  }
  return true;
}

/* ── List ───────────────────────────────────────────────────────────────── */

export async function listRenderJobs(): Promise<RenderJobRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("render_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(`${tag} ❌ LIST failed: ${error.message}`);
    return [];
  }

  return (data ?? []) as RenderJobRow[];
}
