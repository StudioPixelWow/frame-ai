-- Migration: Create render_jobs table for durable render job tracking.
-- Date: 2026-04-19
-- Safe to run multiple times — uses IF NOT EXISTS.
--
-- Context:
--   Render jobs were previously stored as JSON files on the local filesystem.
--   This failed on serverless (Vercel) where /tmp is ephemeral between requests.
--   Moving to Supabase ensures the polling endpoint can always find the job.

CREATE TABLE IF NOT EXISTS public.render_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  status TEXT DEFAULT 'queued',
  data JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for polling by status (worker queries for "queued" jobs)
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON public.render_jobs (status);

-- Index for looking up jobs by project
CREATE INDEX IF NOT EXISTS idx_render_jobs_project_id ON public.render_jobs (project_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
