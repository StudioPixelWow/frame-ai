import type { GSCQueryData, GSCPageData } from './gsc-api';
import type { DomainRankingResult } from './serp-api';
import type { ParsedPageData, TechnicalIssue } from './crawler';

// ============================================================================
// INTERFACES
// ============================================================================

export interface GapAnalysisInput {
  domain: string;
  gscQueries?: GSCQueryData[] | null;
  gscPages?: GSCPageData[] | null;
  serpRankings?: DomainRankingResult[] | null;
  crawlPages?: ParsedPageData[] | null;
  technicalIssues?: TechnicalIssue[] | null;
}

export interface KeywordGap {
  type: 'low_ctr' | 'not_ranking' | 'declining' | 'competitor_owns' | 'untapped_impressions';
  keyword: string;
  evidence: GapEvidence;
  opportunity: 'high' | 'medium' | 'low';
  currentMetrics: {
    impressions?: number;
    clicks?: number;
    ctr?: number;
    position?: number;
  };
  suggestedAction: string;       // Hebrew
  suggestedActionEn: string;     // English for code reference
  relatedUrl?: string;           // page that should rank for this
  competitors?: { domain: string; position: number }[];
}

export interface ContentGap {
  type: 'thin_content' | 'missing_topic' | 'no_faq' | 'no_schema' | 'weak_internal_links' | 'missing_h1_keywords';
  url: string;
  evidence: GapEvidence;
  severity: 'critical' | 'warning' | 'info';
  description: string;          // Hebrew
  descriptionEn: string;
  relatedKeywords: string[];
  suggestedFix: string;         // Hebrew
}

export interface TechnicalGap {
  type: string;
  url: string;
  evidence: GapEvidence;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  impact: string;              // Hebrew description of SEO impact
}

export interface GapEvidence {
  source: 'gsc' | 'serp' | 'crawl' | 'combined';
  dataPoint: string;           // e.g. "Position 15, 2400 impressions, 1.2% CTR"
  confidence: number;          // 0-100
  rawData?: any;
}

export interface GapAnalysisResult {
  domain: string;
  analyzedAt: string;
  dataCompleteness: {
    hasGSC: boolean;
    hasSERP: boolean;
    hasCrawl: boolean;
    overallConfidence: number;
  };
  keywordGaps: KeywordGap[];
  contentGaps: ContentGap[];
  technicalGaps: TechnicalGap[];
  summary: {
    totalGaps: number;
    criticalGaps: number;
    highOpportunityKeywords: number;
    estimatedTrafficPotential: number | null;  // null if can't calculate
  };
  limitations: string[];       // Hebrew messages about what couldn't be analyzed
}

// ============================================================================
// EXPECTED CTR BY POSITION
// ============================================================================

const EXPECTED_CTR_BY_POSITION: Record<number, number> = {
  1: 0.28,
  2: 0.15,
  3: 0.11,
  4: 0.07,
  5: 0.07,
  6: 0.03,
  7: 0.03,
  8: 0.03,
  9: 0.03,
  10: 0.03,
  11: 0.01,
  12: 0.01,
  13: 0.01,
  14: 0.01,
  15: 0.01,
  16: 0.01,
  17: 0.01,
  18: 0.01,
  19: 0.01,
  20: 0.01,
};

