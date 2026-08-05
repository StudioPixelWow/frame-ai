/**
 * PIXEL SEO/GEO — Premium 18-Section Report Engine
 *
 * Generates a comprehensive SEO + GEO (Generative Engine Optimization) report
 * from real scan data. Every value is derived from actual plan data — no fakes.
 *
 * Sections:
 *  1.  Cover                    — שער הדוח
 *  2.  Executive Summary        — תקציר מנהלים
 *  3.  PIXEL SEO Score           — ציון PIXEL SEO
 *  4.  PIXEL GEO Score           — ציון PIXEL GEO
 *  5.  Engine Snapshot           — מצב לפי מנוע
 *  6.  Language Segmentation     — פילוח שפה/מדינה
 *  7.  Branded Analysis          — ממותג מול לא-ממותג
 *  8.  Topic Clusters            — אשכולות נושאיים
 *  9.  Competitor Authority      — תחרות על סמכות
 * 10.  Technical Audit           — ביקורת טכנית
 * 11.  Structured Data & Entity  — נתונים מובנים וישויות
 * 12.  SEO Organic               — SEO אורגני
 * 13.  Content Gaps              — פערי תוכן
 * 14.  Citation Quality          — איכות ציטוטים
 * 15.  Brand Accuracy in AI      — דיוק מותג ב-AI
 * 16.  Action Plan               — תוכנית פעולה
 * 17.  Success Metrics / KPIs    — מדדי הצלחה
 * 18.  Methodology               — מתודולוגיה
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PremiumReportBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level?: 2 | 3 | 4 }
  | { type: "stat"; label: string; value: string; change?: string; color: string; icon?: string; confidence?: "high" | "medium" | "low" }
  | { type: "stat_row"; stats: Array<{ label: string; value: string; change?: string; color: string; icon?: string }> }
  | { type: "score_gauge"; label: string; score: number; previousScore?: number; maxScore: number; color: string; subScores?: Array<{ label: string; score: number; weight: number }> }
  | { type: "table"; headers: string[]; rows: string[][]; caption?: string; sortable?: boolean }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "finding"; severity: "critical" | "warning" | "info" | "success"; title: string; detail: string; recommendation: string; evidence?: string; confidence?: "high" | "medium" | "low" }
  | { type: "engine_card"; engine: string; icon: string; mentionRate: number; citationRate: number; firstMentionRate: number; queriesTested: number; topCitedPages: string[] }
  | { type: "competitor_row"; domain: string; mentions: number; citations: number; engines: string[]; topics: string[]; sourceType: string }
  | { type: "query_result"; query: string; language: string; category: string; branded: boolean; engines: Array<{ engine: string; mentioned: boolean; cited: boolean; position?: number; snippet?: string; sources?: string[] }> }
  | { type: "action_item"; title: string; description: string; priority: "critical" | "high" | "medium" | "low"; impact: string; effort: string; deadline: string; kpi: string; owner?: string; evidence?: string }
  | { type: "methodology_field"; label: string; value: string }
  | { type: "progress_bar"; label: string; value: number; max: number; color: string }
  | { type: "alert"; message: string; severity: "critical" | "warning" | "info" }
  | { type: "kpi_target"; metric: string; current: string; target: string; timeframe: string; confidence: string }
  | { type: "divider" }
  | { type: "page_break" }
  | { type: "spacer"; height: number };

export interface PremiumReportSection {
  id: string;
  number: number;
  title: string;
  titleEn: string;
  icon: string;
  content: PremiumReportBlock[];
}

export interface PremiumSeoReport {
  id: string;
  planId: string;
  clientName: string;
  clientLogo?: string;
  websiteUrl: string;
  generatedAt: string;
  language: "he" | "en";
  version: string;
  confidential: boolean;
  period: { from: string; to: string };
  enginesChecked: string[];
  languagesChecked: string[];
  countriesChecked: string[];
  totalQueries: number;
  sections: PremiumReportSection[];
  scores: {
    pixelSeoScore: number;
    pixelGeoScore: number;
    previousSeoScore?: number;
    previousGeoScore?: number;
    seoSubScores: Record<string, { score: number; weight: number; label: string }>;
    geoSubScores: Record<string, { score: number; weight: number; label: string }>;
  };
  methodology: {
    scanDate: string;
    enginesUsed: string[];
    languagesTested: string[];
    countriesTested: string[];
    totalQueries: number;
    runsPerQuery: number;
    tools: string[];
    userAgentsTested: string[];
    limitations: string[];
    definitions: Array<{ term: string; definition: string }>;
  };
  meta: {
    overallScore: number;
    technicalScore: number;
    contentScore: number;
    visibilityScore: number;
    geoScore: number;
    totalFindings: number;
    criticalFindings: number;
    totalRecommendations: number;
    mentionRate: number;
    citationRate: number;
    firstMentionRate: number;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 100) : 0;
}

function extractDomain(url: string): string {
  return (url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
}

function t(he: boolean, heText: string, enText: string): string {
  return he ? heText : enText;
}

function na(he: boolean, reason?: string): string {
  const base = he ? "לא זמין" : "N/A";
  return reason ? `${base} — ${reason}` : base;
}

function formatDate(date: string | Date, locale: "he" | "en" = "he"): string {
  try {
    return new Date(date).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch { return String(date); }
}

function confidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/** Detect if a query is branded (contains client name or domain) */
function isBrandedQuery(query: string, clientName: string, domain: string): boolean {
  const q = query.toLowerCase();
  const name = clientName.toLowerCase().trim();
  const dom = extractDomain(domain).split(".")[0].toLowerCase();
  if (!name && !dom) return false;
  return (name.length > 1 && q.includes(name)) || (dom.length > 2 && q.includes(dom));
}

/** Group queries by topic category */
function groupByCategory(items: any[], key: string = "category"): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  for (const item of items) {
    const cat = item[key] || "general";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

/** Extract competitor domains/brands from AI responses */
function extractCompetitors(aiQueries: any[], clientName: string, clientDomain: string): Map<string, { mentions: number; citations: number; engines: Set<string>; topics: Set<string>; sourceType: string }> {
  const competitors = new Map<string, { mentions: number; citations: number; engines: Set<string>; topics: Set<string>; sourceType: string }>();
  const domainLower = extractDomain(clientDomain);

  for (const q of aiQueries) {
    if (q.scanMode !== "real") continue;
    // Extract from sources
    const sources: Array<{ url: string; domain: string; title?: string }> = q.sources || [];
    for (const src of sources) {
      const srcDomain = extractDomain(src.domain || src.url || "");
      if (!srcDomain || srcDomain === domainLower || srcDomain.includes(domainLower) || domainLower.includes(srcDomain)) continue;
      if (!competitors.has(srcDomain)) {
        competitors.set(srcDomain, { mentions: 0, citations: 0, engines: new Set(), topics: new Set(), sourceType: guessSourceType(srcDomain) });
      }
      const entry = competitors.get(srcDomain)!;
      entry.citations++;
      entry.engines.add(q.platform || "");
      entry.topics.add(q.category || q.query?.split(" ").slice(0, 2).join(" ") || "general");
    }

    // Extract from snippet/responseText — look for domain patterns
    const text = (q.responseText || q.snippet || "").toLowerCase();
    if (!text) continue;
    const domainRegex = /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z]{2,})/g;
    let match;
    while ((match = domainRegex.exec(text)) !== null) {
      const found = match[1];
      if (found === domainLower || found.includes(domainLower) || domainLower.includes(found)) continue;
      // Skip common non-competitor domains
      if (["google.com", "facebook.com", "youtube.com", "twitter.com", "wikipedia.org", "linkedin.com", "instagram.com", "tiktok.com", "x.com"].includes(found)) continue;
      if (!competitors.has(found)) {
        competitors.set(found, { mentions: 0, citations: 0, engines: new Set(), topics: new Set(), sourceType: guessSourceType(found) });
      }
      const entry = competitors.get(found)!;
      entry.mentions++;
      entry.engines.add(q.platform || "");
      entry.topics.add(q.category || "general");
    }
  }

  return competitors;
}

function guessSourceType(domain: string): string {
  const d = domain.toLowerCase();
  if (d.endsWith(".gov") || d.endsWith(".gov.il")) return "governmental";
  if (d.endsWith(".edu") || d.endsWith(".ac.il")) return "academic";
  if (d.includes("news") || d.includes("ynet") || d.includes("mako") || d.includes("walla") || d.includes("haaretz") || d.includes("globes") || d.includes("calcalist") || d.includes("themarker")) return "news";
  if (d.includes("forum") || d.includes("reddit") || d.includes("quora")) return "forum";
  if (d.includes("facebook") || d.includes("instagram") || d.includes("tiktok") || d.includes("twitter") || d.includes("linkedin")) return "social";
  if (d.includes("wiki")) return "encyclopedia";
  return "commercial";
}

// ── Engine Display Map ────────────────────────────────────────────────────────

const ENGINE_MAP: Record<string, { name: string; nameHe: string; icon: string; ids: string[] }> = {
  chatgpt: { name: "ChatGPT", nameHe: "ChatGPT", icon: "🤖", ids: ["chatgpt"] },
  google_ai: { name: "Google AI Overview", nameHe: "Google AI Overview", icon: "✨", ids: ["google_ai_overview"] },
  gemini: { name: "Gemini", nameHe: "Gemini", icon: "💎", ids: ["gemini"] },
  perplexity: { name: "Perplexity", nameHe: "Perplexity", icon: "🔮", ids: ["perplexity"] },
  claude: { name: "Claude", nameHe: "Claude", icon: "🧠", ids: ["claude"] },
  google_seo: { name: "Google SEO", nameHe: "Google SEO", icon: "🔍", ids: ["google_seo"] },
};

// ── PIXEL SEO Score Calculator ────────────────────────────────────────────────

interface SeoSubScores {
  technical: { score: number; weight: number; label: string };
  organicVisibility: { score: number; weight: number; label: string };
  contentCoverage: { score: number; weight: number; label: string };
  authority: { score: number; weight: number; label: string };
  indexability: { score: number; weight: number; label: string };
  searchPerformance: { score: number; weight: number; label: string };
  brandedVisibility: { score: number; weight: number; label: string };
  nonBrandedVisibility: { score: number; weight: number; label: string };
  conversionReadiness: { score: number; weight: number; label: string };
}

