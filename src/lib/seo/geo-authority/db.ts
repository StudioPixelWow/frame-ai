/**
 * GEO Authority Center — persistence layer.
 *
 * Creates and reads the dedicated geo_* tables that unify the 15 GEO-authority
 * modules. Tables are auto-created via ensureTable (exec_sql RPC), matching the
 * app's existing pattern; a full SQL fallback lives in add-geo-authority-tables.sql.
 *
 * IDs are TEXT to match the rest of the app. All writes go through the
 * service-role Supabase client (getSupabase).
 */

import { ensureTable, getSupabase } from '@/lib/db/store';

/* ─────────────────────────── DDL ─────────────────────────── */

export const GEO_DDL: Record<string, string> = {
  geo_authority_scores: `
    CREATE TABLE IF NOT EXISTS public.geo_authority_scores (
      id text PRIMARY KEY,
      plan_id text NOT NULL,
      client_id text,
      scope text NOT NULL DEFAULT 'site',          -- 'site' | 'page'
      page_url text,
      overall integer NOT NULL DEFAULT 0,          -- 0-100
      sub_scores jsonb NOT NULL DEFAULT '{}',      -- {topical, entity, citation, internalLinking, brand, schema, contentDepth, aiReadiness, eeat}
      issues jsonb NOT NULL DEFAULT '[]',
      computed_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_auth_scores_plan ON public.geo_authority_scores(plan_id);`,

  geo_recommendations: `
    CREATE TABLE IF NOT EXISTS public.geo_recommendations (
      id text PRIMARY KEY,
      plan_id text NOT NULL,
      client_id text,
      module_id text NOT NULL,                      -- which of the 15 modules raised it
      title text NOT NULL,
      description text,
      priority text DEFAULT 'medium',               -- high | medium | low
      related_page text,
      estimated_impact text,                        -- e.g. "+8 AI Readiness"
      status text DEFAULT 'open',                    -- open | task | dismissed | applied
      created_by text DEFAULT 'ai',
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_recs_plan ON public.geo_recommendations(plan_id);`,

  geo_tasks: `
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
      status text DEFAULT 'todo',                    -- todo | in_progress | done
      approval_required boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_tasks_plan ON public.geo_tasks(plan_id);`,

  geo_generated_drafts: `
    CREATE TABLE IF NOT EXISTS public.geo_generated_drafts (
      id text PRIMARY KEY,
      plan_id text NOT NULL,
      client_id text,
      module_id text NOT NULL,
      kind text NOT NULL,                            -- faq | citation | schema | internal_link | content | entity | brand_mention
      target_page text,
      title text,
      payload jsonb NOT NULL DEFAULT '{}',           -- the actual draft (never auto-published)
      status text DEFAULT 'draft',                    -- draft | approved | applied | rejected
      created_at timestamptz DEFAULT now(),
      approved_at timestamptz,
      applied_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS geo_drafts_plan ON public.geo_generated_drafts(plan_id);`,

  geo_module_results: `
    CREATE TABLE IF NOT EXISTS public.geo_module_results (
      id text PRIMARY KEY,
      plan_id text NOT NULL,
      module_id text NOT NULL,
      result jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS geo_modres_plan ON public.geo_module_results(plan_id, module_id);`,

  geo_logs: `
    CREATE TABLE IF NOT EXISTS public.geo_logs (
      id text PRIMARY KEY,
      plan_id text,
      module_id text,
      level text DEFAULT 'info',
      message text,
      meta jsonb,
      created_at timestamptz DEFAULT now()
    );`,
};

