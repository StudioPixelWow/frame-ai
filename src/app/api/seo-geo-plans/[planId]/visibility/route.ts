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
import { ensureVisibilityTables, visSb, vid, getBrandProfile, upsertBrandProfile, listQueries, listCompetitors, listPrompts } from '@/lib/seo/geo-visibility/db';
import { generateWithAI } from '@/lib/ai/openai-client';
import { runVisibilityRun, estimateRunCostCents, generateQueriesFromPlan, ensureBrandProfile } from '@/lib/seo/geo-visibility/run';
import { availableEngines, VIS_ENGINES } from '@/lib/seo/geo-visibility/provider';
import { getApiStatus } from '@/lib/seo/platform-apis';
import { getQueryDrilldown, executeImprovement } from '@/lib/seo/geo-visibility/drilldown';

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

  // Full query list (for the clickable drill-down table): mention count + appeared flag.
  const menCountByQ: Record<string, number> = {};
  for (const m of mentions) menCountByQ[m.query_id] = (menCountByQ[m.query_id] || 0) + 1;
  const allQueries = queries.map((q: any) => ({
    id: q.id, query: q.query_text, topic: q.topic, intent: q.intent || null,
    priority: q.priority, mentions: menCountByQ[q.id] || 0, appeared: (menCountByQ[q.id] || 0) > 0,
  })).sort((a: any, b: any) => (a.appeared === b.appeared ? a.priority - b.priority : a.appeared ? 1 : -1));

  // History / diff / alerts / global-index layer.
  const [alerts, citationHistory, changeEvents, diffs, globalIndex] = await Promise.all([
    sb.from('geo_visibility_alerts').select('*').eq('plan_id', planId).neq('status', 'dismissed').order('detected_at', { ascending: false }).limit(60).then((r) => r.data || []),
    sb.from('geo_citation_history').select('*').eq('plan_id', planId).order('last_seen_at', { ascending: false }).limit(100).then((r) => r.data || []),
    sb.from('geo_ai_answer_change_events').select('*').eq('plan_id', planId).order('created_at', { ascending: false }).limit(80).then((r) => r.data || []),
    sb.from('geo_citation_diffs').select('*').eq('plan_id', planId).order('created_at', { ascending: false }).limit(80).then((r) => r.data || []),
    sb.from('geo_global_citation_index').select('*').order('citation_frequency', { ascending: false }).limit(500).then((r) => r.data || []),
  ]);
  const globalInsights = computeGlobalInsights(globalIndex);

  const latest = agg[agg.length - 1] || null;
  const apiStatus = getApiStatus();
  return {
    summary: latest, trend: agg, runs,
    mentions: mentions.slice(0, 50), citations: citations.slice(0, 50),
    topics: Object.values(topicStats).map((t) => ({ ...t, rate: t.queries ? Math.round((t.mentions / t.queries) * 100) : 0 })).sort((a, b) => b.rate - a.rate),
    citationPages, competitors, competitorLeaderboard, opportunities, allQueries,
    brand, queryCount: queries.length, competitorCount: competitors.length,
    engines: VIS_ENGINES.map((e) => ({ id: e, available: !!apiStatus[e] })),
    availableEngines: availableEngines(),
    alerts, citationHistory, changeEvents, diffs, globalIndex: globalIndex.slice(0, 50), globalInsights,
    prompts: await listPrompts(planId),
    alertCounts: { new: alerts.filter((a: any) => a.status === 'new').length, total: alerts.length },
    metricMeta: METRIC_META,
  };
}

// Advanced Global Citation Index insights (aggregated, anonymous).
function computeGlobalInsights(rows: any[]) {
  const sumBy = (key: string) => {
    const m: Record<string, number> = {};
    for (const r of rows) { const k = r[key] || '—'; m[k] = (m[k] || 0) + (r.citation_frequency || 0); }
    return Object.entries(m).map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value);
  };
  const mostCitedDomains = sumBy('cited_domain').slice(0, 12);
  const mostCitedPageTypes = sumBy('page_type').slice(0, 8);
  const byEngine = sumBy('ai_engine').slice(0, 8);

  // Per-topic dominant source type → "AI prefers X for topic Y".
  const topicType: Record<string, Record<string, number>> = {};
  const topicDomains: Record<string, Set<string>> = {};
  for (const r of rows) {
    const t = r.topic || '—';
    (topicType[t] ||= {})[r.page_type || 'page'] = (topicType[t]?.[r.page_type || 'page'] || 0) + (r.citation_frequency || 0);
    (topicDomains[t] ||= new Set()).add(r.cited_domain);
  }
  const topicPreference = Object.entries(topicType).map(([topic, types]) => {
    const top = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    return { topic, preferredSource: top?.[0] || '—', strength: top?.[1] || 0 };
  }).sort((a, b) => b.strength - a.strength).slice(0, 15);

  // Competitiveness/volatility proxy: distinct domains per topic (more = more volatile).
  const topicVolatility = Object.entries(topicDomains).map(([topic, set]) => ({ topic, distinctSources: set.size }))
    .sort((a, b) => b.distinctSources - a.distinctSources).slice(0, 12);

  const buckets = {
    government: topicPreference.filter((t) => t.preferredSource === 'government').map((t) => t.topic),
    blog: topicPreference.filter((t) => t.preferredSource === 'blog').map((t) => t.topic),
    service: topicPreference.filter((t) => t.preferredSource === 'service').map((t) => t.topic),
    reference: topicPreference.filter((t) => t.preferredSource === 'reference').map((t) => t.topic),
  };
  return { mostCitedDomains, mostCitedPageTypes, byEngine, topicPreference, topicVolatility, buckets, totalRows: rows.length };
}

