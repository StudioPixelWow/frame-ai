/**
 * Rank tracking (up to 150 keywords/plan) + Backlink monitoring (up to 500/client)
 * + site authority metrics (DR/UR/links/referring domains/dofollow) — persistence.
 * Auto-created via ensureTable; SQL fallback in SUPABASE_MANUAL_SETUP.sql.
 */

import { ensureTable, getSupabase } from '@/lib/db/store';

export const RB_DDL: Record<string, string> = {
  geo_tracked_keywords: `
    CREATE TABLE IF NOT EXISTS public.geo_tracked_keywords (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text,
      keyword text NOT NULL, target_url text, country text DEFAULT 'IL', language text DEFAULT 'he',
      intent text, search_volume integer, difficulty integer,
      current_rank integer, previous_rank integer, best_rank integer,
      history jsonb DEFAULT '[]', last_checked timestamptz, created_at timestamptz DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS geo_tkw_uniq ON public.geo_tracked_keywords(plan_id, keyword);`,

  geo_backlinks: `
    CREATE TABLE IF NOT EXISTS public.geo_backlinks (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text,
      source_url text, source_domain text, target_url text, anchor text,
      dofollow boolean DEFAULT true, domain_rating integer,
      first_seen timestamptz, last_seen timestamptz, status text DEFAULT 'active',
      created_at timestamptz DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS geo_bl_uniq ON public.geo_backlinks(plan_id, source_url);`,

  geo_authority_metrics: `
    CREATE TABLE IF NOT EXISTS public.geo_authority_metrics (
      id text PRIMARY KEY, plan_id text NOT NULL, client_id text,
      dr integer DEFAULT 0, ur integer DEFAULT 0,
      total_links integer DEFAULT 0, referring_domains integer DEFAULT 0,
      dofollow_domains integer DEFAULT 0, dofollow_links integer DEFAULT 0,
      source text DEFAULT 'estimated', computed_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_authmet_plan ON public.geo_authority_metrics(plan_id, computed_at);`,
};

let ensured = false;
export async function ensureRbTables(): Promise<void> {
  if (ensured) return;
  for (const [name, ddl] of Object.entries(RB_DDL)) { try { await ensureTable(name, ddl); } catch { /* SQL fallback */ } }
  ensured = true;
}

export const rbId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
export function rbSb() { return getSupabase(); }

export async function listKeywords(planId: string): Promise<any[]> {
  await ensureRbTables();
  const { data } = await rbSb().from('geo_tracked_keywords').select('*').eq('plan_id', planId).order('current_rank', { ascending: true, nullsFirst: false }).limit(200);
  return data || [];
}
export async function listBacklinks(planId: string, limit = 200): Promise<any[]> {
  await ensureRbTables();
  const { data } = await rbSb().from('geo_backlinks').select('*').eq('plan_id', planId).order('last_seen', { ascending: false }).limit(limit);
  return data || [];
}
export async function latestAuthority(planId: string): Promise<any | null> {
  await ensureRbTables();
  const { data } = await rbSb().from('geo_authority_metrics').select('*').eq('plan_id', planId).order('computed_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}
