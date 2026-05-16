import {
  ScanMode,
  VisibilityPlatformId,
  PlatformSummary,
  PlatformResultBase,
  ResultEvidence,
  GoogleSeoResult,
  GoogleAiOverviewResult,
  AiPlatformResult,
  PlatformResult,
} from '@/lib/db/schema';

/**
 * Platform configuration mapping
 */
export const PLATFORM_CONFIG: Record<
  VisibilityPlatformId,
  { name: string; icon: string; description: string }
> = {
  google_seo: {
    name: 'Google SEO',
    icon: '🔍',
    description: 'Organic search results on Google',
  },
  google_ai_overview: {
    name: 'Google AI Overview',
    icon: '✨',
    description: 'AI-generated summaries in Google search',
  },
  gemini: {
    name: 'Gemini',
    icon: '💎',
    description: 'Google Gemini AI responses',
  },
  chatgpt: {
    name: 'ChatGPT',
    icon: '💬',
    description: 'OpenAI ChatGPT responses',
  },
  claude: {
    name: 'Claude',
    icon: '🧠',
    description: 'Anthropic Claude responses',
  },
  perplexity: {
    name: 'Perplexity',
    icon: '🔮',
    description: 'Perplexity AI responses',
  },
};

/**
 * Maps engine names from plan data to platform IDs
 */
function engineToPlatformId(
  engine: string
): VisibilityPlatformId | null {
  const mapping: Record<string, VisibilityPlatformId> = {
    chatgpt: 'chatgpt',
    gemini: 'gemini',
    perplexity: 'perplexity',
    claude: 'claude',
    copilot: 'chatgpt', // Copilot maps to ChatGPT
  };
  return mapping[engine] || null;
}

/**
 * Computes opportunity score based on mention status and query characteristics
 * Higher score = bigger opportunity
 */
export function computeOpportunityScore(
  mentioned: boolean,
  importance: string,
  intent: string,
  competitorCount: number
): number {
  let score = 0;

  // Not mentioned is the biggest opportunity (base 60 points)
  if (!mentioned) {
    score += 60;
  }

  // Importance levels (0-20 points)
  const importanceWeight: Record<string, number> = {
    critical: 20,
    high: 15,
    medium: 10,
    low: 5,
  };
  score += importanceWeight[importance.toLowerCase()] || 5;

  // Intent levels (0-20 points) - transactional highest
  const intentWeight: Record<string, number> = {
    transactional: 20,
    commercial: 15,
    informational: 10,
    navigational: 5,
  };
  score += intentWeight[intent.toLowerCase()] || 5;

  // Competitor mentions increase opportunity (0-20 points)
  if (competitorCount > 0) {
    score += Math.min(20, competitorCount * 2);
  }

  return Math.min(100, score); // Cap at 100
}

/**
 * Generates stable ID from plan ID, platform, and query ID
 */
function generateResultId(
  planId: string,
  platformId: VisibilityPlatformId,
  queryId: string
): string {
  return `${planId}-${platformId}-${queryId}`;
}

/**
 * Extracts aiQueries from plan data — checks both websiteScan.aiQueries and plan.aiQueries
 */
function extractAiQueries(plan: any): any[] {
  return plan?.websiteScan?.aiQueries || plan?.aiQueries || [];
}

/**
 * Extracts platformStatuses from plan data — checks both websiteScan and plan level
 */
function extractPlatformStatuses(plan: any): any[] {
  return plan?.websiteScan?.platformStatuses || plan?.platformStatuses || [];
}

/**
 * Maps scan-pipeline platform IDs to visibility platform IDs
 * The scan pipeline uses the same IDs as PLATFORM_CONFIG (google_seo, chatgpt, etc.)
 */
function scanPlatformToVisibilityId(platform: string): VisibilityPlatformId | null {
  const mapping: Record<string, VisibilityPlatformId> = {
    google_seo: 'google_seo',
    google_ai_overview: 'google_ai_overview',
    chatgpt: 'chatgpt',
    gemini: 'gemini',
    claude: 'claude',
    perplexity: 'perplexity',
  };
  return mapping[platform] || engineToPlatformId(platform);
}

/**
 * Builds platform summaries from plan data
 * Reads from scan pipeline's aiQueries + platformStatuses format,
 * with fallback to legacy visibilityResults format.
 */