// Helper to get expected CTR for a position
function getExpectedCTR(position: number): number {
  if (position <= 0) return 0;
  if (position <= 20) return EXPECTED_CTR_BY_POSITION[position] || 0.01;
  return 0.005; // beyond position 20
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export function analyzeGaps(input: GapAnalysisInput): GapAnalysisResult {
  const now = new Date().toISOString();

  // Check data availability
  const hasGSC = !!(input.gscQueries?.length || input.gscPages?.length);
  const hasSERP = !!(input.serpRankings?.length);
  const hasCrawl = !!(input.crawlPages?.length);

  // If neither GSC nor SERP available, cannot perform meaningful analysis
  if (!hasGSC && !hasSERP) {
    return {
      domain: input.domain,
      analyzedAt: now,
      dataCompleteness: {
        hasGSC: false,
        hasSERP: false,
        hasCrawl: hasCrawl,
        overallConfidence: 0,
      },
      keywordGaps: [],
      contentGaps: [],
      technicalGaps: [],
      summary: {
        totalGaps: 0,
        criticalGaps: 0,
        highOpportunityKeywords: 0,
        estimatedTrafficPotential: null,
      },
      limitations: [
        'אין מספיק נתונים מאומתים לניתוח פערים. חבר את Google Search Console או ספק SERP API.',
      ],
    };
  }

  const keywordGaps: KeywordGap[] = [];
  const contentGaps: ContentGap[] = [];
  const technicalGaps: TechnicalGap[] = [];
  const limitations: string[] = [];

  // ========================================================================
  // 1. ANALYZE KEYWORD GAPS FROM GSC
  // ========================================================================

  if (input.gscQueries && input.gscQueries.length > 0) {
    const gscMap = new Map<string, GSCQueryData>();
    input.gscQueries.forEach(q => {
      gscMap.set(q.query.toLowerCase(), q);
    });

    gscMap.forEach((query) => {
      // Check for low CTR: impressions exist but CTR is below expected for position
      if (query.position && query.position >= 4 && query.position <= 20) {
        const expectedCTR = getExpectedCTR(query.position);
        const actualCTR = query.ctr || 0;
        const ctrGap = expectedCTR - actualCTR;

        // Only flag if actual CTR is significantly below expected (more than 30% below)
        if (ctrGap > expectedCTR * 0.3 && query.impressions && query.impressions > 100) {
          keywordGaps.push({
            type: 'low_ctr',
            keyword: query.query,
            evidence: {
              source: 'gsc',
              dataPoint: `Position ${query.position}, ${query.impressions} impressions, ${(actualCTR * 100).toFixed(2)}% CTR (expected: ${(expectedCTR * 100).toFixed(2)}%)`,
              confidence: 85,
              rawData: query,
            },
            opportunity: actualCTR < expectedCTR * 0.5 ? 'high' : 'medium',
            currentMetrics: {
              impressions: query.impressions,
              clicks: query.clicks,
              ctr: actualCTR,
              position: query.position,
            },
            suggestedAction: `שפר את meta description וכותרת לדף זה כדי להגדיל CTR מ-${(actualCTR * 100).toFixed(1)}% ל-${(expectedCTR * 100).toFixed(1)}%`,
            suggestedActionEn: `Improve meta description and title for this position to increase CTR`,
            relatedUrl: undefined,
          });
        }
      }

      // Check for untapped impressions: position > 10 with significant impressions
      if (query.position && query.position > 10 && query.impressions && query.impressions > 500) {
        keywordGaps.push({
          type: 'untapped_impressions',
          keyword: query.query,
          evidence: {
            source: 'gsc',
            dataPoint: `Position ${query.position}, ${query.impressions} impressions, ${(query.ctr || 0) * 100}% CTR`,
            confidence: 90,
            rawData: query,
          },
          opportunity: 'high',
          currentMetrics: {
            impressions: query.impressions,
            clicks: query.clicks,
            ctr: query.ctr,
            position: query.position,
          },
          suggestedAction: `קוד דף זה כדי לשפר דירוג מ-position ${query.position} ל-top 5. יש ${query.impressions} impressions להשיג.`,
          suggestedActionEn: `Optimize page to improve ranking from position ${query.position} to top 5`,
          relatedUrl: undefined,
        });
      }
    });
  } else {
    limitations.push('לא זמינים נתוני GSC שאילתות - לא ניתן לנתח CTR ודירוגים');
  }

  // ========================================================================
  // 2. ANALYZE KEYWORD GAPS FROM SERP
  // ========================================================================

  if (input.serpRankings && input.serpRankings.length > 0) {
    const domainLower = input.domain.toLowerCase();

    input.serpRankings.forEach((ranking) => {
      // Check if domain ranks in this SERP
      const ourPosition = ranking.topCompetitors.findIndex(
        (r) => r.domain.toLowerCase().includes(domainLower)
      );

      if (ourPosition === -1) {
        // Domain doesn't rank for this query - check if competitors do
        const topCompetitor = ranking.topCompetitors[0];
        if (topCompetitor && ranking.totalResults && ranking.totalResults > 100) {
          keywordGaps.push({
            type: 'competitor_owns',
            keyword: ranking.query,
            evidence: {
              source: 'serp',
              dataPoint: `${ranking.query} - לא דירוג. קומפטיטור ${topCompetitor.domain} בעמדה 1`,
              confidence: 95,
              rawData: ranking,
            },
            opportunity: ranking.totalResults > 1000 ? 'high' : 'medium',
            currentMetrics: {
              position: undefined,
            },
            suggestedAction: `צור תוכן מייעד לשאילתה "${ranking.query}" כדי לתחרות עם ${topCompetitor.domain}`,
            suggestedActionEn: `Create targeted content for "${ranking.query}" to compete with ${topCompetitor.domain}`,
            competitors: ranking.topCompetitors.slice(0, 3).map((r) => ({
              domain: r.domain,
              position: ranking.topCompetitors.indexOf(r) + 1,
            })),
          });
        }
      } else if (ourPosition >= 20) {
        // Domain ranks but position is very low
        if (ranking.totalResults && ranking.totalResults > 100) {
          keywordGaps.push({
            type: 'not_ranking',
            keyword: ranking.query,
            evidence: {
              source: 'serp',
              dataPoint: `Position ${ourPosition + 1}, ${ranking.totalResults || 0} estimated monthly searches`,
              confidence: 90,
              rawData: ranking,
            },
            opportunity: ranking.totalResults > 1000 ? 'high' : 'medium',
            currentMetrics: {
              position: ourPosition + 1,
            },
            suggestedAction: `אופטימיזציה עקיפה לשאילתה "${ranking.query}" - כרגע בעמדה ${ourPosition + 1}`,
            suggestedActionEn: `Optimize for "${ranking.query}" - currently at position ${ourPosition + 1}`,
            competitors: ranking.topCompetitors.slice(0, 3).map((r, idx) => ({
              domain: r.domain,
              position: idx + 1,
            })),
          });
        }
      }
    });
  } else {
    limitations.push('לא זמינים נתוני SERP - לא ניתן לנתח דירוגים של מתחרים');
  }

  // ========================================================================
  // 3. ANALYZE CONTENT GAPS FROM CRAWL
  // ========================================================================

  if (input.crawlPages && input.crawlPages.length > 0) {
    const gscPageMap = new Map<string, GSCPageData>();
    if (input.gscPages) {
      input.gscPages.forEach(p => {
        gscPageMap.set(p.page.toLowerCase(), p);
      });
    }

    input.crawlPages.forEach((page) => {
      // Thin content check: < 300 words
      if (page.wordCount && page.wordCount < 300) {
        const gscData = gscPageMap.get(page.url.toLowerCase());
        contentGaps.push({
          type: 'thin_content',
          url: page.url,
          evidence: {
            source: 'crawl',
            dataPoint: `${page.wordCount} מילים (מינימום מומלץ: 300)`,
            confidence: 95,
            rawData: { wordCount: page.wordCount },
          },
          severity: gscData && gscData.impressions > 1000 ? 'critical' : 'warning',
          description: `דף זה מכיל רק ${page.wordCount} מילים. תוכן דק עלול להשפיע על דירוג.`,
          descriptionEn: `Page contains only ${page.wordCount} words. Thin content may impact ranking.`,
          relatedKeywords: gscData ? [(gscData as any).topQuery || ''] : [],
          suggestedFix: `הרחב את התוכן ל-${300 + Math.min(page.wordCount, 200)} מילים לפחות. הוסף סעיפים, טבלאות, או FAQ.`,
        });
      }

      // Missing schema check: no JSON-LD or structured data
      if ((!page.schemaMarkup || page.schemaMarkup.length === 0)) {
        const gscData = gscPageMap.get(page.url.toLowerCase());
        contentGaps.push({
          type: 'no_schema',
          url: page.url,
          evidence: {
            source: 'crawl',
            dataPoint: 'אין JSON-LD schema או structured data',
            confidence: 100,
            rawData: { hasSchema: false },
          },
          severity: gscData && (gscData.impressions || 0) > 500 ? 'warning' : 'info',
          description: 'דף זה לא מכיל JSON-LD schema. Google עלול להחמיץ בהקשר עמוד.',
          descriptionEn: 'Page missing JSON-LD schema for context',
          relatedKeywords: gscData ? [(gscData as any).topQuery || ''] : [],
          suggestedFix: `הוסף JSON-LD schema עבור ${inferPageType(page.url)}`,
        });
      }

      // Weak internal links check: < 3 internal links pointing to page
      if (page.internalLinks.length && page.internalLinks.length < 3) {
        const gscData = gscPageMap.get(page.url.toLowerCase());
        if (gscData && (gscData.impressions || 0) > 0) {
          contentGaps.push({
            type: 'weak_internal_links',
            url: page.url,
            evidence: {
              source: 'crawl',
              dataPoint: `${page.internalLinks.length} קישורים פנימיים משאר הדף`,
              confidence: 85,
              rawData: { internalLinksCount: page.internalLinks.length },
            },
            severity: (gscData.impressions || 0) > 2000 ? 'warning' : 'info',
            description: `דף זה מקבל רק ${page.internalLinks.length} קישורים פנימיים. עלול להשפיע על פירור ודירוג.`,
            descriptionEn: `Page receives only ${page.internalLinks.length} internal links, may impact crawlability and ranking`,
            relatedKeywords: gscData ? [(gscData as any).topQuery || ''] : [],
            suggestedFix: `הוסף קישורים פנימיים מעמודים רלוונטיים לדף זה כדי לחזק את הדירוג.`,
          });
        }
      }

      // Missing H1 with keyword check
      const h1Text = page.h1Tags && page.h1Tags[0] ? page.h1Tags[0] : '';
      const gscDataForH1 = gscPageMap.get(page.url.toLowerCase());
      const targetKeyword = (gscDataForH1 as any)?.topQuery || '';
      const hasKeywordInH1 = h1Text && targetKeyword && h1Text.toLowerCase().includes(targetKeyword.toLowerCase());
      if (!hasKeywordInH1 && targetKeyword) {
        if (gscDataForH1 && (gscDataForH1.clicks || 0) > 0) {
          contentGaps.push({
            type: 'missing_h1_keywords',
            url: page.url,
            evidence: {
              source: 'crawl',
              dataPoint: 'כותרת H1 אינה מכילה את המילה המפתח המטרה',
              confidence: 80,
              rawData: { h1Text: h1Text || 'unknown' },
            },
            severity: 'warning',
            description: `כותרת H1 של דף זה לא מכילה מילה מפתח רלוונטית: "${h1Text}"`,
            descriptionEn: `Page H1 doesn't contain target keyword: "${h1Text}"`,
            relatedKeywords: gscDataForH1 ? [(gscDataForH1 as any).topQuery || ''] : [],
            suggestedFix: `עדכן H1 ל-"${suggestH1((gscDataForH1 as any)?.topQuery || '', page.url)}"`,
          });
        }
      }
    });
  } else {
    limitations.push('לא זמינים נתוני זחילה - לא ניתן לנתח פערי תוכן טכניים');
  }

  // ========================================================================
  // 4. PASS THROUGH TECHNICAL ISSUES FROM CRAWLER
  // ========================================================================

  if (input.technicalIssues && input.technicalIssues.length > 0) {
    input.technicalIssues.forEach((issue) => {
      // Only include issues that affect ranking
      if (
        ['noindex', 'robots_txt_blocked', 'redirect_chain', 'slow_page', 'broken_link'].includes(
          issue.type
        )
      ) {
        technicalGaps.push({
          type: issue.type,
          url: issue.url,
          evidence: {
            source: 'crawl',
            dataPoint: issue.description || `Technical issue: ${issue.type}`,
            confidence: 90,
            rawData: issue,
          },
          severity: mapTechnicalSeverity(issue.type),
          description: issue.description || `Technical issue detected: ${issue.type}`,
          impact: mapTechnicalImpact(issue.type),
        });
      }
    });
  }

  // ========================================================================
  // 5. CALCULATE SUMMARY & CONFIDENCE
  // ========================================================================

  const totalGaps = keywordGaps.length + contentGaps.length + technicalGaps.length;
  const criticalGaps = [
    ...contentGaps,
    ...technicalGaps,
  ].filter((g) => g.severity === 'critical').length;
  const highOpportunityKeywords = keywordGaps.filter((g) => g.opportunity === 'high').length;

  // Estimate traffic potential from high-opportunity keyword gaps
  let estimatedTrafficPotential: number | null = null;
  if (input.serpRankings && input.serpRankings.length > 0) {
    estimatedTrafficPotential = keywordGaps
      .filter((g) => g.opportunity === 'high')
      .reduce((sum, gap) => {
        const serpData = input.serpRankings!.find(
          (s) => s.query.toLowerCase() === gap.keyword.toLowerCase()
        );
        if (serpData?.totalResults) {
          // Assume we could get ~10% of total results as traffic proxy by ranking in top 5
          return sum + Math.round(serpData.totalResults * 0.1);
        }
        return sum;
      }, 0);
  }

  // Calculate overall confidence based on available data
  let overallConfidence = 0;
  if (hasGSC) overallConfidence += 40;
  if (hasSERP) overallConfidence += 40;
  if (hasCrawl) overallConfidence += 20;

  return {
    domain: input.domain,
    analyzedAt: now,
    dataCompleteness: {
      hasGSC,
      hasSERP,
      hasCrawl,
      overallConfidence,
    },
    keywordGaps,
    contentGaps,
    technicalGaps,
    summary: {
      totalGaps,
      criticalGaps,
      highOpportunityKeywords,
      estimatedTrafficPotential: estimatedTrafficPotential && estimatedTrafficPotential > 0 ? estimatedTrafficPotential : null,
    },
    limitations,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapTechnicalSeverity(
  issueType: string
): 'critical' | 'warning' | 'info' {
  switch (issueType) {
    case 'noindex':
    case 'robots_txt_blocked':
    case 'redirect_chain':
      return 'critical';
    case 'slow_page':
    case 'broken_link':
      return 'warning';
    default:
      return 'info';
  }
}

function mapTechnicalImpact(issueType: string): string {
  switch (issueType) {
    case 'noindex':
      return 'דף זה מסומן כ-noindex - לא יוכל להופיע בתוצאות חיפוש';
    case 'robots_txt_blocked':
      return 'דף חסום בקובץ robots.txt - Google לא יוכל לזחול או לאינדקס אותו';
    case 'redirect_chain':
      return 'שרשרת קישורים כזה גורמת לאובדן דירוג וזמן טעינה איטי';
    case 'slow_page':
      return 'דף איטי משפיע על חוויית המשתמש וקביעת הדירוג';
    case 'broken_link':
      return 'קישור שבור מזיק לחוויית משתמש ודירוג';
    default:
      return 'בעיה טכנית שעלולה להשפיע על דירוג ואינדקסציה';
  }
}

function inferPageType(url: string): string {
  if (url.includes('/blog/') || url.includes('/article/')) return 'BlogPosting';
  if (url.includes('/product/')) return 'Product';
  if (url.includes('/faq') || url.includes('/qa')) return 'FAQPage';
  if (url.includes('/about')) return 'Organization';
  return 'WebPage';
}

function suggestH1(targetQuery: string, url: string): string {
  if (!targetQuery) return 'כותרת ראשית רלוונטית';
  return `${targetQuery.charAt(0).toUpperCase() + targetQuery.slice(1)}`;
}
