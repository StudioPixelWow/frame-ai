/**
 * Render Worker — DB update helpers
 * Updates render_jobs and video_projects in Supabase.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const tag = "[Worker:DB]";
let _sb: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (_sb) return _sb;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://uaruggdabeyiuppcvbbi.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  _sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return _sb;
}

export interface JobUpdate {
  status?: string;
  progress?: number;
  stage?: string;
  result_url?: string;
  error?: string | null;
}

export async function updateJob(jobId: string, updates: JobUpdate): Promise<void> {
  const sb = getDb();
  const payload = { ...updates, updated_at: new Date().toISOString() };
  const { error } = await sb.from("render_jobs").update(payload).eq("job_id", jobId);
  if (error) {
    console.warn(`${tag} Update failed for ${jobId}: ${error.message}`);
  } else {
    console.log(`${tag} ${jobId}: status=${updates.status || "-"} progress=${updates.progress ?? "-"}%`);
  }
}

export async function updateProject(
  projectId: string,
  outputUrl: string,
  jobId: string,
): Promise<void> {
  const sb = getDb();
  const now = new Date().toISOString();
  const payload = {
    video_url: outputUrl,
    render_output_key: outputUrl,
    render_job_id: jobId,
    rendered_at: now,
    status: "complete",
    updated_at: now,
  };

  console.log(`${tag} Updating video_projects id=${projectId}`);
  const { error } = await sb
    .from("video_projects")
    .update(payload)
    .eq("id", projectId);

  if (error) {
    // Retry without potentially missing columns
    console.warn(`${tag} Update failed: ${error.message} — retrying minimal`);
    const { error: retryErr } = await sb
      .from("video_projects")
      .update({ video_url: outputUrl, status: "complete", updated_at: now })
      .eq("id", projectId);
    if (retryErr) {
      console.error(`${tag} Retry also failed: ${retryErr.message}`);
    } else {
      console.log(`${tag} ✅ Project updated (minimal): video_url=${outputUrl}`);
    }
  } else {
    console.log(`${tag} ✅ Project updated: video_url=${outputUrl} status=complete`);
  }

  // Verify
  const { data: verify } = await sb
    .from("video_projects")
    .select("id, video_url, render_output_key, status")
    .eq("id", projectId)
    .maybeSingle();

  if (verify) {
    console.log(`${tag} VERIFY: video_url=${(verify as any).video_url || "(null)"} status=${(verify as any).status}`);
  }
}
