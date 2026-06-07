/**
 * GEO Authority Center API.
 *
 * GET  /api/seo-geo-plans/[planId]/authority
 *      → computes & persists the AI Authority Score (8 sub-scores + overall),
 *        refreshes recommendations, and returns module statuses + tasks + drafts.
 *
 * POST /api/seo-geo-plans/[planId]/authority   { action, ... }
 *      action='recompute'                       → recompute score + recommendations
 *      action='create_task'   recId             → turn a recommendation into a (draft-gated) task
 *      action='run_module'    moduleId          → run a module engine (citation/brand/schema produce drafts)
 *      action='task_status'   taskId, status    → update a task's status
 *      action='draft_status'  draftId, status   → approve/apply/reject a draft (apply = manual gate)
 *
 * Staff only. No website change is ever published automatically — engines emit
 * drafts; applying requires explicit approval.
 */

import { NextRequest } from 'next/server';
import { ok, err, loadPlan, notFound, requireStaff, withErrorBoundary } from '@/lib/seo/api-helpers';
import { computeAuthorityScore } from '@/lib/seo/geo-authority/authority-score';
import { GEO_MODULES, resolveStatus, getModule } from '@/lib/seo/geo-authority/modules';
import {
  saveAuthorityScore, getLatestAuthorityScore, replaceRecommendations, listRecommendations,
  createTaskFromRecommendation, listTasks, updateTaskStatus, listDrafts, setDraftStatus, saveModuleResult,
} from '@/lib/seo/geo-authority/db';
import { runCitationBuilder, runBrandMention, runSchemaAutomation } from '@/lib/seo/geo-authority/engines';

function ctxFromPlan(plan: any) {
  const facts = plan?.websiteScan?.websiteFacts || {};
  return {
    planId: plan.id,
    clientId: plan.clientId || null,
    businessName: plan.clientName || plan.businessProfile?.businessName || plan.businessProfile?.name || 'העסק',
    industry: facts?.detected_industry?.value || facts?.industry || plan.businessProfile?.industry || '',
    location: facts?.detected_location?.value || facts?.location || plan.businessProfile?.location || '',
    websiteUrl: plan.websiteUrl || '',
    pages: (plan.scannedPages || []).slice(0, 5).map((p: any) => ({ url: p.url, title: p.title, content: p.content })),
  };
}

async function computeAndPersist(plan: any) {
  const result = computeAuthorityScore(plan);
  await saveAuthorityScore({
    planId: plan.id, clientId: plan.clientId, scope: 'site',
    overall: result.overall, subScores: result.subScores, issues: result.issues,
  });
  await replaceRecommendations(plan.id, plan.clientId || null, result.recommendations);
  return result;
}

async function buildState(plan: any, result?: any) {
  const score = result || (await getLatestAuthorityScore(plan.id, 'site'));
  const [recommendations, tasks, drafts] = await Promise.all([
    listRecommendations(plan.id), listTasks(plan.id), listDrafts(plan.id),
  ]);
  const modules = GEO_MODULES.map((m) => ({
    ...m,
    status: resolveStatus(m.id, plan),
    openRecs: recommendations.filter((r: any) => r.module_id === m.id && r.status === 'open').length,
    drafts: drafts.filter((d: any) => d.module_id === m.id).length,
  }));
  return {
    overall: result?.overall ?? score?.overall ?? 0,
    subScores: result?.subScores ?? score?.sub_scores ?? {},
    issues: result?.issues ?? score?.issues ?? [],
    modules, recommendations, tasks, drafts,
  };
}

export const GET = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const guard = requireStaff(req); if (guard) return guard;
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');
  const result = await computeAndPersist(plan);
  return ok(await buildState(plan, result));
});

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const guard = requireStaff(req); if (guard) return guard;
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  let body: any = {};
  try { body = await req.json(); } catch { /* noop */ }
  const action = body.action as string;

  switch (action) {
    case 'recompute': {
      const result = await computeAndPersist(plan);
      return ok(await buildState(plan, result));
    }
    case 'create_task': {
      if (!body.recId) return err('recId נדרש');
      const task = await createTaskFromRecommendation(body.recId);
      if (!task) return err('המלצה לא נמצאה', 404);
      return ok({ task, state: await buildState(plan) });
    }
    case 'task_status': {
      if (!body.taskId || !body.status) return err('taskId ו-status נדרשים');
      await updateTaskStatus(body.taskId, body.status);
      return ok({ state: await buildState(plan) });
    }
    case 'draft_status': {
      if (!body.draftId || !body.status) return err('draftId ו-status נדרשים');
      await setDraftStatus(body.draftId, body.status);
      return ok({ state: await buildState(plan) });
    }
    case 'run_module': {
      const m = getModule(body.moduleId);
      if (!m) return err('מודול לא נמצא', 404);
      const ctx = ctxFromPlan(plan);
      let out: any = null;
      if (m.id === 'citation_builder') out = await runCitationBuilder(ctx);
      else if (m.id === 'brand_mention') out = await runBrandMention(ctx);
      else if (m.id === 'schema_automation') out = await runSchemaAutomation(ctx);
      else if (m.id === 'authority_score') { const result = await computeAndPersist(plan); out = { recomputed: true, overall: result.overall }; }
      else {
        // Modules backed by existing engines — point the UI to their dedicated route/tab.
        return ok({ delegated: true, module: m.id, message: `מודול זה מופעל דרך הלשונית הקיימת (${m.engines[0]}).`, state: await buildState(plan) });
      }
      if (out) await saveModuleResult(plan.id, m.id, out).catch(() => {});
      return ok({ ran: m.id, out, state: await buildState(plan) });
    }
    default:
      return err('action לא נתמך');
  }
});
