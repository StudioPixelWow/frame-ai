/**
 * Advanced GEO Growth Center API.
 *
 * GET  → computes & persists all advanced scores, returns module statuses +
 *        the contents of the advanced tables (opportunities, queries, sims, …).
 * POST → { action }:
 *        'recompute_scores'
 *        'run_module'        moduleId            (runs the engine for that module)
 *        'content_brief'     topic?
 *        'content_validator' target, content
 *        'create_task'       title, … (→ geo_tasks via core db)
 *        'set_status'        table, id, status
 *
 * Staff only. Draft/recommendation only — никогда no live-site change.
 */

import { NextRequest } from 'next/server';
import { ok, err, loadPlan, notFound, requireStaff, withErrorBoundary } from '@/lib/seo/api-helpers';
import { computeAllScores } from '@/lib/seo/geo-authority/scores';
import { ADV_MODULES, getAdvModule, resolveAdvStatus } from '@/lib/seo/geo-authority/advanced-modules';
import { saveScore, latestScores, listRows, ensureAdvancedTables } from '@/lib/seo/geo-authority/advanced-db';
import {
  runQueryDiscovery, runAnswerSimulation, runCitationOpportunity, runReputationMonitor,
  runOpportunityEngine, runRoadmap, runContentBrief, runContentValidator, runForecast, runConversationPaths,
  type EngineCtx,
} from '@/lib/seo/geo-authority/advanced-engines';
import { getSupabase } from '@/lib/db/store';

function ctx(plan: any): EngineCtx {
  const facts = plan?.websiteScan?.websiteFacts || {};
  return {
    planId: plan.id, clientId: plan.clientId || null,
    businessName: plan.clientName || plan.businessProfile?.businessName || 'העסק',
    industry: facts?.detected_industry?.value || facts?.industry || plan.businessProfile?.industry || '',
    location: facts?.detected_location?.value || facts?.location || plan.businessProfile?.location || '',
    websiteUrl: plan.websiteUrl || '',
    keywords: [...(plan.aiKeywords || []), ...(plan.clientKeywords || [])].map((k: any) => (typeof k === 'string' ? k : k?.keyword)).filter(Boolean),
    competitors: (plan.competitors || []).map((c: any) => c?.name || c?.domain || c).filter(Boolean),
    pages: (plan.scannedPages || []).slice(0, 8).map((p: any) => ({ url: p.url, title: p.title, content: p.content })),
    visibility: (plan.visibilityResults || plan.baselineAiQueries || []).map((v: any) => ({ query: v.query, platform: v.platform, found: v.found })),
  };
}

const ADV_TABLES = [
  'geo_opportunities', 'geo_query_discovery_sets', 'geo_answer_simulations', 'geo_reputation_checks',
  'geo_content_briefs', 'geo_content_validations', 'geo_roadmaps', 'geo_forecasts',
  'geo_conversation_paths', 'geo_citation_opportunities',
];

async function persistScores(plan: any) {
  const scores = computeAllScores(plan);
  for (const [kind, sc] of Object.entries(scores)) {
    await saveScore({ planId: plan.id, clientId: plan.clientId, kind, value: sc.value, explanation: sc.explanation, factors: sc.factors, recommendations: sc.recommendations }).catch(() => {});
  }
  return scores;
}

async function buildState(plan: any, freshScores?: any) {
  await ensureAdvancedTables();
  const scores = freshScores || (await latestScores(plan.id));
  const tableData: Record<string, any[]> = {};
  await Promise.all(ADV_TABLES.map(async (t) => { tableData[t] = await listRows(t, plan.id, 60).catch(() => []); }));
  const counts: Record<string, number> = {};
  for (const t of ADV_TABLES) counts[t] = tableData[t].length;
  const modules = ADV_MODULES.map((m) => ({ ...m, status: resolveAdvStatus(m, { tables: counts, scores }) }));
  return { scores, modules, tables: tableData, counts };
}

export const GET = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const guard = requireStaff(req); if (guard) return guard;
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error; if (!plan) return notFound('Plan');
  const scores = await persistScores(plan);
  return ok(await buildState(plan, scores));
});

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const guard = requireStaff(req); if (guard) return guard;
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error; if (!plan) return notFound('Plan');

  let body: any = {}; try { body = await req.json(); } catch { /* */ }
  const c = ctx(plan);

  switch (body.action) {
    case 'recompute_scores': {
      const scores = await persistScores(plan);
      return ok(await buildState(plan, scores));
    }
    case 'content_brief': {
      const out = await runContentBrief(c, body.topic);
      return ok({ out, state: await buildState(plan) });
    }
    case 'content_validator': {
      if (!body.target || !body.content) return err('target ו-content נדרשים');
      const out = await runContentValidator(c, body.target, body.content);
      return ok({ out, state: await buildState(plan) });
    }
    case 'set_status': {
      if (!body.table || !body.id || !body.status) return err('table/id/status נדרשים');
      if (!ADV_TABLES.includes(body.table)) return err('table לא מורשה');
      await getSupabase().from(body.table).update({ status: body.status }).eq('id', body.id);
      return ok({ state: await buildState(plan) });
    }
    case 'run_module': {
      const m = getAdvModule(body.moduleId);
      if (!m) return err('מודול לא נמצא', 404);
      let out: any = { delegated: true };
      switch (m.action) {
        case 'query_discovery': out = await runQueryDiscovery(c); break;
        case 'answer_simulation': out = await runAnswerSimulation(c); break;
        case 'citation_opportunity': out = await runCitationOpportunity(c); break;
        case 'reputation_monitor': out = await runReputationMonitor(c); break;
        case 'opportunity_engine': out = await runOpportunityEngine(c); break;
        case 'roadmap': out = await runRoadmap(c); break;
        case 'content_brief': out = await runContentBrief(c, body.topic); break;
        case 'forecast': out = await runForecast(c); break;
        case 'conversation_paths': out = await runConversationPaths(c); break;
        default:
          // Score-only or extends-existing modules: just refresh scores and point to the existing module.
          await persistScores(plan);
          return ok({ delegated: true, module: m.id, message: m.extends ? `מודול זה מרחיב את ${m.extends} — ראה את הלשונית הקיימת.` : 'מודול מבוסס-ניקוד — הציון עודכן.', state: await buildState(plan) });
      }
      return ok({ ran: m.id, out, state: await buildState(plan) });
    }
    default: return err('action לא נתמך');
  }
});
