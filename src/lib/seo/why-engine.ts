// @ts-nocheck
import type { GSCQueryData } from './gsc-api';
import type { SerpResultItem, DomainRankingResult } from './serp-api';
import type { ParsedPageData } from './crawler';

/**
 * Input data for why-analysis
 */
export interface WhyAnalysisInput {
  targetPage: ParsedPageData;
  targetKeyword: string;
  gscData?: GSCQueryData | null;         // GSC data for this keyword
  serpCompetitors?: SerpResultItem[];     // top competitors for this keyword
  competitorPages?: ParsedPageData[];    // crawled competitor pages (if available)
}

/**
 * Individual ranking factor with measurement and evidence
 */
export interface WhyFactor {
  factor: string;                        // English identifier
  label: string;                         // Hebrew user-facing label
  impact: 'positive' | 'negative' | 'neutral';
  severity: 'critical' | 'major' | 'minor';
  measurement: {
    metric: string;                      // what was measured
    yourValue: string | number;
    competitorAvg?: string | number | null;
    benchmark?: string | number | null;
  };
  evidence: {
    source: string;
    snippet: string;
    confidence: number;                  // 0-100
  };
  recommendation?: string;              // Hebrew — what to fix (only for negative)
}

/**
 * Complete why-analysis result
 */
export interface WhyAnalysisResult {
  targetUrl: string;
  targetKeyword: string;
  currentPosition: number | null;
  analyzedAt: string;
  factors: WhyFactor[];
  overallAssessment: string;             // Hebrew summary
  dataCompleteness: number;              // 0-100, how much data was available
  limitations: string[];                 // Hebrew messages about gaps
}

/**
 * Internal helper for averaging competitor metrics
 */
