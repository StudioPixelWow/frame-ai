/**
 * Render Worker — Poll Supabase for queued render jobs
 */
import { getDb } from "./update-job";
import { processJob } from "./process-job";

const tag = "[Worker:Poll]";
const POLL_INTERVAL_MS = 3000;

let isRendering = false;

export async function pollOnce(): Promise<void> {
  if (isRendering) return;

  try {
    const sb = getDb();
    const { data, error } = await sb
      .from("render_jobs")
      .select("job_id")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      console.warn(`${tag} Poll query failed: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      const jobId = data[0].job_id;
      console.log(`${tag} Found queued job: ${jobId}`);
      isRendering = true;
      try {
        await processJob(jobId);
      } finally {
        isRendering = false;
      }
    }
  } catch (err) {
    console.warn(`${tag} Poll error:`, err instanceof Error ? err.message : err);
    isRendering = false;
  }
}

export function startPolling(): void {
  console.log(`${tag} Polling every ${POLL_INTERVAL_MS}ms`);
  setInterval(pollOnce, POLL_INTERVAL_MS);
  // First poll immediately
  pollOnce();
}