export function buildPlatformSummaries(plan: any): PlatformSummary[] {
  const summaries: PlatformSummary[] = [];
  const aiQueries = extractAiQueries(plan);
  const platformStatuses = extractPlatformStatuses(plan);
  const legacyVisibilityResults = plan.visibilityResults || [];

  // If we have platformStatuses from the scan pipeline, use them directly
  // They already have queriesScanned, mentionsFound, scanMode per platform
  const statusMap = new Map<string, any>();
  for (const ps of platformStatuses) {
    statusMap.set(ps.id, ps);
  }

  // Also group aiQueries by platform for detailed data
  const queryByPlatform = new Map<string, any[]>();
  for (const q of aiQueries) {
    const pid = q.platform;
    if (!pid) continue;
    if (!queryByPlatform.has(pid)) queryByPlatform.set(pid, []);
    queryByPlatform.get(pid)!.push(q);
  }

  // Also handle legacy format — group visibilityResults by engine
  const legacyByPlatform = new Map<VisibilityPlatformId, any[]>();
  for (const result of legacyVisibilityResults) {
    const pid = engineToPlatformId(result.engine);
    if (!pid) continue;
    if (!legacyByPlatform.has(pid)) legacyByPlatform.set(pid, []);
    legacyByPlatform.get(pid)!.push(result);
  }

  // Build summaries for all platforms
  const allPlatformIds: VisibilityPlatformId[] = [
    'google_seo',
    'google_ai_overview',
    'gemini',
    'chatgpt',
    'claude',
    'perplexity',
  ];

  for (const platformId of allPlatformIds) {
    const status = statusMap.get(platformId);
    const queries = queryByPlatform.get(platformId) || [];
    const legacyResults = legacyByPlatform.get(platformId) || [];

    // Priority 1: Use platformStatuses from scan pipeline (most reliable)
    if (status && (status.queriesScanned > 0 || status.mentionsFound > 0)) {
      const qs = status.queriesScanned || queries.length;
      const mentions = status.mentionsFound || queries.filter((q: any) => q.found).length;
      const pct = qs > 0 ? (mentions / qs) * 100 : 0;
      summaries.push({
        platformId,
        platformName: PLATFORM_CONFIG[platformId].name,
        icon: PLATFORM_CONFIG[platformId].icon,
        queriesScanned: qs,
        mentions,
        visibilityPct: Math.round(pct * 10) / 10,
        scanMode: (status.scanMode || 'simulated') as ScanMode,
        lastScannedAt: plan.completedAt || plan.updatedAt || null,
      });
      continue;
    }

    // Priority 2: Use aiQueries grouped by platform
    if (queries.length > 0) {
      const mentions = queries.filter((q: any) => q.found).length;
      const pct = queries.length > 0 ? (mentions / queries.length) * 100 : 0;
      summaries.push({
        platformId,
        platformName: PLATFORM_CONFIG[platformId].name,
        icon: PLATFORM_CONFIG[platformId].icon,
        queriesScanned: queries.length,
        mentions,
        visibilityPct: Math.round(pct * 10) / 10,
        scanMode: (queries[0]?.scanMode || 'simulated') as ScanMode,
        lastScannedAt: queries[0]?.checkedAt || null,
      });
      continue;
    }

    // Priority 3: Use legacy visibilityResults
    if (legacyResults.length > 0) {
      const mentions = legacyResults.filter((r: any) => r.mentioned).length;
      const pct = legacyResults.length > 0 ? (mentions / legacyResults.length) * 100 : 0;
      summaries.push({
        platformId,
        platformName: PLATFORM_CONFIG[platformId].name,
        icon: PLATFORM_CONFIG[platformId].icon,
        queriesScanned: legacyResults.length,
        mentions,
        visibilityPct: Math.round(pct * 10) / 10,
        scanMode: (plan.scanMode || 'simulated') as ScanMode,
        lastScannedAt: legacyResults[0]?.scannedAt || null,
      });
      continue;
    }

    // No data — check if platform was scanned but had 0 results vs never scanned
    const wasScanned = status && status.status === 'completed';
    summaries.push({
      platformId,
      platformName: PLATFORM_CONFIG[platformId].name,
      icon: PLATFORM_CONFIG[platformId].icon,
      queriesScanned: 0,
      mentions: 0,
      visibilityPct: 0,
      scanMode: wasScanned ? ((status.scanMode || 'simulated') as ScanMode) : 'unavailable',
      lastScannedAt: null,
    });
  }

  return summaries;
}

/**
 * Builds platform-specific results from plan data
 * Reads from scan pipeline's aiQueries format with fallback to legacy visibilityResults.
 */
