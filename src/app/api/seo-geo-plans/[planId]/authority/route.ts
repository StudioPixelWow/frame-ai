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
import { applyDraft } from '@/lib/seo/geo-authority/apply';
import { getGeoPublishMode, setGeoPublishMode, isAutoApplicableKind } from '@/lib/seo/geo-authority/settings';

/** Auto-apply freshly-created safe drafts when publish mode is 'auto'. */
async function maybeAutoApply(plan: any, moduleId: string): Promise<{ applied: number; results: any[] } | null> {
  const mode = await getGeoPublishMode();
  if (mode !== 'auto') return null;
  const drafts = (await listDrafts(plan.id, moduleId)).filter((d: any) => d.status === 'draft' && isAutoApplicableKind(d.kind));
  const results: any[] = []; let applied = 0;
  for (const d of drafts.slice(0, 20)) {
    const out = await applyDraft(plan, d);
    if (out.applied) { await setDraftStatus(d.id, 'applied'); applied++; }
    results.push({ id: d.id, kind: d.kind, ...out });
  }
  return { applied, results };
}

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
    publishMode: await getGeoPublishMode(),
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
      // When applying, actually push the approved draft to the website (WordPress).
      let applyOutcome: any = null;
      if (body.status === 'applied') {
        const drafts = await listDrafts(plan.id);
        const draft = drafts.find((d: any) => d.id === body.draftId);
        if (draft) applyOutcome = await applyDraft(plan, draft);
        // Mark applied only if it actually applied OR there's no WP (manual placement).
        if (!applyOutcome || applyOutcome.applied) await setDraftStatus(body.draftId, 'applied');
        else await setDraftStatus(body.draftId, 'approved'); // keep approved; surface the reason
      } else {
        await setDraftStatus(body.draftId, body.status);
      }
      return ok({ apply: applyOutcome, state: await buildState(plan) });
    }
    case 'score_page': {
      if (!body.pageUrl) return err('pageUrl נדרש');
      const page = (plan.scannedPages || []).find((p: any) => p.url === body.pageUrl);
      if (!page) return err('עמוד לא נמצא בסריקה', 404);
      // Compute against a single-page view of the plan.
      const pagePlan = { ...plan, scannedPages: [page] };
      const result = computeAuthorityScore(pagePlan);
      await saveAuthorityScore({
        planId: plan.id, clientId: plan.clientId, scope: 'page', pageUrl: body.pageUrl,
        overall: result.overall, subScores: result.subScores, issues: result.issues,
      });
      return ok({ pageUrl: body.pageUrl, overall: result.overall, subScores: result.subScores, issues: result.issues });
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
      // Auto-publish: if enabled, immediately apply the freshly-created safe drafts
      // (schema/faq/internal_link) to a WordPress-connected site, with logging.
      const autoApply = await maybeAutoApply(plan, m.id);
      return ok({ ran: m.id, out, autoApplied: autoApply, state: await buildState(plan) });
    }
    case 'set_publish_mode': {
      if (body.mode !== 'auto' && body.mode !== 'draft') return err('mode חייב להיות auto או draft');
      await setGeoPublishMode(body.mode);
      return ok({ mode: body.mode, state: await buildState(plan) });
    }
    default:
      return err('action לא נתמך');
  }
});
