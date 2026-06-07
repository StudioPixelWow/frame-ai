/**
 * GEO AI Visibility Center API.
 *
 * GET  → dashboard: monthly aggregations (trend), latest run, mentions,
 *        citations, competitors, topic breakdown, score, opportunities, engine
 *        availability (measured vs mock).
 * POST → { action }:
 *        'gen_queries'                     auto-create queries from the plan
 *        'add_query' / 'update_query' / 'delete_query'
 *        'update_brand'  patch{...}        brand profile
 *        'add_competitor' / 'delete_competitor'
 *        'cost_preview'                    estimated cost/time for a manual run
 *        'run_now'  engines?, queryLimit?  manual measured run (cost-gated)
 *        'enable_automation' frequency?    add 'ai_visibility' to the client's schedule
 *
 * Staff only. Pure measurement — never changes a website.
 */

import { NextRequest } from 'next/server';
import { ok, err, loadPlan, notFound, requireStaff, withErrorBoundary } from '@/lib/seo/api-helpers';
import { ensureVisibilityTables, visSb, vid, getBrandProfile, upsertBrandProfile, listQueries, listCompetitors } from '@/lib/seo/geo-visibility/db';
import { runVisibilityRun, estimateRunCostCents, generateQueriesFromPlan, ensureBrandProfile } from '@/lib/seo/geo-visibility/run';
import { availableEngines, VIS_ENGINES } from '@/lib/seo/geo-visibility/provider';
import { getApiStatus } from '@/lib/seo/platform-apis';

