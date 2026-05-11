/**
 * PIXEL SEO/GEO — Semantic Intelligence Engine
 *
 * Analyzes crawled website data to build:
 * - Topical authority map (what topics the site covers, depth, gaps)
 * - Semantic clusters (groups of related pages/content)
 * - Entity extraction (business entities, services, locations, people)
 * - Pillar/cluster page detection
 * - Internal linking graph with authority flow analysis
 * - Content intent classification
 *
 * All analysis is based on REAL crawl data — never invented.
 */

import type { ParsedPageData } from './crawler';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SemanticAnalysis {
  topicalMap: TopicalCluster[];
  entities: ExtractedEntity[];
  pillarPages: PillarPageCandidate[];
  orphanPages: string[];
  linkGraph: LinkGraphAnalysis;
  contentIntents: ContentIntentMap;
  semanticScore: number; // 0-100 overall semantic health
  analysisConfidence: number;
  analyzedAt: string;
}

export interface TopicalCluster {
  id: string;
  topic: string;
  keywords: string[];
  pages: ClusterPage[];
  depth: number;         // how many pages cover this topic
  coverage: number;      // 0-100 how well the topic is covered
  authority: number;     // 0-100 estimated topical authority
  intent: 'informational' | 'commercial' | 'transactional' | 'local' | 'navigational';
  hasPillar: boolean;
  pillarUrl: string | null;
  gaps: string[];        // missing subtopics
  aiOpportunity: number; // 0-100 how likely AI engines will pick this up
}

export interface ClusterPage {
  url: string;
  title: string;
  role: 'pillar' | 'supporting' | 'tangential';
  wordCount: number;
  internalLinksIn: number;
  internalLinksOut: number;
  relevanceScore: number; // 0-100 how relevant to cluster topic
}

export interface ExtractedEntity {
  name: string;
  type: 'business' | 'service' | 'product' | 'location' | 'person' | 'brand' | 'concept';
  mentions: number;
  pages: string[];
  prominence: number;  // 0-100
  isCore: boolean;     // is this a core business entity
}

export interface PillarPageCandidate {
  url: string;
  title: string;
  topic: string;
  score: number;        // 0-100 pillar page fitness
  wordCount: number;
  internalLinksIn: number;
  internalLinksOut: number;
  hasSchema: boolean;
  hasFAQ: boolean;
  reasons: string[];    // why this is/should be a pillar page
  recommendations: string[];
}

export interface LinkGraphAnalysis {
  totalInternalLinks: number;
  averageLinksPerPage: number;
  maxLinksIn: { url: string; count: number };
  maxLinksOut: { url: string; count: number };
  orphanPages: string[];          // pages with 0 internal links pointing to them
  deadEndPages: string[];         // pages with 0 outgoing internal links
  hubPages: string[];             // pages with high in+out links
  authorityDistribution: 'healthy' | 'top_heavy' | 'flat' | 'fragmented';
  clusterConnectivity: number;    // 0-100 how well clusters are interlinked
  recommendations: LinkRecommendation[];
}

export interface LinkRecommendation {
  type: 'add_link' | 'strengthen_pillar' | 'connect_clusters' | 'fix_orphan' | 'fix_dead_end';
  fromUrl: string;
  toUrl: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  anchorSuggestion: string;
}

export interface ContentIntentMap {
  informational: string[];
  commercial: string[];
  transactional: string[];
  local: string[];
  navigational: string[];
  unclassified: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '').toLowerCase();
}

function extractWords(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\sא-ת]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, magA = 0, magB = 0;
  for (const [key, val] of Array.from(a)) {
    magA += val * val;
    if (b.has(key)) dot += val * b.get(key)!;
  }
  for (const val of Array.from(b.values())) magB += val * val;
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function buildTfVector(words: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const total = words.length || 1;
  const tf = new Map<string, number>();
  for (const [w, c] of Array.from(freq)) tf.set(w, c / total);
  return tf;
}

