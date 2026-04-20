/**
 * GET /api/data/migrate-render-jobs
 *
 * Creates the render_jobs table in Supabase.
 * Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS.
 *
 * Required columns:
 *   job_id        TEXT PRIMARY KEY
 *   project_id    TEXT
 *   status        TEXT NOT NULL DEFAULT 'queued'
 *   progress      INTEGER NOT NULL DEFAULT 0
 *   stage         TEXT
 *   result_url    TEXT
 *   error         TEXT
 *   metadata      JSONB DEFAULT '{}'::jsonb
 *   created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
 *   updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
 */

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/store";

export const dynamic = "force-dynamic";

const DDL = `
CREATE TABLE IF NOT EXISTS public.render_jobs (
  job_id      TEXT PRIMARY KEY,
  project_id  TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',
  progress    INTEGER NOT NULL DEFAULT 0,
  stage       TEXT,
  result_url  TEXT,
  error       TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON public.render_jobs (status);
CREATE INDEX IF NOT EXISTS idx_render_jobs_project_id ON public.render_jobs (project_id);

NOTIFY pgrst, 'reload schema';
`;

export async function GET() {
  const sb = getSupabase();
  const tag = "[migrate-render-jobs]";

  // Strategy 1: Try exec_sql RPC
  for (const param of ["query", "sql_text", "sql"]) {
    try {
      const { error } = await sb.rpc("exec_sql", { [param]: DDL });
      if (!error) {
        console.log(`${tag} ✅ render_jobs table created via exec_sql(${param})`);
        return NextResponse.json({ success: true, method: `exec_sql(${param})` });
      }
      if (error.message?.includes("already exists")) {
        console.log(`${tag} ✅ render_jobs table already exists`);
        return NextResponse.json({ success: true, method: "already_exists" });
      }
      // If param name is wrong, try next
      if (error.message?.includes("argument") || error.message?.includes("Could not find")) {
        continue;
      }
      console.warn(`${tag} exec_sql(${param}) failed: ${error.message}`);
    } catch (err) {
      console.warn(`${tag} exec_sql(${param}) threw:`, err instanceof Error ? err.message : err);
    }
  }

  // Strategy 2: Try inserting a dummy row to verify the table exists
  try {
    const { error } = await sb.from("render_jobs").select("job_id").limit(0);
    if (!error) {
      console.log(`${tag} ✅ render_jobs table already accessible`);
      return NextResponse.json({ success: true, method: "already_accessible" });
    }
  } catch { /* ignore */ }

  // Strategy 3: Return the SQL for manual execution
  console.error(`${tag} ❌ Could not auto-create render_jobs. Run SQL manually in Supabase Dashboard.`);
  return NextResponse.json({
    success: false,
    error: "exec_sql RPC not available. Run this SQL in Supabase Dashboard → SQL Editor:",
    sql: DDL,
  }, { status: 500 });
}
