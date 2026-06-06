-- UGC Business Video Generator — run in Supabase SQL Editor ONLY if the
-- auto-create (ensureTable via exec_sql) didn't run. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.ugc_projects (
  id text PRIMARY KEY,
  user_id text,
  client_id text,
  business_name text NOT NULL,
  business_type text,
  goal text,
  target_audience text,
  tone text,
  language text DEFAULT 'he',
  duration integer DEFAULT 30,
  style text,
  brand_colors text,
  logo_url text,
  brief_json jsonb,
  result_json jsonb,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ugc_video_inputs (
  id text PRIMARY KEY,
  project_id text,
  selling_points text,
  location text,
  existing_assets text,
  presenter_type text,
  ai_tools_selected jsonb,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ugc_scripts (
  id text PRIMARY KEY,
  project_id text,
  variation_label text,
  hook text,
  full_script text,
  shot_breakdown jsonb,
  captions jsonb,
  cta text,
  status text DEFAULT 'generated',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ugc_prompts (
  id text PRIMARY KEY,
  project_id text,
  variation_label text,
  tool_name text,
  prompt_type text,
  prompt_text text,
  status text DEFAULT 'ready',
  output_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ugc_exports (
  id text PRIMARY KEY,
  project_id text,
  final_video_url text,
  subtitles_url text,
  aspect_ratio text DEFAULT '9:16',
  duration integer,
  created_at timestamptz DEFAULT now()
);

NOTIFY pgrst, 'reload schema';
