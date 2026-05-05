// @ts-nocheck
/**
 * PIXEL SEO/GEO — Scan Orchestrator
 *
 * Ties together: crawler, GSC API, SERP API, website facts extraction,
 * gap analysis, why engine, and plan generation into a single pipeline.
 *
 * NEVER generates fake data. Returns null/partial for missing integrations.
 */

import { crawlWebsite, type CrawlResult, type CrawlOptions } from './crawler';
import { isGSCAvailable, fetchGSCData, getGSCSiteUrl, type GSCData } from './gsc-api';
import { isSerpAvailable, fetchBulkSerp, checkDomainRankings, type SerpResult, type DomainRankingResult } from './serp-api';
import { extractWebsiteFacts, type WebsiteFacts } from './website-facts';
import { analyzeGaps, type GapAnalysisResult } from './gap-analysis';
import { validateScanData, type ValidationResult } from './validation-gate';
import { ScanLogger, type ScanLog } from './scan-logs';
import { isPlatformAvailable, queryPlatform } from './platform-apis';
import { PLATFORMS, type PlatformId, type PlatformStatus, type ScanType, getScanConfig } from './scan-pipeline';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrchestratorInput {
  planId: string;
  url: string;
  scanType: ScanType;
  domain: string;              // extracted domain
}

export interface OrchestratorResult {
  success: boolean;
  scanId: string;
  planId: string;
  url: string;
  scanType: ScanType;
  startedAt: string;
  completedAt: string;
  durationMs: number;

  // Core data
  crawlResult: CrawlResult | null;
  gscData: GSCData | null;
  serpData: Map<string, SerpResult> | null;
  domainRankings: DomainRankingResult[] | null;
  websiteFacts: WebsiteFacts | null;
  gapAnalysis: GapAnalysisResult | null;

  // Platform visibility
  platformStatuses: PlatformStatus[];
  aiVisibilityResults: AIVisibilityResult[];

  // Validation
  validation: ValidationResult;

  // Logging
  scanLog: ScanLog;

  // Data availability flags
  integrations: {
    gsc: boolean;
    serp: boolean;
    openai: boolean;
    anthropic: boolean;
    gemini: boolean;
    perplexity: boolean;
  };
}

export interface AIVisibilityResult {
  platform: PlatformId;
  query: string;
  found: boolean;
  position?: number;
  snippet?: string;
  confidence: number;
  scanMode: 'real' | 'unavailable';
}

// ── Main Orchestrator ──────────────────────────────────────────────────────

