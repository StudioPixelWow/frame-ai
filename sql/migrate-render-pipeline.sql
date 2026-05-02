-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  PixelFrameAI — Render Pipeline Migration                      ║
-- ║  Run in: Supabase Dashboard → SQL Editor → New query → Run     ║
-- ║  Safe to run multiple times (IF NOT EXISTS on every statement)  ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ── video_projects table columns ──
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS client_name TEXT DEFAULT '';
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS project_type TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS preset TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS duration_sec INTEGER;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS segments JSONB;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS source_video_key TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS render_output_key TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS thumbnail_key TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS wizard_state JSONB;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS render_payload JSONB;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS end_date TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS render_job_id TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS rendered_at TIMESTAMPTZ;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ── render_jobs table ──
CREATE TABLE IF NOT EXISTS public.render_jobs (
  job_id TEXT PRIMARY KEY,
  project_id TEXT,
  status TEXT DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  stage TEXT,
  result_url TEXT,
  error TEXT,
  metadata JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_render_jobs_project ON public.render_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON public.render_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_projects_status ON public.video_projects(status);
CREATE INDEX IF NOT EXISTS idx_video_projects_client ON public.video_projects(client_id);

-- ── Reload PostgREST schema cache ──
NOTIFY pgrst, 'reload schema';