// Real-vs-Estimated framework: how each metric is sourced (drives the UI badges + tooltips).
const METRIC_META: Record<string, { type: string; source: string; confidence: number; method: string }> = {
  visibility_score: { type: 'measured', source: 'scheduled AI runs', confidence: 80, method: 'weighted score over measured responses' },
  total_mentions: { type: 'measured', source: 'scheduled AI runs', confidence: 90, method: 'brand detection in AI answers' },
  share_of_ai_voice: { type: 'measured', source: 'scheduled AI runs', confidence: 75, method: 'brand vs competitor mentions' },
  total_citations: { type: 'measured', source: 'scheduled AI runs', confidence: 85, method: 'source URLs in AI answers' },
  estimated_ai_reach: { type: 'estimated', source: 'model', confidence: 40, method: 'volume × AI-usage × mention probability' },
};

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
      const modules = new Set<string>([...(st?.modules_enabled || ['geo_refresh']), 'ai_visibility', 'visibility_report']);
      await asb.from('geo_client_automation_status').update({ modules_enabled: Array.from(modules), run_frequency: body.frequency || st?.run_frequency || 'weekly', updated_at: new Date().toISOString() }).eq('plan_id', planId);
      return ok({ enabled: true, modules: Array.from(modules) });
    }
    case 'add_prompt': {
      if (!body.prompt_text) return err('prompt_text נדרש');
      await ensureVisibilityTables();
      await visSb().from('geo_visibility_prompts').insert({ id: vid('vp'), plan_id: planId, prompt_text: body.prompt_text, parent_query_id: body.parent_query_id || null, parent_prompt_id: body.parent_prompt_id || null, conversation_depth: body.conversation_depth || 1, intent_stage: body.intent_stage || 'consideration', topic: body.topic || null, priority: body.priority || 5, expected_answer_type: body.expected_answer_type || null, target_brand: body.target_brand || null, target_page_url: body.target_page_url || null, status: 'active', created_at: new Date().toISOString() });
      return ok({ state: await dashboard(planId) });
    }
    case 'delete_prompt': {
      if (!body.id) return err('id נדרש');
      await visSb().from('geo_visibility_prompts').update({ status: 'deleted' }).eq('id', body.id).eq('plan_id', planId);
      return ok({ state: await dashboard(planId) });
    }
    case 'gen_followups': {
      const seed = body.seed || (await listQueries(planId))[0]?.query_text;
      if (!seed) return err('אין שאילתת זרע');
      const facts = (plan as any)?.websiteScan?.websiteFacts || {};
      const r = await generateWithAI(
        'אתה בונה מסעות שיחה (follow-up prompts) שמשתמש אמיתי ישאל מנוע AI, בעברית. החזר JSON array בלבד.',
        `נושא/שאילתת פתיחה: "${seed}". תחום: ${facts?.detected_industry?.value || ''}.
ייצר 5 follow-up prompts בעומק עולה. כל פריט: {"prompt":"...","conversation_depth":1-4,"intent_stage":"awareness|consideration|decision","topic":"..."}`,
        { temperature: 0.6, maxTokens: 1200 });
      let items: any[] = [];
      if (r.success) { const d: any = r.data; items = Array.isArray(d) ? d : (typeof d === 'string' ? (() => { try { return JSON.parse(d.slice(d.indexOf('['), d.lastIndexOf(']') + 1)); } catch { return []; } })() : (d?.items || [])); }
      const rows = items.slice(0, 8).map((p: any) => ({ id: vid('vp'), plan_id: planId, prompt_text: p.prompt, conversation_depth: p.conversation_depth || 1, intent_stage: p.intent_stage || 'consideration', topic: p.topic || seed, priority: 5, status: 'active', created_at: new Date().toISOString() }));
      if (rows.length) await visSb().from('geo_visibility_prompts').insert(rows);
      return ok({ created: rows.length, state: await dashboard(planId) });
    }
    case 'alert_status': {
      if (!body.alertId || !body.status) return err('alertId ו-status נדרשים');
      await sb.from('geo_visibility_alerts').update({ status: body.status }).eq('id', body.alertId).eq('plan_id', planId);
      return ok({ state: await dashboard(planId) });
    }
    case 'query_detail': {
      if (!body.queryId) return err('queryId נדרש');
      const detail = await getQueryDrilldown(planId, body.queryId);
      return ok({ detail });
    }
    case 'query_execute': {
      if (!body.queryId || !body.actionType) return err('queryId ו-actionType נדרשים');
      const draft = await executeImprovement(planId, body.queryId, { actionType: body.actionType, title: body.title, detail: body.detail });
      return ok({ draft });
    }
    case 'list_drafts': {
      await ensureVisibilityTables();
      const { data } = await sb.from('geo_visibility_drafts').select('*').eq('plan_id', planId).order('created_at', { ascending: false }).limit(50);
      return ok({ drafts: data || [] });
    }
    default: return err('action לא נתמך');
  }
});