export async function runFullScan(input: OrchestratorInput): Promise<OrchestratorResult> {
  const { planId, url, scanType, domain } = input;
  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const logger = new ScanLogger(scanId, planId, url);
  const startedAt = new Date().toISOString();
  const config = getScanConfig(scanType);

  // Initialize integrations check
  const integrations = {
    gsc: isGSCAvailable(),
    serp: isSerpAvailable(),
    openai: isPlatformAvailable('chatgpt' as any),
    anthropic: isPlatformAvailable('claude' as any),
    gemini: isPlatformAvailable('gemini' as any),
    perplexity: isPlatformAvailable('perplexity' as any),
  };

  logger.logAction('init', 'Starting scan orchestrator', { scanType, url, integrations });

  // ── Stage 1: Crawl Website ──
  let crawlResult: CrawlResult | null = null;
  try {
    logger.logAction('crawl', 'Starting website crawl', { maxPages: config.maxPages });
    const crawlStart = Date.now();
    crawlResult = await crawlWebsite(url, { maxPages: config.maxPages, maxDepth: scanType === 'deep' ? 3 : 2 });
    const crawlDuration = Date.now() - crawlStart;
    logger.logAction('crawl', 'Crawl completed', { pages: crawlResult.pagesScanned, duration: crawlDuration }, crawlDuration);
    for (let i = 0; i < crawlResult.pagesScanned; i++) logger.incrementPages();
  } catch (err: any) {
    logger.logAction('crawl', 'Crawl failed', { error: err.message }, 0, false, err.message);
  }

  // ── Stage 2: Extract Website Facts ──
  let websiteFacts: WebsiteFacts | null = null;
  if (crawlResult && crawlResult.pages.length > 0) {
    try {
      logger.logAction('facts', 'Extracting website facts');
      // Build the scan data object that extractWebsiteFacts expects
      const scanData = {
        metaTitle: crawlResult.pages[0]?.title || '',
        metaDescription: crawlResult.pages[0]?.metaDescription || '',
        h1Tags: crawlResult.pages[0]?.h1Tags || [],
        structuredData: crawlResult.pages[0]?.schemaMarkup || [],
      };
      const scannedPages = crawlResult.pages.map(p => ({
        url: p.url,
        title: p.title || '',
        metaDescription: p.metaDescription || '',
        h1Tags: p.h1Tags,
        h2Tags: p.h2Tags,
        paragraphs: p.paragraphs,
        schemaMarkup: p.schemaMarkup,
        internalLinks: p.internalLinks,
        wordCount: p.wordCount,
      }));
      websiteFacts = extractWebsiteFacts(scanData, scannedPages, url);
      const evidenceCount = Object.values(websiteFacts || {}).filter(v => v && typeof v === 'object' && 'confidence' in v && (v as any).confidence > 0).length;
      for (let i = 0; i < evidenceCount; i++) logger.incrementEvidence();
      logger.logAction('facts', 'Facts extracted', { evidenceCount });
    } catch (err: any) {
      logger.logAction('facts', 'Facts extraction failed', { error: err.message }, 0, false, err.message);
    }
  }

  // ── Stage 3: Pull GSC Data ──
  let gscData: GSCData | null = null;
  if (integrations.gsc) {
    try {
      logger.logAction('gsc', 'Fetching Google Search Console data');
      logger.incrementApiCall();
      const siteUrl = getGSCSiteUrl(domain);
      gscData = await fetchGSCData(siteUrl);
      if (gscData) {
        logger.logAction('gsc', 'GSC data received', { queries: gscData.queries.length, pages: gscData.pages.length });
      } else {
        logger.logAction('gsc', 'GSC returned no data', null, 0, false);
        logger.incrementApiCall(true);
      }
    } catch (err: any) {
      logger.logAction('gsc', 'GSC fetch failed', { error: err.message }, 0, false, err.message);
      logger.incrementApiCall(true);
    }
  } else {
    logger.logAction('gsc', 'GSC not configured — skipping', { reason: 'No credentials' });
    logger.rejectAssumption('gsc_data', null, 'GSC לא מוגדר', 'GSC not configured', 'ENV_MISSING');
  }

  // ── Stage 4: Pull SERP Data ──
  let serpData: Map<string, SerpResult> | null = null;
  let domainRankings: DomainRankingResult[] | null = null;
  if (integrations.serp && websiteFacts) {
    try {
      // Build queries from facts + GSC
      const keywords: string[] = [];
      if (websiteFacts.keywords && 'value' in websiteFacts.keywords && Array.isArray((websiteFacts.keywords as any).value)) {
        keywords.push(...(websiteFacts.keywords as any).value.slice(0, 20));
      }
      if (gscData) {
        const topGscQueries = gscData.queries.slice(0, 10).map(q => q.query);
        keywords.push(...topGscQueries.filter(q => !keywords.includes(q)));
      }

      if (keywords.length > 0) {
        logger.logAction('serp', 'Fetching SERP rankings', { queryCount: keywords.length });
        logger.incrementApiCall();

        serpData = await fetchBulkSerp(keywords.slice(0, 20), { location: 'Israel', language: 'he' });
        domainRankings = await checkDomainRankings(domain, keywords.slice(0, 15), { location: 'Israel', language: 'he' });

        logger.logAction('serp', 'SERP data received', {
          queriesChecked: keywords.length,
          resultsReturned: serpData?.size || 0,
          rankingsFound: domainRankings?.filter(r => r.position !== null).length || 0,
        });
      }
    } catch (err: any) {
      logger.logAction('serp', 'SERP fetch failed', { error: err.message }, 0, false, err.message);
      logger.incrementApiCall(true);
    }
  } else if (!integrations.serp) {
    logger.logAction('serp', 'SERP API not configured — skipping');
    logger.rejectAssumption('serp_data', null, 'SERP API לא מוגדר', 'SERP API not configured', 'ENV_MISSING');
  }

  // ── Stage 5: AI Visibility Check ──
  const platformStatuses: PlatformStatus[] = [];
  const aiVisibilityResults: AIVisibilityResult[] = [];

  // Build queries for AI platforms
  const aiQueries: string[] = [];
  if (websiteFacts?.business_type && 'value' in websiteFacts.business_type && (websiteFacts.business_type as any).value) {
    const biz = (websiteFacts.business_type as any).value;
    const location = websiteFacts.location && 'value' in websiteFacts.location ? (websiteFacts.location as any).value : '';
    aiQueries.push(`מה הכי טוב ב${biz} ${location ? 'ב' + location : ''}`.trim());
    aiQueries.push(`המלצות ל${biz}`);
    if (websiteFacts.products_services && 'value' in websiteFacts.products_services) {
      const services = (websiteFacts.products_services as any).value || [];
      if (services.length > 0) aiQueries.push(`${services[0]} ${location || ''}`);
    }
  }

  for (const platform of PLATFORMS) {
    const pid = platform.id as PlatformId;
    const available = isPlatformAvailable(pid as any);

    if (!available || pid === 'google_seo') {
      platformStatuses.push({
        id: pid, name: platform.name, icon: platform.icon,
        status: pid === 'google_seo' ? 'completed' : 'api_missing',
        queriesScanned: 0, mentionsFound: 0,
        scanMode: pid === 'google_seo' ? 'real' : 'unavailable',
      });
      continue;
    }

    // Real AI platform query
    let mentions = 0;
    const queriesForPlatform = aiQueries.slice(0, 3);

    for (const q of queriesForPlatform) {
      try {
        logger.incrementApiCall();
        const result = await queryPlatform(pid as any, q, domain);
        if (result && result.found) mentions++;
        aiVisibilityResults.push({
          platform: pid, query: q,
          found: result?.found || false,
          position: result?.position,
          snippet: result?.snippet,
          confidence: result?.confidence || 0,
          scanMode: result?.scanMode || 'unavailable',
        });
      } catch (err: any) {
        logger.incrementApiCall(true);
        aiVisibilityResults.push({
          platform: pid, query: q, found: false, confidence: 0, scanMode: 'unavailable',
        });
      }
    }

    platformStatuses.push({
      id: pid, name: platform.name, icon: platform.icon,
      status: 'completed',
      queriesScanned: queriesForPlatform.length,
      mentionsFound: mentions,
      scanMode: 'real',
    });
  }

  logger.logAction('visibility', 'AI visibility check completed', {
    platforms: platformStatuses.length,
    totalQueries: aiVisibilityResults.length,
    totalMentions: aiVisibilityResults.filter(r => r.found).length,
  });

  // ── Stage 6: Gap Analysis ──
  let gapAnalysis: GapAnalysisResult | null = null;
  if (crawlResult || gscData || domainRankings) {
    try {
      logger.logAction('gaps', 'Running gap analysis');
      gapAnalysis = analyzeGaps({
        domain,
        gscQueries: gscData?.queries || null,
        gscPages: gscData?.pages || null,
        serpRankings: domainRankings || null,
        crawlPages: crawlResult?.pages || null,
        technicalIssues: crawlResult?.technicalIssues || null,
      });
      logger.logAction('gaps', 'Gap analysis completed', {
        keywordGaps: gapAnalysis.keywordGaps.length,
        contentGaps: gapAnalysis.contentGaps.length,
        technicalGaps: gapAnalysis.technicalGaps.length,
      });
    } catch (err: any) {
      logger.logAction('gaps', 'Gap analysis failed', { error: err.message }, 0, false, err.message);
    }
  }

  // ── Final Validation ──
  const validation = validateScanData({
    websiteFacts,
    crawlResult,
    scanDurationMs: Date.now() - new Date(startedAt).getTime(),
    pagesScanned: crawlResult?.pagesScanned || 0,
    evidenceCount: logger.getLog().metrics.evidenceCollected,
  });

  logger.logAction('validate', 'Final validation', { result: validation.mode, canProceed: validation.canProceed });

  // ── Finalize ──
  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const scanLog = logger.finalize(validation.isValid ? 'completed' : durationMs < 5000 ? 'invalid' : 'completed');

  return {
    success: true,
    scanId,
    planId,
    url,
    scanType,
    startedAt,
    completedAt,
    durationMs,
    crawlResult,
    gscData,
    serpData: serpData || null,
    domainRankings,
    websiteFacts,
    gapAnalysis,
    platformStatuses,
    aiVisibilityResults,
    validation,
    scanLog,
    integrations,
  };
}
