/**
 * AI Visibility run engine — executes a controlled monitoring run: a fixed query
 * set × selected AI engines, detects mentions/citations/competitors, stores
 * everything, computes the visibility score, estimates reach, and upserts the
 * monthly aggregation. Real when API keys exist; Mock-flagged otherwise. Cost-
 * controlled via a per-run query cap. Pure measurement — never changes a website.
 */

import { seoPlans } from '@/lib/db';
import { ensureVisibilityTables, vid, visSb, visMonthKey, getBrandProfile, upsertBrandProfile, listQueries, listCompetitors } from './db';
import { availableEngines, runQuery, extractMention, extractCitations, extractCompetitors, VIS_ENGINES, type BrandMatch } from './provider';
import { calculateAIVisibilityScore, estimateAIReach } from './scoring';
import type { PlatformId } from '@/lib/seo/platform-apis';

const COST_PER_CALL_CENTS = 0.3;
export function estimateRunCostCents(numQueries: number, numEngines: number) { return Math.ceil(numQueries * numEngines * COST_PER_CALL_CENTS); }

/** Derive a brand profile from the plan if none was saved yet. */
export async function ensureBrandProfile(planId: string): Promise<BrandMatch> {
  let bp = await getBrandProfile(planId);
  if (!bp) {
    const plan: any = await seoPlans.getByIdAsync(planId);
    const domain = (plan?.websiteUrl || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    const patch = {
      client_id: plan?.clientId || null,
      brand_name: plan?.clientName || plan?.businessProfile?.businessName || domain || 'Brand',
      brand_aliases: [], owner_names: [], expert_names: [], domain,
      social_handles: [], location_names: [], excluded_terms: [],
    };
    await upsertBrandProfile(planId, patch);
    bp = { plan_id: planId, ...patch };
  }
  return {
    name: bp.brand_name || '', aliases: bp.brand_aliases || [], domain: bp.domain || '',
    owners: bp.owner_names || [], experts: bp.expert_names || [],
  };
}

/** Auto-create queries from the plan's keywords if the project has none yet. */
export async function generateQueriesFromPlan(planId: string): Promise<number> {
  await ensureVisibilityTables();
  const existing = await listQueries(planId);
  if (existing.length) return 0;
  const plan: any = await seoPlans.getByIdAsync(planId);
  const kws = [...(plan?.aiKeywords || []), ...(plan?.clientKeywords || [])]
    .map((k: any) => (typeof k === 'string' ? k : k?.keyword)).filter(Boolean);
  const uniq = Array.from(new Set(kws)).slice(0, 30);
  if (!uniq.length) return 0;
  const rows = uniq.map((q: string) => ({
    id: vid('vq'), plan_id: planId, client_id: plan?.clientId || null, query_set: 'auto',
    query_text: q, topic: q, intent: 'commercial', language: 'he', country: 'IL',
    priority: 5, business_importance_score: 6, status: 'active',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }));
  await visSb().from('geo_visibility_queries').insert(rows);
  return rows.length;
}

export interface RunOpts { planId: string; engines?: PlatformId[]; queryLimit?: number; runType?: string; budgetCents?: number; }

export async function runVisibilityRun(opts: RunOpts) {
  await ensureVisibilityTables();
  const sb = visSb();
  const planId = opts.planId;
  const plan: any = await seoPlans.getByIdAsync(planId);
  if (!plan) throw new Error('Plan not found');

  const brand = await ensureBrandProfile(planId);
  await generateQueriesFromPlan(planId);
  let queries = await listQueries(planId);
  const limit = opts.queryLimit ?? 25;
  queries = queries.slice(0, limit);

  // Engines: those with keys; if none, fall back to all (Mock) so the pipeline still runs.
  const live = availableEngines();
  const engines = (opts.engines && opts.engines.length ? opts.engines : (live.length ? live : VIS_ENGINES));

  // Cost control.
  const estCost = estimateRunCostCents(queries.length, engines.length);
  if (opts.budgetCents && opts.budgetCents > 0 && estCost > opts.budgetCents) {
    throw new Error(`עלות משוערת (${estCost}¢) חורגת מהתקציב (${opts.budgetCents}¢)`);
  }

  const competitors = await listCompetitors(planId);
  const compDomains = competitors.map((c) => (c.competitor_domain || '').replace(/^www\./, '')).filter(Boolean);
  const compMatch = competitors.map((c) => ({ name: c.competitor_name, domain: c.competitor_domain, aliases: c.aliases || [] }));

  const runId = vid('vrun');
  const startedAt = new Date().toISOString();
  await sb.from('geo_visibility_runs').insert({
    id: runId, plan_id: planId, client_id: plan.clientId || null, query_set: 'all',
    ai_engine: engines.join(','), run_type: opts.runType || 'manual', status: 'running',
    started_at: startedAt, total_queries: queries.length * engines.length, created_at: startedAt,
  });

  let responses = 0, ok = 0, fail = 0, mentions = 0, citations = 0, compMentions = 0, negative = 0, mock = 0;
  const positions: number[] = []; const recLevels: string[] = []; const topics = new Set<string>(); const topicsCovered = new Set<string>();
  const respRows: any[] = [], menRows: any[] = [], citRows: any[] = [], cmRows: any[] = [];

  for (const q of queries) {
    topics.add(q.topic || q.query_text);
    for (const engine of engines) {
      responses++;
      try {
        const res = await runQuery(engine, q.query_text, brand);
        if (res.scanMode === 'mock') mock++;
        ok++;
        const respId = vid('vresp');
        respRows.push({ id: respId, run_id: runId, plan_id: planId, query_id: q.id, ai_engine: engine, raw_response: (res.responseText || '').slice(0, 4000), found: res.found, position: res.position ?? null, mention_type: res.mentionType, latency_ms: res.latencyMs, created_at: new Date().toISOString() });

        const m = extractMention(res, brand);
        if (m.found) {
          mentions++;
          if (res.position) positions.push(res.position);
          recLevels.push(m.recommendationLevel);
          if (m.sentiment === 'negative') negative++;
          topicsCovered.add(q.topic || q.query_text);
          menRows.push({ id: vid('vmen'), plan_id: planId, run_id: runId, query_id: q.id, response_id: respId, ai_engine: engine, mention_text: (res.responseText || '').slice(0, 200), mention_type: 'brand', position: res.position ?? null, sentiment: m.sentiment, recommendation_level: m.recommendationLevel, confidence_score: res.confidence, is_exact_match: m.isExact, is_alias_match: m.isAlias, created_at: new Date().toISOString() });
        }
        for (const c of extractCitations(res, brand, compDomains)) {
          citations++;
          citRows.push({ id: vid('vcit'), plan_id: planId, run_id: runId, query_id: q.id, response_id: respId, ai_engine: engine, cited_url: c.url, cited_domain: c.domain, cited_page_title: c.title || null, citation_position: c.position, is_own_site: c.isOwn, is_competitor_site: c.isCompetitor, confidence_score: res.confidence, created_at: new Date().toISOString() });
        }
        for (const cm of extractCompetitors(res, compMatch)) {
          compMentions++;
          cmRows.push({ id: vid('vcm'), plan_id: planId, run_id: runId, query_id: q.id, ai_engine: engine, competitor_name: cm.name, position: cm.position, was_cited: cm.cited, created_at: new Date().toISOString() });
        }
      } catch { fail++; }
    }
  }

  // Bulk persist (chunked to be safe).
  const insertChunked = async (table: string, rows: any[]) => { for (let i = 0; i < rows.length; i += 200) await sb.from(table).insert(rows.slice(i, i + 200)).then(() => {}, () => {}); };
  await insertChunked('geo_visibility_responses', respRows);
  await insertChunked('geo_visibility_mentions', menRows);
  await insertChunked('geo_visibility_citations', citRows);
  await insertChunked('geo_visibility_competitor_mentions', cmRows);

  const avgPosition = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
  const score = calculateAIVisibilityScore({ totalResponses: responses, mentions, citations, competitorMentions: compMentions, avgPosition, recommendationLevels: recLevels, topicsCovered: topicsCovered.size, totalTopics: topics.size, negativeSentiment: negative });
  const mentionRate = responses ? mentions / responses : 0;
  const citationRate = responses ? citations / responses : 0;
  const reach = estimateAIReach({ queries, mentionRate, citationRate, enginesCount: engines.length });

  await sb.from('geo_visibility_runs').update({
    status: fail > 0 && ok === 0 ? 'failed' : fail > 0 ? 'partially_failed' : 'completed',
    completed_at: new Date().toISOString(), successful_queries: ok, failed_queries: fail,
    mentions, citations, visibility_score: score.value, cost_estimate_cents: estCost,
  }).eq('id', runId);

  await upsertMonthly(planId, plan.clientId || null, { responses, mentions, citations, compMentions, mentionRate, citationRate, score: score.value, reach, queriesTested: queries.length, engines });

  await sb.from('geo_visibility_logs').insert({ id: vid('vlog'), plan_id: planId, run_id: runId, level: 'info', event_type: 'run_completed', message: `score=${score.value} mentions=${mentions} citations=${citations} mock=${mock}/${responses}`, created_at: new Date().toISOString() });

  return { runId, responses, mentions, citations, competitorMentions: compMentions, score: score.value, reach, estCostCents: estCost, mocked: mock, engines };
}

async function upsertMonthly(planId: string, clientId: string | null, d: any) {
  const sb = visSb();
  const month = visMonthKey();
  const sov = (d.mentions + d.compMentions) > 0 ? d.mentions / (d.mentions + d.compMentions) : 0;
  const row = {
    plan_id: planId, client_id: clientId, month, total_queries_tested: d.queriesTested,
    total_ai_responses: d.responses, total_mentions: d.mentions, total_citations: d.citations,
    mention_rate: +d.mentionRate.toFixed(3), citation_rate: +d.citationRate.toFixed(3),
    share_of_ai_voice: +sov.toFixed(3), visibility_score: d.score, estimated_ai_reach: d.reach,
    top_engine: (d.engines || [])[0] || null, updated_at: new Date().toISOString(),
  };
  const { data: existing } = await sb.from('geo_visibility_monthly_aggregations').select('id').eq('plan_id', planId).eq('month', month).maybeSingle();
  if (existing?.id) await sb.from('geo_visibility_monthly_aggregations').update(row).eq('id', existing.id);
  else await sb.from('geo_visibility_monthly_aggregations').insert({ id: vid('vagg'), created_at: new Date().toISOString(), ...row });
}