async function dashboard(planId: string) {
  await ensureVisibilityTables();
  const sb = visSb();
  const [agg, runs, mentions, citations, compMentions, queries, competitors, brand] = await Promise.all([
    sb.from('geo_visibility_monthly_aggregations').select('*').eq('plan_id', planId).order('month', { ascending: true }).then((r) => r.data || []),
    sb.from('geo_visibility_runs').select('*').eq('plan_id', planId).order('created_at', { ascending: false }).limit(20).then((r) => r.data || []),
    sb.from('geo_visibility_mentions').select('*').eq('plan_id', planId).order('created_at', { ascending: false }).limit(100).then((r) => r.data || []),
    sb.from('geo_visibility_citations').select('*').eq('plan_id', planId).order('created_at', { ascending: false }).limit(100).then((r) => r.data || []),
    sb.from('geo_visibility_competitor_mentions').select('*').eq('plan_id', planId).order('created_at', { ascending: false }).limit(200).then((r) => r.data || []),
    listQueries(planId), listCompetitors(planId), getBrandProfile(planId),
  ]);

  // Topic breakdown from queries × mentions.
  const qById = new Map(queries.map((q: any) => [q.id, q]));
  const topicStats: Record<string, { topic: string; queries: number; mentions: number }> = {};
  for (const q of queries) { const t = q.topic || q.query_text; (topicStats[t] ||= { topic: t, queries: 0, mentions: 0 }).queries++; }
  for (const m of mentions) { const q = qById.get(m.query_id) as any; const t = q?.topic || q?.query_text || '—'; (topicStats[t] ||= { topic: t, queries: 0, mentions: 0 }).mentions++; }

  // Citation pages (own site) ranked.
  const pageCounts: Record<string, number> = {};
  for (const c of citations) if (c.is_own_site) pageCounts[c.cited_url] = (pageCounts[c.cited_url] || 0) + 1;
  const citationPages = Object.entries(pageCounts).map(([url, count]) => ({ url, count })).sort((a, b) => b.count - a.count).slice(0, 20);

  // Competitor leaderboard.
  const compCounts: Record<string, number> = {};
  for (const cm of compMentions) compCounts[cm.competitor_name] = (compCounts[cm.competitor_name] || 0) + 1;
  const competitorLeaderboard = Object.entries(compCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Opportunity queries: those with no mention in the latest run.
  const mentionedQ = new Set(mentions.map((m: any) => m.query_id));
  const opportunities = queries.filter((q: any) => !mentionedQ.has(q.id)).slice(0, 30).map((q: any) => ({ id: q.id, query: q.query_text, topic: q.topic, priority: q.priority }));

  const latest = agg[agg.length - 1] || null;
  const apiStatus = getApiStatus();
  return {
    summary: latest, trend: agg, runs,
    mentions: mentions.slice(0, 50), citations: citations.slice(0, 50),
    topics: Object.values(topicStats).map((t) => ({ ...t, rate: t.queries ? Math.round((t.mentions / t.queries) * 100) : 0 })).sort((a, b) => b.rate - a.rate),
    citationPages, competitors, competitorLeaderboard, opportunities,
    brand, queryCount: queries.length, competitorCount: competitors.length,
    engines: VIS_ENGINES.map((e) => ({ id: e, available: !!apiStatus[e] })),
    availableEngines: availableEngines(),
  };
}

export const GET = withErrorBoundary(async (req: NextRequest, ctx: { params: Promise<{ planId: string }> }) => {
  const g = requireStaff(req); if (g) return g;
  const { planId } = await ctx.params;
  const { plan, error } = await loadPlan(planId, req); if (error) return error; if (!plan) return notFound('Plan');
  return ok(await dashboard(planId));
});

export const POST = withErrorBoundary(async (req: NextRequest, ctx: { params: Promise<{ planId: string }> }) => {
  const g = requireStaff(req); if (g) return g;
  const { planId } = await ctx.params;
  const { plan, error } = await loadPlan(planId, req); if (error) return error; if (!plan) return notFound('Plan');
  let body: any = {}; try { body = await req.json(); } catch { /* */ }
  const sb = visSb();

  switch (body.action) {
    case 'gen_queries': {
      await ensureBrandProfile(planId);
      const n = await generateQueriesFromPlan(planId);
      return ok({ created: n, state: await dashboard(planId) });
    }
    case 'add_query': {
      if (!body.query_text) return err('query_text נדרש');
      await ensureVisibilityTables();
      await sb.from('geo_visibility_queries').insert({ id: vid('vq'), plan_id: planId, client_id: plan.clientId || null, query_set: body.query_set || 'manual', query_text: body.query_text, topic: body.topic || body.query_text, intent: body.intent || 'commercial', language: body.language || 'he', country: body.country || 'IL', city: body.city || null, priority: body.priority || 5, business_importance_score: body.business_importance_score || 5, target_page_url: body.target_page_url || null, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return ok({ state: await dashboard(planId) });
    }
    case 'delete_query': {
      if (!body.id) return err('id נדרש');
      await sb.from('geo_visibility_queries').update({ status: 'deleted' }).eq('id', body.id).eq('plan_id', planId);
      return ok({ state: await dashboard(planId) });
    }
    case 'update_brand': {
      if (!body.patch) return err('patch נדרש');
      const allowed = ['brand_name', 'brand_aliases', 'owner_names', 'expert_names', 'domain', 'social_handles', 'location_names', 'excluded_terms'];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (body.patch[k] !== undefined) patch[k] = body.patch[k];
      await upsertBrandProfile(planId, patch);
      return ok({ state: await dashboard(planId) });
    }
    case 'add_competitor': {
      if (!body.competitor_name) return err('competitor_name נדרש');
      await ensureVisibilityTables();
      await sb.from('geo_visibility_competitors').insert({ id: vid('vcomp'), plan_id: planId, competitor_name: body.competitor_name, competitor_domain: body.competitor_domain || null, aliases: body.aliases || [], category: body.category || null, location: body.location || null, priority: body.priority || 5, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return ok({ state: await dashboard(planId) });
    }
    case 'delete_competitor': {
      if (!body.id) return err('id נדרש');
      await sb.from('geo_visibility_competitors').update({ status: 'deleted' }).eq('id', body.id).eq('plan_id', planId);
      return ok({ state: await dashboard(planId) });
    }
    case 'cost_preview': {
      await ensureBrandProfile(planId); await generateQueriesFromPlan(planId);
      const queries = await listQueries(planId);
      const engines = (body.engines && body.engines.length ? body.engines : (availableEngines().length ? availableEngines() : VIS_ENGINES));
      const limit = body.queryLimit || 25;
      const n = Math.min(queries.length, limit);
      return ok({ queries: n, engines, calls: n * engines.length, estCostCents: estimateRunCostCents(n, engines.length), live: availableEngines().length > 0 });
    }
    case 'run_now': {
      const out = await runVisibilityRun({ planId, engines: body.engines, queryLimit: body.queryLimit || 25, runType: 'manual', budgetCents: body.budgetCents });
      return ok({ run: out, state: await dashboard(planId) });
    }
    case 'enable_automation': {
      // Add 'ai_visibility' to the client's automation modules (uses the backbone).
      const asb = (await import('@/lib/seo/automation/db')).getSb();
      const { data: st } = await asb.from('geo_client_automation_status').select('modules_enabled,run_frequency').eq('plan_id', planId).maybeSingle();
      const modules = new Set<string>([...(st?.modules_enabled || ['geo_refresh']), 'ai_visibility']);
      await asb.from('geo_client_automation_status').update({ modules_enabled: Array.from(modules), run_frequency: body.frequency || st?.run_frequency || 'weekly', updated_at: new Date().toISOString() }).eq('plan_id', planId);
      return ok({ enabled: true, modules: Array.from(modules) });
    }
    default: return err('action לא נתמך');
  }
});
