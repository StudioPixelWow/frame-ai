-- Video Pipeline Tables
-- Run this migration in Supabase SQL Editor to create the pipeline tables.

-- 1. Pipeline States
CREATE TABLE IF NOT EXISTS public.app_video_pipeline_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Video Versions
CREATE TABLE IF NOT EXISTS public.app_video_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Video Audit Logs
CREATE TABLE IF NOT EXISTS public.app_video_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Hook Analyses
CREATE TABLE IF NOT EXISTS public.app_hook_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. AI Video Analyses
CREATE TABLE IF NOT EXISTS public.app_ai_video_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups by projectId inside JSONB data
CREATE INDEX IF NOT EXISTS idx_pipeline_states_project ON app_video_pipeline_states ((data->>'projectId'));
CREATE INDEX IF NOT EXISTS idx_video_versions_project ON app_video_versions ((data->>'projectId'));
CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON app_video_audit_logs ((data->>'projectId'));
