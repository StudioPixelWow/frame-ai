-- Creative PixelAI — fallback SQL (the app auto-creates these via ensureTable/exec_sql;
-- run this ONLY if the tables don't appear after first use).

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
  background_type text,
  placement text,
  scale_mode text,
  padding integer,
  blur_amount integer,
  brightness numeric,
  export_type text,
  created_at timestamptz DEFAULT now()
);

NOTIFY pgrst, 'reload schema';
