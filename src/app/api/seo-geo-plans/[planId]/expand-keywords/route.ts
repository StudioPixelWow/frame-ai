/**
 * POST /api/seo-geo-plans/[planId]/expand-keywords
 *
 * Takes the client's seed keywords (the ones they entered) and expands them via
 * AI into ~150 Google search keywords + ~150 conversational AI/GEO queries.
 * REPLACES plan.visibilityQueries entirely — wiping any junk that was previously
 * scraped from page titles/footers. Seeds are the only source of intent.
 */
import { NextRequest } from 'next/server';
import { ok, err, loadPlan, notFound, updatePlanSafe, logActivity, generateId, withErrorBoundary } from '@/lib/seo/api-helpers';
import { expandSeedKeywords } from '@/lib/seo/keyword-research/expand';

export const maxDuration = 120;

export const POST = withErrorBoundary(async (req: NextRequest, ctx: { params: Promise<{ planId: string }> }) => {
  const { planId } = await ctx.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  const p: any = plan;
  let body: any = {}; try { body = await req.json(); } catch { /* */ }

  // Seeds: prefer client-entered keywords; allow override from the request body.
  const fromClient = Array.isArray(p.clientKeywords) ? p.clientKeywords.map((k: any) => (typeof k === 'string' ? k : k?.keyword)).filter(Boolean) : [];
  const fromAi = Array.isArray(p.aiKeywords) ? p.aiKeywords.map((k: any) => (typeof k === 'string' ? k : k?.keyword)).filter(Boolean) : [];
  const seeds: string[] = (Array.isArray(body.seeds) && body.seeds.length ? body.seeds : (fromClient.length ? fromClient : fromAi)).map((s: string) => String(s).trim()).filter(Boolean);

  if (!seeds.length) return err('אין ביטויי זרע. הוסף תחילה את ביטויי המפתח של הלקוח.', 400);

  const facts = p.websiteScan?.websiteFacts || {};
  const context = {
    businessName: p.clientName || p.businessProfile?.businessName || '',
    industry: facts?.detected_industry?.value || facts?.industry || p.businessProfile?.industry || '',
    location: p.location || p.city || facts?.location?.value || facts?.location || '',
    services: (facts?.products_services || p.businessProfile?.products || []).filter(Boolean).slice(0, 10),
  };

  const expanded = await expandSeedKeywords(seeds, context);

  // Build the new visibility-query set. category encodes the scan target:
  //   'google' → checked on Google SEO ;  'ai' → checked on AI engines (GEO).
  const now = new Date().toISOString();
  const googleQs = expanded.google.map((q) => ({ id: generateId('vq'), query: q, category: 'google', intent: 'commercial' as const, importance: 'medium' as const }));
  const aiQs = expanded.ai.map((q) => ({ id: generateId('vq'), query: q, category: 'ai', intent: 'informational' as const, importance: 'medium' as const }));
  const visibilityQueries = [...googleQs, ...aiQs];

  const updated = await updatePlanSafe(planId, { visibilityQueries } as any);
  if (!updated) return err('שמירת הביטויים נכשלה', 500);

  logActivity(planId, 'expand_keywords', { seeds: seeds.length, google: googleQs.length, ai: aiQs.length, usedAI: expanded.usedAI });

  return ok({
    seeds, googleCount: googleQs.length, aiCount: aiQs.length, total: visibilityQueries.length,
    usedAI: expanded.usedAI, sampleGoogle: expanded.google.slice(0, 8), sampleAi: expanded.ai.slice(0, 8),
  });
});