// Stop words for Hebrew + English
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'and', 'but', 'or', 'nor',
  'not', 'so', 'yet', 'for', 'with', 'from', 'into', 'this', 'that',
  'these', 'those', 'its', 'our', 'your', 'their', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'than', 'too', 'very', 'just', 'about', 'above', 'after', 'before',
  'של', 'את', 'על', 'עם', 'לא', 'גם', 'או', 'כי', 'אם', 'אבל',
  'הם', 'היא', 'הוא', 'אנחנו', 'זה', 'זו', 'אלה', 'כל', 'עוד',
  'יותר', 'רק', 'בין', 'לפי', 'אחרי', 'לפני', 'תחת', 'מעל',
]);

function getSignificantWords(words: string[]): string[] {
  return words.filter(w => !STOP_WORDS.has(w) && w.length > 2);
}

// ── Intent Classification ──────────────────────────────────────────────────

const INTENT_SIGNALS = {
  transactional: ['buy', 'order', 'price', 'cost', 'shop', 'purchase', 'deal', 'discount', 'coupon', 'קנה', 'מחיר', 'עלות', 'הזמנה', 'רכישה', 'מבצע', 'הנחה'],
  commercial: ['best', 'top', 'review', 'compare', 'vs', 'alternative', 'הכי', 'טוב', 'מומלץ', 'השוואה', 'ביקורת', 'חוות דעת'],
  local: ['near', 'nearby', 'location', 'address', 'hours', 'directions', 'בקרבת', 'כתובת', 'שעות', 'איך להגיע', 'סניף', 'סניפים'],
  informational: ['how', 'what', 'why', 'guide', 'tutorial', 'learn', 'tips', 'איך', 'מה', 'למה', 'מדריך', 'טיפים', 'הסבר'],
  navigational: ['login', 'sign', 'account', 'dashboard', 'כניסה', 'התחברות', 'חשבון'],
};

function classifyPageIntent(page: ParsedPageData): string {
  const text = [
    page.title || '',
    page.metaDescription || '',
    ...(page.h1Tags || []),
    ...(page.h2Tags || []),
  ].join(' ').toLowerCase();

  const scores: Record<string, number> = {
    transactional: 0,
    commercial: 0,
    local: 0,
    informational: 0,
    navigational: 0,
  };

  for (const [intent, signals] of Object.entries(INTENT_SIGNALS)) {
    for (const signal of signals) {
      if (text.includes(signal)) scores[intent] += 1;
    }
  }

  // URL-based signals
  const url = (page.url || '').toLowerCase();
  if (url.includes('/blog/') || url.includes('/guide/') || url.includes('/article/')) scores.informational += 2;
  if (url.includes('/product/') || url.includes('/shop/') || url.includes('/store/')) scores.transactional += 2;
  if (url.includes('/service') || url.includes('/pricing')) scores.commercial += 2;
  if (url.includes('/contact') || url.includes('/location') || url.includes('/branch')) scores.local += 1;

  const max = Math.max(...Object.values(scores));
  if (max === 0) return 'informational'; // default
  return Object.entries(scores).find(([, v]) => v === max)?.[0] || 'informational';
}

// ── Entity Extraction ──────────────────────────────────────────────────────

