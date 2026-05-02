-- Migration: Ensure video_projects has every column the app expects.
-- Date: 2026-04-19
-- Safe to run multiple times — every statement uses IF NOT EXISTS.
--
-- Context:
--   The app code (projects route.ts) selects/inserts 24 columns.
--   If any column is missing, Supabase returns:
--     "Could not find the '<column>' column of 'video_projects'"
--   This migration adds every column the app expects.

-- ── Text columns ──────────────────────────────────────────────────────────

ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS name                TEXT DEFAULT '';
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS client_id           TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS client_name         TEXT DEFAULT '';
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS status              TEXT DEFAULT 'draft';
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS description         TEXT DEFAULT '';
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS project_type        TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS format              TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS preset              TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS source_video_key    TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS render_output_key   TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS thumbnail_key       TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS video_url           TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS thumbnail_url       TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS start_date          TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS end_date            TEXT;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;

-- ── Integer columns ───────────────────────────────────────────────────────

ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS duration_sec        INTEGER;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS duration            INTEGER;

-- ── JSONB columns ─────────────────────────────────────────────────────────

ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS segments            JSONB;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS wizard_state        JSONB;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS render_payload      JSONB;

-- ── Timestamp columns ─────────────────────────────────────────────────────

ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT now();

-- ── Reload PostgREST schema cache ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
