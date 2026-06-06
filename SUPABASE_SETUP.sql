-- ============================================================================
-- PixelManageAI — consolidated Supabase setup
-- Run this ENTIRE file in Supabase → SQL Editor. It is idempotent (safe to
-- re-run). It creates every table/column the newer features rely on, in case
-- the app's auto-create (exec_sql) didn't run.
-- ============================================================================

-- ── 1) tasks: extra columns (submitted vs reference files, content type, etc.) ──
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS notes           text DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS client_name     text DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority        text DEFAULT 'medium';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date        text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description     text DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS gantt_item_id   text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS files           jsonb DEFAULT '[]'::jsonb;  -- reference / helper files
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS submitted_files jsonb DEFAULT '[]'::jsonb;  -- employee's submitted deliverable
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS content_type    text;                        -- post | story | reel
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS adaptations     jsonb;                       -- AI size adaptations

-- ── 2) Per-client caption style (video editor preset) ──
CREATE TABLE IF NOT EXISTS public.app_client_caption_styles (
  client_id  text PRIMARY KEY,
  style      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- ── 3) Creative PixelAI (size adaptations) ──
CREATE TABLE IF NOT EXISTS public.creative_adaptations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'admin',
  client_id text,
  campaign_id text,
  original_asset_url text NOT NULL,
  original_file_name text,
  original_width integer NOT NULL,
  original_height integer NOT NULL,
  original_mime_type text,
  openai_analysis_json jsonb,
  selected_formats text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.creative_adaptation_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adaptation_id uuid NOT NULL REFERENCES public.creative_adaptations(id) ON DELETE CASCADE,
  output_format text NOT NULL,
  output_width integer NOT NULL,
  output_height integer NOT NULL,
  output_asset_url text NOT NULL,
  background_type text, placement text, scale_mode text,
  padding integer, blur_amount integer, brightness numeric, export_type text,
  created_at timestamptz DEFAULT now()
);

-- ── 4) UGC Business Video Generator ──
CREATE TABLE IF NOT EXISTS public.ugc_projects (
  id text PRIMARY KEY, user_id text, client_id text,
  business_name text NOT NULL, business_type text, goal text, target_audience text,
  tone text, language text DEFAULT 'he', duration integer DEFAULT 30, style text,
  brand_colors text, logo_url text, brief_json jsonb, result_json jsonb,
  status text DEFAULT 'draft', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ugc_video_inputs (
  id text PRIMARY KEY, project_id text, selling_points text, location text,
  existing_assets text, presenter_type text, ai_tools_selected jsonb, notes text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ugc_scripts (
  id text PRIMARY KEY, project_id text, variation_label text, hook text,
  full_script text, shot_breakdown jsonb, captions jsonb, cta text,
  status text DEFAULT 'generated', created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ugc_prompts (
  id text PRIMARY KEY, project_id text, variation_label text, tool_name text,
  prompt_type text, prompt_text text, status text DEFAULT 'ready', output_url text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ugc_exports (
  id text PRIMARY KEY, project_id text, final_video_url text, subtitles_url text,
  aspect_ratio text DEFAULT '9:16', duration integer, created_at timestamptz DEFAULT now()
);

-- ── 5) Competitor research ──
CREATE TABLE IF NOT EXISTS public.client_competitors (
  id text PRIMARY KEY, client_id text NOT NULL, name text NOT NULL,
  page_id text, country text DEFAULT 'IL', notes text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.competitor_ads (
  id text PRIMARY KEY, client_id text NOT NULL, competitor_id text NOT NULL, ad_id text NOT NULL,
  page_name text, body text, title text, snapshot_url text, platforms jsonb, start_time text,
  active boolean DEFAULT true, first_seen timestamptz DEFAULT now(), last_seen timestamptz DEFAULT now(), raw jsonb
);

-- ── Reload PostgREST schema cache so the API sees the new columns/tables ──
NOTIFY pgrst, 'reload schema';
