-- ============================================================================
-- PixelManageAI — Supabase manual setup (run ONCE, copy-paste into SQL editor)
--
-- Everything here is created automatically by the app at runtime (exec_sql RPC),
-- but running it manually guarantees no "table/column does not exist" errors if
-- the auto-create ever fails (e.g. RPC timeout). 100% idempotent — safe to re-run.
--
-- Sections:
--   A. GEO Authority Center tables (geo_*)            ← newest module
--   B. Tasks deliverable columns (portal approved files)
--   C. Storage bucket reminder (NOT SQL — see note)
-- ============================================================================


-- ============================================================================
-- A. GEO AUTHORITY CENTER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geo_authority_scores (
  id text PRIMARY KEY,
  plan_id text NOT NULL,
  client_id text,
  scope text NOT NULL DEFAULT 'site',         -- 'site' | 'page'
  page_url text,
  overall integer NOT NULL DEFAULT 0,         -- 0-100
  sub_scores jsonb NOT NULL DEFAULT '{}',     -- 8 dimensions
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
  status text DEFAULT 'open',                  -- open | task | dismissed | applied
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
  status text DEFAULT 'todo',                  -- todo | in_progress | done
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
  kind text NOT NULL,                          -- faq | citation | schema | internal_link | content | entity | brand_mention
  target_page text,
  title text,
  payload jsonb NOT NULL DEFAULT '{}',         -- the draft itself (NEVER auto-published)
  status text DEFAULT 'draft',                  -- draft | approved | applied | rejected
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

-- Per-entity stores (used by monitoring cron + future per-entity persistence)
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
CREATE INDEX IF NOT EXISTS geo_mon_results_plan ON public.geo_ai_monitoring_results(plan_id, checked_at);


-- ============================================================================
-- B. TASKS — deliverable / portal columns
-- Ensures the portal can show manager-approved files and submitted deliverables.
-- ============================================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS submitted_files jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS files          jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS content_type   text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS adaptations    jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS gantt_item_id  text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS client_id      text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS client_name    text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS notes          text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date       date;


-- ============================================================================
-- C. ADVANCED GEO GROWTH CENTER (25 advanced modules)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geo_scores (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, kind text NOT NULL,
  scope text DEFAULT 'site', ref text, value integer NOT NULL DEFAULT 0,
  explanation text, factors jsonb DEFAULT '[]', recommendations jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_scores_plan ON public.geo_scores(plan_id, kind);

CREATE TABLE IF NOT EXISTS public.geo_opportunities (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, title text, type text, bucket text,
  roi integer, difficulty integer, visibility_potential integer, citation_potential integer,
  lead_potential integer, demand integer, score integer, related_query text, related_topic text,
  related_page text, status text DEFAULT 'open', created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_opps_plan ON public.geo_opportunities(plan_id);

CREATE TABLE IF NOT EXISTS public.geo_content_briefs (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, title text, target_page text,
  payload jsonb NOT NULL DEFAULT '{}', priority_score integer, status text DEFAULT 'draft', created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_briefs_plan ON public.geo_content_briefs(plan_id);

CREATE TABLE IF NOT EXISTS public.geo_content_validations (
  id text PRIMARY KEY, plan_id text NOT NULL, target text, score integer, checks jsonb DEFAULT '[]', passed boolean, created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_answer_simulations (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, query text, platform text,
  brand_appeared boolean, was_cited boolean, who_appeared jsonb, ideal_answer text, missing text,
  recommendation text, score integer, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_sim_plan ON public.geo_answer_simulations(plan_id);

CREATE TABLE IF NOT EXISTS public.geo_reputation_checks (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, platform text, sentiment text,
  accurate boolean, risk_level text, issues jsonb, missing_expertise jsonb, description text,
  score integer, created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_roadmaps (
  id text PRIMARY KEY, plan_id text NOT NULL, horizon text, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_forecasts (
  id text PRIMARY KEY, plan_id text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', confidence integer, created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_query_discovery_sets (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, query text, query_type text, topic text,
  target_page text, priority text, country text, language text, est_volume text, status text DEFAULT 'open', created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_qd_plan ON public.geo_query_discovery_sets(plan_id);

CREATE TABLE IF NOT EXISTS public.geo_conversation_paths (
  id text PRIMARY KEY, plan_id text NOT NULL, seed text, path jsonb, missing_pages jsonb, linking jsonb, funnel jsonb, created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_citation_opportunities (
  id text PRIMARY KEY, plan_id text NOT NULL, page text, source_type text, gap text, probability integer,
  competitor_cited text, status text DEFAULT 'open', created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_brand_memory_snapshots (
  id text PRIMARY KEY, plan_id text NOT NULL, mentions integer, citations integer, topics jsonb, description text, created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_market_share_snapshots (
  id text PRIMARY KEY, plan_id text NOT NULL, dimension text, dimension_value text, engine text, share numeric, created_at timestamptz DEFAULT now()
);

-- Source network (visual map — UI/seed next phase)
CREATE TABLE IF NOT EXISTS public.geo_source_network_nodes (id text PRIMARY KEY, plan_id text, label text, node_type text, url text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.geo_source_network_edges (id text PRIMARY KEY, plan_id text, from_node text, to_node text, weight numeric, created_at timestamptz DEFAULT now());


-- ============================================================================
-- D. GEO AUTOMATION BACKBONE (queue / scheduler / per-client status)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geo_client_automation_status (
  plan_id text PRIMARY KEY, client_id text, client_name text,
  automation_enabled boolean DEFAULT true, modules_enabled jsonb DEFAULT '["geo_refresh"]',
  run_frequency text DEFAULT 'daily', priority integer DEFAULT 5,
  last_run_at timestamptz, next_run_at timestamptz, last_success_at timestamptz, last_failure_at timestamptz,
  current_status text DEFAULT 'active', failure_count integer DEFAULT 0,
  monthly_budget_cents integer DEFAULT 0, monthly_usage_cents integer DEFAULT 0, usage_month text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_automation_jobs (
  id text PRIMARY KEY, idempotency_key text UNIQUE, plan_id text NOT NULL, client_id text,
  job_type text NOT NULL, status text DEFAULT 'queued', priority integer DEFAULT 5,
  attempts integer DEFAULT 0, max_attempts integer DEFAULT 3, scheduled_for timestamptz DEFAULT now(),
  locked_at timestamptz, locked_by text, started_at timestamptz, finished_at timestamptz,
  error text, cost_cents integer DEFAULT 0, result jsonb, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_jobs_status ON public.geo_automation_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS geo_jobs_plan ON public.geo_automation_jobs(plan_id);

CREATE TABLE IF NOT EXISTS public.geo_automation_schedules (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, job_type text NOT NULL,
  frequency text DEFAULT 'daily', enabled boolean DEFAULT true, next_run_at timestamptz,
  last_run_at timestamptz, priority integer DEFAULT 5, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_sched_plan ON public.geo_automation_schedules(plan_id, job_type);

CREATE TABLE IF NOT EXISTS public.geo_automation_runs (
  id text PRIMARY KEY, job_id text, plan_id text NOT NULL, client_id text, job_type text,
  status text, started_at timestamptz, finished_at timestamptz, duration_ms integer,
  cost_cents integer DEFAULT 0, summary jsonb, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_runs_plan ON public.geo_automation_runs(plan_id, created_at);

CREATE TABLE IF NOT EXISTS public.geo_automation_run_logs (
  id text PRIMARY KEY, run_id text, job_id text, plan_id text, level text DEFAULT 'info',
  message text, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_runlogs_run ON public.geo_automation_run_logs(run_id);

CREATE TABLE IF NOT EXISTS public.geo_job_failures (
  id text PRIMARY KEY, job_id text, plan_id text, job_type text, error text, attempt integer, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_failures_plan ON public.geo_job_failures(plan_id, created_at);

CREATE TABLE IF NOT EXISTS public.geo_job_locks (
  lock_key text PRIMARY KEY, locked_by text, locked_at timestamptz, expires_at timestamptz
);


-- ============================================================================
-- E. GEO AI VISIBILITY CENTER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geo_visibility_brand_profiles (
  plan_id text PRIMARY KEY, client_id text, brand_name text, brand_aliases jsonb DEFAULT '[]',
  owner_names jsonb DEFAULT '[]', expert_names jsonb DEFAULT '[]', domain text,
  social_handles jsonb DEFAULT '[]', location_names jsonb DEFAULT '[]', excluded_terms jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_visibility_queries (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, query_set text DEFAULT 'default',
  query_text text NOT NULL, topic text, intent text DEFAULT 'informational', language text DEFAULT 'he',
  country text DEFAULT 'IL', city text, priority integer DEFAULT 5, estimated_search_volume integer,
  business_importance_score integer DEFAULT 5, target_page_url text, status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_vis_q_plan ON public.geo_visibility_queries(plan_id, status);

CREATE TABLE IF NOT EXISTS public.geo_visibility_runs (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, query_set text, ai_engine text,
  run_type text DEFAULT 'manual', status text DEFAULT 'pending', started_at timestamptz, completed_at timestamptz,
  total_queries integer DEFAULT 0, successful_queries integer DEFAULT 0, failed_queries integer DEFAULT 0,
  cost_estimate_cents integer DEFAULT 0, tokens_used integer DEFAULT 0, mentions integer DEFAULT 0,
  citations integer DEFAULT 0, visibility_score integer, error_message text, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_vis_run_plan ON public.geo_visibility_runs(plan_id, created_at);

CREATE TABLE IF NOT EXISTS public.geo_visibility_responses (
  id text PRIMARY KEY, run_id text, plan_id text NOT NULL, query_id text, ai_engine text, raw_response text,
  found boolean, position integer, mention_type text, latency_ms integer, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_vis_resp_run ON public.geo_visibility_responses(run_id);

CREATE TABLE IF NOT EXISTS public.geo_visibility_mentions (
  id text PRIMARY KEY, plan_id text NOT NULL, run_id text, query_id text, response_id text, ai_engine text,
  mention_text text, mention_type text DEFAULT 'brand', position integer, sentiment text DEFAULT 'neutral',
  recommendation_level text DEFAULT 'mentioned', confidence_score integer DEFAULT 0, is_exact_match boolean,
  is_alias_match boolean, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_vis_men_plan ON public.geo_visibility_mentions(plan_id, created_at);

CREATE TABLE IF NOT EXISTS public.geo_visibility_citations (
  id text PRIMARY KEY, plan_id text NOT NULL, run_id text, query_id text, response_id text, ai_engine text,
  cited_url text, cited_domain text, cited_page_title text, citation_position integer, is_own_site boolean,
  is_competitor_site boolean, confidence_score integer DEFAULT 0, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_vis_cit_plan ON public.geo_visibility_citations(plan_id, created_at);

CREATE TABLE IF NOT EXISTS public.geo_visibility_competitors (
  id text PRIMARY KEY, plan_id text NOT NULL, competitor_name text, competitor_domain text, aliases jsonb DEFAULT '[]',
  category text, location text, priority integer DEFAULT 5, status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_vis_comp_plan ON public.geo_visibility_competitors(plan_id);

CREATE TABLE IF NOT EXISTS public.geo_visibility_competitor_mentions (
  id text PRIMARY KEY, plan_id text NOT NULL, run_id text, query_id text, ai_engine text, competitor_name text,
  position integer, was_cited boolean, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_vis_compmen_plan ON public.geo_visibility_competitor_mentions(plan_id, created_at);

CREATE TABLE IF NOT EXISTS public.geo_visibility_monthly_aggregations (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, month text, total_queries_tested integer DEFAULT 0,
  total_ai_responses integer DEFAULT 0, total_mentions integer DEFAULT 0, total_citations integer DEFAULT 0,
  mention_rate numeric DEFAULT 0, citation_rate numeric DEFAULT 0, share_of_ai_voice numeric DEFAULT 0,
  visibility_score integer DEFAULT 0, estimated_ai_reach integer DEFAULT 0, top_engine text, top_topic text,
  strongest_competitor text, biggest_opportunity text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS geo_vis_agg_uniq ON public.geo_visibility_monthly_aggregations(plan_id, month);

CREATE TABLE IF NOT EXISTS public.geo_visibility_logs (
  id text PRIMARY KEY, plan_id text, run_id text, level text DEFAULT 'info', event_type text, message text,
  metadata jsonb, created_at timestamptz DEFAULT now()
);


-- ============================================================================
-- F. GEO AI VISIBILITY — HISTORY / DIFF / ALERTS / GLOBAL INDEX (Data Moat)
-- ============================================================================

-- Source-strength classification columns on the existing citations table
ALTER TABLE public.geo_visibility_citations ADD COLUMN IF NOT EXISTS source_classification text DEFAULT 'citation';
ALTER TABLE public.geo_visibility_citations ADD COLUMN IF NOT EXISTS source_weight integer DEFAULT 1;
ALTER TABLE public.geo_visibility_citations ADD COLUMN IF NOT EXISTS is_primary_source boolean DEFAULT false;
ALTER TABLE public.geo_visibility_citations ADD COLUMN IF NOT EXISTS is_featured_source boolean DEFAULT false;
ALTER TABLE public.geo_visibility_citations ADD COLUMN IF NOT EXISTS classification_reason text;

CREATE TABLE IF NOT EXISTS public.geo_metric_metadata (
  id text PRIMARY KEY, metric_key text, data_source text, confidence_level integer,
  measurement_type text, last_measured_at timestamptz, calculation_method text
);

CREATE TABLE IF NOT EXISTS public.geo_citation_history (
  id text PRIMARY KEY, plan_id text NOT NULL, cited_url text, cited_domain text,
  first_seen_at timestamptz, last_seen_at timestamptz, total_times_seen integer DEFAULT 0,
  total_days_visible integer DEFAULT 0, current_visibility_status text DEFAULT 'new',
  visibility_trend text DEFAULT 'flat', citation_growth_rate numeric DEFAULT 0,
  citation_loss_count integer DEFAULT 0, engines_seen_on jsonb DEFAULT '[]',
  queries_seen_on jsonb DEFAULT '[]', topics_seen_on jsonb DEFAULT '[]',
  is_own_site boolean DEFAULT false, updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS geo_cithist_uniq ON public.geo_citation_history(plan_id, cited_url);

CREATE TABLE IF NOT EXISTS public.geo_global_citation_index (
  id text PRIMARY KEY, cited_domain text, page_type text, topic text, industry text,
  language text, country text, ai_engine text, citation_frequency integer DEFAULT 0,
  citation_position_avg numeric DEFAULT 0, source_type text, schema_types_detected jsonb DEFAULT '[]',
  content_structure_detected text, first_seen_at timestamptz, last_seen_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS geo_gci_uniq ON public.geo_global_citation_index(cited_domain, topic, ai_engine);

CREATE TABLE IF NOT EXISTS public.geo_ai_answer_snapshots (
  id text PRIMARY KEY, plan_id text NOT NULL, run_id text, query_id text, prompt_id text,
  ai_engine text, response_hash text, normalized_answer text, brand_found boolean,
  recommendation_level text, citations jsonb DEFAULT '[]', competitors jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_snap_lookup ON public.geo_ai_answer_snapshots(plan_id, query_id, ai_engine, created_at);

CREATE TABLE IF NOT EXISTS public.geo_ai_answer_change_events (
  id text PRIMARY KEY, plan_id text NOT NULL, query_id text, prompt_id text, ai_engine text,
  event_type text, severity text, before_value text, after_value text, explanation text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_chg_plan ON public.geo_ai_answer_change_events(plan_id, created_at);

CREATE TABLE IF NOT EXISTS public.geo_citation_diffs (
  id text PRIMARY KEY, plan_id text NOT NULL, query_id text, prompt_id text, ai_engine text,
  diff_type text, previous_run_id text, current_run_id text, previous_value text, current_value text,
  impact_score integer DEFAULT 0, severity text, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_diff_plan ON public.geo_citation_diffs(plan_id, created_at);

CREATE TABLE IF NOT EXISTS public.geo_visibility_alerts (
  id text PRIMARY KEY, plan_id text NOT NULL, client_id text, alert_type text, severity text,
  title text, description text, related_query_id text, related_prompt_id text, related_url text,
  related_competitor text, before_value text, after_value text, detected_at timestamptz DEFAULT now(),
  status text DEFAULT 'new', action_recommendation text, linked_action_item_id text
);
CREATE INDEX IF NOT EXISTS geo_alerts_plan ON public.geo_visibility_alerts(plan_id, status, detected_at);

CREATE TABLE IF NOT EXISTS public.geo_visibility_prompts (
  id text PRIMARY KEY, plan_id text NOT NULL, prompt_text text, parent_query_id text,
  parent_prompt_id text, conversation_depth integer DEFAULT 1, intent_stage text, topic text,
  priority integer DEFAULT 5, expected_answer_type text, target_brand text, target_page_url text,
  status text DEFAULT 'active', created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_prompts_plan ON public.geo_visibility_prompts(plan_id, status);


-- ============================================================================
-- G. STORAGE BUCKET (not SQL — do this in the dashboard, once)
-- ----------------------------------------------------------------------------
-- The portal/file uploads use a Storage bucket named:  project-files
-- If it doesn't exist:  Supabase Dashboard → Storage → New bucket
--   name: project-files   |   Public bucket: ON (so previews/links work)
-- ============================================================================
