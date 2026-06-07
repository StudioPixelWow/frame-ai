/**
 * GEO AI Visibility — history / diff / alerts / global-index persistence.
 *
 * The "Data Moat" layer: every run snapshots AI answers, diffs them vs the prior
 * run, tracks each citation's lifecycle, classifies source strength, raises
 * alerts, and contributes anonymous aggregates to a cross-client Global Citation
 * Index. Auto-created via ensureTable; SQL fallback in SUPABASE_MANUAL_SETUP.sql.
 */

import { ensureTable, getSupabase } from '@/lib/db/store';

export const VIS_HIST_DDL: Record<string, string> = {
  geo_metric_metadata: `
    CREATE TABLE IF NOT EXISTS public.geo_metric_metadata (
      id text PRIMARY KEY, metric_key text, data_source text, confidence_level integer,
      measurement_type text, last_measured_at timestamptz, calculation_method text
    );`,

  geo_citation_history: `
    CREATE TABLE IF NOT EXISTS public.geo_citation_history (
      id text PRIMARY KEY, plan_id text NOT NULL, cited_url text, cited_domain text,
      first_seen_at timestamptz, last_seen_at timestamptz, total_times_seen integer DEFAULT 0,
      total_days_visible integer DEFAULT 0, current_visibility_status text DEFAULT 'new',
      visibility_trend text DEFAULT 'flat', citation_growth_rate numeric DEFAULT 0,
      citation_loss_count integer DEFAULT 0, engines_seen_on jsonb DEFAULT '[]',
      queries_seen_on jsonb DEFAULT '[]', topics_seen_on jsonb DEFAULT '[]',
      is_own_site boolean DEFAULT false, updated_at timestamptz DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS geo_cithist_uniq ON public.geo_citation_history(plan_id, cited_url);`,

  geo_global_citation_index: `
    CREATE TABLE IF NOT EXISTS public.geo_global_citation_index (
      id text PRIMARY KEY, cited_domain text, page_type text, topic text, industry text,
      language text, country text, ai_engine text, citation_frequency integer DEFAULT 0,
      citation_position_avg numeric DEFAULT 0, source_type text, schema_types_detected jsonb DEFAULT '[]',
      content_structure_detected text, first_seen_at timestamptz, last_seen_at timestamptz
    );
    CREATE UNIQUE INDEX IF NOT EXISTS geo_gci_uniq ON public.geo_global_citation_index(cited_domain, topic, ai_engine);`,

  geo_ai_answer_snapshots: `
    CREATE TABLE IF NOT EXISTS public.geo_ai_answer_snapshots (
      id text PRIMARY KEY, plan_id text NOT NULL, run_id text, query_id text, prompt_id text,
      ai_engine text, response_hash text, normalized_answer text, brand_found boolean,
      recommendation_level text, citations jsonb DEFAULT '[]', competitors jsonb DEFAULT '[]',
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_snap_lookup ON public.geo_ai_answer_snapshots(plan_id, query_id, ai_engine, created_at);`,

  geo_ai_answer_change_events: `
    CREATE TABLE IF NOT EXISTS public.geo_ai_answer_change_events (
      id text PRIMARY KEY, plan_id text NOT NULL, query_id text, prompt_id text, ai_engine text,
      event_type text, severity text, before_value text, after_value text, explanation text,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_chg_plan ON public.geo_ai_answer_change_events(plan_id, created_at);`,

  geo_citation_diffs: `
    CREATE TABLE IF NOT EXISTS public.geo_citation_diffs (
      id text PRIMARY KEY, plan_id text NOT NULL, query_id text, prompt_id text, ai_engine text,
      diff_type text, previous_run_id text, current_run_id text, previous_value text, current_value text,
      impact_score integer DEFAULT 0, severity text, created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_diff_plan ON public.geo_citation_diffs(plan_id, created_at);`,

  geo_visibility_alerts: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_alerts (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text, alert_type text, severity text,
      title text, description text, related_query_id text, related_prompt_id text, related_url text,
      related_competitor text, before_value text, after_value text, detected_at timestamptz DEFAULT now(),
      status text DEFAULT 'new', action_recommendation text, linked_action_item_id text
    );
    CREATE INDEX IF NOT EXISTS geo_alerts_plan ON public.geo_visibility_alerts(plan_id, status, detected_at);`,

  geo_visibility_prompts: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_prompts (
      id text PRIMARY KEY, plan_id text NOT NULL, prompt_text text, parent_query_id text,
      parent_prompt_id text, conversation_depth integer DEFAULT 1, intent_stage text, topic text,
      priority integer DEFAULT 5, expected_answer_type text, target_brand text, target_page_url text,
      status text DEFAULT 'active', created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_prompts_plan ON public.geo_visibility_prompts(plan_id, status);`,
};

// Columns added to the existing citations table for Featured/Primary classification.
const CIT_ALTERS = [
  `ALTER TABLE public.geo_visibility_citations ADD COLUMN IF NOT EXISTS source_classification text DEFAULT 'citation';`,
  `ALTER TABLE public.geo_visibility_citations ADD COLUMN IF NOT EXISTS source_weight integer DEFAULT 1;`,
  `ALTER TABLE public.geo_visibility_citations ADD COLUMN IF NOT EXISTS is_primary_source boolean DEFAULT false;`,
  `ALTER TABLE public.geo_visibility_citations ADD COLUMN IF NOT EXISTS is_featured_source boolean DEFAULT false;`,
  `ALTER TABLE public.geo_visibility_citations ADD COLUMN IF NOT EXISTS classification_reason text;`,
];

let ensured = false;
export async function ensureVisibilityHistoryTables(): Promise<void> {
  if (ensured) return;
  for (const [name, ddl] of Object.entries(VIS_HIST_DDL)) {
    try { await ensureTable(name, ddl); } catch { /* SQL fallback */ }
  }
  // Add classification columns to the existing citations table (idempotent).
  for (const alter of CIT_ALTERS) {
    try { await getSupabase().rpc('exec_sql', { query: alter }); } catch { /* SQL fallback */ }
  }
  ensured = true;
}

export function histSb() { return getSupabase(); }
export const hid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