// The complete table set requested for the module (the ones above are actively
// used by code; these are created for completeness and future per-entity storage).
export const GEO_DDL_EXTRA: Record<string, string> = {
  geo_entities: `CREATE TABLE IF NOT EXISTS public.geo_entities (id text PRIMARY KEY, plan_id text, name text, type text, description text, related jsonb, created_at timestamptz DEFAULT now());`,
  geo_faqs: `CREATE TABLE IF NOT EXISTS public.geo_faqs (id text PRIMARY KEY, plan_id text, target_page text, question text, answer text, status text DEFAULT 'draft', created_at timestamptz DEFAULT now());`,
  geo_internal_links: `CREATE TABLE IF NOT EXISTS public.geo_internal_links (id text PRIMARY KEY, plan_id text, from_page text, to_page text, anchor text, status text DEFAULT 'draft', created_at timestamptz DEFAULT now());`,
  geo_citations: `CREATE TABLE IF NOT EXISTS public.geo_citations (id text PRIMARY KEY, plan_id text, target_page text, claim text, source_title text, source_url text, status text DEFAULT 'draft', created_at timestamptz DEFAULT now());`,
  geo_content_gaps: `CREATE TABLE IF NOT EXISTS public.geo_content_gaps (id text PRIMARY KEY, plan_id text, topic text, intent text, source text, draft_id text, created_at timestamptz DEFAULT now());`,
  geo_schema_markup: `CREATE TABLE IF NOT EXISTS public.geo_schema_markup (id text PRIMARY KEY, plan_id text, target_page text, schema_type text, json_ld jsonb, valid boolean, status text DEFAULT 'draft', created_at timestamptz DEFAULT now());`,
  geo_topic_clusters: `CREATE TABLE IF NOT EXISTS public.geo_topic_clusters (id text PRIMARY KEY, plan_id text, pillar text, pillar_url text, children jsonb, authority integer DEFAULT 0, created_at timestamptz DEFAULT now());`,
  geo_competitors: `CREATE TABLE IF NOT EXISTS public.geo_competitors (id text PRIMARY KEY, plan_id text, domain text, name text, covered_topics jsonb, gaps jsonb, created_at timestamptz DEFAULT now());`,
  geo_ai_monitoring_queries: `CREATE TABLE IF NOT EXISTS public.geo_ai_monitoring_queries (id text PRIMARY KEY, plan_id text, platform text, query text, active boolean DEFAULT true, created_at timestamptz DEFAULT now());`,
  geo_ai_monitoring_results: `CREATE TABLE IF NOT EXISTS public.geo_ai_monitoring_results (id text PRIMARY KEY, plan_id text, query_id text, platform text, found boolean, position integer, snippet text, checked_at timestamptz DEFAULT now());`,
};

let ensured = false;
/** Idempotently create every geo_* table. Safe to call on each request. */
export async function ensureGeoTables(): Promise<void> {
  if (ensured) return;
  for (const [name, ddl] of [...Object.entries(GEO_DDL), ...Object.entries(GEO_DDL_EXTRA)]) {
    try { await ensureTable(name, ddl); } catch { /* best-effort; SQL fallback documented */ }
  }
  ensured = true;
}

/* ─────────────────────────── helpers ─────────────────────────── */

const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/* ── Authority scores ── */
export async function saveAuthorityScore(row: {
  planId: string; clientId?: string | null; scope?: string; pageUrl?: string | null;
  overall: number; subScores: Record<string, number>; issues: any[];
}): Promise<void> {
  await ensureGeoTables();
  const sb = getSupabase();
  await sb.from('geo_authority_scores').insert({
    id: rid('gas'), plan_id: row.planId, client_id: row.clientId ?? null,
    scope: row.scope || 'site', page_url: row.pageUrl ?? null,
    overall: Math.round(row.overall), sub_scores: row.subScores, issues: row.issues,
    computed_at: new Date().toISOString(),
  });
}

