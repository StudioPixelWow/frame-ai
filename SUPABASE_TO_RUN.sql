-- PixelManageAI: Supabase setup (10/06/2026). Safe to run multiple times.
-- Paste into Supabase > SQL Editor > Run.

-- 1) GEO Visibility drafts (NEW this release)
CREATE TABLE IF NOT EXISTS public.geo_visibility_drafts (
  id text PRIMARY KEY,
  plan_id text NOT NULL,
  client_id text,
  query_id text,
  query_text text,
  action_type text,
  title text,
  content_html text,
  content_text text,
  meta jsonb,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_vis_draft_plan ON public.geo_visibility_drafts (plan_id, created_at);

-- 2) Google Ads tables
CREATE TABLE IF NOT EXISTS public.app_google_ads_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.app_google_ads_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.app_google_ads_report_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Collection: monthly retainer payments + annual hosting date
CREATE TABLE IF NOT EXISTS public.app_retainer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS annual_payment_date DATE;

NOTIFY pgrst, 'reload schema';
