/**
 * Rank tracking + Backlink monitoring API.
 *
 * GET  → keywords (with ranks), backlinks (recent), latest authority metrics, counts.
 * POST → { action }: 'gen_keywords' | 'scan_ranks' | 'scan_backlinks' |
 *        'add_keyword' (keyword) | 'delete_keyword' (id)
 *
 * Staff only. Uses SerpAPI/DataForSEO when configured, else clearly-labeled estimates.
 */

import { NextRequest } from 'next/server';
import { ok, err, loadPlan, notFound, requireStaff, withErrorBoundary } from '@/lib/seo/api-helpers';
import { listKeywords, listBacklinks, latestAuthority, ensureRbTables, rbSb, rbId } from '@/lib/seo/rank-backlinks/db';
import { ensureTrackedKeywords, scanRanks, scanBacklinks } from '@/lib/seo/rank-backlinks/engine';
import { rankProviderConfigured, backlinkProviderConfigured } from '@/lib/seo/rank-backlinks/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function state(planId: string) {
  const [keywords, backlinks, authority] = await Promise.all([listKeywords(planId), listBacklinks(planId, 200), latestAuthority(planId)]);
  const ranked = keywords.filter((k: any) => typeof k.current_rank === 'number');
  return {
    keywords, backlinks, authority,
    counts: {
      keywords: keywords.length,
      top10: ranked.filter((k: any) => k.current_rank <= 10).length,
      top3: ranked.filter((k: any) => k.current_rank <= 3).length,
      avgRank: ranked.length ? Math.round(ranked.reduce((a: number, k: any) => a + k.current_rank, 0) / ranked.length) : null,
      backlinks: backlinks.length,
      lostBacklinks: backlinks.filter((b: any) => b.status === 'lost').length,
    },
    providers: { rank: rankProviderConfigured(), backlink: backlinkProviderConfigured() },
  };
}

export const GET = withErrorBoundary(async (req: NextRequest, ctx: { params: Promise<{ planId: string }> }) => {
  const g = requireStaff(req); if (g) return g;
  const { planId } = await ctx.params;
  const { plan, error } = await loadPlan(planId, req); if (error) return error; if (!plan) return notFound('Plan');
  return ok(await state(planId));
});

export const POST = withErrorBoundary(async (req: NextRequest, ctx: { params: Promise<{ planId: string }> }) => {
  const g = requireStaff(req); if (g) return g;
  const { planId } = await ctx.params;
  const { plan, error } = await loadPlan(planId, req); if (error) return error; if (!plan) return notFound('Plan');
  let body: any = {}; try { body = await req.json(); } catch { /* */ }

  switch (body.action) {
    case 'gen_keywords': { const n = await ensureTrackedKeywords(plan); return ok({ created: n, state: await state(planId) }); }
    case 'scan_ranks': { await ensureTrackedKeywords(plan); const r = await scanRanks(plan); return ok({ ...r, state: await state(planId) }); }
    case 'scan_backlinks': { const r = await scanBacklinks(plan); return ok({ ...r, state: await state(planId) }); }
    case 'add_keyword': {
      if (!body.keyword) return err('keyword נדרש');
      await ensureRbTables();
      await rbSb().from('geo_tracked_keywords').insert({ id: rbId('tkw'), plan_id: planId, client_id: plan.clientId || null, keyword: body.keyword, target_url: plan.websiteUrl || null, country: 'IL', language: 'he', history: [], created_at: new Date().toISOString() }).then(() => {}, () => {});
      return ok({ state: await state(planId) });
    }
    case 'delete_keyword': {
      if (!body.id) return err('id נדרש');
      await rbSb().from('geo_tracked_keywords').delete().eq('id', body.id).eq('plan_id', planId);
      return ok({ state: await state(planId) });
    }
    default: return err('action לא נתמך');
  }
});
