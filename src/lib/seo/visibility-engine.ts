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
} from '@/lib/schema';

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
 * Builds platform summaries from plan data
 * Computes metrics for each platform (queries scanned, mentions, visibility %)
 */
export function buildPlatformSummaries(plan: any): PlatformSummary[] {
  const summaries: PlatformSummary[] = [];
  const visibilityResults = plan.visibilityResults || [];
  const visibilityQueries = plan.visibilityQueries || [];

  // Google SEO - no existing data source
  summaries.push({
    platformId: 'google_seo',
    platformName: PLATFORM_CONFIG.google_seo.name,
    icon: PLATFORM_CONFIG.google_seo.icon,
    queriesScanned: 0,
    mentions: 0,
    visibilityPct: 0,
    scanMode: 'unavailable',
    lastScannedAt: null,
  });

  // Google AI Overview - no existing data source
  summaries.push({
    platformId: 'google_ai_overview',
    platformName: PLATFORM_CONFIG.google_ai_overview.name,
    icon: PLATFORM_CONFIG.google_ai_overview.icon,
    queriesScanned: 0,
    mentions: 0,
    visibilityPct: 0,
    scanMode: 'unavailable',
    lastScannedAt: null,
  });

  // AI Platforms - built from visibilityResults
  const aiPlatforms = new Map<VisibilityPlatformId, any[]>();

  // Group results by platform
  for (const result of visibilityResults) {
    const platformId = engineToPlatformId(result.engine);
    if (!platformId) continue;

    if (!aiPlatforms.has(platformId)) {
      aiPlatforms.set(platformId, []);
    }
    aiPlatforms.get(platformId)!.push(result);
  }

  // Build summaries for AI platforms
  const aiPlatformIds: VisibilityPlatformId[] = [
    'gemini',
    'chatgpt',
    'claude',
    'perplexity',
  ];
  for (const platformId of aiPlatformIds) {
    const platformResults = aiPlatforms.get(platformId) || [];

    if (platformResults.length === 0) {
      // No data for this platform
      summaries.push({
        platformId,
        platformName: PLATFORM_CONFIG[platformId].name,
        icon: PLATFORM_CONFIG[platformId].icon,
        queriesScanned: 0,
        mentions: 0,
        visibilityPct: 0,
        scanMode: 'unavailable',
        lastScannedAt: null,
      });
    } else {
      const mentions = platformResults.filter((r) => r.mentioned).length;
      const queriesScanned = platformResults.length;
      const visibilityPct =
        queriesScanned > 0 ? (mentions / queriesScanned) * 100 : 0;
      const scanMode = plan.scanMode || 'simulated';
      const lastScannedAt = platformResults
        .map((r) => new Date(r.scannedAt).getTime())
        .reduce((max, t) => Math.max(max, t), 0);

      summaries.push({
        platformId,
        platformName: PLATFORM_CONFIG[platformId].name,
        icon: PLATFORM_CONFIG[platformId].icon,
        queriesScanned,
        mentions,
        visibilityPct: Math.round(visibilityPct * 10) / 10,
        scanMode: scanMode as ScanMode,
        lastScannedAt: lastScannedAt > 0 ? new Date(lastScannedAt).toISOString() : null,
      });
    }
  }

  return summaries;
}

/**
 * Builds platform-specific results from plan data
 * Returns empty array for platforms with no data source
 */
export function buildPlatformResults(
  plan: any,
  platformId: VisibilityPlatformId
): PlatformResult[] {
  // Google SEO and AI Overview have no data source
  if (platformId === 'google_seo' || platformId === 'google_ai_overview') {
    return [];
  }

  const visibilityResults = plan.visibilityResults || [];
  const visibilityQueries = plan.visibilityQueries || [];
  const scanMode = plan.scanMode || 'simulated';
  const planId = plan.id || '';

  // Create lookup for query metadata
  const queryMetadata = new Map<
    string,
    { category: string; intent: string; importance: string }
  >();
  for (const q of visibilityQueries) {
    queryMetadata.set(q.query, {
      category: q.category || 'general',
      intent: q.intent || 'informational',
      importance: q.importance || 'medium',
    });
  }

  // Filter results for this platform
  const platformResults: PlatformResult[] = [];

  for (const result of visibilityResults) {
    const resultPlatformId = engineToPlatformId(result.engine);
    if (resultPlatformId !== platformId) continue;

    const metadata = queryMetadata.get(result.query) || {
      category: 'general',
      intent: 'informational',
      importance: 'medium',
    };

    // Determine confidence level based on scan mode
    let confidence: number;
    if (scanMode === 'unavailable') {
      confidence = 0;
    } else if (scanMode === 'real') {
      confidence = 100;
    } else {
      confidence = 50; // simulated
    }

    // Build evidence
    const evidence: ResultEvidence = {
      sourceUrl: null,
      extractedSnippet: result.context || null,
      rawApiResponse: null,
      scanMode: scanMode as ScanMode,
      confidence,
    };

    // Compute opportunity score
    const opportunityScore = computeOpportunityScore(
      result.mentioned,
      metadata.importance,
      metadata.intent,
      result.competitorsMentioned?.length || 0
    );

    // Create result ID
    const id = generateResultId(planId, platformId, result.queryId);

    // Build AI platform result
    const aiResult: AiPlatformResult = {
      id,
      planId,
      platformId: platformId as VisibilityPlatformId,
      query: result.query,
      queryCategory: metadata.category,
      queryIntent: metadata.intent,
      mentioned: result.mentioned,
      scanMode: scanMode as ScanMode,
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