export function buildPlatformResults(
  plan: any,
  platformId: VisibilityPlatformId
): PlatformResult[] {
  const aiQueries = extractAiQueries(plan);
  const legacyVisibilityResults = plan.visibilityResults || [];
  const legacyVisibilityQueries = plan.visibilityQueries || [];
  const planId = plan.id || '';

  // ── Try scan-pipeline aiQueries format first ──
  const pipelineResults = aiQueries.filter(
    (q: any) => scanPlatformToVisibilityId(q.platform) === platformId
  );

  if (pipelineResults.length > 0) {
    return pipelineResults.map((q: any, idx: number) => {
      const sm = (q.scanMode || 'simulated') as ScanMode;
      const confidence = q.confidence ?? (sm === 'real' ? 100 : sm === 'simulated' ? 50 : 0);
      const mentioned = !!q.found;

      const evidence: ResultEvidence = {
        sourceUrl: null,
        extractedSnippet: q.snippet || null,
        rawApiResponse: null,
        scanMode: sm,
        confidence,
      };

      const opportunityScore = computeOpportunityScore(
        mentioned,
        'medium',
        'informational',
        0
      );

      // Try to extract competitors from snippet (names/brands mentioned)
      const competitors: string[] = q.competitorsMentioned || [];
      // Try to extract sources if available
      const sources: string[] = q.sources || [];

      const result: AiPlatformResult = {
        id: `${planId}-${platformId}-${idx}`,
        planId,
        platformId,
        query: q.query || '',
        queryCategory: 'general',
        queryIntent: 'informational',
        mentioned,
        scanMode: sm,
        confidence,
        evidence,
        scannedAt: q.checkedAt || new Date().toISOString(),
        competitorsMentioned: competitors,
        opportunityScore,
        answer: q.snippet || null,
        mentionContext: q.snippet || null,
        sources,
      };

      return result;
    });
  }

  // ── Fallback to legacy visibilityResults format ──
  const scanMode = (plan.scanMode || 'simulated') as ScanMode;

  // Create lookup for query metadata
  const queryMetadata = new Map<
    string,
    { category: string; intent: string; importance: string }
  >();
  for (const q of legacyVisibilityQueries) {
    queryMetadata.set(q.query, {
      category: q.category || 'general',
      intent: q.intent || 'informational',
      importance: q.importance || 'medium',
    });
  }

  const platformResults: PlatformResult[] = [];

  for (const result of legacyVisibilityResults) {
    const resultPlatformId = engineToPlatformId(result.engine);
    if (resultPlatformId !== platformId) continue;

    const metadata = queryMetadata.get(result.query) || {
      category: 'general',
      intent: 'informational',
      importance: 'medium',
    };

    let confidence: number;
    if (scanMode === 'unavailable') {
      confidence = 0;
    } else if (scanMode === 'real') {
      confidence = 100;
    } else {
      confidence = 50;
    }

    const evidence: ResultEvidence = {
      sourceUrl: null,
      extractedSnippet: result.context || null,
      rawApiResponse: null,
      scanMode,
      confidence,
    };

    const opportunityScore = computeOpportunityScore(
      result.mentioned,
      metadata.importance,
      metadata.intent,
      result.competitorsMentioned?.length || 0
    );

    const id = generateResultId(planId, platformId, result.queryId || String(platformResults.length));

    const aiResult: AiPlatformResult = {
      id,
      planId,
      platformId,
      query: result.query,
      queryCategory: metadata.category,
      queryIntent: metadata.intent,
      mentioned: result.mentioned,
      scanMode,
      confidence,
      evidence,
      scannedAt: result.scannedAt,
      competitorsMentioned: result.competitorsMentioned || [],
      opportunityScore,
      answer: result.context || null,
      mentionContext: result.context || null,
      sources: [],
    };

    platformResults.push(aiResult);
  }

  return platformResults;
}

/**
 * Clusters results by query category
 */
export function clusterKeywords(
  results: PlatformResultBase[]
): Map<string, PlatformResultBase[]> {
  const clusters = new Map<string, PlatformResultBase[]>();

  for (const result of results) {
    const category = result.queryCategory || 'uncategorized';
    if (!clusters.has(category)) {
      clusters.set(category, []);
    }
    clusters.get(category)!.push(result);
  }

  return clusters;
}

/**
 * Builds global metrics from platform summaries
 */
export function buildGlobalMetrics(
  summaries: PlatformSummary[]
): {
  totalQueries: number;
  totalMentions: number;
  overallVisibilityPct: number;
  perPlatform: PlatformSummary[];
} {
  let totalQueries = 0;
  let totalMentions = 0;

  for (const summary of summaries) {
    if (summary.scanMode !== 'unavailable') {
      totalQueries += summary.queriesScanned;
      totalMentions += summary.mentions;
    }
  }

  const overallVisibilityPct =
    totalQueries > 0 ? (totalMentions / totalQueries) * 100 : 0;

  return {
    totalQueries,
    totalMentions,
    overallVisibilityPct: Math.round(overallVisibilityPct * 10) / 10,
    perPlatform: summaries,
  };
}
