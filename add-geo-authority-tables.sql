-- ============================================================================
-- GEO Authority Center — database migration
-- Run this in Supabase SQL editor if the auto-create (exec_sql RPC) didn't run.
-- All tables use TEXT ids to match the rest of the app. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geo_authority_scores (
  id text PRIMARY KEY,
  plan_id text NOT NULL,
  client_id text,
  scope text NOT NULL DEFAULT 'site',
  page_url text,
  overall integer NOT NULL DEFAULT 0,
  sub_scores jsonb NOT NULL DEFAULT '{}',
  issues jsonb NOT NULL DEFAULT '[]',
  computed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_auth_scores_plan ON public.geo_authority_scores(plan_id);

CREATE TABLE IF NOT EXISTS public.geo_recommendations (
  id text PRIMARY KEY,
  plan_id text NOT NULL,
  client_id text,
  module_id text NOT NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium',
  related_page text,
  estimated_impact text,
  status text DEFAULT 'open',
  created_by text DEFAULT 'ai',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_recs_plan ON public.geo_recommendations(plan_id);

CREATE TABLE IF NOT EXISTS public.geo_tasks (
  id text PRIMARY KEY,
  plan_id text NOT NULL,
  client_id text,
  recommendation_id text,
  module_id text,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium',
  related_page text,
  estimated_impact text,
  status text DEFAULT 'todo',
  approval_required boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_tasks_plan ON public.geo_tasks(plan_id);

CREATE TABLE IF NOT EXISTS public.geo_generated_drafts (
  id text PRIMARY KEY,
  plan_id text NOT NULL,
  client_id text,
  module_id text NOT NULL,
  kind text NOT NULL,
  target_page text,
  title text,
  payload jsonb NOT NULL DEFAULT '{}',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  applied_at timestamptz
);
CREATE INDEX IF NOT EXISTS geo_drafts_plan ON public.geo_generated_drafts(plan_id);

CREATE TABLE IF NOT EXISTS public.geo_module_results (
  id text PRIMARY KEY,
  plan_id text NOT NULL,
  module_id text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_modres_plan ON public.geo_module_results(plan_id, module_id);

CREATE TABLE IF NOT EXISTS public.geo_logs (
  id text PRIMARY KEY, plan_id text, module_id text, level text DEFAULT 'info',
  message text, meta jsonb, created_at timestamptz DEFAULT now()
);

-- Per-entity stores (created for completeness / future use)
CREATE TABLE IF NOT EXISTS public.geo_entities (id text PRIMARY KEY, plan_id text, name text, type text, description text, related jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.geo_faqs (id text PRIMARY KEY, plan_id text, target_page text, question text, answer text, status text DEFAULT 'draft', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.geo_internal_links (id text PRIMARY KEY, plan_id text, from_page text, to_page text, anchor text, status text DEFAULT 'draft', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.geo_citations (id text PRIMARY KEY, plan_id text, target_page text, claim text, source_title text, source_url text, status text DEFAULT 'draft', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.geo_content_gaps (id text PRIMARY KEY, plan_id text, topic text, intent text, source text, draft_id text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.geo_schema_markup (id text PRIMARY KEY, plan_id text, target_page text, schema_type text, json_ld jsonb, valid boolean, status text DEFAULT 'draft', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.geo_topic_clusters (id text PRIMARY KEY, plan_id text, pillar text, pillar_url text, children jsonb, authority integer DEFAULT 0, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.geo_competitors (id text PRIMARY KEY, plan_id text, domain text, name text, covered_topics jsonb, gaps jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.geo_ai_monitoring_queries (id text PRIMARY KEY, plan_id text, platform text, query text, active boolean DEFAULT true, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.geo_ai_monitoring_results (id text PRIMARY KEY, plan_id text, query_id text, platform text, found boolean, position integer, snippet text, checked_at timestamptz DEFAULT now());
