/**
 * GEO AI Visibility Center — persistence.
 *
 * The "project" is the existing SeoPlan (plan_id) — we do NOT duplicate the
 * projects/sites concept. Brand profile, queries, runs, responses, mentions,
 * citations, competitors, monthly aggregations and scores all key off plan_id.
 * Auto-created via ensureTable; SQL fallback in SUPABASE_MANUAL_SETUP.sql.
 */

import { ensureTable, getSupabase } from '@/lib/db/store';

export const VIS_DDL: Record<string, string> = {
  geo_visibility_brand_profiles: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_brand_profiles (
      plan_id text PRIMARY KEY, client_id text,
      brand_name text, brand_aliases jsonb DEFAULT '[]', owner_names jsonb DEFAULT '[]',
      expert_names jsonb DEFAULT '[]', domain text, social_handles jsonb DEFAULT '[]',
      location_names jsonb DEFAULT '[]', excluded_terms jsonb DEFAULT '[]',
      updated_at timestamptz DEFAULT now()
    );`,

  geo_visibility_queries: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_queries (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text, query_set text DEFAULT 'default',
      query_text text NOT NULL, topic text, intent text DEFAULT 'informational',
      language text DEFAULT 'he', country text DEFAULT 'IL', city text,
      priority integer DEFAULT 5, estimated_search_volume integer,
      business_importance_score integer DEFAULT 5, target_page_url text,
      status text DEFAULT 'active', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_vis_q_plan ON public.geo_visibility_queries(plan_id, status);`,

  geo_visibility_runs: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_runs (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text, query_set text,
      ai_engine text, run_type text DEFAULT 'manual', status text DEFAULT 'pending',
      started_at timestamptz, completed_at timestamptz, total_queries integer DEFAULT 0,
      successful_queries integer DEFAULT 0, failed_queries integer DEFAULT 0,
      cost_estimate_cents integer DEFAULT 0, tokens_used integer DEFAULT 0,
      mentions integer DEFAULT 0, citations integer DEFAULT 0, visibility_score integer,
      error_message text, created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_vis_run_plan ON public.geo_visibility_runs(plan_id, created_at);`,

  geo_visibility_responses: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_responses (
      id text PRIMARY KEY, run_id text, plan_id text NOT NULL, query_id text, ai_engine text,
      raw_response text, found boolean, position integer, mention_type text,
      latency_ms integer, created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_vis_resp_run ON public.geo_visibility_responses(run_id);`,

  geo_visibility_mentions: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_mentions (
      id text PRIMARY KEY, plan_id text NOT NULL, run_id text, query_id text, response_id text,
      ai_engine text, mention_text text, mention_type text DEFAULT 'brand', position integer,
      sentiment text DEFAULT 'neutral', recommendation_level text DEFAULT 'mentioned',
      confidence_score integer DEFAULT 0, is_exact_match boolean, is_alias_match boolean,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_vis_men_plan ON public.geo_visibility_mentions(plan_id, created_at);`,

  geo_visibility_citations: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_citations (
      id text PRIMARY KEY, plan_id text NOT NULL, run_id text, query_id text, response_id text,
      ai_engine text, cited_url text, cited_domain text, cited_page_title text, citation_position integer,
      is_own_site boolean, is_competitor_site boolean, confidence_score integer DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_vis_cit_plan ON public.geo_visibility_citations(plan_id, created_at);`,

  geo_visibility_competitors: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_competitors (
      id text PRIMARY KEY, plan_id text NOT NULL, competitor_name text, competitor_domain text,
      aliases jsonb DEFAULT '[]', category text, location text, priority integer DEFAULT 5,
      status text DEFAULT 'active', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_vis_comp_plan ON public.geo_visibility_competitors(plan_id);`,

  geo_visibility_competitor_mentions: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_competitor_mentions (
      id text PRIMARY KEY, plan_id text NOT NULL, run_id text, query_id text, ai_engine text,
      competitor_name text, position integer, was_cited boolean, created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_vis_compmen_plan ON public.geo_visibility_competitor_mentions(plan_id, created_at);`,

  geo_visibility_monthly_aggregations: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_monthly_aggregations (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text, month text,
      total_queries_tested integer DEFAULT 0, total_ai_responses integer DEFAULT 0,
      total_mentions integer DEFAULT 0, total_citations integer DEFAULT 0,
      mention_rate numeric DEFAULT 0, citation_rate numeric DEFAULT 0, share_of_ai_voice numeric DEFAULT 0,
      visibility_score integer DEFAULT 0, estimated_ai_reach integer DEFAULT 0,
      top_engine text, top_topic text, strongest_competitor text, biggest_opportunity text,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS geo_vis_agg_uniq ON public.geo_visibility_monthly_aggregations(plan_id, month);`,

  geo_visibility_logs: `
    CREATE TABLE IF NOT EXISTS public.geo_visibility_logs (
      id text PRIMARY KEY, plan_id text, run_id text, level text DEFAULT 'info',
      event_type text, message text, metadata jsonb, created_at timestamptz DEFAULT now()
    );`,
};

let ensured = false;
export async function ensureVisibilityTables(): Promise<void> {
  if (ensured) return;
  for (const [name, ddl] of Object.entries(VIS_DDL)) {
    try { await ensureTable(name, ddl); } catch { /* SQL fallback documented */ }
  }
  ensured = true;
}

export const vid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
export const visMonthKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
export function visSb() { return getSupabase(); }

/* ── Brand profile ── */
export async function getBrandProfile(planId: string): Promise<any | null> {
  await ensureVisibilityTables();
  const { data } = await visSb().from('geo_visibility_brand_profiles').select('*').eq('plan_id', planId).maybeSingle();
  return data || null;
}
export async function upsertBrandProfile(planId: string, patch: Record<string, unknown>): Promise<void> {
  await ensureVisibilityTables();
  const sb = visSb();
  const existing = await getBrandProfile(planId);
  if (existing) await sb.from('geo_visibility_brand_profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('plan_id', planId);
  else await sb.from('geo_visibility_brand_profiles').insert({ plan_id: planId, ...patch, updated_at: new Date().toISOString() });
}

export async function listQueries(planId: string): Promise<any[]> {
  await ensureVisibilityTables();
  const { data } = await visSb().from('geo_visibility_queries').select('*').eq('plan_id', planId).eq('status', 'active').order('priority', { ascending: true });
  return data || [];
}
export async function listCompetitors(planId: string): Promise<any[]> {
  await ensureVisibilityTables();
  const { data } = await visSb().from('geo_visibility_competitors').select('*').eq('plan_id', planId).eq('status', 'active');
  return data || [];
}
export async function listPrompts(planId: string): Promise<any[]> {
  try {
    const { data } = await visSb().from('geo_visibility_prompts').select('*').eq('plan_id', planId).eq('status', 'active').order('conversation_depth', { ascending: true });
    return data || [];
  } catch { return []; }
}
