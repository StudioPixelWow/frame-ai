import { NextRequest } from 'next/server';
import {
  ok,
  err,
  loadPlan,
  updatePlanSafe,
  logActivity,
  withErrorBoundary,
  parseBody,
} from '@/lib/seo/api-helpers';
import {
  queryPlatform,
  isPlatformAvailable,
  type PlatformId,
} from '@/lib/seo/platform-apis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/seo-geo-plans/[planId]/check-keyword
 *
 * Live check a single keyword across all 6 platforms in parallel.
 * Updates clientKeywords with Google position + history,
 * and merges AI results into websiteScan.aiQueries.
 */

const ALL_PLATFORMS: PlatformId[] = [
  'google_seo',
  'google_ai_overview',
  'chatgpt',
  'gemini',
  'perplexity',
  'claude',
];

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return err('תוכנית לא נמצאה', 404);

  const { body, error: parseErr } = await parseBody<{ keyword: string; keywordIndex: number }>(req);
  if (parseErr) return parseErr;
  if (!body) return err('גוף הבקשה חסר', 400);

  const { keyword, keywordIndex } = body;
  if (!keyword || keywordIndex === undefined || keywordIndex === null) {
    return err('חסר keyword או keywordIndex', 400);
  }

  const now = new Date().toISOString();
  const targetDomain = (plan as any).url || (plan as any).websiteUrl || (plan as any).domain || '';
  const businessName = (plan as any).businessName || (plan as any).clientName || targetDomain;

  // Run all platform checks in parallel
  const results = await Promise.allSettled(
    ALL_PLATFORMS.map(async (platformId) => {
      if (!isPlatformAvailable(platformId)) {
        return { platformId, available: false, result: null };
      }
      try {
        const result = await queryPlatform(platformId, keyword, businessName, targetDomain);
        return { platformId, available: true, result };
      } catch (e: any) {
        console.error(`[CHECK-KEYWORD] ${platformId} error:`, e.message);
        return { platformId, available: true, result: null };
      }
    })
  );

  // Parse results
  const platformResults: Record<string, any> = {};
  const newAiQueries: any[] = [];

  for (const settled of results) {
    if (settled.status !== 'fulfilled') continue;
    const { platformId, available, result } = settled.value;

    platformResults[platformId] = {
      available,
      found: result?.found ?? false,
      position: result?.position,
      snippet: result?.snippet,
      confidence: result?.confidence ?? 0,
      scanMode: result?.scanMode ?? 'unavailable',
      responseText: result?.responseText,
      sources: result?.sources,
      mentionType: result?.mentionType,
    };

    if (available && result) {
      newAiQueries.push({
        platform: platformId,
        query: keyword,
        queryId: `kw-${keywordIndex}`,
        found: result.found,
        position: result.position,
        snippet: result.snippet,
        confidence: result.confidence,
        scanMode: result.scanMode,
        checkedAt: now,
        responseText: result.responseText,
        sources: result.sources,
        mentionType: result.mentionType,
      });
    }
  }

  // Update clientKeywords with Google position
  const clientKeywords = [...((plan as any).clientKeywords || [])];
  if (keywordIndex >= 0 && keywordIndex < clientKeywords.length) {
    const kw = { ...clientKeywords[keywordIndex] };
    const googleResult = platformResults['google_seo'];
    if (googleResult?.available && googleResult.found) {
      const oldRank = kw.currentRank;
      kw.currentRank = googleResult.position || null;
      kw.lastCheckedAt = now;

      if (!kw.history) kw.history = [];
      kw.history = [...kw.history, {
        rank: googleResult.position || null,
        date: now,
        change: oldRank ? (oldRank - (googleResult.position || 0)) : 0,
      }];
    } else if (googleResult?.available) {
      kw.lastCheckedAt = now;
    }
    clientKeywords[keywordIndex] = kw;
  }

  // Merge new AI queries into existing websiteScan.aiQueries
  const websiteScan = (plan as any).websiteScan || {};
  const existingAiQueries: any[] = websiteScan.aiQueries || [];

  // Remove old entries for this keyword, add new ones
  const filteredQueries = existingAiQueries.filter(
    (q: any) => q.queryId !== `kw-${keywordIndex}` && q.query !== keyword
  );
  const mergedQueries = [...filteredQueries, ...newAiQueries];

  // Save to DB
  const updated = await updatePlanSafe(planId, {
    clientKeywords,
    websiteScan: {
      ...websiteScan,
      aiQueries: mergedQueries,
    },
  } as any);

  if (!updated) return err('שגיאה בשמירת תוצאות הבדיקה', 500);

  logActivity(planId, 'check_keyword', {
    keyword,
    keywordIndex,
    platforms: Object.keys(platformResults),
    found: Object.entries(platformResults)
      .filter(([, v]) => (v as any).found)
      .map(([k]) => k),
  });

  return ok({
    keyword,
    keywordIndex,
    platformResults,
    googlePosition: platformResults['google_seo']?.position || null,
    checkedAt: now,
  });
});
