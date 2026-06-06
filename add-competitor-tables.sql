-- Competitor research — run in Supabase SQL Editor only if auto-create didn't run.

CREATE TABLE IF NOT EXISTS public.client_competitors (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  name text NOT NULL,
  page_id text,
  country text DEFAULT 'IL',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.competitor_ads (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  competitor_id text NOT NULL,
  ad_id text NOT NULL,
  page_name text,
  body text,
  title text,
  snapshot_url text,
  platforms jsonb,
  start_time text,
  active boolean DEFAULT true,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  raw jsonb
);

NOTIFY pgrst, 'reload schema';
