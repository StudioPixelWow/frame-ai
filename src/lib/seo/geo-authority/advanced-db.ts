/**
 * Advanced GEO Growth Center — persistence for the 25 advanced modules.
 *
 * Reuses the core geo_* tables (geo_recommendations, geo_tasks,
 * geo_generated_drafts, geo_module_results) and adds first-class tables only
 * where querying/trend matters. A generic `geo_scores` table stores every score
 * (value 0-100 + explanation + factors + recommendations). Auto-created via
 * ensureTable; SQL fallback in SUPABASE_MANUAL_SETUP.sql.
 */

import { ensureTable, getSupabase } from '@/lib/db/store';

export const ADV_DDL: Record<string, string> = {
  geo_scores: `
    CREATE TABLE IF NOT EXISTS public.geo_scores (
      id text PRIMARY KEY,
      plan_id text NOT NULL,
      client_id text,
      kind text NOT NULL,                 -- which score (ai_trust, geo_opportunity, …)
      scope text DEFAULT 'site',          -- site | page | query | topic
      ref text,                           -- page url / query / topic when scoped
      value integer NOT NULL DEFAULT 0,   -- 0-100
      explanation text,
      factors jsonb DEFAULT '[]',
      recommendations jsonb DEFAULT '[]',
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_scores_plan ON public.geo_scores(plan_id, kind);`,

  geo_opportunities: `
    CREATE TABLE IF NOT EXISTS public.geo_opportunities (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text,
      title text, type text, bucket text,         -- quick_win | strategic | high_effort | lost
      roi integer, difficulty integer, visibility_potential integer,
      citation_potential integer, lead_potential integer, demand integer,
      score integer, related_query text, related_topic text, related_page text,
      status text DEFAULT 'open', created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_opps_plan ON public.geo_opportunities(plan_id);`,

  geo_content_briefs: `
    CREATE TABLE IF NOT EXISTS public.geo_content_briefs (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text,
      title text, target_page text, payload jsonb NOT NULL DEFAULT '{}',
      priority_score integer, status text DEFAULT 'draft', created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_briefs_plan ON public.geo_content_briefs(plan_id);`,

  geo_content_validations: `
    CREATE TABLE IF NOT EXISTS public.geo_content_validations (
      id text PRIMARY KEY, plan_id text NOT NULL,
      target text, score integer, checks jsonb DEFAULT '[]', passed boolean,
      created_at timestamptz DEFAULT now()
    );`,

  geo_answer_simulations: `
    CREATE TABLE IF NOT EXISTS public.geo_answer_simulations (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text,
      query text, platform text, brand_appeared boolean, was_cited boolean,
      who_appeared jsonb, ideal_answer text, missing text, recommendation text,
      score integer, created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_sim_plan ON public.geo_answer_simulations(plan_id);`,

  geo_reputation_checks: `
    CREATE TABLE IF NOT EXISTS public.geo_reputation_checks (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text,
      platform text, sentiment text, accurate boolean, risk_level text,
      issues jsonb, missing_expertise jsonb, description text,
      score integer, created_at timestamptz DEFAULT now()
    );`,

  geo_roadmaps: `
    CREATE TABLE IF NOT EXISTS public.geo_roadmaps (
      id text PRIMARY KEY, plan_id text NOT NULL,
      horizon text, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now()
    );`,

  geo_forecasts: `
    CREATE TABLE IF NOT EXISTS public.geo_forecasts (
      id text PRIMARY KEY, plan_id text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}', confidence integer, created_at timestamptz DEFAULT now()
    );`,

  geo_query_discovery_sets: `
    CREATE TABLE IF NOT EXISTS public.geo_query_discovery_sets (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text,
      query text, query_type text, topic text, target_page text,
      priority text, country text, language text, est_volume text,
      status text DEFAULT 'open', created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_qd_plan ON public.geo_query_discovery_sets(plan_id);`,

  geo_conversation_paths: `
    CREATE TABLE IF NOT EXISTS public.geo_conversation_paths (
      id text PRIMARY KEY, plan_id text NOT NULL,
      seed text, path jsonb, missing_pages jsonb, linking jsonb, funnel jsonb,
      created_at timestamptz DEFAULT now()
    );`,

  geo_citation_opportunities: `
    CREATE TABLE IF NOT EXISTS public.geo_citation_opportunities (
      id text PRIMARY KEY, plan_id text NOT NULL,
      page text, source_type text, gap text, probability integer,
      competitor_cited text, status text DEFAULT 'open', created_at timestamptz DEFAULT now()
    );`,

  geo_brand_memory_snapshots: `
    CREATE TABLE IF NOT EXISTS public.geo_brand_memory_snapshots (
      id text PRIMARY KEY, plan_id text NOT NULL,
      mentions integer, citations integer, topics jsonb, description text,
      created_at timestamptz DEFAULT now()
    );`,

  geo_market_share_snapshots: `
    CREATE TABLE IF NOT EXISTS public.geo_market_share_snapshots (
      id text PRIMARY KEY, plan_id text NOT NULL,
      dimension text, dimension_value text, engine text, share numeric,
      created_at timestamptz DEFAULT now()
    );`,
};

let ensured = false;
export async function ensureAdvancedTables(): Promise<void> {
  if (ensured) return;
  for (const [name, ddl] of Object.entries(ADV_DDL)) {
    try { await ensureTable(name, ddl); } catch { /* SQL fallback documented */ }
  }
  ensured = true;
}

const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/* ── Generic scores ── */
export async function saveScore(row: {
  planId: string; clientId?: string | null; kind: string; scope?: string; ref?: string;
  value: number; explanation?: string; factors?: any[]; recommendations?: any[];
}): Promise<void> {
  await ensureAdvancedTables();
  await getSupabase().from('geo_scores').insert({
    id: rid('gsc'), plan_id: row.planId, client_id: row.clientId ?? null, kind: row.kind,
    scope: row.scope || 'site', ref: row.ref || null, value: Math.round(row.value),
    explanation: row.explanation || '', factors: row.factors || [], recommendations: row.recommendations || [],
    created_at: new Date().toISOString(),
  });
}

export async function latestScores(planId: string): Promise<Record<string, any>> {
  await ensureAdvancedTables();
  const { data } = await getSupabase().from('geo_scores').select('*')
    .eq('plan_id', planId).order('created_at', { ascending: false }).limit(200);
  const out: Record<string, any> = {};
  for (const r of (data || [])) if (!out[r.kind]) out[r.kind] = r; // newest per kind
  return out;
}

/* ── Generic insert/list for first-class advanced tables ── */
export async function insertRows(table: string, planId: string, rows: any[]): Promise<number> {
  if (!rows.length) return 0;
  await ensureAdvancedTables();
  const withIds = rows.map((r) => ({ id: rid('adv'), plan_id: planId, created_at: new Date().toISOString(), ...r }));
  const { error } = await getSupabase().from(table).insert(withIds);
  return error ? 0 : withIds.length;
}

export async function listRows(table: string, planId: string, limit = 100): Promise<any[]> {
  await ensureAdvancedTables();
  const { data } = await getSupabase().from(table).select('*')
    .eq('plan_id', planId).order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

export async function replaceRows(table: string, planId: string, rows: any[]): Promise<number> {
  await ensureAdvancedTables();
  await getSupabase().from(table).delete().eq('plan_id', planId);
  return insertRows(table, planId, rows);
}
