import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import {
  ok,
  err,
  notFound,
  loadPlan,
  updatePlanSafe,
  logActivity,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';
import {
  queryPlatform,
  isPlatformAvailable,
  getApiStatus,
  type PlatformId,
  type PlatformQueryResult,
} from '@/lib/seo/platform-apis';

/**
 * POST /api/seo-geo-plans/[planId]/run-ai-scan
 *
 * Runs REAL AI visibility scan across all configured platforms.
 * Queries each AI engine (ChatGPT, Gemini, Perplexity, Claude, Google)
 * with the plan's visibility queries and stores actual results.
 */

interface AIQueryResult {
  platform: PlatformId;
  query: string;
  queryId: string;
  found: boolean;
  position?: number;
  snippet?: string;
  confidence: number;
  scanMode: 'real' | 'unavailable';
  checkedAt: string;
}

interface PlatformStatusResult {
  id: PlatformId;
  name: string;
  icon: string;
  status: 'completed' | 'api_missing' | 'error';
  queriesScanned: number;
  mentionsFound: number;
  scanMode: 'real' | 'unavailable';
}

const PLATFORM_META: Record<PlatformId, { name: string; icon: string }> = {
  google_seo: { name: 'Google SEO', icon: '🔍' },
  google_ai_overview: { name: 'Google AI Overview', icon: '✨' },
  gemini: { name: 'Gemini', icon: '💎' },
  chatgpt: { name: 'ChatGPT', icon: '💬' },
  claude: { name: 'Claude', icon: '🧠' },
  perplexity: { name: 'Perplexity', icon: '🔮' },
};

const AI_PLATFORMS: PlatformId[] = ['chatgpt', 'gemini', 'perplexity', 'claude', 'google_ai_overview'];

// ============================================================================
// GEO Query Formulation — Hebrew SEO/GEO Toolkit guidelines
// Transforms raw visibility queries into GEO-optimized variants that better
// match how Israeli users ask AI platforms (conversational Hebrew patterns).
// ============================================================================

/**
 * Build GEO-optimized query variants per Hebrew SEO/GEO Toolkit guidelines:
 * 1. Conversational Hebrew phrasing ("מה זה", "איך", "למה", "מי הכי טוב")
 * 2. Local-intent signals (city, "באזור", "ליד")
 * 3. Comparison/recommendation patterns ("מומלץ", "השוואה", "עדיף")
 * 4. Platform-specific phrasing adjustments
 */
function buildGEOQuery(
  rawQuery: string,
  platformId: PlatformId,
  businessName: string,
  location?: string
): string {
  // For Google SEO — keep raw query (traditional keyword matching)
  if (platformId === 'google_seo') return rawQuery;

  let geoQuery = rawQuery;

  // Hebrew conversational framing for AI platforms
  // If the query is already a question, keep it; otherwise wrap in natural Hebrew question form
  const isQuestion =
    geoQuery.includes('?') ||
    geoQuery.startsWith('מה ') ||
    geoQuery.startsWith('איך ') ||
    geoQuery.startsWith('למה ') ||
    geoQuery.startsWith('מי ') ||
    geoQuery.startsWith('האם ') ||
    geoQuery.startsWith('כמה ') ||
    geoQuery.startsWith('איפה ') ||
    geoQuery.startsWith('מתי ');

  if (!isQuestion) {
    // Apply GEO conversational patterns based on query intent signals
    const hasLocalIntent = location && (
      geoQuery.includes(location) ||
      geoQuery.includes('באזור') ||
      geoQuery.includes('ליד') ||
      geoQuery.includes('בעיר')
    );

    const hasComparisonIntent =
      geoQuery.includes('השוואה') ||
      geoQuery.includes('מומלץ') ||
      geoQuery.includes('הכי טוב') ||
      geoQuery.includes('עדיף');

    if (hasComparisonIntent) {
      // Recommendation-style: "מי הכי טוב ל[QUERY]?"
      geoQuery = `מי הכי טוב ל${geoQuery}?`;
    } else if (hasLocalIntent) {
      // Local-intent: "איפה אפשר למצוא [QUERY]?"
      geoQuery = `איפה אפשר למצוא ${geoQuery}?`;
    } else {
      // Default informational: "מה זה [QUERY] ולמה זה חשוב?"
      geoQuery = `מה זה ${geoQuery}?`;
    }
  }

  // Platform-specific adjustments per GEO Toolkit
  switch (platformId) {
    case 'chatgpt':
      // ChatGPT responds well to explicit "המלץ לי" or "תסביר"
      if (!geoQuery.includes('המלץ') && !geoQuery.includes('תסביר')) {
        geoQuery = geoQuery.replace(/\?$/, ' — תן המלצה?');
      }
      break;
    case 'perplexity':
      // Perplexity prefers source-seeking queries — add "עם מקורות"
      if (!geoQuery.includes('מקורות') && !geoQuery.includes('לפי')) {
        geoQuery = geoQuery.replace(/\?$/, ' עם מקורות?');
      }
      break;
    case 'gemini':
    case 'google_ai_overview':
      // Google/Gemini: add location context if available
      if (location && !geoQuery.includes(location)) {
        geoQuery = geoQuery.replace(/\?$/, ` ב${location}?`);
      }
      break;
    case 'claude':
      // Claude responds well to detailed, structured questions
      break;
  }

  return geoQuery;
}

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  const now = new Date().toISOString();

  // Determine target domain and business name from plan
  let targetDomain = (plan as any).websiteUrl || (plan as any).url || (plan as any).domain || '';
  if (targetDomain && !targetDomain.startsWith('http://') && !targetDomain.startsWith('https://')) {
    targetDomain = `https://${targetDomain}`;
  }
  targetDomain = targetDomain.replace(/\/+$/, '');
  const businessName = (plan as any).businessName || (plan as any).clientName || targetDomain;

  // Get visibility queries from plan — these are the queries to check across platforms
  const visibilityQueries: Array<{ id: string; query: string; category?: string; intent?: string }> =
    (plan as any).visibilityQueries || [];

  if (visibilityQueries.length === 0) {
    return err('אין שאילתות נראות מוגדרות בתוכנית. הוסף שאילתות תחילה.', 400);
  }

  // Check which platforms are available
  const apiStatus = getApiStatus();

  // Run real queries against each platform
  const aiQueries: AIQueryResult[] = [];
  const platformStatuses: PlatformStatusResult[] = [];

  for (const platformId of AI_PLATFORMS) {
    const meta = PLATFORM_META[platformId];
    const available = isPlatformAvailable(platformId);

    if (!available) {
      platformStatuses.push({
        id: platformId,
        name: meta.name,
        icon: meta.icon,
        status: 'api_missing',
        queriesScanned: 0,
        mentionsFound: 0,
        scanMode: 'unavailable',
      });
      continue;
    }

    // Query this platform with each visibility query
    let mentions = 0;
    let scanned = 0;
    let hasError = false;

    // Extract location from plan for GEO query formulation
    const planLocation = (plan as any).location || (plan as any).city || '';

    for (const vq of visibilityQueries) {
      try {
        // Apply GEO query formulation per Hebrew SEO/GEO Toolkit guidelines
        const geoQuery = buildGEOQuery(vq.query, platformId, businessName, planLocation);

        const result: PlatformQueryResult = await queryPlatform(
          platformId,
          geoQuery,
          businessName,
          targetDomain
        );

        scanned++;
        if (result.found) mentions++;

        aiQueries.push({
          platform: platformId,
          query: vq.query, // Store original query for UI display
          queryId: vq.id,
          found: result.found,
          position: result.position,
          snippet: result.snippet,
          confidence: result.confidence,
          scanMode: result.scanMode,
          checkedAt: now,
        });
      } catch (e: any) {
        hasError = true;
        aiQueries.push({
          platform: platformId,
          query: vq.query,
          queryId: vq.id,
          found: false,
          confidence: 0,
          scanMode: 'real',
          checkedAt: now,
        });
      }
    }

    platformStatuses.push({
      id: platformId,
      name: meta.name,
      icon: meta.icon,
      status: hasError && scanned === 0 ? 'error' : 'completed',
      queriesScanned: scanned,
      mentionsFound: mentions,
      scanMode: 'real',
    });
  }

  // Also add Google SEO as a platform status (uses same Google API)
  const googleAvailable = isPlatformAvailable('google_seo');
  if (googleAvailable) {
    let googleMentions = 0;
    let googleScanned = 0;

    for (const vq of visibilityQueries) {
      try {
        const result = await queryPlatform('google_seo', vq.query, businessName, targetDomain);
        googleScanned++;
        if (result.found) googleMentions++;

        aiQueries.push({
          platform: 'google_seo',
          query: vq.query,
          queryId: vq.id,
          found: result.found,
          position: result.position,
          snippet: result.snippet,
          confidence: result.confidence,
          scanMode: result.scanMode,
          checkedAt: now,
        });
      } catch {
        // Skip individual failures
      }
    }

    platformStatuses.push({
      id: 'google_seo',
      name: 'Google SEO',
      icon: '🔍',
      status: 'completed',
      queriesScanned: googleScanned,
      mentionsFound: googleMentions,
      scanMode: googleAvailable ? 'real' : 'unavailable',
    });
  } else {
    platformStatuses.push({
      id: 'google_seo',
      name: 'Google SEO',
      icon: '🔍',
      status: 'api_missing',
      queriesScanned: 0,
      mentionsFound: 0,
      scanMode: 'unavailable',
    });
  }

  // Calculate overall visibility score
  const totalScanned = aiQueries.filter(q => q.scanMode === 'real').length;
  const totalMentions = aiQueries.filter(q => q.scanMode === 'real' && q.found).length;
  const visibilityScore = totalScanned > 0 ? Math.round((totalMentions / totalScanned) * 100) : 0;

  // Store results in the plan — using websiteScan fields that visibility-engine.ts reads
  const websiteScan = (plan as any).websiteScan || {};
  const updated = await updatePlanSafe(planId, {
    websiteScan: {
      ...websiteScan,
      aiQueries,
      platformStatuses,
      aiScanCompletedAt: now,
    },
    visibilityScore,
    visibilityResults: aiQueries.map(q => ({
      queryId: q.queryId,
      query: q.query,
      engine: q.platform,
      mentioned: q.found,
      position: q.position || null,
      context: q.snippet || (q.found ? `נמצא ב-${PLATFORM_META[q.platform]?.name}` : `לא נמצא ב-${PLATFORM_META[q.platform]?.name}`),
      sentiment: q.found ? 'positive' : 'not_mentioned',
      competitorsMentioned: [],
      scannedAt: q.checkedAt,
    })),
    status: 'visibility_done',
  } as any);

  if (!updated) return err('שגיאה בשמירת תוצאות הסריקה', 500);

  logActivity(planId, 'run_ai_scan', {
    resultsCount: aiQueries.length,
    visibilityScore,
    queriesScanned: visibilityQueries.length,
    platformsScanned: platformStatuses.filter(p => p.status === 'completed').length,
    platformsUnavailable: platformStatuses.filter(p => p.status === 'api_missing').length,
    totalMentions,
    apiStatus,
  });

  return ok({
    aiQueries,
    platformStatuses,
    score: visibilityScore,
    queryCount: visibilityQueries.length,
    platformsAvailable: platformStatuses.filter(p => p.status === 'completed').map(p => p.id),
    platformsMissing: platformStatuses.filter(p => p.status === 'api_missing').map(p => p.id),
  });
});
