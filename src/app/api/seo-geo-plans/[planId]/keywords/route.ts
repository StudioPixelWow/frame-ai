import { NextRequest, NextResponse } from 'next/server';
import { ok, err, loadPlan, notFound, updatePlanSafe, withErrorBoundary } from '@/lib/seo/api-helpers';

/**
 * POST /api/seo-geo-plans/[planId]/keywords
 * Update a client keyword's rank.
 *
 * Body: { keywordIndex: number, newRank: number }
 * Returns: { clientKeywords: SeoKeywordTracking[] }
 */
export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  const body = await req.json();
  const { keywordIndex, newRank } = body as { keywordIndex: number; newRank: number };

  if (typeof keywordIndex !== 'number' || typeof newRank !== 'number' || newRank < 1 || newRank > 100) {
    return err('keywordIndex (number) and newRank (1-100) are required', 400);
  }

  const clientKeywords = Array.isArray((plan as any).clientKeywords) ? [...(plan as any).clientKeywords] : [];
  if (keywordIndex < 0 || keywordIndex >= clientKeywords.length) {
    return err(`Invalid keywordIndex: ${keywordIndex}`, 400);
  }

  const kw = { ...clientKeywords[keywordIndex] };
  const now = new Date().toISOString();

  // Set initial rank on first update
  if (kw.initialRank === null || kw.initialRank === undefined) {
    kw.initialRank = newRank;
  }

  // Determine trend
  const prevRank = kw.currentRank;
  kw.currentRank = newRank;
  if (prevRank === null || prevRank === undefined) {
    kw.trend = 'new';
  } else if (newRank < prevRank) {
    kw.trend = 'up'; // Lower rank number = higher position = improvement
  } else if (newRank > prevRank) {
    kw.trend = 'down';
  } else {
    kw.trend = 'stable';
  }

  // Add to history
  if (!Array.isArray(kw.history)) kw.history = [];
  kw.history.push({ date: now, rank: newRank });
  kw.lastChecked = now;

  clientKeywords[keywordIndex] = kw;

  const updated = await updatePlanSafe(planId, { clientKeywords });
  if (!updated) return err('Failed to update keyword rank', 500);

  return ok({ clientKeywords });
});
