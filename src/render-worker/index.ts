// ── Vercel guard: prevent this worker from running on Vercel serverless ──
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  console.log("[Worker] Detected Vercel/Lambda — worker disabled. Use Railway.");
  process.exit(0);
}

/**
 * PixelManageAI — Render Worker Entry Point
 *
 * Standalone Node.js process that performs Remotion video rendering.
 * Runs OUTSIDE Next.js / Vercel — on a persistent server with FFmpeg.
 *
 * Start:
 *   npx tsx src/render-worker/index.ts
 *
 * Environment:
 *   SUPABASE_SERVICE_ROLE_KEY  — required
 *   SUPABASE_URL               — optional (has default)
 *
 * Flow:
 *   1. Polls Supabase render_jobs for status="queued"
 *   2. Loads full project composition data (format, segments, subtitles, etc.)
 *   3. Bundles Remotion project (cached after first run)
 *   4. Renders via renderMedia() with all edit data applied
 *   5. Uploads rendered MP4 to Supabase Storage (project-files/outputs/)
 *   6. Updates render_jobs.result_url + video_projects.video_url
 *   7. Sets status to "done"
 *
 * The Next.js API route only creates the job row — it does NOT render.
 */
import { getDb } from "./update-job";
import { startPolling } from "./poll-jobs";

const tag = "[Worker]";

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════");
  console.log(" PixelManageAI Render Worker");
  console.log(" Remotion rendering on persistent server");
  console.log("═══════════════════════════════════════════════");

  // Verify DB connection
  try {
    getDb();
    console.log(`${tag} ✅ Supabase connected`);
  } catch (err) {
    console.error(`${tag} ❌ Cannot connect to Supabase:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }

  startPolling();
}

main().catch((err) => {
  console.error(`${tag} Fatal:`, err);
  process.exit(1);
});