function extractEntities(pages: ParsedPageData[], businessName: string, products: string[]): ExtractedEntity[] {
  const entityMap = new Map<string, { type: ExtractedEntity['type']; pages: Set<string>; mentions: number }>();

  // Always add business name as core entity
  if (businessName) {
    entityMap.set(businessName.toLowerCase(), {
      type: 'business',
      pages: new Set(),
      mentions: 0,
    });
  }

  // Add known products/services
  for (const prod of products) {
    if (prod && prod.length > 2) {
      entityMap.set(prod.toLowerCase(), {
        type: 'service',
        pages: new Set(),
        mentions: 0,
      });
    }
  }

  // Scan all pages for entity mentions
  for (const page of pages) {
    const allText = [
      page.title || '',
      page.metaDescription || '',
      ...(page.h1Tags || []),
      ...(page.h2Tags || []),
      ...(page.paragraphs || []).slice(0, 5),
    ].join(' ').toLowerCase();

    for (const [entity, data] of Array.from(entityMap)) {
      if (allText.includes(entity)) {
        data.pages.add(page.url);
        // Count approximate mentions
        const regex = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = allText.match(regex);
        data.mentions += matches?.length || 0;
      }
    }

    // Extract location entities from schema
    if (page.schemaMarkup && Array.isArray(page.schemaMarkup)) {
      for (const schema of page.schemaMarkup) {
        if (typeof schema === 'string') {
          if (schema.includes('LocalBusiness') || schema.includes('Place')) {
            // Page has location schema — try to extract from content
            const locationPatterns = allText.match(/(?:ב|in\s+)([א-ת\w\s]{3,20})/g);
            if (locationPatterns) {
              for (const loc of locationPatterns.slice(0, 3)) {
                const clean = loc.replace(/^(?:ב|in\s+)/, '').trim();
                if (clean.length > 2 && !entityMap.has(clean.toLowerCase())) {
                  entityMap.set(clean.toLowerCase(), {
                    type: 'location',
                    pages: new Set([page.url]),
                    mentions: 1,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Extract H2-based service/product entities
    for (const h2 of (page.h2Tags || [])) {
      const clean = h2.trim();
      if (clean.length > 3 && clean.length < 50 && clean.split(/\s+/).length <= 4) {
        const key = clean.toLowerCase();
        if (!entityMap.has(key) && !STOP_WORDS.has(key)) {
          entityMap.set(key, {
            type: 'concept',
            pages: new Set([page.url]),
            mentions: 1,
          });
        }
      }
    }
  }

  // Build entities array with prominence
  const maxMentions = Math.max(1, ...Array.from(entityMap.values()).map(e => e.mentions));
  const entities: ExtractedEntity[] = [];

  for (const [name, data] of Array.from(entityMap)) {
    const prominence = Math.round((data.mentions / maxMentions) * 70 + (data.pages.size / Math.max(1, pages.length)) * 30);
    entities.push({
      name,
      type: data.type,
      mentions: data.mentions,
      pages: Array.from(data.pages),
      prominence: Math.min(100, prominence),
      isCore: data.type === 'business' || (data.type === 'service' && products.some(p => p.toLowerCase() === name)),
    });
  }

  return entities
    .filter(e => e.mentions > 0 || e.isCore)
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, 50);
}

// ── Topical Clustering ─────────────────────────────────────────────────────

function buildTopicalClusters(
  pages: ParsedPageData[],
  entities: ExtractedEntity[],
  linkMap: Map<string, Set<string>>
): TopicalCluster[] {
  if (pages.length === 0) return [];

  // Build TF vectors for each page
  const pageVectors = new Map<string, { vector: Map<string, number>; page: ParsedPageData }>();
  for (const page of pages) {
    const words = extractWords([
      page.title || '',
      ...(page.h1Tags || []),
      ...(page.h2Tags || []),
      page.metaDescription || '',
      ...(page.paragraphs || []).slice(0, 3),
    ].join(' '));
    const significant = getSignificantWords(words);
    if (significant.length > 0) {
      pageVectors.set(normalizeUrl(page.url), {
        vector: buildTfVector(significant),
        page,
      });
    }
  }

  // Group pages by topic similarity using greedy clustering
  const clusters: TopicalCluster[] = [];
  const assigned = new Set<string>();
  const pageUrls = Array.from(pageVectors.keys());

  for (const seedUrl of pageUrls) {
    if (assigned.has(seedUrl)) continue;
    const seed = pageVectors.get(seedUrl)!;

    const clusterPages: ClusterPage[] = [];
    const clusterUrls = new Set<string>();

    // Find all pages similar to seed
    for (const candidateUrl of pageUrls) {
      if (assigned.has(candidateUrl)) continue;
      const candidate = pageVectors.get(candidateUrl)!;
      const sim = cosineSimilarity(seed.vector, candidate.vector);

      if (sim >= 0.15 || candidateUrl === seedUrl) {
        assigned.add(candidateUrl);
        clusterUrls.add(candidateUrl);

        const linksIn = linkMap.get(candidateUrl)?.size || 0;
        const linksOut = candidate.page.internalLinks?.length || 0;

        clusterPages.push({
          url: candidate.page.url,
          title: candidate.page.title || '',
          role: 'supporting',
          wordCount: candidate.page.wordCount || 0,
          internalLinksIn: linksIn,
          internalLinksOut: linksOut,
          relevanceScore: Math.round(sim * 100),
        });
      }
    }

    if (clusterPages.length === 0) continue;

    // Determine cluster topic from seed page
    const seedPage = seed.page;
    const topic = seedPage.h1Tags?.[0] || seedPage.title || 'Unnamed Topic';

    // Extract cluster keywords from all page content
    const allClusterWords: string[] = [];
    for (const cp of clusterPages) {
      const pv = pageVectors.get(normalizeUrl(cp.url));
      if (pv) allClusterWords.push(...getSignificantWords(extractWords(
        [pv.page.title || '', ...(pv.page.h1Tags || []), ...(pv.page.h2Tags || [])].join(' ')
      )));
    }
    const wordFreq = new Map<string, number>();
    for (const w of allClusterWords) wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    const keywords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);

    // Find pillar page (most linked-to within cluster)
    let pillarUrl: string | null = null;
    let maxPillarScore = 0;
    for (const cp of clusterPages) {
      const pillarScore = cp.internalLinksIn * 3 + cp.wordCount / 100 + (cp.url.split('/').length <= 4 ? 20 : 0);
      if (pillarScore > maxPillarScore) {
        maxPillarScore = pillarScore;
        pillarUrl = cp.url;
        cp.role = 'pillar';
      }
    }

    // Calculate cluster metrics
    const depth = clusterPages.length;
    const totalWordCount = clusterPages.reduce((s, p) => s + p.wordCount, 0);
    const coverage = Math.min(100, Math.round(
      (depth >= 5 ? 30 : depth * 6) +
      (totalWordCount >= 5000 ? 30 : (totalWordCount / 5000) * 30) +
      (pillarUrl ? 20 : 0) +
      (keywords.length >= 5 ? 20 : keywords.length * 4)
    ));

    const authority = Math.min(100, Math.round(
      coverage * 0.4 +
      (depth >= 3 ? 30 : depth * 10) +
      (totalWordCount >= 3000 ? 30 : (totalWordCount / 3000) * 30)
    ));

    // Classify cluster intent
    const intentVotes: Record<string, number> = {};
    for (const cp of clusterPages) {
      const pv = pageVectors.get(normalizeUrl(cp.url));
      if (pv) {
        const intent = classifyPageIntent(pv.page);
        intentVotes[intent] = (intentVotes[intent] || 0) + 1;
      }
    }
    const mainIntent = Object.entries(intentVotes)
      .sort((a, b) => b[1] - a[1])[0]?.[0] as TopicalCluster['intent'] || 'informational';

    // Identify gaps — check if related entities are missing from cluster
    const gaps: string[] = [];
    const clusterText = clusterPages.map(cp => cp.title).join(' ').toLowerCase();
    for (const entity of entities.filter(e => e.isCore)) {
      if (!clusterText.includes(entity.name) && entity.type === 'service') {
        gaps.push(`Missing coverage of "${entity.name}" in this topic cluster`);
      }
    }
    if (!pillarUrl) gaps.push('No clear pillar page — consider creating a comprehensive guide');
    if (depth < 3) gaps.push('Cluster depth is shallow — add supporting articles');
    if (totalWordCount < 2000) gaps.push('Total content is thin — expand with more detailed coverage');

    // AI opportunity — structured + deep + authoritative clusters rank in AI
    const aiOpportunity = Math.min(100, Math.round(
      (coverage >= 60 ? 0 : (100 - coverage) * 0.5) +
      (authority >= 60 ? 0 : (100 - authority) * 0.3) +
      (mainIntent === 'informational' ? 20 : mainIntent === 'commercial' ? 15 : 10)
    ));

    clusters.push({
      id: `cluster_${clusters.length + 1}`,
      topic: topic.length > 80 ? topic.slice(0, 80) : topic,
      keywords,
      pages: clusterPages,
      depth,
      coverage,
      authority,
      intent: mainIntent,
      hasPillar: !!pillarUrl,
      pillarUrl,
      gaps,
      aiOpportunity,
    });
  }

  return clusters.sort((a, b) => b.authority - a.authority);
}

// ── Link Graph Analysis ────────────────────────────────────────────────────

function analyzeLinkGraph(pages: ParsedPageData[]): { linkMap: Map<string, Set<string>>; analysis: LinkGraphAnalysis } {
  // Build adjacency map: target → set of sources
  const inLinks = new Map<string, Set<string>>();
  const outLinks = new Map<string, number>();
  const allUrls = new Set<string>();

  for (const page of pages) {
    const normalized = normalizeUrl(page.url);
    allUrls.add(normalized);
    const outCount = page.internalLinks?.length || 0;
    outLinks.set(normalized, outCount);

    for (const link of (page.internalLinks || [])) {
      const target = normalizeUrl(link);
      if (!inLinks.has(target)) inLinks.set(target, new Set());
      inLinks.get(target)!.add(normalized);
    }
  }

  // Ensure all crawled pages are in inLinks map
  for (const url of Array.from(allUrls)) {
    if (!inLinks.has(url)) inLinks.set(url, new Set());
  }

  const totalInternalLinks = Array.from(outLinks.values()).reduce((s, c) => s + c, 0);
  const averageLinksPerPage = pages.length > 0 ? Math.round(totalInternalLinks / pages.length) : 0;

  // Find extremes
  let maxIn = { url: '', count: 0 };
  let maxOut = { url: '', count: 0 };
  for (const [url, sources] of Array.from(inLinks)) {
    if (sources.size > maxIn.count) maxIn = { url, count: sources.size };
  }
  for (const [url, count] of Array.from(outLinks)) {
    if (count > maxOut.count) maxOut = { url, count };
  }

  // Find orphan pages (no internal links pointing to them, excluding homepage)
  const orphanPages: string[] = [];
  for (const url of Array.from(allUrls)) {
    const ins = inLinks.get(url)?.size || 0;
    if (ins === 0 && !url.match(/^https?:\/\/[^/]+\/?$/)) {
      orphanPages.push(url);
    }
  }

  // Find dead-end pages (no outgoing links)
  const deadEndPages: string[] = [];
  for (const [url, count] of Array.from(outLinks)) {
    if (count === 0) deadEndPages.push(url);
  }

  // Find hub pages (high in + out)
  const hubPages: string[] = [];
  for (const url of Array.from(allUrls)) {
    const ins = inLinks.get(url)?.size || 0;
    const outs = outLinks.get(url) || 0;
    if (ins >= 3 && outs >= 3) hubPages.push(url);
  }

  // Authority distribution assessment
  const inCounts = Array.from(allUrls).map(u => inLinks.get(u)?.size || 0);
  const maxInCount = Math.max(1, ...inCounts);
  const avgInCount = inCounts.reduce((s, c) => s + c, 0) / Math.max(1, inCounts.length);
  let authorityDistribution: LinkGraphAnalysis['authorityDistribution'] = 'healthy';
  if (maxInCount > avgInCount * 5 && allUrls.size > 5) authorityDistribution = 'top_heavy';
  else if (maxInCount <= 2 && allUrls.size > 5) authorityDistribution = 'flat';
  else if (orphanPages.length > allUrls.size * 0.3) authorityDistribution = 'fragmented';

  // Cluster connectivity — what % of pages have cross-cluster links
  const clusterConnectivity = allUrls.size > 0
    ? Math.round(((allUrls.size - orphanPages.length) / allUrls.size) * 100)
    : 0;

  // Generate recommendations
  const recommendations: LinkRecommendation[] = [];

  // Fix orphan pages
  for (const orphan of orphanPages.slice(0, 5)) {
    const orphanPage = pages.find(p => normalizeUrl(p.url) === orphan);
    const bestSource = hubPages[0] || Array.from(allUrls).find(u => u !== orphan) || '';
    if (bestSource) {
      recommendations.push({
        type: 'fix_orphan',
        fromUrl: bestSource,
        toUrl: orphan,
        reason: `"${orphanPage?.title || orphan}" has no internal links — invisible to crawlers`,
        impact: 'high',
        anchorSuggestion: orphanPage?.title || orphan.split('/').pop() || '',
      });
    }
  }

  // Fix dead-end pages
  for (const deadEnd of deadEndPages.slice(0, 3)) {
    const deadPage = pages.find(p => normalizeUrl(p.url) === deadEnd);
    const bestTarget = maxIn.url !== deadEnd ? maxIn.url : (hubPages[0] || '');
    if (bestTarget) {
      recommendations.push({
        type: 'fix_dead_end',
        fromUrl: deadEnd,
        toUrl: bestTarget,
        reason: `"${deadPage?.title || deadEnd}" has no outgoing links — authority dead end`,
        impact: 'medium',
        anchorSuggestion: pages.find(p => normalizeUrl(p.url) === bestTarget)?.title || '',
      });
    }
  }

  // Strengthen pillar pages (pages with high content but low incoming links)
  for (const page of pages) {
    const normalized = normalizeUrl(page.url);
    const ins = inLinks.get(normalized)?.size || 0;
    if (page.wordCount && page.wordCount > 1000 && ins < 3) {
      const source = hubPages.find(h => h !== normalized) || '';
      if (source) {
        recommendations.push({
          type: 'strengthen_pillar',
          fromUrl: source,
          toUrl: normalized,
          reason: `"${page.title}" has ${page.wordCount} words but only ${ins} internal links — underlinked authority page`,
          impact: 'high',
          anchorSuggestion: page.h1Tags?.[0] || page.title || '',
        });
      }
    }
  }

  return {
    linkMap: inLinks,
    analysis: {
      totalInternalLinks,
      averageLinksPerPage,
      maxLinksIn: maxIn,
      maxLinksOut: maxOut,
      orphanPages,
      deadEndPages,
      hubPages,
      authorityDistribution,
      clusterConnectivity,
      recommendations: recommendations.slice(0, 15),
    },
  };
}

// ── Pillar Page Detection ──────────────────────────────────────────────────

function detectPillarPages(
  pages: ParsedPageData[],
  clusters: TopicalCluster[],
  linkMap: Map<string, Set<string>>
): PillarPageCandidate[] {
  const candidates: PillarPageCandidate[] = [];

  for (const page of pages) {
    const normalized = normalizeUrl(page.url);
    const inLinks = linkMap.get(normalized)?.size || 0;
    const outLinks = page.internalLinks?.length || 0;
    const wordCount = page.wordCount || 0;
    const hasSchema = !!(page.schemaMarkup && page.schemaMarkup.length > 0);
    const urlDepth = page.url.replace(/^https?:\/\/[^/]+/, '').split('/').filter(Boolean).length;

    // Score pillar fitness
    let score = 0;
    const reasons: string[] = [];
    const recommendations: string[] = [];

    // Word count (pillar pages should be comprehensive)
    if (wordCount >= 2000) { score += 25; reasons.push(`Comprehensive content (${wordCount} words)`); }
    else if (wordCount >= 1000) { score += 15; reasons.push(`Good content depth (${wordCount} words)`); }
    else { recommendations.push(`Expand content to 1500+ words for pillar page status`); }

    // Internal links (pillar pages receive many links)
    if (inLinks >= 5) { score += 20; reasons.push(`Strong internal authority (${inLinks} incoming links)`); }
    else if (inLinks >= 3) { score += 10; reasons.push(`Moderate internal authority (${inLinks} incoming links)`); }
    else { recommendations.push(`Add internal links from related pages to strengthen authority`); }

    // Outgoing links (pillar pages link to supporting content)
    if (outLinks >= 5) { score += 15; reasons.push(`Links to ${outLinks} related pages`); }
    else { recommendations.push(`Add links to supporting articles within this topic`); }

    // URL depth (pillar pages are usually at top level)
    if (urlDepth <= 2) { score += 10; reasons.push(`Top-level URL structure`); }

    // Schema markup
    if (hasSchema) { score += 10; reasons.push(`Has structured data`); }
    else { recommendations.push(`Add JSON-LD schema markup`); }

    // Check if it's already identified as a cluster pillar
    const matchingCluster = clusters.find(c => c.pillarUrl === page.url);
    if (matchingCluster) {
      score += 20;
      reasons.push(`Identified as pillar for "${matchingCluster.topic}" cluster`);
    }

    // Has FAQ content
    const hasFAQ = (page.h2Tags || []).some(h => /faq|שאלות|q&a|frequently/i.test(h));
    if (hasFAQ) { score += 5; reasons.push(`Contains FAQ section`); }

    const topic = matchingCluster?.topic || page.h1Tags?.[0] || page.title || '';

    if (score >= 30) {
      candidates.push({
        url: page.url,
        title: page.title || '',
        topic,
        score: Math.min(100, score),
        wordCount,
        internalLinksIn: inLinks,
        internalLinksOut: outLinks,
        hasSchema,
        hasFAQ,
        reasons,
        recommendations,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 20);
}

// ── Main Analysis Function ─────────────────────────────────────────────────

export function analyzeSemantics(
  pages: ParsedPageData[],
  businessName: string,
  products: string[],
): SemanticAnalysis {
  const now = new Date().toISOString();

  if (!pages || pages.length === 0) {
    return {
      topicalMap: [],
      entities: [],
      pillarPages: [],
      orphanPages: [],
      linkGraph: {
        totalInternalLinks: 0,
        averageLinksPerPage: 0,
        maxLinksIn: { url: '', count: 0 },
        maxLinksOut: { url: '', count: 0 },
        orphanPages: [],
        deadEndPages: [],
        hubPages: [],
        authorityDistribution: 'fragmented',
        clusterConnectivity: 0,
        recommendations: [],
      },
      contentIntents: {
        informational: [],
        commercial: [],
        transactional: [],
        local: [],
        navigational: [],
        unclassified: [],
      },
      semanticScore: 0,
      analysisConfidence: 0,
      analyzedAt: now,
    };
  }

  // Step 1: Build link graph
  const { linkMap, analysis: linkGraph } = analyzeLinkGraph(pages);

  // Step 2: Extract entities
  const entities = extractEntities(pages, businessName, products);

  // Step 3: Build topical clusters
  const topicalMap = buildTopicalClusters(pages, entities, linkMap);

  // Step 4: Detect pillar pages
  const pillarPages = detectPillarPages(pages, topicalMap, linkMap);

  // Step 5: Classify content intents
  const contentIntents: ContentIntentMap = {
    informational: [],
    commercial: [],
    transactional: [],
    local: [],
    navigational: [],
    unclassified: [],
  };
  for (const page of pages) {
    const intent = classifyPageIntent(page);
    if (intent in contentIntents) {
      (contentIntents as any)[intent].push(page.url);
    } else {
      contentIntents.unclassified.push(page.url);
    }
  }

  // Step 6: Calculate semantic score
  const clusterCoverage = topicalMap.length > 0 ? topicalMap.reduce((s, c) => s + c.coverage, 0) / topicalMap.length : 0;
  const hasPillarPages = pillarPages.filter(p => p.score >= 50).length;
  const semanticScore = Math.min(100, Math.round(
    clusterCoverage * 0.3 +
    (hasPillarPages >= 3 ? 20 : hasPillarPages * 7) +
    linkGraph.clusterConnectivity * 0.2 +
    (entities.filter(e => e.isCore).length >= 3 ? 15 : entities.filter(e => e.isCore).length * 5) +
    (linkGraph.authorityDistribution === 'healthy' ? 15 : linkGraph.authorityDistribution === 'top_heavy' ? 8 : 3)
  ));

  const analysisConfidence = Math.min(100, Math.round(
    (pages.length >= 10 ? 40 : pages.length * 4) +
    (entities.length >= 5 ? 30 : entities.length * 6) +
    (topicalMap.length >= 3 ? 30 : topicalMap.length * 10)
  ));

  return {
    topicalMap,
    entities,
    pillarPages,
    orphanPages: linkGraph.orphanPages,
    linkGraph,
    contentIntents,
    semanticScore,
    analysisConfidence,
    analyzedAt: now,
  };
}