export async function getLatestAuthorityScore(planId: string, scope = 'site'): Promise<any | null> {
  await ensureGeoTables();
  const sb = getSupabase();
  const { data } = await sb.from('geo_authority_scores').select('*')
    .eq('plan_id', planId).eq('scope', scope)
    .order('computed_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

/* ── Recommendations ── */
export async function replaceRecommendations(planId: string, clientId: string | null, recs: Array<{
  moduleId: string; title: string; description?: string; priority?: string;
  relatedPage?: string; estimatedImpact?: string;
}>): Promise<void> {
  await ensureGeoTables();
  const sb = getSupabase();
  // Keep recs that were already turned into tasks / dismissed; refresh the open ones.
  await sb.from('geo_recommendations').delete().eq('plan_id', planId).eq('status', 'open');
  if (!recs.length) return;
  const rows = recs.map((r) => ({
    id: rid('grec'), plan_id: planId, client_id: clientId,
    module_id: r.moduleId, title: r.title, description: r.description || '',
    priority: r.priority || 'medium', related_page: r.relatedPage || null,
    estimated_impact: r.estimatedImpact || null, status: 'open', created_by: 'ai',
    created_at: new Date().toISOString(),
  }));
  await sb.from('geo_recommendations').insert(rows);
}

export async function listRecommendations(planId: string): Promise<any[]> {
  await ensureGeoTables();
  const sb = getSupabase();
  const { data } = await sb.from('geo_recommendations').select('*')
    .eq('plan_id', planId).order('created_at', { ascending: false });
  return data || [];
}

/* ── Tasks (draft-gated; approval_required defaults true) ── */
export async function createTaskFromRecommendation(recId: string): Promise<any | null> {
  await ensureGeoTables();
  const sb = getSupabase();
  const { data: rec } = await sb.from('geo_recommendations').select('*').eq('id', recId).maybeSingle();
  if (!rec) return null;
  const task = {
    id: rid('gtask'), plan_id: rec.plan_id, client_id: rec.client_id,
    recommendation_id: rec.id, module_id: rec.module_id,
    title: rec.title, description: rec.description, priority: rec.priority,
    related_page: rec.related_page, estimated_impact: rec.estimated_impact,
    status: 'todo', approval_required: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  await sb.from('geo_tasks').insert(task);
  await sb.from('geo_recommendations').update({ status: 'task' }).eq('id', recId);
  return task;
}

export async function listTasks(planId: string): Promise<any[]> {
  await ensureGeoTables();
  const sb = getSupabase();
  const { data } = await sb.from('geo_tasks').select('*')
    .eq('plan_id', planId).order('created_at', { ascending: false });
  return data || [];
}

export async function updateTaskStatus(taskId: string, status: string): Promise<void> {
  await ensureGeoTables();
  const sb = getSupabase();
  await sb.from('geo_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
}

/* ── Drafts (NEVER auto-published — created as draft, applied only on approval) ── */
export async function saveDraft(row: {
  planId: string; clientId?: string | null; moduleId: string; kind: string;
  targetPage?: string; title?: string; payload: any;
}): Promise<string> {
  await ensureGeoTables();
  const sb = getSupabase();
  const id = rid('gdraft');
  await sb.from('geo_generated_drafts').insert({
    id, plan_id: row.planId, client_id: row.clientId ?? null,
    module_id: row.moduleId, kind: row.kind, target_page: row.targetPage || null,
    title: row.title || null, payload: row.payload, status: 'draft',
    created_at: new Date().toISOString(),
  });
  return id;
}

export async function listDrafts(planId: string, moduleId?: string): Promise<any[]> {
  await ensureGeoTables();
  const sb = getSupabase();
  let q = sb.from('geo_generated_drafts').select('*').eq('plan_id', planId);
  if (moduleId) q = q.eq('module_id', moduleId);
  const { data } = await q.order('created_at', { ascending: false });
  return data || [];
}

export async function setDraftStatus(draftId: string, status: 'approved' | 'applied' | 'rejected'): Promise<void> {
  await ensureGeoTables();
  const sb = getSupabase();
  const patch: Record<string, unknown> = { status };
  if (status === 'approved') patch.approved_at = new Date().toISOString();
  if (status === 'applied') patch.applied_at = new Date().toISOString();
  await sb.from('geo_generated_drafts').update(patch).eq('id', draftId);
}

/* ── Module results cache ── */
export async function saveModuleResult(planId: string, moduleId: string, result: any): Promise<void> {
  await ensureGeoTables();
  const sb = getSupabase();
  await sb.from('geo_module_results').insert({
    id: rid('gmr'), plan_id: planId, module_id: moduleId, result,
    created_at: new Date().toISOString(),
  });
}