function averageMetric(values: (number | null | undefined)[]): number | null {
  const filtered = values.filter((v) => typeof v === 'number' && v >= 0);
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

/**
 * Extract current position from GSC data if available
 */
function extractCurrentPosition(gscData?: GSCQueryData | null): number | null {
  if (!gscData || !gscData.positions || gscData.positions.length === 0) {
    return null;
  }
  // Return the latest position (most recent)
  return gscData.positions[gscData.positions.length - 1];
}

/**
 * Count word occurrences in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

/**
 * Calculate keyword density as percentage
 */
function calculateKeywordDensity(text: string, keyword: string): number {
  const words = text.toLowerCase().split(/\s+/);
  const keywordWords = keyword.toLowerCase().split(/\s+/);

  if (words.length === 0) return 0;

  let matches = 0;
  for (let i = 0; i <= words.length - keywordWords.length; i++) {
    const phrase = words.slice(i, i + keywordWords.length).join(' ');
    if (phrase === keyword.toLowerCase()) {
      matches++;
    }
  }

  return (matches / words.length) * 100;
}

/**
 * Check if text contains keyword (case-insensitive)
 */
function containsKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * Check if keyword appears as complete word/phrase (not partial)
 */
function containsKeywordExact(text: string, keyword: string): boolean {
  const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return regex.test(text);
}

/**
 * Main why-analysis function
 */
export function analyzeWhy(input: WhyAnalysisInput): WhyAnalysisResult {
  const {
    targetPage,
    targetKeyword,
    gscData,
    serpCompetitors,
    competitorPages,
  } = input;

  const factors: WhyFactor[] = [];
  const dataQuality: { [key: string]: boolean } = {};
  const limitations: string[] = [];

  // Extract current position
  const currentPosition = extractCurrentPosition(gscData);

  // === FACTOR 1: Content Length ===
  if (targetPage.content && targetPage.content.text) {
    const yourWordCount = countWords(targetPage.content.text);
    let competitorAvg: number | null = null;

    if (competitorPages && competitorPages.length > 0) {
      const competitorCounts = competitorPages
        .filter((p) => p.content?.text)
        .map((p) => countWords(p.content!.text));
      competitorAvg = averageMetric(competitorCounts);
    }

    const impact = competitorAvg ? (yourWordCount >= competitorAvg * 0.9 ? 'positive' : 'negative') : 'neutral';
    const severity = yourWordCount < 500 ? 'major' : yourWordCount < 1000 && competitorAvg && yourWordCount < competitorAvg * 0.7 ? 'major' : 'minor';

    factors.push({
      factor: 'content_length',
      label: 'אורך תוכן',
      impact,
      severity,
      measurement: {
        metric: 'מילים בעמוד',
        yourValue: yourWordCount,
        competitorAvg: competitorAvg || null,
        benchmark: 1200,
      },
      evidence: {
        source: 'Page crawl',
        snippet: `Your page: ${yourWordCount} words${competitorAvg ? ` vs competitor avg: ${Math.round(competitorAvg)} words` : ''}`,
        confidence: 95,
      },
      ...(impact === 'negative' && {
        recommendation: `הגדלת תוכן לכל פחות ${Math.max(500, Math.round(competitorAvg || 1200))} מילים. תוכן ארוך יותר בדרך כלל דורג טוב יותר.`,
      }),
    });

    dataQuality['content_length'] = true;
  } else {
    limitations.push('לא היה אפשר לנתח אורך תוכן - לא הייתה גישה לטקסט בעמוד');
  }

  // === FACTOR 2: Keyword in Title ===
  if (targetPage.title) {
    const keywordInTitle = containsKeywordExact(targetPage.title, targetKeyword);
    const impact = keywordInTitle ? 'positive' : 'negative';
    const severity = keywordInTitle ? 'minor' : 'major';

    factors.push({
      factor: 'keyword_in_title',
      label: 'מילת מפתח בכותרת',
      impact,
      severity,
      measurement: {
        metric: 'נמצאה בכותרת',
        yourValue: keywordInTitle ? 'כן' : 'לא',
        benchmark: 'כן',
      },
      evidence: {
        source: 'Title tag',
        snippet: `Title: "${targetPage.title}"`,
        confidence: 100,
      },
      ...(impact === 'negative' && {
        recommendation: `הוסף את המילת המפתח "${targetKeyword}" לתחילת כותרת העמוד.`,
      }),
    });

    dataQuality['keyword_in_title'] = true;
  } else {
    limitations.push('לא היה אפשר לבדוק מילת מפתח בכותרת - כותרת לא נמצאה');
  }

  // === FACTOR 3: Keyword in H1 ===
  if (targetPage.headings && targetPage.headings.h1 && targetPage.headings.h1.length > 0) {
    const h1Text = targetPage.headings.h1[0];
    const keywordInH1 = containsKeywordExact(h1Text, targetKeyword);
    const impact = keywordInH1 ? 'positive' : 'neutral';
    const severity = keywordInH1 ? 'minor' : 'minor';

    factors.push({
      factor: 'keyword_in_h1',
      label: 'מילת מפתח ב-H1',
      impact,
      severity,
      measurement: {
        metric: 'נמצאה ב-H1',
        yourValue: keywordInH1 ? 'כן' : 'לא',
        benchmark: 'כן',
      },
      evidence: {
        source: 'H1 tag',
        snippet: `H1: "${h1Text}"`,
        confidence: 100,
      },
      ...(impact !== 'positive' && {
        recommendation: `שקול לכלול את המילת המפתח "${targetKeyword}" ב-H1 של העמוד.`,
      }),
    });

    dataQuality['keyword_in_h1'] = true;
  } else {
    limitations.push('לא היה אפשר לבדוק מילת מפתח ב-H1 - H1 לא נמצאה בעמוד');
  }

  // === FACTOR 4: Keyword in H2 ===
  if (targetPage.headings && targetPage.headings.h2 && targetPage.headings.h2.length > 0) {
    const h2Text = targetPage.headings.h2.join(' ');
    const keywordInH2 = containsKeywordExact(h2Text, targetKeyword);
    const impact = keywordInH2 ? 'positive' : 'neutral';

    factors.push({
      factor: 'keyword_in_h2',
      label: 'מילת מפתח ב-H2',
      impact,
      severity: 'minor',
      measurement: {
        metric: 'נמצאה באחד מה-H2',
        yourValue: keywordInH2 ? 'כן' : 'לא',
        benchmark: 'כן',
      },
      evidence: {
        source: 'H2 tags',
        snippet: `${targetPage.headings.h2.length} H2 headings found`,
        confidence: 95,
      },
    });

    dataQuality['keyword_in_h2'] = true;
  }

  // === FACTOR 5: Keyword Density ===
  if (targetPage.content && targetPage.content.text) {
    const density = calculateKeywordDensity(targetPage.content.text, targetKeyword);
    let competitorDensityAvg: number | null = null;

    if (competitorPages && competitorPages.length > 0) {
      const competitorDensities = competitorPages
        .filter((p) => p.content?.text)
        .map((p) => calculateKeywordDensity(p.content!.text, targetKeyword));
      competitorDensityAvg = averageMetric(competitorDensities);
    }

    // Optimal keyword density is typically 1-3%
    let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (density < 0.5) impact = 'negative';
    else if (density > 0.5 && density <= 3) impact = 'positive';
    else if (density > 3) impact = 'negative';

    factors.push({
      factor: 'keyword_density',
      label: 'צפיפות מילת מפתח',
      impact,
      severity: impact === 'negative' ? 'major' : 'minor',
      measurement: {
        metric: 'אחוז מכל המילים בעמוד',
        yourValue: density.toFixed(2),
        competitorAvg: competitorDensityAvg ? competitorDensityAvg.toFixed(2) : null,
        benchmark: '1-3%',
      },
      evidence: {
        source: 'Page content analysis',
        snippet: `Keyword "${targetKeyword}" appears ${(density * (countWords(targetPage.content.text) / 100)).toFixed(0)} times in ${countWords(targetPage.content.text)} words`,
        confidence: 90,
      },
      ...(impact === 'negative' && {
        recommendation: density < 0.5 ? `הגבר את נוכחות המילת המפתח "${targetKeyword}" בתוכן בצורה טבעית.` : `הפחת את חזרות מילת המפתח "${targetKeyword}" - מסתכן בספאם.`,
      }),
    });

    dataQuality['keyword_density'] = true;
  }

  // === FACTOR 6: Meta Description ===
  if (targetPage.metaDescription) {
    const hasDescription = !!targetPage.metaDescription;
    const hasKeyword = containsKeyword(targetPage.metaDescription, targetKeyword);
    const isOptimalLength = targetPage.metaDescription.length >= 120 && targetPage.metaDescription.length <= 160;

    const impact = hasDescription && hasKeyword ? 'positive' : 'neutral';
    const severity = !hasDescription ? 'major' : 'minor';

    factors.push({
      factor: 'meta_description',
      label: 'תיאור מטה (Meta Description)',
      impact,
      severity,
      measurement: {
        metric: 'תיאור קיים + מילת מפתח + אורך אופטימלי',
        yourValue: `${hasDescription ? 'כן' : 'לא'} | ${hasKeyword ? 'כן' : 'לא'} | ${isOptimalLength ? 'כן' : 'לא'} (${targetPage.metaDescription.length} chars)`,
        benchmark: 'כן | כן | כן (120-160)',
      },
      evidence: {
        source: 'Meta description tag',
        snippet: `"${targetPage.metaDescription.substring(0, 80)}..."`,
        confidence: 100,
      },
      ...(impact !== 'positive' && {
        recommendation: `כתוב תיאור מטה של 120-160 תווים שיכלול את המילת המפתח "${targetKeyword}".`,
      }),
    });

    dataQuality['meta_description'] = true;
  } else {
    limitations.push('לא נמצא תיאור מטה (Meta Description)');
  }

  // === FACTOR 7: Heading Structure ===
  if (targetPage.headings) {
    const h1Count = targetPage.headings.h1?.length || 0;
    const h2Count = targetPage.headings.h2?.length || 0;
    const h3Count = targetPage.headings.h3?.length || 0;

    const isOptimalH1 = h1Count === 1;
    const hasH2s = h2Count > 0;
    const impact = isOptimalH1 && hasH2s ? 'positive' : h1Count === 0 || h1Count > 1 ? 'negative' : 'neutral';
    const severity = h1Count !== 1 ? 'major' : 'minor';

    factors.push({
      factor: 'heading_structure',
      label: 'מבנה כותרות',
      impact,
      severity,
      measurement: {
        metric: 'H1, H2, H3 counts',
        yourValue: `H1: ${h1Count}, H2: ${h2Count}, H3: ${h3Count}`,
        benchmark: 'H1: 1, H2: 2+, H3: 3+',
      },
      evidence: {
        source: 'Heading tag analysis',
        snippet: `Heading hierarchy: ${h1Count} H1, ${h2Count} H2, ${h3Count} H3`,
        confidence: 100,
      },
      ...(impact !== 'positive' && {
        recommendation: h1Count !== 1 ? `וודא שיש בדיוק H1 אחד בעמוד. כרגע: ${h1Count}` : `הוסף לפחות 2 H2 headings לעמוד לשיפור מבנה ההיררכיה.`,
      }),
    });

    dataQuality['heading_structure'] = true;
  }

  // === FACTOR 8: Internal Links TO this page ===
  if (targetPage.internalLinkCount !== undefined) {
    const internalLinkCount = targetPage.internalLinkCount;
    let competitorLinkAvg: number | null = null;

    if (competitorPages && competitorPages.length > 0) {
      const competitorLinks = competitorPages
        .map((p) => p.internalLinkCount || 0)
        .filter((count) => count > 0);
      competitorLinkAvg = averageMetric(competitorLinks);
    }

    const impact = internalLinkCount > 0 ? 'positive' : internalLinkCount === 0 ? 'negative' : 'neutral';
    const severity = internalLinkCount === 0 ? 'major' : 'minor';

    factors.push({
      factor: 'internal_links',
      label: 'קישורים פנימיים',
      impact,
      severity,
      measurement: {
        metric: 'קישורים פנימיים המצביעים לעמוד',
        yourValue: internalLinkCount,
        competitorAvg: competitorLinkAvg || null,
        benchmark: '3+',
      },
      evidence: {
        source: 'Site crawl',
        snippet: `${internalLinkCount} internal links pointing to this page${competitorLinkAvg ? ` (avg competitor: ${Math.round(competitorLinkAvg)})` : ''}`,
        confidence: 90,
      },
      ...(impact === 'negative' && {
        recommendation: `הוסף קישורים פנימיים מעמודים רלוונטיים לעמוד זה. כל"ד: לפחות 3.`,
      }),
    });

    dataQuality['internal_links'] = true;
  } else {
    limitations.push('לא היה אפשר לנתח קישורים פנימיים - נדרש נתון קישור מעמודים');
  }

  // === FACTOR 9: Schema Markup ===
  if (targetPage.schemaMarkup && targetPage.schemaMarkup.length > 0) {
    const schemaTypes = targetPage.schemaMarkup.map((s) => s.type).join(', ');
    const hasSchemaMarkup = targetPage.schemaMarkup.length > 0;

    let competitorSchemaCount = 0;
    if (competitorPages && competitorPages.length > 0) {
      competitorPages.forEach((p) => {
        if (p.schemaMarkup && p.schemaMarkup.length > 0) {
          competitorSchemaCount++;
        }
      });
    }

    const competitorSchemaPercentage = competitorPages ? (competitorSchemaCount / competitorPages.length) * 100 : null;

    const impact = hasSchemaMarkup ? 'positive' : 'negative';
    const severity = hasSchemaMarkup ? 'minor' : 'major';

    factors.push({
      factor: 'schema_markup',
      label: 'סימון סכמה (Schema Markup)',
      impact,
      severity,
      measurement: {
        metric: 'סוגי Schema JSON-LD',
        yourValue: `${targetPage.schemaMarkup.length} types: ${schemaTypes}`,
        competitorAvg: competitorSchemaPercentage ? `${competitorSchemaPercentage.toFixed(0)}% competitors have schema` : null,
        benchmark: '1+ schema type',
      },
      evidence: {
        source: 'Schema markup detection',
        snippet: `Found ${targetPage.schemaMarkup.length} schema markup(s) of types: ${schemaTypes}`,
        confidence: 100,
      },
    });

    dataQuality['schema_markup'] = true;
  } else {
    factors.push({
      factor: 'schema_markup',
      label: 'סימון סכמה (Schema Markup)',
      impact: 'negative',
      severity: 'major',
      measurement: {
        metric: 'סוגי Schema JSON-LD',
        yourValue: 'לא קיים',
        benchmark: '1+ schema type',
      },
      evidence: {
        source: 'Schema markup detection',
        snippet: 'No JSON-LD schema markup found on page',
        confidence: 100,
      },
      recommendation: 'הוסף Schema markup מתאים (Article, FAQPage, Product, וכו\') בפורמט JSON-LD.',
    });

    dataQuality['schema_markup'] = true;
  }

  // === FACTOR 10: Page Speed ===
  if (targetPage.pageLoadTime !== undefined) {
    const loadTimeMs = targetPage.pageLoadTime;
    let competitorLoadTimeAvg: number | null = null;

    if (competitorPages && competitorPages.length > 0) {
      const competitorLoadTimes = competitorPages
        .map((p) => p.pageLoadTime)
        .filter((t) => typeof t === 'number');
      competitorLoadTimeAvg = averageMetric(competitorLoadTimes);
    }

    // Fast: <2000ms, Optimal: 2000-3000ms, Slow: >3000ms
    let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (loadTimeMs < 2000) impact = 'positive';
    else if (loadTimeMs > 3500) impact = 'negative';

    const severity = loadTimeMs > 5000 ? 'critical' : loadTimeMs > 3500 ? 'major' : 'minor';

    factors.push({
      factor: 'page_speed',
      label: 'מהירות טעינה',
      impact,
      severity,
      measurement: {
        metric: 'זמן טעינה במילישניות',
        yourValue: loadTimeMs,
        competitorAvg: competitorLoadTimeAvg || null,
        benchmark: '2000ms',
      },
      evidence: {
        source: 'Page crawl timing',
        snippet: `Page loaded in ${loadTimeMs}ms${competitorLoadTimeAvg ? ` (avg competitor: ${Math.round(competitorLoadTimeAvg)}ms)` : ''}`,
        confidence: 85,
      },
      ...(impact !== 'positive' && {
        recommendation: 'השתמש בכלים כמו Google PageSpeed Insights לאתר בעיות ביצועים. שימוש בקומפרסיה תמונה וקאשינג יכול לשפר מהירות.',
      }),
    });

    dataQuality['page_speed'] = true;
  } else {
    limitations.push('לא היה אפשר לנתח מהירות עמוד - נתון זמן הטעינה לא זמין');
  }

  // === FACTOR 11: Mobile Meta Viewport ===
  if (targetPage.mobileViewport !== undefined) {
    const hasViewport = targetPage.mobileViewport;
    const impact = hasViewport ? 'positive' : 'negative';

    factors.push({
      factor: 'mobile_meta',
      label: 'תגית Viewport (Mobile)',
      impact,
      severity: impact === 'negative' ? 'major' : 'minor',
      measurement: {
        metric: 'Viewport meta tag present',
        yourValue: hasViewport ? 'כן' : 'לא',
        benchmark: 'כן',
      },
      evidence: {
        source: 'HTML head tag analysis',
        snippet: hasViewport ? 'Viewport meta tag found' : 'Viewport meta tag missing',
        confidence: 100,
      },
      ...(impact === 'negative' && {
        recommendation: 'הוסף <meta name="viewport" content="width=device-width, initial-scale=1"> בתגית <head> של העמוד.',
      }),
    });

    dataQuality['mobile_meta'] = true;
  }

  // === FACTOR 12: Canonical Tag ===
  if (targetPage.canonical !== undefined) {
    const hasCanonical = !!targetPage.canonical;
    const pointsToSelf = targetPage.canonical === targetPage.url;
    const impact = hasCanonical && pointsToSelf ? 'positive' : hasCanonical ? 'neutral' : 'negative';
    const severity = !hasCanonical ? 'major' : 'minor';

    factors.push({
      factor: 'canonical',
      label: 'תגית Canonical',
      impact,
      severity,
      measurement: {
        metric: 'Canonical tag present & points to self',
        yourValue: hasCanonical ? (pointsToSelf ? 'כן' : `צביע להוא לא עצמי`) : 'לא',
        benchmark: 'כן (points to self)',
      },
      evidence: {
        source: 'Link rel="canonical" tag',
        snippet: hasCanonical ? `Canonical: ${targetPage.canonical}` : 'No canonical tag found',
        confidence: 100,
      },
      ...(impact !== 'positive' && {
        recommendation: hasCanonical && !pointsToSelf ? `תוקן את הcanonical לצביע לעמוד הנוכחי: ${targetPage.url}` : `הוסף canonical tag לעמוד: <link rel="canonical" href="${targetPage.url}">`,
      }),
    });

    dataQuality['canonical'] = true;
  } else {
    limitations.push('לא היה אפשר לבדוק canonical tag');
  }

  // === FACTOR 13: Content Freshness ===
  if (targetPage.lastModified) {
    const lastModDate = new Date(targetPage.lastModified);
    const now = new Date();
    const daysOld = Math.floor((now.getTime() - lastModDate.getTime()) / (1000 * 60 * 60 * 24));

    let impact: 'positive' | 'negative' | 'neutral' = 'positive';
    if (daysOld > 365) impact = 'negative';
    else if (daysOld > 180) impact = 'neutral';

    const severity = daysOld > 365 ? 'major' : 'minor';

    factors.push({
      factor: 'content_freshness',
      label: 'עדכניות תוכן',
      impact,
      severity,
      measurement: {
        metric: 'ימים מאז עדכון אחרון',
        yourValue: daysOld,
        benchmark: '< 180 days',
      },
      evidence: {
        source: 'Last-Modified header / page metadata',
        snippet: `Last modified: ${lastModDate.toISOString().split('T')[0]} (${daysOld} days ago)`,
        confidence: 80,
      },
      ...(impact !== 'positive' && {
        recommendation: `עדכן את תוכן העמוד או הוסף מידע חדש. תוכן עדכני דורג טוב יותר על ידי גוגל.`,
      }),
    });

    dataQuality['content_freshness'] = true;
  }

  // === FACTOR 14: FAQ Content ===
  if (targetPage.content && targetPage.content.text) {
    const hasFAQ =
      /faq|frequently asked|שאלות נפוצות/i.test(targetPage.content.text) ||
      (targetPage.schemaMarkup && targetPage.schemaMarkup.some((s) => s.type === 'FAQPage'));

    const impact = hasFAQ ? 'positive' : 'neutral';

    factors.push({
      factor: 'faq_content',
      label: 'תוכן שאלות ותשובות',
      impact,
      severity: 'minor',
      measurement: {
        metric: 'FAQ section detected',
        yourValue: hasFAQ ? 'כן' : 'לא',
        benchmark: 'כן (for Q&A queries)',
      },
      evidence: {
        source: 'Content & schema analysis',
        snippet: hasFAQ ? 'FAQ content or FAQPage schema detected' : 'No FAQ section found',
        confidence: 85,
      },
      ...(impact !== 'positive' && {
        recommendation: 'שקול להוסיף חלק שאלות ותשובות עם Schema markup מסוג FAQPage לשיפור CTR וVideo.)',
      }),
    });

    dataQuality['faq_content'] = true;
  }

  // === FACTOR 15: Media Richness ===
  if (targetPage.images !== undefined || targetPage.videos !== undefined) {
    const imageCount = targetPage.images?.length || 0;
    const imagesWithAlt = targetPage.images?.filter((img) => !!img.alt).length || 0;
    const videoCount = targetPage.videos?.length || 0;
    const hasRichMedia = imageCount > 0 || videoCount > 0;

    let competitorMediaAvg: number | null = null;
    if (competitorPages && competitorPages.length > 0) {
      const competitorMediaCounts = competitorPages
        .map((p) => (p.images?.length || 0) + (p.videos?.length || 0))
        .filter((c) => c > 0);
      competitorMediaAvg = averageMetric(competitorMediaCounts);
    }

    const impact = hasRichMedia ? 'positive' : 'neutral';
    const severity = hasRichMedia ? 'minor' : 'minor';
    const altCoverage = imageCount > 0 ? ((imagesWithAlt / imageCount) * 100).toFixed(0) : 0;

    factors.push({
      factor: 'media_richness',
      label: 'עשירות מדיה (תמונות וווידאו)',
      impact,
      severity,
      measurement: {
        metric: 'תמונות עם alt text + ווידאו',
        yourValue: `${imageCount} images (${altCoverage}% with alt) + ${videoCount} videos`,
        competitorAvg: competitorMediaAvg ? `${Math.round(competitorMediaAvg)} media items` : null,
        benchmark: '5+ images + 1+ video (recommended)',
      },
      evidence: {
        source: 'Media tag analysis',
        snippet: `Images: ${imageCount} (${imagesWithAlt} with alt text), Videos: ${videoCount}`,
        confidence: 95,
      },
      ...(impact !== 'positive' && {
        recommendation: `הוסף תמונות ותיאורי alt, וקחול להוסיף ווידאו משובץ לשיפור עסקת וחיוך יותר.`,
      }),
    });

    dataQuality['media_richness'] = true;
  }

  // Calculate data completeness
  const totalFactors = 15;
  const dataCompleteness = Math.round((Object.keys(dataQuality).length / totalFactors) * 100);

  // Build overall assessment (Hebrew)
  let assessmentText = '';
  const positiveCount = factors.filter((f) => f.impact === 'positive').length;
  const negativeCount = factors.filter((f) => f.impact === 'negative').length;
  const criticalCount = factors.filter((f) => f.severity === 'critical').length;
  const majorCount = factors.filter((f) => f.severity === 'major').length;

  if (criticalCount > 0) {
    assessmentText = `יש ${criticalCount} בעיות קריטיות המפריעות לדירוג העמוד.`;
  } else if (majorCount > 2) {
    assessmentText = `יש ${majorCount} בעיות גדולות שחייבות תיקון לשיפור דירוג.`;
  } else if (negativeCount > positiveCount) {
    assessmentText = `יש יותר בעיות שליליות (${negativeCount}) מחיוביות (${positiveCount}). שפר את הנקודות השליליות לראשונה.`;
  } else if (positiveCount >= 10) {
    assessmentText = `העמוד בעל ביסוס טוב עם ${positiveCount} גורמים חיוביים.`;
  } else {
    assessmentText = `יש מקום לשיפור. ${negativeCount} גורמים שליליים צריכים תיקון.`;
  }

  if (currentPosition) {
    if (currentPosition <= 3) {
      assessmentText += ` העמוד כרגע בעמדה ${currentPosition} - שמור על טיב ההקשור.`;
    } else if (currentPosition <= 10) {
      assessmentText += ` העמוד בעמדה ${currentPosition} - קרוב לקליק קודם, שימו כמה עדכונים להגבר גרומ.`;
    } else {
      assessmentText += ` העמוד בעמדה ${currentPosition} - רחוק מחלון הקליק. תיקון הבעיות הדומות עשויה לעזור.`;
    }
  }

  return {
    targetUrl: targetPage.url,
    targetKeyword,
    currentPosition: currentPosition || null,
    analyzedAt: new Date().toISOString(),
    factors: factors.sort((a, b) => {
      // Sort by: negative before neutral, critical before major, by impact
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      const impactOrder = { negative: 0, neutral: 1, positive: 2 };

      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return impactOrder[a.impact] - impactOrder[b.impact];
    }),
    overallAssessment: assessmentText,
    dataCompleteness,
    limitations,
  };
}