function computeSeoScore(plan: any, he: boolean): { overall: number; subScores: SeoSubScores; confidence: "high" | "medium" | "low" } {
  const scan = plan.websiteScan;
  const scannedPages: any[] = plan.scannedPages || scan?.scannedPages || [];
  const aiQueries: any[] = scan?.aiQueries || plan?.aiQueries || [];
  const realQueries = aiQueries.filter((q: any) => q.scanMode === "real");
  const clientName = (plan.clientName || "").toLowerCase();
  const domain = extractDomain(plan.websiteUrl || "");

  // 1. Technical SEO (weight: 15%)
  let techScore = 0;
  if (scan) {
    if (scan.hasSSL) techScore += 15;
    if (scan.loadTimeMs && scan.loadTimeMs < 3000) techScore += 15;
    if (scan.mobileOptimized) techScore += 15;
    if (scan.hasRobotsTxt) techScore += 10;
    if (scan.hasSitemap) techScore += 10;
    if (scan.structuredData) techScore += 10;
    if (scan.canonicalTags) techScore += 5;
    if (scan.metaTitle && scan.metaTitle.length > 5) techScore += 10;
    if (scan.metaDescription && scan.metaDescription.length > 20) techScore += 5;
    if (scan.openGraph) techScore += 5;
    const issueCount = scan.issues?.length || 0;
    techScore = Math.max(0, Math.min(100, techScore - issueCount * 5));
  }

  // 2. Organic Visibility (weight: 10%)
  let organicScore = 0;
  if (plan.visibilityScore && plan.visibilityScore > 0) {
    organicScore = plan.visibilityScore;
  } else if (realQueries.length > 0) {
    const found = realQueries.filter((q: any) => q.found).length;
    organicScore = pct(found, realQueries.length);
  }

  // 3. Content Coverage (weight: 15%)
  let contentScore = 0;
  if (scan) {
    if (scan.metaTitle && scan.metaTitle.length > 10) contentScore += 10;
    if (scan.metaDescription && scan.metaDescription.length > 50) contentScore += 10;
    if (scan.h1Tags?.length > 0) contentScore += 10;
    if ((scan.h2Tags?.length || 0) > 2) contentScore += 10;
    const pages = scan.totalPages || scan.indexedPages || 0;
    if (pages >= 10) contentScore += 10;
    if (pages >= 20) contentScore += 10;
    const pagesWithContent = scannedPages.filter((p: any) => (p.wordCount || 0) > 200).length;
    if (pagesWithContent >= 3) contentScore += 20;
    if (scannedPages.some((p: any) => p.hasSchema)) contentScore += 10;
    const faqPages = scannedPages.filter((p: any) => (p.title || "").toLowerCase().includes("faq") || (p.title || "").includes("שאלות"));
    if (faqPages.length > 0) contentScore += 10;
  }
  contentScore = Math.min(100, contentScore);

  // 4. Authority (weight: 10%)
  let authorityScore = 0;
  if (scan?.domainAuthority) {
    authorityScore = Math.min(100, scan.domainAuthority * 2);
  }
  if (scan?.eeat) {
    authorityScore = Math.max(authorityScore, scan.eeat.score || 0);
  }

  // 5. Indexability (weight: 10%)
  let indexScore = 0;
  if (scan) {
    if (scan.hasRobotsTxt) indexScore += 25;
    if (scan.hasSitemap) indexScore += 25;
    if (scan.canonicalTags) indexScore += 20;
    if (scan.brokenLinks === 0) indexScore += 15;
    if ((scan.indexedPages || 0) > 0) indexScore += 15;
  }

  // 6. Search Performance (weight: 10%)
  let searchPerfScore = 0;
  // GSC data if available
  if (plan.gscData?.clicks && plan.gscData.clicks > 0) {
    searchPerfScore = Math.min(100, Math.round(plan.gscData.clicks / 10));
  } else if (plan.technicalScore && plan.technicalScore > 0) {
    searchPerfScore = plan.technicalScore;
  } else if (scan) {
    searchPerfScore = techScore > 0 ? Math.round(techScore * 0.6) : 0;
  }

  // 7. Branded Visibility (weight: 10%)
  let brandedScore = 0;
  const brandedQueries = realQueries.filter((q: any) => isBrandedQuery(q.query || "", clientName, domain));
  if (brandedQueries.length > 0) {
    const brandedFound = brandedQueries.filter((q: any) => q.found).length;
    brandedScore = pct(brandedFound, brandedQueries.length);
  }

  // 8. Non-Branded Visibility (weight: 10%)
  let nonBrandedScore = 0;
  const nonBrandedQueries = realQueries.filter((q: any) => !isBrandedQuery(q.query || "", clientName, domain));
  if (nonBrandedQueries.length > 0) {
    const nbFound = nonBrandedQueries.filter((q: any) => q.found).length;
    nonBrandedScore = pct(nbFound, nonBrandedQueries.length);
  }

  // 9. Conversion Readiness (weight: 10%)
  let conversionScore = 0;
  if (scan) {
    if (scan.eeat?.hasContactInfo) conversionScore += 25;
    if (scan.eeat?.hasAboutPage) conversionScore += 15;
    if (scan.eeat?.hasPrivacyPolicy) conversionScore += 10;
    if (scan.eeat?.hasTestimonials) conversionScore += 15;
    if (scan.eeat?.hasSocialProof) conversionScore += 10;
    if (scan.openGraph) conversionScore += 10;
    if (scan.structuredData) conversionScore += 15;
  }
  if (conversionScore === 0 && scan) {
    // Fallback estimation
    if (scan.metaTitle) conversionScore += 20;
    if (scan.metaDescription) conversionScore += 20;
    if (scan.totalPages > 5) conversionScore += 20;
    if (scan.hasSSL) conversionScore += 20;
    if (scan.mobileOptimized) conversionScore += 20;
  }

  const subScores: SeoSubScores = {
    technical: { score: techScore, weight: 15, label: t(he, "SEO טכני", "Technical SEO") },
    organicVisibility: { score: organicScore, weight: 10, label: t(he, "נראות אורגנית", "Organic Visibility") },
    contentCoverage: { score: contentScore, weight: 15, label: t(he, "כיסוי תוכן", "Content Coverage") },
    authority: { score: authorityScore, weight: 10, label: t(he, "סמכות", "Authority") },
    indexability: { score: indexScore, weight: 10, label: t(he, "אינדקסביליות", "Indexability") },
    searchPerformance: { score: searchPerfScore, weight: 10, label: t(he, "ביצועי חיפוש", "Search Performance") },
    brandedVisibility: { score: brandedScore, weight: 10, label: t(he, "נראות ממותגת", "Branded Visibility") },
    nonBrandedVisibility: { score: nonBrandedScore, weight: 10, label: t(he, "נראות לא ממותגת", "Non-Branded Visibility") },
    conversionReadiness: { score: conversionScore, weight: 10, label: t(he, "מוכנות להמרה", "Conversion Readiness") },
  };

  const overall = Math.round(
    Object.values(subScores).reduce((sum, s) => sum + s.score * (s.weight / 100), 0)
  );

  const dataPoints = [
    scan ? 1 : 0,
    realQueries.length > 0 ? 1 : 0,
    scannedPages.length > 0 ? 1 : 0,
    plan.gscData ? 1 : 0,
    scan?.domainAuthority ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return { overall, subScores, confidence: dataPoints >= 4 ? "high" : dataPoints >= 2 ? "medium" : "low" };
}

// ── PIXEL GEO Score Calculator ────────────────────────────────────────────────

interface GeoSubScores {
  mentionRate: { score: number; weight: number; label: string };
  citationRate: { score: number; weight: number; label: string };
  firstMentionRate: { score: number; weight: number; label: string };
  citationProminence: { score: number; weight: number; label: string };
  topicCoverage: { score: number; weight: number; label: string };
  crossEngineConsistency: { score: number; weight: number; label: string };
  accuracy: { score: number; weight: number; label: string };
  sourceAuthority: { score: number; weight: number; label: string };
  multilingualVisibility: { score: number; weight: number; label: string };
  answerShare: { score: number; weight: number; label: string };
}

function computeGeoScore(plan: any, he: boolean): { overall: number; subScores: GeoSubScores; metrics: Record<string, number>; confidence: "high" | "medium" | "low" } {
  const scan = plan.websiteScan;
  const aiQueries: any[] = scan?.aiQueries || plan?.aiQueries || [];
  const realQueries = aiQueries.filter((q: any) => q.scanMode === "real");
  const clientName = (plan.clientName || "").toLowerCase();
  const domain = extractDomain(plan.websiteUrl || "");

  // Mention Rate: % of queries where brand name appears in response
  const mentionedQueries = realQueries.filter((q: any) => {
    if (q.found) return true;
    const text = (q.responseText || q.snippet || "").toLowerCase();
    return clientName.length > 1 && text.includes(clientName);
  });
  const mentionRate = pct(mentionedQueries.length, realQueries.length);

  // Citation Rate: % where site is used as source
  const citedQueries = realQueries.filter((q: any) => {
    const sources: any[] = q.sources || [];
    return sources.some((s: any) => {
      const sd = extractDomain(s.domain || s.url || "");
      return sd === domain || sd.includes(domain) || domain.includes(sd);
    });
  });
  const citationRate = pct(citedQueries.length, realQueries.length);

  // First Mention Rate: % where brand is mentioned first
  const firstMentionQueries = realQueries.filter((q: any) => {
    if (!q.found) return false;
    const text = (q.responseText || q.snippet || "").toLowerCase();
    if (!clientName || clientName.length < 2) return false;
    const firstIndex = text.indexOf(clientName);
    if (firstIndex < 0) return false;
    // Check if brand appears in the first 200 characters
    return firstIndex < 200;
  });
  const firstMentionRate = pct(firstMentionQueries.length, realQueries.length);

  // Citation Prominence
  let prominenceScore = 0;
  if (citedQueries.length > 0) {
    const homePageCitations = citedQueries.filter((q: any) => {
      const sources: any[] = q.sources || [];
      return sources.some((s: any) => {
        const u = (s.url || "").replace(/^https?:\/\//, "").replace(/^www\./, "");
        return u === domain || u === domain + "/" || u === domain + "/he" || u === domain + "/en";
      });
    });
    const internalPageCitations = citedQueries.filter((q: any) => {
      const sources: any[] = q.sources || [];
      return sources.some((s: any) => {
        const sd = extractDomain(s.domain || s.url || "");
        const u = (s.url || "").replace(/^https?:\/\//, "").replace(/^www\./, "");
        return (sd === domain || sd.includes(domain)) && u !== domain && u !== domain + "/";
      });
    });
    const homeRatio = pct(homePageCitations.length, citedQueries.length);
    const internalRatio = pct(internalPageCitations.length, citedQueries.length);
    // Internal page citations are better (more specific)
    prominenceScore = Math.min(100, Math.round(internalRatio * 0.6 + homeRatio * 0.4 + citationRate * 0.3));
  }

  // Topic Coverage: % of categories with at least one mention
  const categories = new Set(realQueries.map((q: any) => q.category || "general").filter(Boolean));
  const coveredCategories = new Set(mentionedQueries.map((q: any) => q.category || "general").filter(Boolean));
  const topicCoverage = categories.size > 0 ? pct(coveredCategories.size, categories.size) : 0;

  // Cross-Engine Consistency
  const engineIds = [...new Set(realQueries.map((q: any) => q.platform).filter(Boolean))];
  let consistencyScore = 0;
  if (engineIds.length > 1) {
    const enginesWithMention = engineIds.filter(eid => {
      const engineQueries = realQueries.filter((q: any) => q.platform === eid);
      return engineQueries.some((q: any) => q.found);
    });
    consistencyScore = pct(enginesWithMention.length, engineIds.length);
  } else if (engineIds.length === 1 && mentionRate > 0) {
    consistencyScore = mentionRate;
  }

  // Accuracy: start at 100, minus for each wrong info detected
  let accuracyScore = 100;
  // We can't detect inaccuracies automatically, but we can flag when AI responses
  // contain the brand but with low confidence
  const lowConfidenceResponses = realQueries.filter((q: any) =>
    q.found && q.confidence && q.confidence < 50
  );
  accuracyScore = Math.max(0, accuracyScore - lowConfidenceResponses.length * 10);

  // Source Authority: how many citations come from high-authority pages
  let sourceAuthorityScore = citationRate > 0 ? 50 : 0;
  if (scan?.domainAuthority && scan.domainAuthority > 30) sourceAuthorityScore += 25;
  if (scan?.eeat?.score && scan.eeat.score > 50) sourceAuthorityScore += 25;
  sourceAuthorityScore = Math.min(100, sourceAuthorityScore);

  // Multilingual Visibility: check if queries are in different languages
  const languages = new Set(realQueries.map((q: any) => detectLanguage(q.query || "")));
  const multilingualScore = languages.size > 1 ? Math.min(100, mentionRate + 20) : mentionRate;

  // Answer Share: rough estimate of how much answer is about the brand
  let answerShareScore = 0;
  if (mentionedQueries.length > 0) {
    const shares = mentionedQueries.map((q: any) => {
      const text = (q.responseText || q.snippet || "").toLowerCase();
      if (!text || !clientName) return 0;
      const mentions = (text.match(new RegExp(escapeRegex(clientName), "gi")) || []).length;
      const words = text.split(/\s+/).length;
      return Math.min(100, Math.round((mentions * 10 / Math.max(words, 1)) * 100));
    });
    answerShareScore = Math.round(shares.reduce((a: number, b: number) => a + b, 0) / shares.length);
  }

  const subScores: GeoSubScores = {
    mentionRate: { score: mentionRate, weight: 25, label: t(he, "שיעור אזכור מותג", "Brand Mention Rate") },
    citationRate: { score: citationRate, weight: 25, label: t(he, "שיעור ציטוט אתר", "Website Citation Rate") },
    firstMentionRate: { score: firstMentionRate, weight: 15, label: t(he, "שיעור אזכור ראשון", "First-Position Mention Rate") },
    citationProminence: { score: prominenceScore, weight: 5, label: t(he, "בולטות ציטוט", "Citation Prominence") },
    topicCoverage: { score: topicCoverage, weight: 10, label: t(he, "כיסוי נושאי", "Topic Coverage") },
    crossEngineConsistency: { score: consistencyScore, weight: 5, label: t(he, "עקביות בין מנועים", "Cross-Engine Consistency") },
    accuracy: { score: accuracyScore, weight: 5, label: t(he, "דיוק מידע", "Accuracy") },
    sourceAuthority: { score: sourceAuthorityScore, weight: 3, label: t(he, "סמכות מקור", "Source Authority") },
    multilingualVisibility: { score: multilingualScore, weight: 3, label: t(he, "נראות רב-שפתית", "Multilingual Visibility") },
    answerShare: { score: answerShareScore, weight: 4, label: t(he, "נתח תשובה", "Answer Share") },
  };

  const overall = Math.round(
    Object.values(subScores).reduce((sum, s) => sum + s.score * (s.weight / 100), 0)
  );

  // Additional metrics for the GEO section
  const metrics: Record<string, number> = {
    nameMentions: mentionedQueries.length,
    siteCitations: citedQueries.length,
    firstAppearances: firstMentionQueries.length,
    totalRealQueries: realQueries.length,
    homePageCitations: 0,
    internalPageCitations: 0,
    incorrectSourceCitations: 0,
    competitorMentions: 0,
    noBrandAnswers: realQueries.length - mentionedQueries.length,
  };

  return { overall, subScores, metrics, confidence: realQueries.length >= 10 ? "high" : realQueries.length >= 5 ? "medium" : "low" };
}

function detectLanguage(text: string): string {
  const hebrewRange = /[֐-׿]/;
  const arabicRange = /[؀-ۿ]/;
  if (hebrewRange.test(text)) return "he";
  if (arabicRange.test(text)) return "ar";
  return "en";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Main Generator ────────────────────────────────────────────────────────────

export function generatePremiumReport(
  plan: any,
  language: "he" | "en" = "he",
  businessProfile?: any,
  previousPlan?: any
): PremiumSeoReport {
  const he = language === "he";
  const scan = plan.websiteScan || null;
  const domain = extractDomain(plan.websiteUrl || "");
  const clientName = plan.clientName || "";
  const aiQueries: any[] = scan?.aiQueries || plan?.aiQueries || [];
  const realQueries = aiQueries.filter((q: any) => q.scanMode === "real");
  const scannedPages: any[] = plan.scannedPages || scan?.scannedPages || [];
  const platformStatuses: any[] = scan?.platformStatuses || plan?.platformStatuses || [];
  const goals = (plan.goals || []).filter((g: any) => g.selected !== false);
  const weeks = plan.weeks || [];
  const days = plan.days || [];
  const allTasks = weeks.flatMap((w: any) => w.tasks || []);
  const visQueries = plan.visibilityQueries || [];
  const insights = plan.insights || [];
  const clientKeywords = plan.clientKeywords || [];

  // Compute scores
  const seoScoreData = computeSeoScore(plan, he);
  const geoScoreData = computeGeoScore(plan, he);

  // Previous scores
  let prevSeoScore: number | undefined;
  let prevGeoScore: number | undefined;
  if (previousPlan) {
    prevSeoScore = computeSeoScore(previousPlan, he).overall;
    prevGeoScore = computeGeoScore(previousPlan, he).overall;
  } else if (plan.scanHistory?.length > 0) {
    const lastScan = plan.scanHistory[plan.scanHistory.length - 1];
    prevSeoScore = lastScan.overallScore;
    prevGeoScore = lastScan.visibilityScore;
  }

  // Competitors
  const competitorMap = extractCompetitors(aiQueries, clientName, plan.websiteUrl || "");

  // Collect engines actually checked
  const enginesChecked = [...new Set(realQueries.map((q: any) => q.platform).filter(Boolean))];
  const engineDisplayNames = enginesChecked.map(id => {
    for (const e of Object.values(ENGINE_MAP)) {
      if (e.ids.includes(id)) return e.name;
    }
    return id;
  });

  // Detect languages checked
  const languagesChecked = [...new Set(realQueries.map((q: any) => detectLanguage(q.query || "")))];

  // Detect if branded/non-branded queries exist
  const brandedQs = realQueries.filter((q: any) => isBrandedQuery(q.query || "", clientName, domain));
  const nonBrandedQs = realQueries.filter((q: any) => !isBrandedQuery(q.query || "", clientName, domain));

  // Technical findings
  const techFindings = buildTechnicalFindings(scan, scannedPages, he);

  // Build all 18 sections
  const sections: PremiumReportSection[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: Cover
  // ═══════════════════════════════════════════════════════════════════════════

  sections.push({
    id: "cover", number: 1,
    title: t(he, "שער הדוח", "Report Cover"),
    titleEn: "Report Cover",
    icon: "📋",
    content: [
      { type: "heading", text: t(he, `דוח SEO & GEO פרימיום`, `Premium SEO & GEO Report`), level: 2 },
      { type: "paragraph", text: t(he,
        `דוח ניתוח מקיף עבור ${clientName} (${domain})`,
        `Comprehensive analysis report for ${clientName} (${domain})`) },
      { type: "stat_row", stats: [
        { label: t(he, "לקוח", "Client"), value: clientName || na(he), color: "#00B5FE" },
        { label: t(he, "דומיין", "Domain"), value: domain || na(he), color: "#00B5FE" },
        { label: t(he, "תאריך הפקה", "Generated"), value: formatDate(new Date(), language), color: "#00B5FE" },
        { label: t(he, "גרסה", "Version"), value: "2.0", color: "#00B5FE" },
      ]},
      { type: "stat_row", stats: [
        { label: t(he, "מנועים שנבדקו", "Engines Checked"), value: engineDisplayNames.join(", ") || na(he), color: "#6366F1" },
        { label: t(he, "שפות", "Languages"), value: languagesChecked.map(l => l === "he" ? t(he, "עברית", "Hebrew") : l === "en" ? t(he, "אנגלית", "English") : l).join(", ") || na(he), color: "#6366F1" },
        { label: t(he, "שאילתות", "Queries"), value: `${realQueries.length}`, color: "#6366F1" },
      ]},
      { type: "alert", message: t(he, "דוח סודי — לשימוש פנימי בלבד", "Confidential — For internal use only"), severity: "info" },
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: Executive Summary
  // ═══════════════════════════════════════════════════════════════════════════

  const criticalCount = techFindings.filter(f => f.severity === "critical").length;
  const warningCount = techFindings.filter(f => f.severity === "warning").length;

  // Identify main strength, barrier, opportunity, risk
  const mainStrength = seoScoreData.overall >= 60
    ? t(he, "בסיס טכני טוב עם נוכחות דיגיטלית קיימת", "Good technical foundation with existing digital presence")
    : geoScoreData.overall >= 40
      ? t(he, "נוכחות בסיסית במנועי AI", "Basic presence in AI engines")
      : scan?.hasSSL
        ? t(he, "האתר מאובטח ב-SSL", "Site is SSL-secured")
        : t(he, "קיום אתר פעיל", "Active website exists");

  const mainBarrier = criticalCount > 0
    ? t(he, `${criticalCount} בעיות טכניות קריטיות מעכבות צמיחה`, `${criticalCount} critical technical issues blocking growth`)
    : geoScoreData.subScores.mentionRate.score < 30
      ? t(he, "שיעור אזכור נמוך במנועי AI", "Low mention rate in AI engines")
      : t(he, "פערי תוכן בנושאים מרכזיים", "Content gaps in key topics");

  const mainOpportunity = nonBrandedQs.length > 0 && pct(nonBrandedQs.filter((q: any) => q.found).length, nonBrandedQs.length) < 50
    ? t(he, "הגדלת נראות בשאילתות לא-ממותגות", "Increasing visibility in non-branded queries")
    : t(he, "יצירת תוכן ממוקד לפערי נושאים", "Creating targeted content for topic gaps");

  const mainRisk = geoScoreData.subScores.accuracy.score < 80
    ? t(he, "מידע לא מדויק על המותג בתשובות AI", "Inaccurate brand info in AI responses")
    : competitorMap.size > 0
      ? t(he, `${competitorMap.size} מתחרים מזוהים מתחזקים בתוצאות AI`, `${competitorMap.size} identified competitors strengthening in AI results`)
      : t(he, "שינויים באלגוריתמים עלולים להשפיע על הנראות", "Algorithm changes may impact visibility");

  // Top priority actions
  const topActions: string[] = [];
  if (criticalCount > 0) topActions.push(t(he, "תיקון בעיות טכניות קריטיות", "Fix critical technical issues"));
  if (!scan?.structuredData) topActions.push(t(he, "הוספת נתונים מובנים (Schema.org)", "Add structured data (Schema.org)"));
  if (geoScoreData.subScores.mentionRate.score < 50) topActions.push(t(he, "יצירת תוכן סמכותי לשאילתות AI חסרות", "Create authoritative content for missing AI queries"));
  if (geoScoreData.subScores.citationRate.score < 30) topActions.push(t(he, "בניית מקורות ציטוט באתר", "Build citation sources on site"));
  if (topActions.length < 3) topActions.push(t(he, "מעקב חודשי ושיפור מתמשך", "Monthly tracking and continuous improvement"));

  sections.push({
    id: "executive_summary", number: 2,
    title: t(he, "תקציר מנהלים", "Executive Summary"),
    titleEn: "Executive Summary",
    icon: "📊",
    content: [
      { type: "stat_row", stats: [
        { label: t(he, "ציון PIXEL SEO", "PIXEL SEO Score"), value: `${seoScoreData.overall}`, change: prevSeoScore !== undefined ? `${seoScoreData.overall - prevSeoScore > 0 ? "+" : ""}${seoScoreData.overall - prevSeoScore}` : undefined, color: scoreColor(seoScoreData.overall), icon: "🔍" },
        { label: t(he, "ציון PIXEL GEO", "PIXEL GEO Score"), value: `${geoScoreData.overall}`, change: prevGeoScore !== undefined ? `${geoScoreData.overall - prevGeoScore > 0 ? "+" : ""}${geoScoreData.overall - prevGeoScore}` : undefined, color: scoreColor(geoScoreData.overall), icon: "🤖" },
        { label: t(he, "ממצאים קריטיים", "Critical Findings"), value: `${criticalCount}`, color: criticalCount > 0 ? "#EF4444" : "#10B981", icon: "⚠️" },
        { label: t(he, "שאילתות נבדקו", "Queries Tested"), value: `${realQueries.length}`, color: "#00B5FE", icon: "🔎" },
      ]},
      { type: "spacer", height: 8 },
      { type: "heading", text: t(he, "סטטוס כללי", "Overall Status"), level: 3 },
      { type: "paragraph", text: t(he,
        `ניתוח מקיף של SEO ונראות AI (GEO) עבור ${clientName} (${domain}). בוצעו ${realQueries.length} בדיקות ב-${enginesChecked.length} מנועי AI. נמצאו ${criticalCount} ממצאים קריטיים ו-${warningCount} אזהרות.${businessProfile?.industry ? ` תחום: ${businessProfile.industry}.` : ""}`,
        `Comprehensive SEO and AI visibility (GEO) analysis for ${clientName} (${domain}). ${realQueries.length} checks performed across ${enginesChecked.length} AI engines. Found ${criticalCount} critical issues and ${warningCount} warnings.${businessProfile?.industry ? ` Industry: ${businessProfile.industry}.` : ""}`) },
      { type: "heading", text: t(he, "חוזק מרכזי", "Main Strength"), level: 4 },
      { type: "paragraph", text: mainStrength },
      { type: "heading", text: t(he, "מחסום מרכזי", "Main Barrier"), level: 4 },
      { type: "paragraph", text: mainBarrier },
      { type: "heading", text: t(he, "הזדמנות מרכזית", "Main Opportunity"), level: 4 },
      { type: "paragraph", text: mainOpportunity },
      { type: "heading", text: t(he, "סיכון מרכזי", "Main Risk"), level: 4 },
      { type: "paragraph", text: mainRisk },
      { type: "divider" },
      { type: "heading", text: t(he, "פעולות בעדיפות עליונה", "Top Priority Actions"), level: 3 },
      { type: "list", items: topActions, ordered: true },
      { type: "spacer", height: 8 },
      { type: "stat_row", stats: [
        { label: t(he, "רמת דחיפות", "Urgency Level"), value: criticalCount > 2 ? t(he, "גבוהה", "High") : criticalCount > 0 ? t(he, "בינונית", "Medium") : t(he, "נמוכה", "Low"), color: criticalCount > 2 ? "#EF4444" : criticalCount > 0 ? "#F59E0B" : "#10B981" },
        { label: t(he, "רמת ביטחון", "Confidence Level"), value: t(he, seoScoreData.confidence === "high" ? "גבוהה" : seoScoreData.confidence === "medium" ? "בינונית" : "נמוכה", seoScoreData.confidence === "high" ? "High" : seoScoreData.confidence === "medium" ? "Medium" : "Low"), color: seoScoreData.confidence === "high" ? "#10B981" : seoScoreData.confidence === "medium" ? "#F59E0B" : "#EF4444" },
      ]},
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2.5: Market Context — "Where Exposure Is Located"
  // ═══════════════════════════════════════════════════════════════════════════

  // Count queries per engine for distribution
  const engineDistribution: Array<{ engine: string; queries: number; mentions: number; citations: number; share: string }> = [];
  for (const [, eDef] of Object.entries(ENGINE_MAP)) {
    const eqs = realQueries.filter((q: any) => eDef.ids.includes(q.platform));
    if (eqs.length === 0) continue;
    const eMentions = eqs.filter((q: any) => q.found).length;
    const eCitations = eqs.filter((q: any) => (q.sources || []).some((s: any) => {
      const sd = extractDomain(s.domain || s.url || "");
      return sd === domain || sd.includes(domain);
    })).length;
    engineDistribution.push({
      engine: eDef.nameHe || eDef.name,
      queries: eqs.length,
      mentions: eMentions,
      citations: eCitations,
      share: `${pct(eqs.length, realQueries.length)}%`,
    });
  }

  // Sort by query count descending
  engineDistribution.sort((a, b) => b.queries - a.queries);

  const marketContextContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `סקירת הנוף הדיגיטלי — היכן הקהל מחפש מידע ואילו פלטפורמות מספקות חשיפה עבור ${clientName}. הבנת התפלגות החשיפה מאפשרת תעדוף משאבים.`,
      `Digital landscape overview — where audiences search for information and which platforms provide exposure for ${clientName}. Understanding exposure distribution enables resource prioritization.`) },
    { type: "heading", text: t(he, "התפלגות חשיפה לפי מנוע", "Exposure Distribution by Engine"), level: 3 },
    { type: "table",
      headers: [t(he, "מנוע/פלטפורמה", "Engine/Platform"), t(he, "שאילתות", "Queries"), t(he, "נתח", "Share"), t(he, "אזכורים", "Mentions"), t(he, "ציטוטים", "Citations")],
      rows: engineDistribution.map(ed => [ed.engine, `${ed.queries}`, ed.share, `${ed.mentions} (${pct(ed.mentions, ed.queries)}%)`, `${ed.citations} (${pct(ed.citations, ed.queries)}%)`]),
      sortable: true,
    },
    { type: "divider" },
    { type: "heading", text: t(he, "הקשר שוק — נתח פלטפורמות", "Market Context — Platform Share"), level: 3 },
    { type: "paragraph", text: t(he,
      `Google שולט ב-90%+ מחיפושי האינטרנט בישראל. לצד זאת, מנועי AI (ChatGPT, Gemini, Perplexity, Claude) צוברים נתח גדל, במיוחד בשאילתות אינפורמטיביות ומסחריות. Google AI Overview מופיע ביותר מ-40% מתוצאות החיפוש. ההמלצה: השקיעו ב-SEO קלאסי כבסיס, ובו-זמנית בנו נוכחות GEO בכל מנועי ה-AI.`,
      `Google dominates 90%+ of internet searches in Israel. Meanwhile, AI engines (ChatGPT, Gemini, Perplexity, Claude) are gaining share, especially for informational and commercial queries. Google AI Overview appears in 40%+ of search results. Recommendation: invest in classic SEO as foundation while building GEO presence across all AI engines.`) },
    { type: "heading", text: t(he, "סדר עדיפויות מומלץ", "Recommended Priority Order"), level: 3 },
    { type: "list", items: [
      t(he, "Google SEO — בסיס הנוכחות הדיגיטלית, נתח שוק 90%+", "Google SEO — digital presence foundation, 90%+ market share"),
      t(he, "Google AI Overview — מופיע בתוצאות חיפוש רגילות, חשיפה גבוהה", "Google AI Overview — appears in regular search results, high exposure"),
      t(he, "ChatGPT — הכלי הפופולרי ביותר לשאלות אינפורמטיביות", "ChatGPT — most popular tool for informational queries"),
      t(he, "Gemini — אינטגרציה עמוקה עם Google Workspace ו-Android", "Gemini — deep integration with Google Workspace and Android"),
      t(he, "Perplexity — מנוע מחקר מתקדם עם ציטוטים ישירים", "Perplexity — advanced research engine with direct citations"),
      t(he, "Claude — פופולרי בקרב אנשי מקצוע ומפתחים", "Claude — popular among professionals and developers"),
    ], ordered: true },
  ];

  // Add alert about AI engines where the brand is completely missing
  const missingEngines = engineDistribution.filter(e => e.mentions === 0);
  if (missingEngines.length > 0) {
    marketContextContent.push(
      { type: "alert", message: t(he,
        `${clientName} לא מופיע כלל ב-${missingEngines.length} מנועים: ${missingEngines.map(e => e.engine).join(", ")}. אלו הזדמנויות חשיפה חסרות.`,
        `${clientName} doesn't appear at all in ${missingEngines.length} engines: ${missingEngines.map(e => e.engine).join(", ")}. These are missed exposure opportunities.`), severity: "warning" }
    );
  }

  sections.push({
    id: "market_context", number: 3,
    title: t(he, "היכן נמצאת החשיפה", "Where Exposure Is Located"),
    titleEn: "Where Exposure Is Located",
    icon: "🌐",
    content: marketContextContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: PIXEL SEO Score
  // ═══════════════════════════════════════════════════════════════════════════

  const seoSubScoreEntries = Object.entries(seoScoreData.subScores);

  sections.push({
    id: "pixel_seo_score", number: 4,
    title: t(he, "ציון PIXEL SEO", "PIXEL SEO Score"),
    titleEn: "PIXEL SEO Score",
    icon: "🔍",
    content: [
      { type: "score_gauge", label: t(he, "ציון PIXEL SEO כולל", "Overall PIXEL SEO Score"), score: seoScoreData.overall, previousScore: prevSeoScore, maxScore: 100, color: scoreColor(seoScoreData.overall), subScores: seoSubScoreEntries.map(([, s]) => ({ label: s.label, score: s.score, weight: s.weight })) },
      { type: "stat", label: t(he, "רמת ביטחון", "Confidence Level"), value: t(he, seoScoreData.confidence === "high" ? "גבוהה" : seoScoreData.confidence === "medium" ? "בינונית" : "נמוכה", seoScoreData.confidence), color: seoScoreData.confidence === "high" ? "#10B981" : "#F59E0B", confidence: seoScoreData.confidence },
      ...(prevSeoScore !== undefined ? [{ type: "stat" as const, label: t(he, "שינוי מסריקה קודמת", "Change from Previous Scan"), value: `${seoScoreData.overall - prevSeoScore > 0 ? "+" : ""}${seoScoreData.overall - prevSeoScore}`, color: seoScoreData.overall >= prevSeoScore ? "#10B981" : "#EF4444" }] : []),
      { type: "divider" },
      { type: "heading", text: t(he, "פירוט ציוני משנה", "Sub-Score Breakdown"), level: 3 },
      { type: "table", headers: [t(he, "קטגוריה", "Category"), t(he, "ציון", "Score"), t(he, "משקל", "Weight"), t(he, "תרומה", "Contribution")], rows: seoSubScoreEntries.map(([, s]) => [s.label, `${s.score}`, `${s.weight}%`, `${Math.round(s.score * s.weight / 100)}`]), sortable: true },
      { type: "divider" },
      { type: "heading", text: t(he, "נוסחת חישוב", "Calculation Formula"), level: 3 },
      { type: "paragraph", text: t(he,
        `ציון PIXEL SEO = סכום (ציון_משנה × משקל). ציון כל משנה מחושב מנתוני סריקה אמיתיים: טכני (SSL, מהירות, מובייל, robots, sitemap, schema, canonical, meta, OG), נראות (שאילתות AI שנמצאו), תוכן (כותרות, תיאורים, כותרות H, מספר עמודים, אורך תוכן), סמכות (DA, backlinks), אינדקסביליות (robots, sitemap, canonical, שגיאות), ביצועי חיפוש (GSC אם מחובר), נראות ממותגת/לא-ממותגת (שאילתות AI), מוכנות להמרה (CTA, טפסים, פרטי קשר).`,
        `PIXEL SEO Score = Sum(sub_score × weight). Each sub-score is computed from real scan data: technical (SSL, speed, mobile, robots, sitemap, schema, canonical, meta, OG), visibility (AI queries found), content (titles, descriptions, H tags, page count, content length), authority (DA, backlinks), indexability (robots, sitemap, canonical, errors), search performance (GSC if connected), branded/non-branded visibility (AI queries), conversion readiness (CTA, forms, contact info).`) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: PIXEL GEO Score
  // ═══════════════════════════════════════════════════════════════════════════

  const geoSubScoreEntries = Object.entries(geoScoreData.subScores);

  sections.push({
    id: "pixel_geo_score", number: 5,
    title: t(he, "ציון PIXEL GEO", "PIXEL GEO Score"),
    titleEn: "PIXEL GEO Score",
    icon: "🤖",
    content: [
      { type: "score_gauge", label: t(he, "ציון PIXEL GEO כולל", "Overall PIXEL GEO Score"), score: geoScoreData.overall, previousScore: prevGeoScore, maxScore: 100, color: scoreColor(geoScoreData.overall), subScores: geoSubScoreEntries.map(([, s]) => ({ label: s.label, score: s.score, weight: s.weight })) },
      { type: "stat", label: t(he, "רמת ביטחון", "Confidence Level"), value: t(he, geoScoreData.confidence === "high" ? "גבוהה" : geoScoreData.confidence === "medium" ? "בינונית" : "נמוכה", geoScoreData.confidence), color: geoScoreData.confidence === "high" ? "#10B981" : "#F59E0B", confidence: geoScoreData.confidence },
      { type: "divider" },
      { type: "heading", text: t(he, "מדדים מרכזיים", "Key Metrics"), level: 3 },
      { type: "stat_row", stats: [
        { label: t(he, "אזכור שם", "Name Mention"), value: `${geoScoreData.metrics.nameMentions}/${geoScoreData.metrics.totalRealQueries}`, color: scoreColor(geoScoreData.subScores.mentionRate.score), icon: "💬" },
        { label: t(he, "ציטוט אתר", "Site Citation"), value: `${geoScoreData.metrics.siteCitations}/${geoScoreData.metrics.totalRealQueries}`, color: scoreColor(geoScoreData.subScores.citationRate.score), icon: "🔗" },
        { label: t(he, "הופעה ראשונה", "First Appearance"), value: `${geoScoreData.metrics.firstAppearances}/${geoScoreData.metrics.totalRealQueries}`, color: scoreColor(geoScoreData.subScores.firstMentionRate.score), icon: "🏆" },
      ]},
      { type: "stat_row", stats: [
        { label: t(he, "תשובות ללא מותג", "No-Brand Answers"), value: `${geoScoreData.metrics.noBrandAnswers}`, color: geoScoreData.metrics.noBrandAnswers > 0 ? "#F59E0B" : "#10B981" },
        { label: t(he, "מתחרים מזוהים", "Competitors Identified"), value: `${competitorMap.size}`, color: competitorMap.size > 5 ? "#EF4444" : "#F59E0B" },
      ]},
      { type: "divider" },
      { type: "heading", text: t(he, "פירוט ציוני משנה", "Sub-Score Breakdown"), level: 3 },
      { type: "table", headers: [t(he, "מדד", "Metric"), t(he, "ציון", "Score"), t(he, "משקל", "Weight"), t(he, "תרומה", "Contribution")], rows: geoSubScoreEntries.map(([, s]) => [s.label, `${s.score}`, `${s.weight}%`, `${Math.round(s.score * s.weight / 100)}`]), sortable: true },
      { type: "divider" },
      { type: "heading", text: t(he, "הבחנות חשובות", "Important Distinctions"), level: 3 },
      { type: "paragraph", text: t(he,
        `אזכור = שם המותג מופיע בתשובת ה-AI (הכרה, לא בהכרח קישור). ציטוט = האתר משמש כמקור עם קישור/הפניה (מייצר תעבורה). הופעה ראשונה = המותג מוזכר ב-200 התווים הראשונים של התשובה.`,
        `Mention = brand name appears in AI answer (recognition, not necessarily a link). Citation = website is used as source with link/reference (generates traffic). First appearance = brand mentioned in first 200 characters of the response.`) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6: Engine-by-Engine Snapshot
  // ═══════════════════════════════════════════════════════════════════════════

  const engineCards: PremiumReportBlock[] = [];
  for (const [key, engineDef] of Object.entries(ENGINE_MAP)) {
    const engineQueries = realQueries.filter((q: any) => engineDef.ids.includes(q.platform));
    if (engineQueries.length === 0) continue;

    const mentioned = engineQueries.filter((q: any) => q.found).length;
    const cited = engineQueries.filter((q: any) => {
      const sources: any[] = q.sources || [];
      return sources.some((s: any) => {
        const sd = extractDomain(s.domain || s.url || "");
        return sd === domain || sd.includes(domain) || domain.includes(sd);
      });
    }).length;
    const firstMention = engineQueries.filter((q: any) => {
      if (!q.found) return false;
      const text = (q.responseText || q.snippet || "").toLowerCase();
      return clientName.toLowerCase().length > 1 && text.indexOf(clientName.toLowerCase()) < 200 && text.indexOf(clientName.toLowerCase()) >= 0;
    }).length;

    // Top cited pages from this engine
    const citedPages: string[] = [];
    for (const q of engineQueries) {
      const sources: any[] = q.sources || [];
      for (const s of sources) {
        const sd = extractDomain(s.domain || s.url || "");
        if ((sd === domain || sd.includes(domain) || domain.includes(sd)) && s.url && !citedPages.includes(s.url)) {
          citedPages.push(s.url);
        }
      }
    }

    engineCards.push({
      type: "engine_card",
      engine: engineDef.name,
      icon: engineDef.icon,
      mentionRate: pct(mentioned, engineQueries.length),
      citationRate: pct(cited, engineQueries.length),
      firstMentionRate: pct(firstMention, engineQueries.length),
      queriesTested: engineQueries.length,
      topCitedPages: citedPages.slice(0, 5),
    });
  }

  // Platform status info
  const platformRows: string[][] = platformStatuses.map((ps: any) => [
    `${ps.icon || ""} ${ps.name || ps.id}`,
    `${ps.queriesScanned || 0}`,
    `${ps.mentionsFound || 0}`,
    ps.scanMode === "real" ? t(he, "אמיתי", "Real") : ps.scanMode === "unavailable" ? t(he, "לא זמין", "Unavailable") : t(he, "מדומה", "Simulated"),
    ps.status === "completed" ? "✓" : ps.status === "skipped" ? "—" : ps.status === "api_missing" ? "✗" : "○",
  ]);

  sections.push({
    id: "engine_snapshot", number: 6,
    title: t(he, "מצב לפי מנוע AI", "Engine-by-Engine Snapshot"),
    titleEn: "Engine-by-Engine Snapshot",
    icon: "🔄",
    content: [
      { type: "paragraph", text: t(he,
        `סקירה מפורטת של נראות ${clientName} בכל מנוע AI שנבדק. כל מנוע נבדק בנפרד עם שאילתות ייעודיות.`,
        `Detailed overview of ${clientName} visibility in each AI engine tested. Each engine was checked separately with dedicated queries.`) },
      ...engineCards,
      ...(platformRows.length > 0 ? [
        { type: "divider" as const },
        { type: "heading" as const, text: t(he, "סטטוס פלטפורמות", "Platform Status"), level: 3 as const },
        { type: "table" as const, headers: [t(he, "מנוע", "Engine"), t(he, "שאילתות", "Queries"), t(he, "אזכורים", "Mentions"), t(he, "מצב סריקה", "Scan Mode"), t(he, "סטטוס", "Status")], rows: platformRows },
      ] : []),
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7: Language/Country Segmentation
  // ═══════════════════════════════════════════════════════════════════════════

  const langGroups = groupByCategory(realQueries.map((q: any) => ({
    ...q,
    detectedLang: detectLanguage(q.query || ""),
  })), "detectedLang");

  const langContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `ניתוח נראות מפולח לפי שפת השאילתה. תוצאות משפות שונות אינן מעורבבות.`,
      `Visibility analysis segmented by query language. Results from different languages are not mixed.`) },
  ];

  for (const [lang, queries] of Object.entries(langGroups)) {
    const langName = lang === "he" ? t(he, "עברית", "Hebrew") : lang === "en" ? t(he, "אנגלית", "English") : lang === "ar" ? t(he, "ערבית", "Arabic") : lang;
    const found = queries.filter((q: any) => q.found).length;
    const cited = queries.filter((q: any) => (q.sources || []).some((s: any) => {
      const sd = extractDomain(s.domain || s.url || "");
      return sd === domain || sd.includes(domain);
    })).length;

    langContent.push(
      { type: "heading", text: `${langName} (${queries.length} ${t(he, "שאילתות", "queries")})`, level: 3 },
      { type: "stat_row", stats: [
        { label: t(he, "שאילתות", "Queries"), value: `${queries.length}`, color: "#00B5FE" },
        { label: t(he, "אזכורים", "Mentions"), value: `${found} (${pct(found, queries.length)}%)`, color: scoreColor(pct(found, queries.length)) },
        { label: t(he, "ציטוטים", "Citations"), value: `${cited} (${pct(cited, queries.length)}%)`, color: scoreColor(pct(cited, queries.length)) },
      ]}
    );

    // Per-engine breakdown within this language
    const langEngineRows: string[][] = [];
    for (const [eKey, eDef] of Object.entries(ENGINE_MAP)) {
      const engLangQs = queries.filter((q: any) => eDef.ids.includes(q.platform));
      if (engLangQs.length === 0) continue;
      const engFound = engLangQs.filter((q: any) => q.found).length;
      const engCited = engLangQs.filter((q: any) => (q.sources || []).some((s: any) => {
        const sd = extractDomain(s.domain || s.url || "");
        return sd === domain || sd.includes(domain);
      })).length;
      langEngineRows.push([
        eDef.nameHe || eDef.name,
        `${engLangQs.length}`,
        `${engFound} (${pct(engFound, engLangQs.length)}%)`,
        `${engCited} (${pct(engCited, engLangQs.length)}%)`,
      ]);
    }
    if (langEngineRows.length > 0) {
      langContent.push({
        type: "table",
        headers: [t(he, "מנוע", "Engine"), t(he, "שאילתות", "Queries"), t(he, "אזכורים", "Mentions"), t(he, "ציטוטים", "Citations")],
        rows: langEngineRows,
        caption: t(he, `פירוט לפי מנוע — ${langName}`, `Per-engine breakdown — ${langName}`),
      });
    }
  }

  if (Object.keys(langGroups).length === 0) {
    langContent.push({ type: "paragraph", text: na(he, t(he, "לא נמצאו שאילתות לניתוח", "No queries found for analysis")) });
  }

  sections.push({
    id: "language_segmentation", number: 7,
    title: t(he, "פילוח שפה / מדינה", "Language / Country Segmentation"),
    titleEn: "Language / Country Segmentation",
    icon: "🌍",
    content: langContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 8: Branded vs Non-Branded
  // ═══════════════════════════════════════════════════════════════════════════

  const brandedFound = brandedQs.filter((q: any) => q.found).length;
  const nonBrandedFound = nonBrandedQs.filter((q: any) => q.found).length;

  // Categorize non-branded queries by type
  const nbCategories = groupByCategory(nonBrandedQs.map((q: any) => {
    const query = (q.query || "").toLowerCase();
    let queryType = "informational";
    if (query.includes("vs") || query.includes("compare") || query.includes("or") || query.includes("מול") || query.includes("השוואה")) queryType = "comparison";
    else if (query.includes("best") || query.includes("top") || query.includes("הכי טוב") || query.includes("מומלץ") || query.includes("recommended")) queryType = "commercial";
    else if (query.includes("near") || query.includes("nearby") || query.includes("in ") || query.includes("ב") || query.includes("קרוב")) queryType = "local";
    else if (query.includes("how") || query.includes("what") || query.includes("why") || query.includes("איך") || query.includes("מה") || query.includes("למה")) queryType = "informational";
    else if (query.includes("price") || query.includes("cost") || query.includes("buy") || query.includes("מחיר") || query.includes("עלות")) queryType = "transactional";
    return { ...q, queryType };
  }), "queryType");

  const brandedContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `ניתוח המבחין בין שאילתות ממותגות (מכילות את שם "${clientName}" או הדומיין) לבין שאילתות לא-ממותגות (מחפשות פתרון/נושא). המטרה: לבדוק אם קהלים חדשים מגיעים לעסק.`,
      `Analysis distinguishing branded queries (containing "${clientName}" or domain) from non-branded queries (searching for a solution/topic). Goal: check if new audiences find the business.`) },
    { type: "stat_row", stats: [
      { label: t(he, "שאילתות ממותגות", "Branded Queries"), value: `${brandedQs.length}`, color: "#00B5FE", icon: "🏷️" },
      { label: t(he, "נמצא בממותגות", "Found in Branded"), value: `${brandedFound} (${pct(brandedFound, brandedQs.length)}%)`, color: scoreColor(pct(brandedFound, brandedQs.length)) },
      { label: t(he, "שאילתות לא-ממותגות", "Non-Branded Queries"), value: `${nonBrandedQs.length}`, color: "#6366F1", icon: "🔎" },
      { label: t(he, "נמצא בלא-ממותגות", "Found in Non-Branded"), value: `${nonBrandedFound} (${pct(nonBrandedFound, nonBrandedQs.length)}%)`, color: scoreColor(pct(nonBrandedFound, nonBrandedQs.length)) },
    ]},
  ];

  if (Object.keys(nbCategories).length > 0) {
    brandedContent.push(
      { type: "divider" },
      { type: "heading", text: t(he, "סוגי שאילתות לא-ממותגות", "Non-Branded Query Types"), level: 3 }
    );
    const categoryNames: Record<string, { he: string; en: string }> = {
      comparison: { he: "השוואה", en: "Comparison" },
      commercial: { he: "מסחרי", en: "Commercial" },
      local: { he: "מקומי", en: "Local" },
      informational: { he: "מידעי", en: "Informational" },
      transactional: { he: "עסקאי", en: "Transactional" },
    };
    const catRows: string[][] = Object.entries(nbCategories).map(([cat, qs]) => {
      const f = qs.filter((q: any) => q.found).length;
      return [
        categoryNames[cat]?.[language] || cat,
        `${qs.length}`,
        `${f}`,
        `${pct(f, qs.length)}%`,
      ];
    });
    brandedContent.push({
      type: "table",
      headers: [t(he, "סוג", "Type"), t(he, "שאילתות", "Queries"), t(he, "נמצא", "Found"), t(he, "אחוז", "Rate")],
      rows: catRows,
    });
  }

  sections.push({
    id: "branded_analysis", number: 8,
    title: t(he, "ממותג מול לא-ממותג", "Branded vs Non-Branded"),
    titleEn: "Branded vs Non-Branded",
    icon: "🏷️",
    content: brandedContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 9: Topic Cluster Analysis
  // ═══════════════════════════════════════════════════════════════════════════

  const topicGroups = groupByCategory(realQueries, "category");
  const clusterContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `ניתוח שאילתות AI לפי אשכול נושאי. כל אשכול מייצג תחום תוכן שבו ניתן לחזק את הנוכחות.`,
      `AI query analysis by topic cluster. Each cluster represents a content area where presence can be strengthened.`) },
  ];

  const clusterRows: string[][] = [];
  for (const [category, queries] of Object.entries(topicGroups)) {
    const found = queries.filter((q: any) => q.found).length;
    const cited = queries.filter((q: any) => (q.sources || []).some((s: any) => extractDomain(s.domain || s.url || "").includes(domain))).length;
    const mentionRate = pct(found, queries.length);

    // Find strongest and weakest engines for this cluster
    const enginePerformance: Record<string, { found: number; total: number }> = {};
    for (const q of queries) {
      const platform = q.platform || "unknown";
      if (!enginePerformance[platform]) enginePerformance[platform] = { found: 0, total: 0 };
      enginePerformance[platform].total++;
      if (q.found) enginePerformance[platform].found++;
    }
    const sortedEngines = Object.entries(enginePerformance)
      .map(([eng, stats]) => ({ eng, rate: pct(stats.found, stats.total) }))
      .sort((a, b) => b.rate - a.rate);

    const strongestEngine = sortedEngines[0]?.eng || "-";
    const weakestEngine = sortedEngines.length > 1 ? sortedEngines[sortedEngines.length - 1].eng : "-";

    clusterRows.push([
      category,
      `${queries.length}`,
      `${mentionRate}%`,
      `${pct(cited, queries.length)}%`,
      strongestEngine,
      weakestEngine,
    ]);
  }

  if (clusterRows.length > 0) {
    clusterContent.push({
      type: "table",
      headers: [t(he, "נושא", "Topic"), t(he, "שאילתות", "Queries"), t(he, "אזכור", "Mention %"), t(he, "ציטוט", "Citation %"), t(he, "מנוע חזק", "Strongest Engine"), t(he, "מנוע חלש", "Weakest Engine")],
      rows: clusterRows,
      sortable: true,
    });

    // Recommendations per cluster
    const weakClusters = clusterRows.filter(r => parseInt(r[2]) < 40);
    if (weakClusters.length > 0) {
      clusterContent.push(
        { type: "divider" },
        { type: "heading", text: t(he, "אשכולות הדורשים חיזוק", "Clusters Requiring Strengthening"), level: 3 },
        { type: "list", items: weakClusters.map(r =>
          t(he,
            `"${r[0]}" — שיעור אזכור ${r[2]} בלבד. מומלץ ליצור תוכן סמכותי בנושא זה.`,
            `"${r[0]}" — only ${r[2]} mention rate. Recommended to create authoritative content on this topic.`)
        )}
      );
    }
  } else {
    clusterContent.push({ type: "paragraph", text: na(he, t(he, "אין נתוני קטגוריה זמינים לקיבוץ שאילתות", "No category data available for query clustering")) });
  }

  sections.push({
    id: "topic_clusters", number: 9,
    title: t(he, "ניתוח אשכולות נושאיים", "Topic Cluster Analysis"),
    titleEn: "Topic Cluster Analysis",
    icon: "🎯",
    content: clusterContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 10: Competition for Authority
  // ═══════════════════════════════════════════════════════════════════════════

  const competitorContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `ניתוח מתחרים שמופיעים בתשובות AI כאשר ${clientName} חסר. ${competitorMap.size} דומיינים מתחרים זוהו.`,
      `Analysis of competitors appearing in AI responses when ${clientName} is absent. ${competitorMap.size} competing domains identified.`) },
  ];

  // Sort competitors by total presence
  const sortedCompetitors = [...competitorMap.entries()]
    .map(([dom, data]) => ({ domain: dom, ...data, total: data.mentions + data.citations }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  if (sortedCompetitors.length > 0) {
    for (const comp of sortedCompetitors.slice(0, 10)) {
      competitorContent.push({
        type: "competitor_row",
        domain: comp.domain,
        mentions: comp.mentions,
        citations: comp.citations,
        engines: [...comp.engines],
        topics: [...comp.topics].slice(0, 5),
        sourceType: comp.sourceType,
      });
    }

    competitorContent.push(
      { type: "divider" },
      { type: "heading", text: t(he, "סוגי מקורות מתחרים", "Competitor Source Types"), level: 3 }
    );

    const sourceTypeGroups: Record<string, number> = {};
    for (const comp of sortedCompetitors) {
      sourceTypeGroups[comp.sourceType] = (sourceTypeGroups[comp.sourceType] || 0) + 1;
    }
    const sourceTypeLabels: Record<string, { he: string; en: string }> = {
      commercial: { he: "מסחרי", en: "Commercial" },
      governmental: { he: "ממשלתי", en: "Governmental" },
      news: { he: "חדשות", en: "News" },
      academic: { he: "אקדמי", en: "Academic" },
      forum: { he: "פורום", en: "Forum" },
      social: { he: "רשתות חברתיות", en: "Social" },
      encyclopedia: { he: "אנציקלופדיה", en: "Encyclopedia" },
    };
    competitorContent.push({
      type: "table",
      headers: [t(he, "סוג מקור", "Source Type"), t(he, "מספר דומיינים", "Domain Count")],
      rows: Object.entries(sourceTypeGroups).map(([type, count]) => [
        sourceTypeLabels[type]?.[language] || type,
        `${count}`,
      ]),
    });

    competitorContent.push(
      { type: "divider" },
      { type: "heading", text: t(he, "אסטרטגיה לעקיפת מתחרים", "Strategy to Outperform Competitors"), level: 3 },
      { type: "list", items: [
        t(he, "צור תוכן מומחה עם E-E-A-T (מומחיות, ניסיון, סמכות, אמון)", "Create expert content with E-E-A-T (Expertise, Experience, Authority, Trust)"),
        t(he, "בנה פרופיל סמכות — מאמרים, ביקורות, הופעות מדיה", "Build authority profile — articles, reviews, media appearances"),
        t(he, "פרסם תוכן בפלטפורמות שה-AI מרבה לצטט", "Publish content on platforms that AI frequently cites"),
        t(he, "הוסף FAQ ו-Schema מובנה לכל דף שירות", "Add FAQ and structured Schema to every service page"),
        t(he, "בנה קישורים מאתרי סמכות בתחום", "Build links from authority sites in the field"),
      ]}
    );
  } else {
    competitorContent.push({ type: "paragraph", text: na(he, t(he, "לא זוהו מתחרים בתשובות AI", "No competitors identified in AI responses")) });
  }

  sections.push({
    id: "competitor_authority", number: 10,
    title: t(he, "תחרות על סמכות", "Competition for Authority"),
    titleEn: "Competition for Authority",
    icon: "⚔️",
    content: competitorContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 11: Technical Audit
  // ═══════════════════════════════════════════════════════════════════════════

  const technicalContent: PremiumReportBlock[] = [];

  if (scan) {
    technicalContent.push(
      { type: "paragraph", text: t(he,
        `ביקורת טכנית מלאה של ${domain} על בסיס סריקה אמיתית. כל בדיקה מבוססת על נתוני HTTP בפועל.`,
        `Full technical audit of ${domain} based on real scan. Each check is based on actual HTTP data.`) },
      { type: "stat_row", stats: [
        { label: "SSL", value: scan.hasSSL ? "✓" : "✗", color: scan.hasSSL ? "#10B981" : "#EF4444", icon: "🔒" },
        { label: t(he, "מהירות", "Speed"), value: `${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s`, color: (scan.loadTimeMs || 0) < 3000 ? "#10B981" : "#EF4444", icon: "⚡" },
        { label: t(he, "מובייל", "Mobile"), value: scan.mobileOptimized ? "✓" : "✗", color: scan.mobileOptimized ? "#10B981" : "#EF4444", icon: "📱" },
        { label: "DA", value: `${scan.domainAuthority || 0}`, color: (scan.domainAuthority || 0) > 30 ? "#10B981" : "#F59E0B", icon: "📈" },
      ]},
      { type: "table",
        headers: [t(he, "בדיקה", "Check"), t(he, "תוצאה", "Result"), t(he, "סטטוס", "Status")],
        rows: [
          ["SSL/HTTPS", scan.hasSSL ? t(he, "מאובטח", "Secured") : t(he, "לא מאובטח", "Not Secured"), scan.hasSSL ? "✓" : "✗"],
          [t(he, "מהירות טעינה", "Load Speed"), `${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s`, (scan.loadTimeMs || 0) < 3000 ? "✓" : "✗"],
          [t(he, "מותאם מובייל", "Mobile Optimized"), scan.mobileOptimized ? t(he, "כן", "Yes") : t(he, "לא", "No"), scan.mobileOptimized ? "✓" : "✗"],
          ["Robots.txt", scan.hasRobotsTxt ? t(he, "קיים", "Present") : t(he, "חסר", "Missing"), scan.hasRobotsTxt ? "✓" : "✗"],
          ["Sitemap.xml", scan.hasSitemap ? t(he, "קיים", "Present") : t(he, "חסר", "Missing"), scan.hasSitemap ? "✓" : "✗"],
          [t(he, "נתונים מובנים", "Structured Data"), scan.structuredData ? t(he, "קיים", "Present") : t(he, "חסר", "Missing"), scan.structuredData ? "✓" : "✗"],
          ["Open Graph", scan.openGraph ? t(he, "קיים", "Present") : t(he, "חסר", "Missing"), scan.openGraph ? "✓" : "✗"],
          [t(he, "תגי Canonical", "Canonical Tags"), scan.canonicalTags ? t(he, "קיים", "Present") : t(he, "חסר", "Missing"), scan.canonicalTags ? "✓" : "✗"],
          ["Meta Title", scan.metaTitle ? `"${scan.metaTitle.substring(0, 60)}"` : t(he, "חסר", "Missing"), scan.metaTitle ? "✓" : "✗"],
          ["Meta Description", scan.metaDescription ? `"${scan.metaDescription.substring(0, 80)}..."` : t(he, "חסר", "Missing"), scan.metaDescription ? "✓" : "✗"],
          [t(he, "כותרות H1", "H1 Tags"), `${scan.h1Tags?.length || 0}`, (scan.h1Tags?.length || 0) > 0 ? "✓" : "✗"],
          [t(he, "כותרות H2", "H2 Tags"), `${scan.h2Tags?.length || 0}`, (scan.h2Tags?.length || 0) > 0 ? "✓" : "—"],
          [t(he, "דפים מאונדקסים", "Indexed Pages"), `${scan.indexedPages || scan.totalPages || 0}`, "—"],
          [t(he, "קישורים שבורים", "Broken Links"), `${scan.brokenLinks || 0}`, (scan.brokenLinks || 0) === 0 ? "✓" : "✗"],
          ["Domain Authority", `${scan.domainAuthority || 0}`, (scan.domainAuthority || 0) > 20 ? "✓" : "—"],
          [t(he, "מערכת ניהול", "CMS"), scan.cmsDetected || na(he), "—"],
        ],
        caption: t(he, "סריקה טכנית מלאה", "Full Technical Scan"),
      }
    );

    // Findings
    technicalContent.push({ type: "divider" }, { type: "heading", text: t(he, "ממצאים טכניים", "Technical Findings"), level: 3 });
    for (const f of techFindings) {
      technicalContent.push({
        type: "finding",
        severity: f.severity,
        title: f.title,
        detail: f.detail,
        recommendation: f.rec,
        evidence: f.evidence,
        confidence: "high",
      });
    }

    // Per-page analysis
    if (scannedPages.length > 0) {
      technicalContent.push(
        { type: "divider" },
        { type: "heading", text: t(he, "ניתוח לפי עמוד", "Per-Page Analysis"), level: 3 },
        { type: "table",
          headers: [t(he, "עמוד", "Page"), t(he, "כותרת", "Title"), t(he, "מילים", "Words"), t(he, "Schema", "Schema"), t(he, "Meta", "Meta"), t(he, "H1", "H1")],
          rows: scannedPages.slice(0, 30).map((p: any) => [
            (p.url || "").replace(/^https?:\/\//, "").substring(0, 50),
            (p.title || na(he)).substring(0, 40),
            `${p.wordCount || 0}`,
            p.hasSchema ? "✓" : "✗",
            p.missingMeta ? "✗" : "✓",
            p.missingH1 ? "✗" : "✓",
          ]),
          caption: t(he, `${scannedPages.length} עמודים נסרקו`, `${scannedPages.length} pages scanned`),
        }
      );
    }
  } else {
    technicalContent.push({ type: "paragraph", text: na(he, t(he, "לא בוצעה סריקה טכנית", "No technical scan performed")) });
  }

  sections.push({
    id: "technical_audit", number: 11,
    title: t(he, "ביקורת טכנית", "Technical Audit"),
    titleEn: "Technical Audit",
    icon: "🔧",
    content: technicalContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 12: Structured Data & Entity
  // ═══════════════════════════════════════════════════════════════════════════

  const schemaTypes = scan?.schemaTypes || [];
  const requiredSchemas = [
    { type: "Organization", label: t(he, "ארגון", "Organization"), required: true },
    { type: "LocalBusiness", label: t(he, "עסק מקומי", "Local Business"), required: true },
    { type: "WebSite", label: t(he, "אתר", "Website"), required: true },
    { type: "WebPage", label: t(he, "דף אינטרנט", "Web Page"), required: false },
    { type: "Article", label: t(he, "מאמר", "Article"), required: false },
    { type: "FAQPage", label: t(he, "דף שאלות נפוצות", "FAQ Page"), required: true },
    { type: "BreadcrumbList", label: t(he, "נתיב ניווט", "Breadcrumb"), required: true },
    { type: "Product", label: t(he, "מוצר", "Product"), required: false },
    { type: "Service", label: t(he, "שירות", "Service"), required: false },
    { type: "Review", label: t(he, "ביקורת", "Review"), required: false },
    { type: "HowTo", label: t(he, "מדריך", "How To"), required: false },
  ];

  const structuredContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `ניתוח נתונים מובנים (Schema.org) ועקביות ישות המותג. נתונים מובנים עוזרים למנועי חיפוש ו-AI להבין את תוכן האתר.`,
      `Analysis of structured data (Schema.org) and brand entity consistency. Structured data helps search engines and AI understand site content.`) },
    { type: "table",
      headers: [t(he, "סוג Schema", "Schema Type"), t(he, "סטטוס", "Status"), t(he, "חשיבות", "Importance")],
      rows: requiredSchemas.map(s => [
        `${s.type} (${s.label})`,
        schemaTypes.map((st: string) => st.toLowerCase()).includes(s.type.toLowerCase()) ? "✓ " + t(he, "קיים", "Present") : "✗ " + t(he, "חסר", "Missing"),
        s.required ? t(he, "חיוני", "Required") : t(he, "מומלץ", "Recommended"),
      ]),
    },
  ];

  const presentSchemas = requiredSchemas.filter(s => schemaTypes.map((st: string) => st.toLowerCase()).includes(s.type.toLowerCase()));
  const missingSchemas = requiredSchemas.filter(s => !schemaTypes.map((st: string) => st.toLowerCase()).includes(s.type.toLowerCase()));

  if (missingSchemas.length > 0) {
    structuredContent.push(
      { type: "divider" },
      { type: "heading", text: t(he, "Schema חסרים — המלצות", "Missing Schemas — Recommendations"), level: 3 },
      { type: "list", items: missingSchemas.filter(s => s.required).map(s =>
        t(he,
          `הוסף ${s.type} Schema — ${s.label}. חיוני לזיהוי נכון ע"י מנועי AI.`,
          `Add ${s.type} Schema — ${s.label}. Essential for correct identification by AI engines.`)
      )}
    );
  }

  // Brand consistency check
  structuredContent.push(
    { type: "divider" },
    { type: "heading", text: t(he, "עקביות מותג", "Brand Consistency"), level: 3 }
  );

  if (businessProfile) {
    const consistencyChecks: string[][] = [
      [t(he, "שם עסק", "Business Name"), businessProfile.business_name || na(he), clientName ? "✓" : "✗"],
      [t(he, "תחום", "Industry"), businessProfile.industry || na(he), businessProfile.industry ? "✓" : "—"],
      [t(he, "מיקום", "Location"), businessProfile.location || na(he), businessProfile.location ? "✓" : "—"],
      [t(he, "טלפון", "Phone"), businessProfile.phone || na(he), businessProfile.phone ? "✓" : "—"],
      [t(he, "אימייל", "Email"), businessProfile.email || na(he), businessProfile.email ? "✓" : "—"],
      [t(he, "תיאור", "Description"), businessProfile.description ? (businessProfile.description as string).substring(0, 60) + "..." : na(he), businessProfile.description ? "✓" : "✗"],
    ];
    structuredContent.push({
      type: "table",
      headers: [t(he, "שדה", "Field"), t(he, "ערך", "Value"), t(he, "סטטוס", "Status")],
      rows: consistencyChecks,
    });
  } else {
    structuredContent.push({ type: "paragraph", text: na(he, t(he, "לא הוגדר פרופיל עסקי", "No business profile defined")) });
  }

  sections.push({
    id: "structured_data", number: 12,
    title: t(he, "נתונים מובנים וישויות", "Structured Data & Entity"),
    titleEn: "Structured Data & Entity",
    icon: "🏗️",
    content: structuredContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 13: SEO Organic
  // ═══════════════════════════════════════════════════════════════════════════

  const organicContent: PremiumReportBlock[] = [];

  if (plan.gscData) {
    // GSC data available
    const gsc = plan.gscData;
    organicContent.push(
      { type: "paragraph", text: t(he, "נתונים מ-Google Search Console:", "Data from Google Search Console:") },
      { type: "stat_row", stats: [
        { label: t(he, "קליקים", "Clicks"), value: `${gsc.clicks || 0}`, color: "#00B5FE", icon: "🖱️" },
        { label: t(he, "חשיפות", "Impressions"), value: `${gsc.impressions || 0}`, color: "#6366F1", icon: "👁️" },
        { label: "CTR", value: `${(gsc.ctr || 0).toFixed(1)}%`, color: scoreColor((gsc.ctr || 0) * 10), icon: "📊" },
        { label: t(he, "מיקום ממוצע", "Avg Position"), value: `${(gsc.position || 0).toFixed(1)}`, color: (gsc.position || 99) < 20 ? "#10B981" : "#F59E0B", icon: "📍" },
      ]}
    );
    if (gsc.topQueries?.length > 0) {
      organicContent.push(
        { type: "heading", text: t(he, "שאילתות מובילות", "Top Queries"), level: 3 },
        { type: "table",
          headers: [t(he, "שאילתה", "Query"), t(he, "קליקים", "Clicks"), t(he, "חשיפות", "Impressions"), t(he, "מיקום", "Position")],
          rows: gsc.topQueries.slice(0, 20).map((q: any) => [q.query, `${q.clicks}`, `${q.impressions}`, `${q.position?.toFixed(1) || "-"}`]),
        }
      );
    }
  } else {
    organicContent.push(
      { type: "alert", message: t(he, "Google Search Console לא מחובר. לקבלת נתוני SEO אורגני מדויקים, יש לחבר GSC.", "Google Search Console not connected. Connect GSC for accurate organic SEO data."), severity: "warning" },
      { type: "paragraph", text: t(he,
        `ללא חיבור ל-Google Search Console, אין נתוני קליקים, חשיפות, CTR ומיקום ממוצע. ההערכה מבוססת על הסריקה הטכנית בלבד.`,
        `Without Google Search Console connection, there is no clicks, impressions, CTR, or average position data. Estimation is based on technical scan only.`) },
      { type: "list", items: [
        t(he, "היכנס ל-Google Search Console (search.google.com/search-console)", "Go to Google Search Console (search.google.com/search-console)"),
        t(he, "אמת בעלות על הדומיין", "Verify domain ownership"),
        t(he, "חבר את חשבון ה-GSC לפלטפורמה", "Connect the GSC account to the platform"),
      ], ordered: true }
    );
  }

  // Keyword tracking
  if (clientKeywords.length > 0) {
    organicContent.push(
      { type: "divider" },
      { type: "heading", text: t(he, "מעקב מילות מפתח", "Keyword Tracking"), level: 3 },
      { type: "table",
        headers: [t(he, "מילת מפתח", "Keyword"), t(he, "מיקום נוכחי", "Current Rank"), t(he, "מגמה", "Trend"), t(he, "מקור", "Source")],
        rows: clientKeywords.slice(0, 20).map((kw: any) => [
          kw.keyword,
          kw.currentRank ? `${kw.currentRank}` : na(he),
          kw.trend === "up" ? "↑" : kw.trend === "down" ? "↓" : kw.trend === "stable" ? "→" : "•",
          kw.source === "client" ? t(he, "לקוח", "Client") : t(he, "AI", "AI"),
        ]),
      }
    );
  }

  sections.push({
    id: "seo_organic", number: 13,
    title: t(he, "SEO אורגני", "SEO Organic"),
    titleEn: "SEO Organic",
    icon: "📈",
    content: organicContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 14: Content Gaps
  // ═══════════════════════════════════════════════════════════════════════════

  const missedQueries = realQueries.filter((q: any) => !q.found);
  const existingContentGaps = plan.contentGaps || [];

  const contentGapContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `זוהו ${missedQueries.length} פערי תוכן — שאילתות AI שבהן ${clientName} אינו מופיע. כל פער מייצג הזדמנות ליצירת תוכן ממוקד.`,
      `Identified ${missedQueries.length} content gaps — AI queries where ${clientName} does not appear. Each gap represents a targeted content opportunity.`) },
  ];

  if (missedQueries.length > 0) {
    const gapRows: string[][] = missedQueries.slice(0, 25).map((q: any) => {
      const queryObj = visQueries.find((vq: any) => vq.query === q.query || vq.id === q.queryId);
      const lang = detectLanguage(q.query || "");
      const branded = isBrandedQuery(q.query || "", clientName, domain);

      // Find who appears instead
      const competitorSources = (q.sources || [])
        .filter((s: any) => {
          const sd = extractDomain(s.domain || s.url || "");
          return sd !== domain && !sd.includes(domain);
        })
        .map((s: any) => extractDomain(s.domain || s.url || ""))
        .filter(Boolean)
        .slice(0, 2);

      return [
        q.query || "",
        queryObj?.intent || t(he, "מידעי", "informational"),
        lang === "he" ? t(he, "עברית", "Hebrew") : t(he, "אנגלית", "English"),
        branded ? t(he, "ממותג", "Branded") : t(he, "לא-ממותג", "Non-Branded"),
        competitorSources.join(", ") || "—",
        queryObj?.importance === "high" ? t(he, "גבוהה", "High") : queryObj?.importance === "medium" ? t(he, "בינונית", "Medium") : t(he, "נמוכה", "Low"),
      ];
    });

    contentGapContent.push({
      type: "table",
      headers: [
        t(he, "שאילתה", "Query"),
        t(he, "כוונה", "Intent"),
        t(he, "שפה", "Language"),
        t(he, "סוג", "Type"),
        t(he, "מתחרה מוביל", "Leading Competitor"),
        t(he, "עדיפות", "Priority"),
      ],
      rows: gapRows,
      sortable: true,
      caption: t(he, `${missedQueries.length} פערי תוכן`, `${missedQueries.length} content gaps`),
    });

    contentGapContent.push(
      { type: "divider" },
      { type: "heading", text: t(he, "תוכנית תוכן מומלצת", "Recommended Content Plan"), level: 3 },
      { type: "list", items: [
        t(he, `צור ${Math.min(missedQueries.length, 5)} מאמרי מומחה לשאילתות בעדיפות גבוהה`, `Create ${Math.min(missedQueries.length, 5)} expert articles for high-priority queries`),
        t(he, "כל מאמר צריך FAQ Schema מובנה, מקורות, וסטטיסטיקות", "Each article should have built-in FAQ Schema, sources, and statistics"),
        t(he, "כתוב תשובות ישירות בפסקה הראשונה — מנועי AI מעדיפים תשובות ברורות", "Write direct answers in the first paragraph — AI engines prefer clear answers"),
        t(he, "הוסף נתונים מובנים (Schema) לכל תוכן חדש", "Add structured data (Schema) to every new content"),
        t(he, "עדכן תוכן קיים עם תשובות לשאילתות חסרות", "Update existing content with answers to missing queries"),
      ]}
    );
  } else {
    contentGapContent.push({
      type: "finding",
      severity: "success",
      title: t(he, "כיסוי תוכן מלא", "Full Content Coverage"),
      detail: t(he, "העסק מופיע בכל השאילתות שנבדקו.", "Business appears in all tested queries."),
      recommendation: t(he, "המשך לשמור ולעדכן תוכן באופן שוטף.", "Continue maintaining and updating content regularly."),
    });
  }

  // Existing content gaps from plan
  if (existingContentGaps.length > 0) {
    contentGapContent.push(
      { type: "divider" },
      { type: "heading", text: t(he, "פערי תוכן שזוהו בתוכנית", "Content Gaps from Plan"), level: 3 },
      { type: "table",
        headers: [t(he, "שאילתה", "Query"), t(he, "קטגוריה", "Category"), t(he, "פעולה מומלצת", "Suggested Action"), t(he, "עדיפות", "Priority")],
        rows: existingContentGaps.slice(0, 15).map((g: any) => [
          g.query || "",
          g.category || "",
          g.suggestedAction || "",
          g.importance === "high" ? t(he, "גבוהה", "High") : g.importance === "medium" ? t(he, "בינונית", "Medium") : t(he, "נמוכה", "Low"),
        ]),
      }
    );
  }

  sections.push({
    id: "content_gaps", number: 14,
    title: t(he, "פערי תוכן", "Content Gaps"),
    titleEn: "Content Gaps",
    icon: "📝",
    content: contentGapContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 15: Citation Quality
  // ═══════════════════════════════════════════════════════════════════════════

  const citedQueries = realQueries.filter((q: any) => {
    const sources: any[] = q.sources || [];
    return sources.some((s: any) => {
      const sd = extractDomain(s.domain || s.url || "");
      return sd === domain || sd.includes(domain) || domain.includes(sd);
    });
  });

  const citationContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `ניתוח איכות ציטוטים — לא רק האם האתר מצוטט, אלא כיצד. ציטוט איכותי מפנה לדף הנכון, מתוך הקשר רלוונטי, ומהווה מקור ראשוני.`,
      `Citation quality analysis — not just whether the site is cited, but how. A quality citation points to the right page, in relevant context, and serves as a primary source.`) },
    { type: "stat_row", stats: [
      { label: t(he, "שאילתות עם ציטוט", "Queries with Citation"), value: `${citedQueries.length}/${realQueries.length}`, color: scoreColor(pct(citedQueries.length, realQueries.length)), icon: "🔗" },
      { label: t(he, "שיעור ציטוט", "Citation Rate"), value: `${pct(citedQueries.length, realQueries.length)}%`, color: scoreColor(pct(citedQueries.length, realQueries.length)) },
    ]},
  ];

  if (citedQueries.length > 0) {
    // Analyze each citation
    const citationDetails: string[][] = [];
    let homePageCitations = 0;
    let internalPageCitations = 0;

    for (const q of citedQueries) {
      const sources: any[] = q.sources || [];
      const clientSources = sources.filter((s: any) => {
        const sd = extractDomain(s.domain || s.url || "");
        return sd === domain || sd.includes(domain) || domain.includes(sd);
      });

      for (const src of clientSources) {
        const url = src.url || "";
        const urlPath = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
        const isHomePage = urlPath === domain || urlPath === domain + "/" || urlPath === domain + "/he" || urlPath === domain + "/en";
        if (isHomePage) homePageCitations++;
        else internalPageCitations++;

        citationDetails.push([
          (q.query || "").substring(0, 40),
          urlPath.substring(0, 50),
          isHomePage ? t(he, "דף בית", "Home Page") : t(he, "דף פנימי", "Internal Page"),
          q.platform || "",
          q.mentionType === "both" ? t(he, "טקסט + מקור", "Text + Source") : q.mentionType === "in_sources" ? t(he, "מקור בלבד", "Source Only") : q.mentionType === "in_text" ? t(he, "טקסט בלבד", "Text Only") : "—",
        ]);
      }
    }

    citationContent.push(
      { type: "stat_row", stats: [
        { label: t(he, "ציטוט דף בית", "Home Page Citations"), value: `${homePageCitations}`, color: "#00B5FE" },
        { label: t(he, "ציטוט דף פנימי", "Internal Page Citations"), value: `${internalPageCitations}`, color: internalPageCitations > 0 ? "#10B981" : "#F59E0B" },
      ]},
      { type: "divider" },
      { type: "heading", text: t(he, "פירוט ציטוטים", "Citation Details"), level: 3 },
      { type: "table",
        headers: [t(he, "שאילתה", "Query"), t(he, "URL מצוטט", "Cited URL"), t(he, "סוג דף", "Page Type"), t(he, "מנוע", "Engine"), t(he, "סוג אזכור", "Mention Type")],
        rows: citationDetails.slice(0, 20),
      }
    );

    if (internalPageCitations === 0 && homePageCitations > 0) {
      citationContent.push({
        type: "finding",
        severity: "warning",
        title: t(he, "כל הציטוטים מפנים לדף הבית", "All Citations Point to Home Page"),
        detail: t(he, "מנועי AI מצטטים רק את דף הבית ולא דפים פנימיים ספציפיים. זה מצביע על חוסר תוכן ייעודי.", "AI engines only cite the home page and not specific internal pages. This indicates a lack of dedicated content."),
        recommendation: t(he, "צור דפים ייעודיים לכל נושא/שירות עם תוכן מעמיק ו-Schema מובנה.", "Create dedicated pages for each topic/service with in-depth content and structured Schema."),
      });
    }
  } else {
    citationContent.push({
      type: "finding",
      severity: "warning",
      title: t(he, "אין ציטוטים של האתר", "No Site Citations"),
      detail: t(he, "מנועי AI לא מצטטים את האתר כמקור. העסק עשוי להיות מוזכר בשם אך ללא קישור.", "AI engines do not cite the site as a source. The business may be mentioned by name but without a link."),
      recommendation: t(he, "בנה תוכן סמכותי עם מקורות, נתונים ו-Schema — כדי שמנועי AI יראו באתר מקור ציטוט אמין.", "Build authoritative content with sources, data, and Schema — so AI engines see the site as a reliable citation source."),
    });
  }

  sections.push({
    id: "citation_quality", number: 15,
    title: t(he, "איכות ציטוטים", "Citation Quality"),
    titleEn: "Citation Quality",
    icon: "🔗",
    content: citationContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 16: Brand Accuracy in AI
  // ═══════════════════════════════════════════════════════════════════════════

  const accuracyContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `בדיקת דיוק המידע שמנועי AI מציגים על ${clientName}. כל שגיאה עלולה לפגוע במוניטין ולהפנות לקוחות למתחרים.`,
      `Checking accuracy of information AI engines present about ${clientName}. Every error can damage reputation and redirect customers to competitors.`) },
  ];

  const mentionedInAI = realQueries.filter((q: any) => q.found);
  if (mentionedInAI.length > 0) {
    const accuracyChecks: string[][] = [];

    for (const q of mentionedInAI.slice(0, 15)) {
      const text = (q.responseText || q.snippet || "");
      const textLower = text.toLowerCase();

      // Check if name appears correctly
      const nameCorrect = clientName && textLower.includes(clientName.toLowerCase());
      // Check if domain appears
      const domainAppears = domain && textLower.includes(domain);

      // Look for potential issues
      let issue = t(he, "לא נמצאו שגיאות ברורות", "No obvious errors found");
      let severity = "✓";

      if (!nameCorrect && q.found) {
        issue = t(he, "שם העסק עשוי להופיע בצורה לא מדויקת", "Business name may appear inaccurately");
        severity = "⚠️";
      }

      accuracyChecks.push([
        (q.query || "").substring(0, 40),
        q.platform || "",
        nameCorrect ? "✓" : "?",
        domainAppears ? "✓" : "—",
        severity,
        issue.substring(0, 50),
      ]);
    }

    accuracyContent.push(
      { type: "table",
        headers: [t(he, "שאילתה", "Query"), t(he, "מנוע", "Engine"), t(he, "שם נכון", "Name Correct"), t(he, "דומיין", "Domain"), t(he, "סטטוס", "Status"), t(he, "הערה", "Note")],
        rows: accuracyChecks,
      }
    );

    accuracyContent.push(
      { type: "divider" },
      { type: "heading", text: t(he, "המלצות לדיוק מותג", "Brand Accuracy Recommendations"), level: 3 },
      { type: "list", items: [
        t(he, "ודא ששם העסק, הכתובת, הטלפון והתיאור עקביים בכל הפלטפורמות", "Ensure business name, address, phone, and description are consistent across all platforms"),
        t(he, "עדכן פרופילים ב-Google Business, Bing Places, ושאר מדריכים", "Update profiles on Google Business, Bing Places, and other directories"),
        t(he, "הוסף Organization Schema עם פרטים מלאים ומדויקים", "Add Organization Schema with complete and accurate details"),
        t(he, "צור דף 'אודות' מקיף עם היסטוריה, צוות ומומחיות", "Create a comprehensive 'About' page with history, team, and expertise"),
        t(he, "בדוק תקופתית את תשובות ה-AI ודווח על שגיאות", "Periodically check AI responses and report errors"),
      ]}
    );
  } else {
    accuracyContent.push({
      type: "alert",
      message: t(he, "העסק אינו מופיע בתשובות AI — אין מה לבדוק לדיוק", "Business does not appear in AI responses — no accuracy check possible"),
      severity: "warning",
    });
  }

  sections.push({
    id: "brand_accuracy", number: 16,
    title: t(he, "דיוק מותג ב-AI", "Brand Accuracy in AI"),
    titleEn: "Brand Accuracy in AI",
    icon: "🎯",
    content: accuracyContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 17: Action Plan
  // ═══════════════════════════════════════════════════════════════════════════

  const actionContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `תוכנית פעולה מובנית ל-90 ימים עם 3 שלבים: תשתית (0-30 יום), פערי תוכן (31-60 יום), וצמיחה (61-90 יום). כל משימה מבוססת על ממצאי הסריקה.`,
      `Structured 90-day action plan with 3 phases: infrastructure (0-30 days), content gaps (31-60 days), and growth (61-90 days). Each task is based on scan findings.`) },
  ];

  // Phase 1: Infrastructure (0-30 days)
  const phase1Actions: PremiumReportBlock[] = [];
  phase1Actions.push({ type: "heading", text: t(he, "שלב 1: תשתית (0-30 יום)", "Phase 1: Infrastructure (0-30 days)"), level: 3 });

  if (!scan?.hasSSL) {
    phase1Actions.push({ type: "action_item", title: t(he, "התקנת SSL", "Install SSL"), description: t(he, "התקן תעודת SSL (Let's Encrypt) והפנה HTTP ל-HTTPS", "Install SSL certificate (Let's Encrypt) and redirect HTTP to HTTPS"), priority: "critical", impact: t(he, "גבוהה", "High"), effort: t(he, "נמוך", "Low"), deadline: t(he, "שבוע 1", "Week 1"), kpi: t(he, "אתר נגיש ב-HTTPS", "Site accessible via HTTPS"), evidence: t(he, "סריקה: האתר לא מאובטח", "Scan: Site not secured") });
  }
  if (!scan?.mobileOptimized) {
    phase1Actions.push({ type: "action_item", title: t(he, "התאמה למובייל", "Mobile Optimization"), description: t(he, "יישם עיצוב רספונסיבי ובדוק עם Mobile-Friendly Test", "Implement responsive design and test with Mobile-Friendly Test"), priority: "critical", impact: t(he, "גבוהה", "High"), effort: t(he, "בינוני", "Medium"), deadline: t(he, "שבוע 2", "Week 2"), kpi: t(he, "עובר Mobile-Friendly Test", "Passes Mobile-Friendly Test"), evidence: t(he, "סריקה: האתר לא מותאם למובייל", "Scan: Site not mobile-optimized") });
  }
  if ((scan?.loadTimeMs || 0) > 3000) {
    phase1Actions.push({ type: "action_item", title: t(he, "שיפור מהירות", "Speed Improvement"), description: t(he, "דחוס תמונות, הפעל CDN, מזער CSS/JS", "Compress images, enable CDN, minify CSS/JS"), priority: "high", impact: t(he, "גבוהה", "High"), effort: t(he, "בינוני", "Medium"), deadline: t(he, "שבוע 2", "Week 2"), kpi: t(he, "זמן טעינה מתחת ל-3 שניות", "Load time under 3 seconds"), evidence: t(he, `סריקה: ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)}s`, `Scan: ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)}s`) });
  }
  if (!scan?.hasSitemap) {
    phase1Actions.push({ type: "action_item", title: t(he, "יצירת Sitemap", "Create Sitemap"), description: t(he, "צור sitemap.xml והגש ל-Google Search Console", "Create sitemap.xml and submit to Google Search Console"), priority: "high", impact: t(he, "בינונית", "Medium"), effort: t(he, "נמוך", "Low"), deadline: t(he, "שבוע 1", "Week 1"), kpi: t(he, "Sitemap נגיש ומוגש ל-GSC", "Sitemap accessible and submitted to GSC") });
  }
  if (!scan?.hasRobotsTxt) {
    phase1Actions.push({ type: "action_item", title: t(he, "יצירת Robots.txt", "Create Robots.txt"), description: t(he, "צור robots.txt עם הנחיות סריקה וקישור ל-Sitemap", "Create robots.txt with crawl directives and Sitemap link"), priority: "high", impact: t(he, "בינונית", "Medium"), effort: t(he, "נמוך", "Low"), deadline: t(he, "שבוע 1", "Week 1"), kpi: t(he, "Robots.txt תקין ונגיש", "Valid and accessible robots.txt") });
  }
  if (!scan?.structuredData) {
    phase1Actions.push({ type: "action_item", title: t(he, "הוספת Schema מובנה", "Add Structured Schema"), description: t(he, "הוסף Organization, LocalBusiness, FAQPage ו-BreadcrumbList Schema", "Add Organization, LocalBusiness, FAQPage, and BreadcrumbList Schema"), priority: "high", impact: t(he, "גבוהה", "High"), effort: t(he, "בינוני", "Medium"), deadline: t(he, "שבוע 3", "Week 3"), kpi: t(he, "Schema תקין ב-Google Rich Results Test", "Valid Schema in Google Rich Results Test"), evidence: t(he, "סריקה: חסרים נתונים מובנים", "Scan: Missing structured data") });
  }

  // Always add basic items
  phase1Actions.push({ type: "action_item", title: t(he, "חיבור Google Search Console", "Connect Google Search Console"), description: t(he, "אמת בעלות על הדומיין וחבר GSC למעקב שוטף", "Verify domain ownership and connect GSC for ongoing tracking"), priority: plan.gscData ? "low" : "high", impact: t(he, "גבוהה", "High"), effort: t(he, "נמוך", "Low"), deadline: t(he, "שבוע 1", "Week 1"), kpi: t(he, "GSC פעיל ומדווח", "GSC active and reporting") });

  actionContent.push(...phase1Actions);

  // Phase 2: Content Gaps (31-60 days)
  actionContent.push(
    { type: "divider" },
    { type: "heading", text: t(he, "שלב 2: פערי תוכן (31-60 יום)", "Phase 2: Content Gaps (31-60 days)"), level: 3 }
  );

  const highPriorityGaps = missedQueries
    .filter((q: any) => {
      const queryObj = visQueries.find((vq: any) => vq.query === q.query || vq.id === q.queryId);
      return queryObj?.importance === "high";
    })
    .slice(0, 5);

  if (highPriorityGaps.length > 0) {
    for (const gap of highPriorityGaps) {
      actionContent.push({ type: "action_item", title: t(he, `מאמר: "${(gap.query || "").substring(0, 40)}"`, `Article: "${(gap.query || "").substring(0, 40)}"`), description: t(he, "כתוב מאמר סמכותי עם FAQ Schema, מקורות, ו-2000+ מילים", "Write authoritative article with FAQ Schema, sources, and 2000+ words"), priority: "high", impact: t(he, "גבוהה", "High"), effort: t(he, "גבוה", "High"), deadline: t(he, "שבוע 5-8", "Week 5-8"), kpi: t(he, "מאמר מפורסם ומאונדקס", "Article published and indexed"), evidence: t(he, `שאילתה חסרה: "${gap.query}"`, `Missing query: "${gap.query}"`) });
    }
  } else if (missedQueries.length > 0) {
    actionContent.push({ type: "action_item", title: t(he, "יצירת 3-5 מאמרים ממוקדים", "Create 3-5 Targeted Articles"), description: t(he, "כתוב מאמרים שעונים על שאילתות AI בהן העסק חסר", "Write articles answering AI queries where the business is missing"), priority: "high", impact: t(he, "גבוהה", "High"), effort: t(he, "גבוה", "High"), deadline: t(he, "שבוע 5-8", "Week 5-8"), kpi: t(he, "מאמרים מפורסמים ומאונדקסים", "Articles published and indexed") });
  }

  actionContent.push({ type: "action_item", title: t(he, "עדכון תוכן קיים", "Update Existing Content"), description: t(he, "הוסף תשובות ישירות, FAQ, ונתונים מובנים לדפים קיימים", "Add direct answers, FAQ, and structured data to existing pages"), priority: "medium", impact: t(he, "בינונית", "Medium"), effort: t(he, "בינוני", "Medium"), deadline: t(he, "שבוע 5-8", "Week 5-8"), kpi: t(he, "דפים מעודכנים עם Schema", "Updated pages with Schema") });

  // Phase 3: Growth (61-90 days)
  actionContent.push(
    { type: "divider" },
    { type: "heading", text: t(he, "שלב 3: צמיחה (61-90 יום)", "Phase 3: Growth (61-90 days)"), level: 3 },
    { type: "action_item", title: t(he, "בניית קישורים", "Link Building"), description: t(he, "בנה 10-20 קישורים מאתרי סמכות בתחום", "Build 10-20 links from authority sites in the field"), priority: "medium", impact: t(he, "גבוהה", "High"), effort: t(he, "גבוה", "High"), deadline: t(he, "שבוע 9-12", "Week 9-12"), kpi: t(he, "עלייה ב-DA", "DA increase") },
    { type: "action_item", title: t(he, "הפצת תוכן", "Content Distribution"), description: t(he, "פרסם תוכן בפלטפורמות חיצוניות: לינקדאין, מדיום, פורומים מקצועיים", "Publish content on external platforms: LinkedIn, Medium, professional forums"), priority: "medium", impact: t(he, "בינונית", "Medium"), effort: t(he, "בינוני", "Medium"), deadline: t(he, "שבוע 9-12", "Week 9-12"), kpi: t(he, "תוכן מפורסם ב-5+ פלטפורמות", "Content published on 5+ platforms") },
    { type: "action_item", title: t(he, "סריקה חוזרת והשוואה", "Re-scan and Compare"), description: t(he, "בצע סריקה חוזרת והשווה ציונים לבסיס המקורי", "Perform re-scan and compare scores to original baseline"), priority: "high", impact: t(he, "גבוהה", "High"), effort: t(he, "נמוך", "Low"), deadline: t(he, "שבוע 12", "Week 12"), kpi: t(he, "שיפור בציון PIXEL SEO/GEO", "Improvement in PIXEL SEO/GEO score") },
  );

  sections.push({
    id: "action_plan", number: 17,
    title: t(he, "תוכנית פעולה", "Action Plan"),
    titleEn: "Action Plan",
    icon: "📋",
    content: actionContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 18: Success Metrics / KPIs
  // ═══════════════════════════════════════════════════════════════════════════

  const kpiContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `מדדי הצלחה מדידים למעקב התקדמות. כל יעד מבוסס על המצב הנוכחי מנתוני הסריקה.`,
      `Measurable success metrics for tracking progress. Each target is based on the current state from scan data.`) },
  ];

  const kpis: PremiumReportBlock[] = [
    { type: "kpi_target", metric: t(he, "שיעור אזכור AI", "AI Mention Rate"), current: `${geoScoreData.subScores.mentionRate.score}%`, target: `${Math.min(100, geoScoreData.subScores.mentionRate.score + 20)}%`, timeframe: t(he, "90 יום", "90 days"), confidence: geoScoreData.confidence },
    { type: "kpi_target", metric: t(he, "שיעור ציטוט אתר", "Site Citation Rate"), current: `${geoScoreData.subScores.citationRate.score}%`, target: `${Math.min(100, geoScoreData.subScores.citationRate.score + 15)}%`, timeframe: t(he, "90 יום", "90 days"), confidence: geoScoreData.confidence },
    { type: "kpi_target", metric: t(he, "ציון PIXEL SEO", "PIXEL SEO Score"), current: `${seoScoreData.overall}`, target: `${Math.min(100, seoScoreData.overall + 15)}`, timeframe: t(he, "90 יום", "90 days"), confidence: seoScoreData.confidence },
    { type: "kpi_target", metric: t(he, "ציון PIXEL GEO", "PIXEL GEO Score"), current: `${geoScoreData.overall}`, target: `${Math.min(100, geoScoreData.overall + 15)}`, timeframe: t(he, "90 יום", "90 days"), confidence: geoScoreData.confidence },
  ];

  if (scan) {
    kpis.push(
      { type: "kpi_target", metric: t(he, "דפים עם Schema", "Pages with Schema"), current: `${scannedPages.filter((p: any) => p.hasSchema).length}/${scannedPages.length}`, target: t(he, "כל הדפים", "All pages"), timeframe: t(he, "60 יום", "60 days"), confidence: "high" },
      { type: "kpi_target", metric: t(he, "קישורים שבורים", "Broken Links"), current: `${scan.brokenLinks || 0}`, target: "0", timeframe: t(he, "30 יום", "30 days"), confidence: "high" }
    );
  }

  if (missedQueries.length > 0) {
    kpis.push(
      { type: "kpi_target", metric: t(he, "שאילתות AI חסרות", "Missing AI Queries"), current: `${missedQueries.length}`, target: `${Math.max(0, missedQueries.length - Math.ceil(missedQueries.length * 0.3))}`, timeframe: t(he, "90 יום", "90 days"), confidence: "medium" }
    );
  }

  kpis.push(
    { type: "kpi_target", metric: t(he, "כיסוי אשכולות נושאיים", "Topic Cluster Coverage"), current: `${geoScoreData.subScores.topicCoverage.score}%`, target: `${Math.min(100, geoScoreData.subScores.topicCoverage.score + 25)}%`, timeframe: t(he, "90 יום", "90 days"), confidence: "medium" }
  );

  kpiContent.push(...kpis);
  kpiContent.push(
    { type: "divider" },
    { type: "alert", message: t(he, "הערה: יעדים אלה הם הערכות המבוססות על נתוני הסריקה. התוצאות בפועל תלויות בביצוע, בתחרותיות ובשינויי אלגוריתמים.", "Note: These targets are estimates based on scan data. Actual results depend on execution, competitiveness, and algorithm changes."), severity: "info" }
  );

  sections.push({
    id: "success_metrics", number: 18,
    title: t(he, "מדדי הצלחה / KPIs", "Success Metrics / KPIs"),
    titleEn: "Success Metrics / KPIs",
    icon: "📐",
    content: kpiContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 19: Methodology
  // ═══════════════════════════════════════════════════════════════════════════

  const scanDate = scan?.scannedAt || plan.createdAt || new Date().toISOString();
  const enginesUsed = enginesChecked.map(id => {
    for (const e of Object.values(ENGINE_MAP)) {
      if (e.ids.includes(id)) return e.name;
    }
    return id;
  });

  const methodologyContent: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `פרטי מתודולוגיה מלאים עבור דוח זה. כל הנתונים מבוססים על סריקה אמיתית של ${domain}.`,
      `Full methodology details for this report. All data is based on a real scan of ${domain}.`) },
    { type: "methodology_field", label: t(he, "תאריך סריקה", "Scan Date"), value: formatDate(scanDate, language) },
    { type: "methodology_field", label: t(he, "מבצע הסריקה", "Scan Performed By"), value: "PIXEL SEO/GEO Engine v2.0" },
    { type: "methodology_field", label: t(he, "מנועים שנבדקו", "Engines Checked"), value: enginesUsed.join(", ") || na(he) },
    { type: "methodology_field", label: t(he, "שפות שנבדקו", "Languages Tested"), value: languagesChecked.map(l => l === "he" ? t(he, "עברית", "Hebrew") : l === "en" ? t(he, "אנגלית", "English") : l).join(", ") || na(he) },
    { type: "methodology_field", label: t(he, "מספר שאילתות", "Total Queries"), value: `${realQueries.length}` },
    { type: "methodology_field", label: t(he, "ריצות לשאילתה", "Runs Per Query"), value: "1" },
    { type: "methodology_field", label: t(he, "סוג סריקה", "Scan Type"), value: scan?.scanType === "deep" ? t(he, "סריקה עמוקה", "Deep Scan") : t(he, "סריקה מהירה", "Quick Scan") },
    { type: "methodology_field", label: t(he, "עמודים שנסרקו", "Pages Scanned"), value: `${scannedPages.length || scan?.totalPages || 0}` },
    { type: "methodology_field", label: t(he, "מערכת ניהול תוכן", "CMS Detected"), value: scan?.cmsDetected || na(he) },
    { type: "methodology_field", label: t(he, "טכנולוגיות", "Tech Stack"), value: (scan?.techStack || []).join(", ") || na(he) },
  ];

  // E-E-A-T check results
  if (scan?.eeat) {
    methodologyContent.push(
      { type: "divider" },
      { type: "heading", text: t(he, "בדיקת E-E-A-T", "E-E-A-T Check"), level: 3 },
      { type: "table",
        headers: [t(he, "בדיקה", "Check"), t(he, "תוצאה", "Result")],
        rows: [
          [t(he, "דף אודות", "About Page"), scan.eeat.hasAboutPage ? "✓" : "✗"],
          [t(he, "ביוגרפיית מחבר", "Author Bio"), scan.eeat.hasAuthorBio ? "✓" : "✗"],
          [t(he, "המלצות/עדויות", "Testimonials"), scan.eeat.hasTestimonials ? "✓" : "✗"],
          [t(he, "פרטי קשר", "Contact Info"), scan.eeat.hasContactInfo ? "✓" : "✗"],
          [t(he, "מדיניות פרטיות", "Privacy Policy"), scan.eeat.hasPrivacyPolicy ? "✓" : "✗"],
          [t(he, "הוכחה חברתית", "Social Proof"), scan.eeat.hasSocialProof ? "✓" : "✗"],
          [t(he, "ציון E-E-A-T", "E-E-A-T Score"), `${scan.eeat.score || 0}/100`],
        ],
      }
    );
  }

  // Definitions
  methodologyContent.push(
    { type: "divider" },
    { type: "heading", text: t(he, "הגדרות מונחים", "Term Definitions"), level: 3 },
    { type: "table",
      headers: [t(he, "מונח", "Term"), t(he, "הגדרה", "Definition")],
      rows: [
        [t(he, "אזכור", "Mention"), t(he, "שם המותג מופיע בתשובת ה-AI — הכרה, לא בהכרח קישור", "Brand name appears in AI answer — recognition, not necessarily a link")],
        [t(he, "ציטוט", "Citation"), t(he, "האתר משמש כמקור עם קישור/הפניה — מייצר תעבורה ישירה", "Website used as source with link/reference — generates direct traffic")],
        [t(he, "הופעה ראשונה", "First Mention"), t(he, "המותג מוזכר ב-200 התווים הראשונים של התשובה", "Brand mentioned in first 200 characters of response")],
        [t(he, "שאילתה ממותגת", "Branded Query"), t(he, "שאילתה המכילה את שם העסק או הדומיין", "Query containing business name or domain")],
        [t(he, "שאילתה לא-ממותגת", "Non-Branded Query"), t(he, "שאילתה על צורך/נושא ללא שם העסק", "Query about a need/topic without business name")],
        ["PIXEL SEO Score", t(he, "ציון מורכב 0-100 המשלב טכני, תוכן, סמכות, אינדקסביליות ומוכנות להמרה", "Composite 0-100 score combining technical, content, authority, indexability, and conversion readiness")],
        ["PIXEL GEO Score", t(he, "ציון מורכב 0-100 המשלב אזכור, ציטוט, כיסוי נושאי ועקביות בין מנועים", "Composite 0-100 score combining mention, citation, topic coverage, and cross-engine consistency")],
        ["E-E-A-T", t(he, "מומחיות, ניסיון, סמכות, אמון — קריטריוני איכות של גוגל", "Expertise, Experience, Authoritativeness, Trustworthiness — Google quality criteria")],
        ["Domain Authority", t(he, "ציון 0-100 המעריך את סמכות הדומיין בחיפוש", "0-100 score evaluating domain's search authority")],
      ],
    }
  );

  // Limitations
  const limitations: string[] = [];
  const unavailableEngines = aiQueries.filter((q: any) => q.scanMode === "unavailable");
  if (unavailableEngines.length > 0) {
    const unavailablePlatforms = [...new Set(unavailableEngines.map((q: any) => q.platform))];
    limitations.push(t(he, `${unavailablePlatforms.length} מנועים לא היו זמינים בזמן הסריקה: ${unavailablePlatforms.join(", ")}`, `${unavailablePlatforms.length} engines were unavailable at scan time: ${unavailablePlatforms.join(", ")}`));
  }
  if (!plan.gscData) {
    limitations.push(t(he, "Google Search Console לא מחובר — חסרים נתוני SEO אורגני", "Google Search Console not connected — missing organic SEO data"));
  }
  if (scannedPages.length < 5) {
    limitations.push(t(he, `רק ${scannedPages.length} עמודים נסרקו — ייתכן שחסרים דפים חשובים`, `Only ${scannedPages.length} pages scanned — important pages may be missing`));
  }
  if (!scan?.domainAuthority) {
    limitations.push(t(he, "נתוני Domain Authority לא זמינים", "Domain Authority data not available"));
  }
  limitations.push(t(he, "תשובות AI משתנות לאורך זמן ואינן קבועות", "AI responses change over time and are not fixed"));
  limitations.push(t(he, "בדיקת דיוק מבוססת על זיהוי טקסט ולא על אימות עובדתי מלא", "Accuracy check is text-based, not full factual verification"));

  methodologyContent.push(
    { type: "divider" },
    { type: "heading", text: t(he, "מגבלות", "Limitations"), level: 3 },
    { type: "list", items: limitations }
  );

  methodologyContent.push(
    { type: "divider" },
    { type: "paragraph", text: t(he,
      `דוח זה הופק אוטומטית על ידי PIXEL SEO/GEO Engine v2.0 בתאריך ${formatDate(new Date(), language)}. לשאלות ובירורים, צרו קשר עם הצוות שלנו.`,
      `This report was automatically generated by PIXEL SEO/GEO Engine v2.0 on ${formatDate(new Date(), language)}. For questions, contact our team.`) },
  );

  sections.push({
    id: "methodology", number: 19,
    title: t(he, "מתודולוגיה", "Methodology"),
    titleEn: "Methodology",
    icon: "🔬",
    content: methodologyContent,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 20: Appendices — Per-Query Per-Engine Results Matrix
  // ═══════════════════════════════════════════════════════════════════════════

  const appendixBlocks: PremiumReportBlock[] = [
    { type: "paragraph", text: t(he,
      `נספח מלא — תוצאות כל שאילתה בכל מנוע. ◆ = ציטוט (האתר מצוטט כמקור), ✓ = אזכור (שם המותג מוזכר), ✗ = לא נמצא. זהו הבסיס הראייתי לכל הממצאים בדוח.`,
      `Full appendix — results of every query in every engine. ◆ = citation (site cited as source), ✓ = mention (brand name mentioned), ✗ = not found. This is the evidence base for all findings in the report.`) },
    { type: "divider" },
  ];

  // Group queries by category for organized display
  const categorizedQueries = groupByCategory(realQueries.map((q: any) => ({
    ...q,
    detectedLang: detectLanguage(q.query || ""),
    isBranded: isBrandedQuery(q.query || "", clientName, domain),
  })), "category");

  for (const [cat, catQueries] of Object.entries(categorizedQueries)) {
    const catName = cat === "general" ? t(he, "כללי", "General") :
                    cat === "informational" ? t(he, "אינפורמטיבי", "Informational") :
                    cat === "commercial" ? t(he, "מסחרי", "Commercial") :
                    cat === "comparison" ? t(he, "השוואה", "Comparison") :
                    cat === "local" ? t(he, "מקומי", "Local") :
                    cat === "transactional" ? t(he, "עסקאות", "Transactional") : cat;

    appendixBlocks.push(
      { type: "heading", text: `${catName} (${catQueries.length} ${t(he, "שאילתות", "queries")})`, level: 3 }
    );

    for (const q of catQueries) {
      // Build per-engine results for this query
      const engineResults: Array<{ engine: string; mentioned: boolean; cited: boolean; position?: number; snippet?: string; sources?: string[] }> = [];

      for (const [, eDef] of Object.entries(ENGINE_MAP)) {
        // Check if this query was tested on this engine
        if (!eDef.ids.includes(q.platform)) continue;

        const isCited = (q.sources || []).some((s: any) => {
          const sd = extractDomain(s.domain || s.url || "");
          return sd === domain || sd.includes(domain);
        });

        const citedSources = (q.sources || [])
          .filter((s: any) => {
            const sd = extractDomain(s.domain || s.url || "");
            return sd === domain || sd.includes(domain);
          })
          .map((s: any) => s.url || s.domain || "");

        engineResults.push({
          engine: eDef.nameHe || eDef.name,
          mentioned: !!q.found,
          cited: isCited,
          position: q.mentionPosition || undefined,
          snippet: q.aiAnswer ? (q.aiAnswer as string).slice(0, 120) + (q.aiAnswer.length > 120 ? "..." : "") : undefined,
          sources: citedSources.length > 0 ? citedSources : undefined,
        });
      }

      // If no engine matched this query's platform, add it with a single result
      if (engineResults.length === 0) {
        // Find the display name for this platform
        let engineName = q.platform || "Unknown";
        for (const eDef of Object.values(ENGINE_MAP)) {
          if (eDef.ids.includes(q.platform)) {
            engineName = eDef.nameHe || eDef.name;
            break;
          }
        }
        const isCited = (q.sources || []).some((s: any) => {
          const sd = extractDomain(s.domain || s.url || "");
          return sd === domain || sd.includes(domain);
        });
        engineResults.push({
          engine: engineName,
          mentioned: !!q.found,
          cited: isCited,
        });
      }

      appendixBlocks.push({
        type: "query_result",
        query: q.query || "",
        language: q.detectedLang === "he" ? t(he, "עברית", "Hebrew") : q.detectedLang === "en" ? t(he, "אנגלית", "English") : q.detectedLang || "",
        category: catName,
        branded: !!q.isBranded,
        engines: engineResults,
      });
    }
  }

  // Add summary stats at the bottom of appendix
  const totalMentioned = realQueries.filter((q: any) => q.found).length;
  const totalCited = realQueries.filter((q: any) => (q.sources || []).some((s: any) => {
    const sd = extractDomain(s.domain || s.url || "");
    return sd === domain || sd.includes(domain);
  })).length;

  appendixBlocks.push(
    { type: "divider" },
    { type: "heading", text: t(he, "סיכום נספח", "Appendix Summary"), level: 3 },
    { type: "stat_row", stats: [
      { label: t(he, "סה״כ שאילתות", "Total Queries"), value: `${realQueries.length}`, color: "#00B5FE" },
      { label: t(he, "אזכורים", "Mentions"), value: `${totalMentioned} (${pct(totalMentioned, realQueries.length)}%)`, color: scoreColor(pct(totalMentioned, realQueries.length)) },
      { label: t(he, "ציטוטים", "Citations"), value: `${totalCited} (${pct(totalCited, realQueries.length)}%)`, color: scoreColor(pct(totalCited, realQueries.length)) },
    ]},
  );

  sections.push({
    id: "appendices", number: 20,
    title: t(he, "נספחים — מטריצת תוצאות מלאה", "Appendices — Full Results Matrix"),
    titleEn: "Appendices — Full Results Matrix",
    icon: "📎",
    content: appendixBlocks,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Assemble Final Report
  // ═══════════════════════════════════════════════════════════════════════════

  const now = new Date();
  const periodFrom = scan?.scannedAt || plan.createdAt || now.toISOString();
  const periodTo = now.toISOString();

  const seoSubScoresRecord: Record<string, { score: number; weight: number; label: string }> = {};
  for (const [key, val] of Object.entries(seoScoreData.subScores)) {
    seoSubScoresRecord[key] = val;
  }
  const geoSubScoresRecord: Record<string, { score: number; weight: number; label: string }> = {};
  for (const [key, val] of Object.entries(geoScoreData.subScores)) {
    geoSubScoresRecord[key] = val;
  }

  return {
    id: `premium_report_${Date.now().toString(36)}`,
    planId: plan.id || "",
    clientName,
    clientLogo: businessProfile?.logo || undefined,
    websiteUrl: plan.websiteUrl || "",
    generatedAt: now.toISOString(),
    language,
    version: "2.0",
    confidential: true,
    period: { from: periodFrom, to: periodTo },
    enginesChecked: engineDisplayNames,
    languagesChecked: languagesChecked.map(l => l === "he" ? "Hebrew" : l === "en" ? "English" : l),
    countriesChecked: [t(he, "ישראל", "Israel")],
    totalQueries: realQueries.length,
    sections,
    scores: {
      pixelSeoScore: seoScoreData.overall,
      pixelGeoScore: geoScoreData.overall,
      previousSeoScore: prevSeoScore,
      previousGeoScore: prevGeoScore,
      seoSubScores: seoSubScoresRecord,
      geoSubScores: geoSubScoresRecord,
    },
    methodology: {
      scanDate: formatDate(scanDate, language),
      enginesUsed: engineDisplayNames,
      languagesTested: languagesChecked,
      countriesTested: ["IL"],
      totalQueries: realQueries.length,
      runsPerQuery: 1,
      tools: ["PIXEL SEO/GEO Engine v2.0", "HTTP Crawler", "PageSpeed API"],
      userAgentsTested: ["Googlebot", "Chrome Desktop", "Chrome Mobile"],
      limitations,
      definitions: [
        { term: t(he, "אזכור", "Mention"), definition: t(he, "שם המותג מופיע בתשובת ה-AI", "Brand name appears in AI answer") },
        { term: t(he, "ציטוט", "Citation"), definition: t(he, "האתר משמש כמקור עם קישור", "Website used as source with link") },
        { term: t(he, "הופעה ראשונה", "First Mention"), definition: t(he, "המותג מוזכר ב-200 התווים הראשונים", "Brand mentioned in first 200 chars") },
        { term: "PIXEL SEO Score", definition: t(he, "ציון SEO מורכב 0-100", "Composite SEO score 0-100") },
        { term: "PIXEL GEO Score", definition: t(he, "ציון GEO מורכב 0-100", "Composite GEO score 0-100") },
      ],
    },
    meta: {
      overallScore: seoScoreData.overall,
      technicalScore: seoScoreData.subScores.technical.score,
      contentScore: seoScoreData.subScores.contentCoverage.score,
      visibilityScore: geoScoreData.subScores.mentionRate.score,
      geoScore: geoScoreData.overall,
      totalFindings: techFindings.length,
      criticalFindings: techFindings.filter(f => f.severity === "critical").length,
      totalRecommendations: sections.reduce((sum, s) => sum + s.content.filter(b => b.type === "action_item").length, 0),
      mentionRate: geoScoreData.subScores.mentionRate.score,
      citationRate: geoScoreData.subScores.citationRate.score,
      firstMentionRate: geoScoreData.subScores.firstMentionRate.score,
    },
  };
}

// ── Technical Findings Builder ────────────────────────────────────────────────

function buildTechnicalFindings(
  scan: any,
  scannedPages: any[],
  he: boolean
): Array<{ severity: "critical" | "warning" | "info" | "success"; title: string; detail: string; rec: string; evidence?: string }> {
  const findings: Array<{ severity: "critical" | "warning" | "info" | "success"; title: string; detail: string; rec: string; evidence?: string }> = [];

  if (!scan) return findings;

  // SSL
  if (!scan.hasSSL) {
    findings.push({
      severity: "critical",
      title: t(he, "חסר תעודת SSL", "Missing SSL Certificate"),
      detail: t(he, "האתר לא מאובטח ב-HTTPS. גוגל מסמן אתרים ללא SSL כ'לא מאובטח' ומוריד אותם בדירוג.", "Site is not secured with HTTPS. Google marks non-SSL sites as 'Not Secure' and demotes them."),
      rec: t(he, "התקן תעודת SSL (Let's Encrypt חינמי) והפנה את כל התעבורה ל-HTTPS.", "Install an SSL certificate (Let's Encrypt is free) and redirect all HTTP traffic to HTTPS."),
      evidence: "HTTP response, no HTTPS redirect detected",
    });
  } else {
    findings.push({
      severity: "success",
      title: t(he, "תעודת SSL תקינה", "Valid SSL Certificate"),
      detail: t(he, "האתר מאובטח ב-HTTPS — מעולה.", "Site is secured with HTTPS — excellent."),
      rec: t(he, "ודא חידוש אוטומטי של התעודה.", "Ensure automatic certificate renewal."),
    });
  }

  // Speed
  if ((scan.loadTimeMs || 0) > 3000) {
    findings.push({
      severity: "critical",
      title: t(he, `זמן טעינה איטי: ${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s`, `Slow Load Time: ${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s`),
      detail: t(he, `זמן הטעינה הנוכחי הוא ${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s. גוגל ממליץ על פחות מ-3 שניות. כל שנייה נוספת מעלה את שיעור הנטישה ב-32%.`, `Current load time is ${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s. Google recommends under 3s. Each extra second increases bounce rate by 32%.`),
      rec: t(he, "דחוס תמונות ל-WebP, הפעל טעינה עצלה, השתמש ב-CDN, מזער CSS/JS.", "Compress images to WebP, enable lazy loading, use CDN, minify CSS/JS."),
      evidence: `Load time: ${scan.loadTimeMs}ms`,
    });
  } else if ((scan.loadTimeMs || 0) > 1500) {
    findings.push({
      severity: "warning",
      title: t(he, `זמן טעינה בינוני: ${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s`, `Moderate Load Time: ${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s`),
      detail: t(he, `זמן הטעינה הוא ${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s — סביר אך ניתן לשיפור.`, `Load time is ${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s — acceptable but can improve.`),
      rec: t(he, "שקול דחיסת תמונות וטעינה עצלה לשיפור נוסף.", "Consider image compression and lazy loading for further improvement."),
      evidence: `Load time: ${scan.loadTimeMs}ms`,
    });
  } else {
    findings.push({
      severity: "success",
      title: t(he, `זמן טעינה מצוין: ${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s`, `Excellent Load Time: ${((scan.loadTimeMs || 0) / 1000).toFixed(1)}s`),
      detail: t(he, "זמן הטעינה מתחת ל-1.5 שניות — מצוין.", "Load time is under 1.5s — excellent."),
      rec: t(he, "שמור על הביצועים הנוכחיים.", "Maintain current performance."),
    });
  }

  // Mobile
  if (!scan.mobileOptimized) {
    findings.push({
      severity: "critical",
      title: t(he, "האתר לא מותאם למובייל", "Site Not Mobile-Optimized"),
      detail: t(he, "מעל 60% מהחיפושים מגיעים ממובייל. גוגל משתמש באינדוקס Mobile-First.", "Over 60% of searches come from mobile. Google uses Mobile-First Indexing."),
      rec: t(he, "יישם עיצוב רספונסיבי ובדוק עם Google Mobile-Friendly Test.", "Implement responsive design and test with Google's Mobile-Friendly Test."),
      evidence: "No mobile viewport meta tag detected",
    });
  } else {
    findings.push({
      severity: "success",
      title: t(he, "מותאם מובייל", "Mobile Optimized"),
      detail: t(he, "האתר מותאם למובייל — מעולה.", "Site is mobile-optimized — excellent."),
      rec: t(he, "בדוק Core Web Vitals גם במובייל.", "Check Core Web Vitals on mobile too."),
    });
  }

  // Sitemap
  if (!scan.hasSitemap) {
    findings.push({
      severity: "warning",
      title: t(he, "חסר Sitemap.xml", "Missing Sitemap.xml"),
      detail: t(he, "לא נמצא sitemap.xml. בלעדיו, מנועי חיפוש עלולים לפספס דפים חשובים.", "No sitemap.xml found. Without it, search engines may miss important pages."),
      rec: t(he, "צור sitemap.xml עם כל הדפים החשובים והגש אותו ב-Google Search Console.", "Create a sitemap.xml with all important pages and submit it in Google Search Console."),
      evidence: "HTTP 404 on /sitemap.xml",
    });
  }

  // Robots.txt
  if (!scan.hasRobotsTxt) {
    findings.push({
      severity: "warning",
      title: t(he, "חסר Robots.txt", "Missing Robots.txt"),
      detail: t(he, "לא נמצא robots.txt. משמעות הדבר היא שאין שליטה על אילו דפים נסרקים.", "No robots.txt found. This means no control over which pages are crawled."),
      rec: t(he, "צור robots.txt עם הנחיות סריקה מתאימות וקישור ל-Sitemap.", "Create robots.txt with appropriate crawl directives and Sitemap link."),
      evidence: "HTTP 404 on /robots.txt",
    });
  }

  // Structured Data
  if (!scan.structuredData) {
    findings.push({
      severity: "warning",
      title: t(he, "חסר Schema / נתונים מובנים", "Missing Schema / Structured Data"),
      detail: t(he, "האתר חסר נתונים מובנים (Schema.org). בלעדיהם, תוצאות עשירות ומנועי AI לא יזהו את המידע כראוי.", "Site lacks structured data (Schema.org). Without it, rich results and AI engines won't properly identify information."),
      rec: t(he, "הוסף Organization, LocalBusiness, FAQ ו-Breadcrumb Schema כצעדים ראשונים.", "Add Organization, LocalBusiness, FAQ, and Breadcrumb Schema as first steps."),
      evidence: "No JSON-LD or microdata detected",
    });
  } else {
    findings.push({
      severity: "success",
      title: t(he, "נתונים מובנים קיימים", "Structured Data Present"),
      detail: t(he, `זוהו נתונים מובנים: ${(scan.schemaTypes || []).join(", ") || "Schema.org"}.`, `Structured data detected: ${(scan.schemaTypes || []).join(", ") || "Schema.org"}.`),
      rec: t(he, "ודא שהסכמות שלמות ותקינות ב-Google Rich Results Test.", "Verify schemas are complete and valid in Google Rich Results Test."),
    });
  }

  // Open Graph
  if (!scan.openGraph) {
    findings.push({
      severity: "info",
      title: t(he, "חסרים תגי Open Graph", "Missing Open Graph Tags"),
      detail: t(he, "ללא תגי OG, שיתופים ברשתות חברתיות יציגו תצוגה מקדימה גנרית.", "Without OG tags, social shares will show generic previews."),
      rec: t(he, "הוסף og:title, og:description, og:image לכל הדפים.", "Add og:title, og:description, og:image to all pages."),
    });
  }

  // Canonical
  if (!scan.canonicalTags) {
    findings.push({
      severity: "warning",
      title: t(he, "חסרים תגי Canonical", "Missing Canonical Tags"),
      detail: t(he, "ללא תגי canonical, מנועי חיפוש עלולים לאנדקס גרסאות כפולות.", "Without canonical tags, search engines may index duplicate versions."),
      rec: t(he, "הוסף תג canonical לכל דף שמפנה לגרסה המקורית.", "Add a canonical tag to each page pointing to the original version."),
    });
  }

  // Broken Links
  if ((scan.brokenLinks || 0) > 0) {
    findings.push({
      severity: (scan.brokenLinks || 0) > 5 ? "critical" : "warning",
      title: t(he, `${scan.brokenLinks} קישורים שבורים`, `${scan.brokenLinks} Broken Links`),
      detail: t(he, `נמצאו ${scan.brokenLinks} קישורים שבורים. קישורים שבורים פוגעים בחוויית המשתמש ובדירוג.`, `Found ${scan.brokenLinks} broken links. Broken links harm UX and rankings.`),
      rec: t(he, "תקן או הסר קישורים שבורים. השתמש בהפניות 301 לדפים שעברו.", "Fix or remove broken links. Use 301 redirects for moved pages."),
      evidence: `${scan.brokenLinks} broken links detected during crawl`,
    });
  }

  // Domain Authority
  if ((scan.domainAuthority || 0) > 30) {
    findings.push({
      severity: "success",
      title: t(he, `Domain Authority ${scan.domainAuthority} — בסיס חזק`, `Domain Authority ${scan.domainAuthority} — Strong Base`),
      detail: t(he, `DA של ${scan.domainAuthority} מצביע על סמכות טובה.`, `DA of ${scan.domainAuthority} indicates good authority.`),
      rec: t(he, "המשך לבנות קישורים איכותיים מאתרים רלוונטיים.", "Continue building quality links from relevant sites."),
    });
  } else if ((scan.domainAuthority || 0) > 0) {
    findings.push({
      severity: "warning",
      title: t(he, `Domain Authority ${scan.domainAuthority} — נמוך`, `Domain Authority ${scan.domainAuthority} — Low`),
      detail: t(he, `DA של ${scan.domainAuthority} דורש עבודת בניית סמכות.`, `DA of ${scan.domainAuthority} requires authority-building work.`),
      rec: t(he, "בנה קישורים מאתרי מדיה, בלוגים מקצועיים ומדריכים.", "Build links from media sites, professional blogs, and directories."),
    });
  }

  // Meta tags
  if (!scan.metaTitle) {
    findings.push({
      severity: "warning",
      title: t(he, "חסר Meta Title", "Missing Meta Title"),
      detail: t(he, "דף הבית חסר כותרת Meta. זוהי הכותרת שמופיעה בתוצאות החיפוש.", "Homepage is missing a Meta Title. This is the title that appears in search results."),
      rec: t(he, "כתוב Meta Title ייחודי (50-60 תווים) עם מילות מפתח ושם העסק.", "Write a unique Meta Title (50-60 chars) with keywords and business name."),
    });
  }

  if (!scan.metaDescription) {
    findings.push({
      severity: "warning",
      title: t(he, "חסר Meta Description", "Missing Meta Description"),
      detail: t(he, "דף הבית חסר תיאור Meta. גוגל ישתמש בטקסט מהדף במקום.", "Homepage is missing a Meta Description. Google will use text from the page instead."),
      rec: t(he, "כתוב Meta Description ייחודי (150-160 תווים) עם קריאה לפעולה.", "Write a unique Meta Description (150-160 chars) with a call to action."),
    });
  }

  // Scanned pages issues
  const pagesWithoutMeta = scannedPages.filter((p: any) => p.missingMeta);
  const pagesWithoutH1 = scannedPages.filter((p: any) => p.missingH1);
  const thinPages = scannedPages.filter((p: any) => (p.wordCount || 0) < 200);

  if (pagesWithoutMeta.length > 0) {
    findings.push({
      severity: pagesWithoutMeta.length > 3 ? "warning" : "info",
      title: t(he, `${pagesWithoutMeta.length} דפים ללא Meta`, `${pagesWithoutMeta.length} Pages Without Meta`),
      detail: t(he, `נמצאו ${pagesWithoutMeta.length} דפים ללא תגי Meta מלאים.`, `Found ${pagesWithoutMeta.length} pages without complete Meta tags.`),
      rec: t(he, "הוסף Meta Title ו-Meta Description לכל דף.", "Add Meta Title and Meta Description to every page."),
      evidence: pagesWithoutMeta.slice(0, 3).map((p: any) => p.url).join(", "),
    });
  }

  if (pagesWithoutH1.length > 0) {
    findings.push({
      severity: pagesWithoutH1.length > 3 ? "warning" : "info",
      title: t(he, `${pagesWithoutH1.length} דפים ללא H1`, `${pagesWithoutH1.length} Pages Without H1`),
      detail: t(he, `נמצאו ${pagesWithoutH1.length} דפים ללא כותרת H1.`, `Found ${pagesWithoutH1.length} pages without an H1 heading.`),
      rec: t(he, "הוסף כותרת H1 ייחודית לכל דף.", "Add a unique H1 heading to every page."),
      evidence: pagesWithoutH1.slice(0, 3).map((p: any) => p.url).join(", "),
    });
  }

  if (thinPages.length > 0 && scannedPages.length > 0) {
    findings.push({
      severity: thinPages.length > scannedPages.length / 2 ? "warning" : "info",
      title: t(he, `${thinPages.length} דפים עם תוכן דק`, `${thinPages.length} Thin Content Pages`),
      detail: t(he, `נמצאו ${thinPages.length} דפים עם פחות מ-200 מילים. תוכן דק מפחית סיכויי דירוג ואזכור ב-AI.`, `Found ${thinPages.length} pages with fewer than 200 words. Thin content reduces ranking and AI mention chances.`),
      rec: t(he, "הרחב תוכן בדפים אלו לפחות 500 מילים עם תשובות ישירות.", "Expand content on these pages to at least 500 words with direct answers."),
      evidence: thinPages.slice(0, 3).map((p: any) => `${p.url} (${p.wordCount} words)`).join(", "),
    });
  }

  // User-Agent crawl behavior
  // Check if site serves different content to bot user agents
  if (scan.userAgentTest) {
    const uat = scan.userAgentTest;
    if (uat.blockedBots?.length > 0) {
      findings.push({
        severity: "critical",
        title: t(he, `חסימת User-Agent: ${uat.blockedBots.join(", ")}`, `User-Agent Blocking: ${uat.blockedBots.join(", ")}`),
        detail: t(he,
          `האתר חוסם את סוכני המשתמש הבאים: ${uat.blockedBots.join(", ")}. חסימת בוטים של מנועי AI מונעת אינדקוס ואזכור בתשובות.`,
          `Site blocks the following user agents: ${uat.blockedBots.join(", ")}. Blocking AI engine bots prevents indexing and mentions in responses.`),
        rec: t(he, "עדכן robots.txt ו-WAF להתיר גישה ל-GPTBot, Google-Extended, Anthropic ו-PerplexityBot.", "Update robots.txt and WAF to allow access for GPTBot, Google-Extended, Anthropic, and PerplexityBot."),
        evidence: `Blocked user agents: ${uat.blockedBots.join(", ")}`,
      });
    }
    if (uat.emptyBodyBots?.length > 0) {
      findings.push({
        severity: "critical",
        title: t(he, `תוכן ריק ל-User-Agent: ${uat.emptyBodyBots.join(", ")}`, `Empty Body for User-Agent: ${uat.emptyBodyBots.join(", ")}`),
        detail: t(he,
          `האתר מחזיר HTTP 200 עם גוף ריק לסוכנים: ${uat.emptyBodyBots.join(", ")}. המשמעות: הדפים נראים "נגישים" אך למעשה ללא תוכן — מנועי AI רואים דף ריק.`,
          `Site returns HTTP 200 with empty body for agents: ${uat.emptyBodyBots.join(", ")}. This means pages appear "accessible" but actually have no content — AI engines see a blank page.`),
        rec: t(he, "בדוק WAF/CDN שלא מבצע cloaking. ודא שכל סוכני משתמש מקבלים את אותו תוכן HTML.", "Check WAF/CDN for cloaking. Ensure all user agents receive the same HTML content."),
        evidence: `User agents receiving empty body: ${uat.emptyBodyBots.join(", ")}`,
      });
    }
    if (!uat.blockedBots?.length && !uat.emptyBodyBots?.length) {
      findings.push({
        severity: "success",
        title: t(he, "התנהגות User-Agent תקינה", "User-Agent Behavior OK"),
        detail: t(he, "האתר מחזיר תוכן זהה לכל סוכני המשתמש — בוטים ודפדפנים מקבלים אותו HTML.", "Site returns identical content for all user agents — bots and browsers receive the same HTML."),
        rec: t(he, "המשך לעקוב אחר שינויי WAF/CDN שעלולים לחסום בוטים.", "Continue monitoring WAF/CDN changes that may block bots."),
      });
    }
  } else {
    // No user-agent test data — report as info finding
    findings.push({
      severity: "info",
      title: t(he, "בדיקת User-Agent לא בוצעה", "User-Agent Test Not Performed"),
      detail: t(he,
        "לא בוצעה בדיקת התנהגות per-User-Agent. מומלץ לבדוק שהאתר לא חוסם GPTBot, Google-Extended, Anthropic-AI או PerplexityBot.",
        "No per-User-Agent behavior test was performed. Recommended to verify site doesn't block GPTBot, Google-Extended, Anthropic-AI, or PerplexityBot."),
      rec: t(he, "הרץ בדיקת User-Agent עם curl -H 'User-Agent: GPTBot' לכל דף חשוב.", "Run User-Agent test with curl -H 'User-Agent: GPTBot' on each important page."),
    });
  }

  // Issues from scan
  if (scan.issues?.length > 0) {
    for (const issue of scan.issues.slice(0, 10)) {
      // Avoid duplicates
      if (findings.some(f => f.title.includes(issue.title))) continue;
      findings.push({
        severity: issue.type === "critical" ? "critical" : issue.type === "warning" ? "warning" : "info",
        title: issue.title,
        detail: issue.description,
        rec: t(he, "בדוק ותקן בהקדם.", "Check and fix soon."),
        evidence: issue.category,
      });
    }
  }

  return findings;
}
