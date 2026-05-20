-- ============================================================
-- ALL Missing Tables — Run in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================================

-- ── Podcast Engine Tables ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.podcast_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  client_id UUID,
  title TEXT NOT NULL,
  show_name TEXT,
  guest_names TEXT[],
  language TEXT DEFAULT 'he',
  source_file_path TEXT NOT NULL,
  source_file_size BIGINT,
  duration_seconds INTEGER,
  audio_file_path TEXT,
  status TEXT DEFAULT 'uploaded',
  processing_progress JSONB DEFAULT '{}',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.podcast_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL,
  provider TEXT,
  language TEXT,
  full_text TEXT,
  segments JSONB,
  speaker_labels JSONB,
  chunk_index INTEGER DEFAULT 0,
  chunk_start_time FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.podcast_clip_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL,
  title TEXT NOT NULL,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  transcript_excerpt TEXT,
  topic_tags TEXT[] DEFAULT '{}',
  viral_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  hook_score INTEGER DEFAULT 0,
  reasoning TEXT DEFAULT '',
  is_selected BOOLEAN DEFAULT false,
  user_adjusted_start FLOAT,
  user_adjusted_end FLOAT,
  format_config JSONB,
  hook_package JSONB,
  brand_preset_id UUID,
  viral_style TEXT,
  timeline_edits JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.podcast_rendered_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_candidate_id UUID NOT NULL,
  episode_id UUID NOT NULL,
  render_job_id UUID,
  output_format TEXT DEFAULT '16:9',
  output_file_path TEXT,
  output_file_size BIGINT,
  duration_seconds FLOAT,
  priority INTEGER DEFAULT 2,
  status TEXT DEFAULT 'queued',
  render_config JSONB DEFAULT '{}',
  social_package JSONB,
  thumbnail_paths TEXT[],
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID,
  name TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  intro_path TEXT,
  outro_path TEXT,
  logo_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── App Data Tables (500 errors) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_employee_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_project_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_project_id TEXT,
  client_id TEXT,
  milestone_id TEXT,
  title TEXT,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_type TEXT,
  is_due BOOLEAN NOT NULL DEFAULT false,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Refresh PostgREST schema cache ──────────────────────────
NOTIFY pgrst, 'reload schema';
