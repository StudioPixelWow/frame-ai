/**
 * PIXEL SEO/GEO — Competitor Discovery & Intelligence Engine
 *
 * Discovers and analyzes competitors from REAL data sources:
 * - SERP results (who ranks for our target keywords)
 * - AI visibility results (who gets mentioned by AI engines)
 * - Crawl data (who our site links to / mentions)
 *
 * Provides:
 * - Competitor discovery from SERP overlap
 * - Authority gap analysis (where competitors outperform us)
 * - Content opportunity identification (topics competitors cover that we don't)
 * - AI visibility comparison
 * - Strategic recommendations for outranking competitors
 *
 * NEVER invents competitor data. All insights from real scan results.
 */

import type { DomainRankingResult } from './serp-api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompetitorAnalysis {
  competitors: DiscoveredCompetitor[];
  authorityGaps: AuthorityGap[];
  contentOpportunities: ContentOpportunity[];
  aiVisibilityComparison: AIVisibilityComparison[];
  strategicInsights: StrategicInsight[];
  summary: CompetitorSummary;
  analyzedAt: string;
}

export interface DiscoveredCompetitor {
  domain: string;
  overlapScore: number;       // 0-100 how much they overlap with our keywords
  keywordsShared: string[];
  keywordsTheyOwn: string[];  // keywords where they rank top 3 and we don't rank top 20
  avgPosition: number;        // their average position for shared keywords
  ourAvgPosition: number;     // our average position for shared keywords
  positionAdvantage: number;  // positive = they're ahead, negative = we're ahead
  estimatedAuthority: 'dominant' | 'strong' | 'moderate' | 'weak';
  threatLevel: 'critical' | 'high' | 'medium' | 'low';
  aiMentions: number;         // how many times AI engines mention them
  source: 'serp' | 'ai_scan' | 'both';
}

export interface AuthorityGap {
  keyword: string;
  ourPosition: number | null;     // null = not ranking
  competitorDomain: string;
  competitorPosition: number;
  gap: number;                    // position difference (positive = they're ahead)
  opportunity: 'quick_win' | 'medium_effort' | 'long_term';
  estimatedImpact: 'high' | 'medium' | 'low';
  reason: string;
  suggestedAction: string;
}

export interface ContentOpportunity {
  topic: string;
  type: 'missing_topic' | 'thin_coverage' | 'no_pillar' | 'no_faq' | 'no_schema' | 'competitor_advantage';
  competitorsCovering: string[];
  estimatedSearchVolume: 'high' | 'medium' | 'low';
  intent: 'informational' | 'commercial' | 'transactional' | 'local';
  difficulty: 'easy' | 'medium' | 'hard';
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface AIVisibilityComparison {
  query: string;
  platform: string;
  weMentioned: boolean;
  competitorsMentioned: string[];
  opportunity: string;
}

export interface StrategicInsight {
  id: string;
  category: 'authority' | 'content' | 'technical' | 'local' | 'ai_visibility';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  relatedCompetitors: string[];
  estimatedTimeWeeks: number;
}

export interface CompetitorSummary {
  totalCompetitors: number;
  dominantCompetitor: string | null;
  criticalGaps: number;
  quickWins: number;
  contentOpportunities: number;
  aiVisibilityGap: number;      // percentage points behind best competitor
  overallThreatLevel: 'critical' | 'high' | 'medium' | 'low';
}

// ── Input Types ────────────────────────────────────────────────────────────

export interface CompetitorAnalysisInput {
  domain: string;
  serpRankings?: DomainRankingResult[] | null;
  aiScanResults?: Array<{
    platform: string;
    query: string;
    found: boolean;
    snippet?: string;
    competitorsMentioned?: string[];
  }> | null;
  crawlPages?: Array<{
    url: string;
    title: string;
    h1Tags?: string[];
    h2Tags?: string[];
    wordCount?: number;
    hasSchema?: boolean;
  }> | null;
  knownCompetitors?: string[];
  targetKeywords?: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

function normalizeCompetitorDomain(domain: string): string {
  return domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();
}

// ── Competitor Discovery from SERP ─────────────────────────────────────────

function discoverFromSerp(
  ourDomain: string,
  serpRankings: DomainRankingResult[],
): Map<string, { keywords: string[]; positions: number[]; ourPositions: (number | null)[] }> {
  const competitors = new Map<string, {
    keywords: string[];
    positions: number[];
    ourPositions: (number | null)[];
  }>();

  const ourDomainNorm = normalizeCompetitorDomain(ourDomain);

  for (const ranking of serpRankings) {
    // Find our position
    let ourPos: number | null = null;
    for (let i = 0; i < ranking.topCompetitors.length; i++) {
      if (normalizeCompetitorDomain(ranking.topCompetitors[i].domain) === ourDomainNorm) {
        ourPos = i + 1;
        break;
      }
    }

    // Collect all competitors that rank for this keyword
    for (const comp of ranking.topCompetitors) {
      const compDomain = normalizeCompetitorDomain(comp.domain);
      if (compDomain === ourDomainNorm) continue;

      // Skip non-competitor domains (aggregators, wikis, etc.)
      if (/wikipedia|youtube|facebook|instagram|twitter|linkedin|reddit|amazon|ebay|aliexpress|gov\.il|ynet|walla|mako/i.test(compDomain)) {
        continue;
      }

      if (!competitors.has(compDomain)) {
        competitors.set(compDomain, { keywords: [], positions: [], ourPositions: [] });
      }

      const data = competitors.get(compDomain)!;
      const compIdx = ranking.topCompetitors.indexOf(comp);
      data.keywords.push(ranking.query);
      data.positions.push(compIdx + 1);
      data.ourPositions.push(ourPos);
    }
  }

  return competitors;
}

// ── Competitor Discovery from AI Scans ─────────────────────────────────────

function discoverFromAI(
  aiResults: NonNullable<CompetitorAnalysisInput['aiScanResults']>,
): Map<string, { mentions: number; queries: string[] }> {
  const competitors = new Map<string, { mentions: number; queries: string[] }>();

  for (const result of aiResults) {
    if (result.competitorsMentioned) {
      for (const comp of result.competitorsMentioned) {
        const domain = normalizeCompetitorDomain(comp);
        if (!competitors.has(domain)) {
          competitors.set(domain, { mentions: 0, queries: [] });
        }
        const data = competitors.get(domain)!;
        data.mentions++;
        data.queries.push(result.query);
      }
    }

    // Also extract domains mentioned in snippets
    if (result.snippet) {
      const urlMatches = result.snippet.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g);
      if (urlMatches) {
        for (const match of urlMatches) {
          const domain = normalizeCompetitorDomain(match);
          if (!competitors.has(domain)) {
            competitors.set(domain, { mentions: 0, queries: [] });
          }
          const data = competitors.get(domain)!;
          data.mentions++;
          if (!data.queries.includes(result.query)) data.queries.push(result.query);
        }
      }
    }
  }

  return competitors;
}

// ── Authority Gap Detection ────────────────────────────────────────────────

function findAuthorityGaps(
  competitors: DiscoveredCompetitor[],
  serpRankings: DomainRankingResult[] | null,
  ourDomain: string,
): AuthorityGap[] {
  const gaps: AuthorityGap[] = [];
  if (!serpRankings) return gaps;

  const ourDomainNorm = normalizeCompetitorDomain(ourDomain);
  const topCompetitors = competitors.filter(c => c.threatLevel !== 'low').slice(0, 5);

  for (const ranking of serpRankings) {
    // Find our position
    let ourPos: number | null = null;
    for (let i = 0; i < ranking.topCompetitors.length; i++) {
      if (normalizeCompetitorDomain(ranking.topCompetitors[i].domain) === ourDomainNorm) {
        ourPos = i + 1;
        break;
      }
    }

    // For each top competitor, check if they outrank us
    for (const comp of topCompetitors) {
      const compInSERP = ranking.topCompetitors.find(
        r => normalizeCompetitorDomain(r.domain) === comp.domain
      );
      if (!compInSERP) continue;
      const compPos = ranking.topCompetitors.indexOf(compInSERP) + 1;

      // Gap exists when competitor ranks better or we don't rank at all
      if (ourPos === null || compPos < ourPos) {
        const posGap = ourPos ? ourPos - compPos : 20;

        let opportunity: AuthorityGap['opportunity'] = 'long_term';
        if (ourPos && ourPos <= 10 && posGap <= 3) opportunity = 'quick_win';
        else if (ourPos && ourPos <= 20) opportunity = 'medium_effort';

        let impact: AuthorityGap['estimatedImpact'] = 'low';
        if (!ourPos || ourPos > 10) impact = 'high';
        else if (posGap >= 5) impact = 'high';
        else if (posGap >= 2) impact = 'medium';

        gaps.push({
          keyword: ranking.query,
          ourPosition: ourPos,
          competitorDomain: comp.domain,
          competitorPosition: compPos,
          gap: posGap,
          opportunity,
          estimatedImpact: impact,
          reason: ourPos
            ? `${comp.domain} ranks #${compPos} vs our #${ourPos} — ${posGap} positions ahead`
            : `${comp.domain} ranks #${compPos} — we're not ranking for "${ranking.query}"`,
          suggestedAction: ourPos
            ? `Optimize existing page for "${ranking.query}" — improve content depth and internal linking`
            : `Create targeted content for "${ranking.query}" — ${comp.domain} already captures this traffic`,
        });
      }
    }
  }

  // Sort by impact then by gap size
  return gaps
    .sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      const diff = impactOrder[a.estimatedImpact] - impactOrder[b.estimatedImpact];
      if (diff !== 0) return diff;
      return b.gap - a.gap;
    })
    .slice(0, 30);
}

// ── Content Opportunity Discovery ──────────────────────────────────────────

function findContentOpportunities(
  competitors: DiscoveredCompetitor[],
  crawlPages: CompetitorAnalysisInput['crawlPages'],
  targetKeywords: string[],
): ContentOpportunity[] {
  const opportunities: ContentOpportunity[] = [];
  const existingTopics = new Set<string>();

  // Map existing page topics
  if (crawlPages) {
    for (const page of crawlPages) {
      const topics = [
        page.title || '',
        ...(page.h1Tags || []),
        ...(page.h2Tags || []),
      ].join(' ').toLowerCase();
      existingTopics.add(topics);
    }
  }

  const existingText = Array.from(existingTopics).join(' ');

  // Find keywords competitors own that we don't cover
  for (const comp of competitors.slice(0, 5)) {
    for (const keyword of comp.keywordsTheyOwn) {
      const alreadyCovered = existingText.includes(keyword.toLowerCase());
      if (!alreadyCovered) {
        opportunities.push({
          topic: keyword,
          type: 'missing_topic',
          competitorsCovering: [comp.domain],
          estimatedSearchVolume: comp.overlapScore > 50 ? 'high' : 'medium',
          intent: guessIntent(keyword),
          difficulty: comp.estimatedAuthority === 'dominant' ? 'hard' : comp.estimatedAuthority === 'strong' ? 'medium' : 'easy',
          impact: 'high',
          recommendation: `Create comprehensive content for "${keyword}" — ${comp.domain} is currently capturing this traffic`,
        });
      }
    }
  }

  // Check target keywords not covered in content
  for (const keyword of targetKeywords) {
    const covered = existingText.includes(keyword.toLowerCase());
    if (!covered) {
      const coveringCompetitors = competitors
        .filter(c => c.keywordsShared.some(k => k.toLowerCase() === keyword.toLowerCase()))
        .map(c => c.domain);

      opportunities.push({
        topic: keyword,
        type: 'missing_topic',
        competitorsCovering: coveringCompetitors,
        estimatedSearchVolume: 'medium',
        intent: guessIntent(keyword),
        difficulty: coveringCompetitors.length > 3 ? 'hard' : 'medium',
        impact: 'high',
        recommendation: `Target keyword "${keyword}" has no dedicated content — ${coveringCompetitors.length} competitors rank for it`,
      });
    }
  }

  // Check for thin coverage on existing pages
  if (crawlPages) {
    for (const page of crawlPages) {
      if (page.wordCount && page.wordCount < 500 && page.title) {
        opportunities.push({
          topic: page.title,
          type: 'thin_coverage',
          competitorsCovering: [],
          estimatedSearchVolume: 'medium',
          intent: guessIntent(page.title),
          difficulty: 'easy',
          impact: 'medium',
          recommendation: `"${page.title}" has only ${page.wordCount} words — expand to 1000+ words with deeper coverage`,
        });
      }

      if (!page.hasSchema) {
        opportunities.push({
          topic: page.title || page.url,
          type: 'no_schema',
          competitorsCovering: [],
          estimatedSearchVolume: 'low',
          intent: 'informational',
          difficulty: 'easy',
          impact: 'medium',
          recommendation: `Add JSON-LD structured data to "${page.title || page.url}"`,
        });
      }
    }
  }

  // Deduplicate by topic
  const seen = new Set<string>();
  return opportunities.filter(o => {
    const key = o.topic.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}

function guessIntent(keyword: string): ContentOpportunity['intent'] {
  const lower = keyword.toLowerCase();
  if (/buy|price|cost|shop|order|קנה|מחיר|עלות|הזמנ/.test(lower)) return 'transactional';
  if (/best|top|review|compare|מומלץ|הכי|השווא/.test(lower)) return 'commercial';
  if (/near|nearby|location|address|בקרבת|כתובת|סניף/.test(lower)) return 'local';
  return 'informational';
}

// ── Strategic Insights Generation ──────────────────────────────────────────

function generateStrategicInsights(
  competitors: DiscoveredCompetitor[],
  gaps: AuthorityGap[],
  opportunities: ContentOpportunity[],
  aiComparison: AIVisibilityComparison[],
): StrategicInsight[] {
  const insights: StrategicInsight[] = [];
  let insightId = 1;

  // Dominant competitor threat
  const dominant = competitors.find(c => c.threatLevel === 'critical');
  if (dominant) {
    insights.push({
      id: `insight_${insightId++}`,
      category: 'authority',
      title: `מתחרה דומיננטי: ${dominant.domain}`,
      description: `${dominant.domain} שולט ב-${dominant.keywordsTheyOwn.length} ביטויים שלנו עם עמדה ממוצעת ${dominant.avgPosition.toFixed(1)}. הם מהווים האיום העיקרי על התנועה שלנו.`,
      priority: 'critical',
      action: `בנה אסטרטגיית תוכן ממוקדת נגד ${dominant.domain} — התמקד ב-${dominant.keywordsTheyOwn.slice(0, 3).join(', ')}`,
      relatedCompetitors: [dominant.domain],
      estimatedTimeWeeks: 8,
    });
  }

  // Quick win opportunities
  const quickWins = gaps.filter(g => g.opportunity === 'quick_win');
  if (quickWins.length > 0) {
    insights.push({
      id: `insight_${insightId++}`,
      category: 'content',
      title: `${quickWins.length} הזדמנויות מהירות לשיפור`,
      description: `יש ${quickWins.length} ביטויים שבהם אנחנו כבר בעמוד 1 אבל ממיקום 4-10. שיפור קטן יכול להביא קפיצה משמעותית בתנועה.`,
      priority: 'high',
      action: `שפר meta titles, descriptions, ותוכן עבור: ${quickWins.slice(0, 3).map(q => `"${q.keyword}"`).join(', ')}`,
      relatedCompetitors: [...new Set(quickWins.map(q => q.competitorDomain))].slice(0, 3),
      estimatedTimeWeeks: 2,
    });
  }

  // Missing content topics
  const missingTopics = opportunities.filter(o => o.type === 'missing_topic' && o.impact === 'high');
  if (missingTopics.length > 0) {
    insights.push({
      id: `insight_${insightId++}`,
      category: 'content',
      title: `${missingTopics.length} נושאים חסרים עם פוטנציאל גבוה`,
      description: `מתחרים מדורגים על ${missingTopics.length} נושאים שאין לנו תוכן עליהם. יצירת תוכן ייעודי תפתח מקורות תנועה חדשים.`,
      priority: 'high',
      action: `צור תוכן עבור: ${missingTopics.slice(0, 5).map(t => `"${t.topic}"`).join(', ')}`,
      relatedCompetitors: [...new Set(missingTopics.flatMap(t => t.competitorsCovering))].slice(0, 3),
      estimatedTimeWeeks: 4,
    });
  }

  // AI visibility gap
  const weAppear = aiComparison.filter(a => a.weMentioned).length;
  const totalAI = aiComparison.length;
  if (totalAI > 0 && weAppear < totalAI * 0.5) {
    const competitorMentions = new Map<string, number>();
    for (const a of aiComparison) {
      for (const comp of a.competitorsMentioned) {
        competitorMentions.set(comp, (competitorMentions.get(comp) || 0) + 1);
      }
    }
    const topAICompetitor = Array.from(competitorMentions.entries()).sort((a, b) => b[1] - a[1])[0];

    insights.push({
      id: `insight_${insightId++}`,
      category: 'ai_visibility',
      title: `חשיפה חלשה במנועי AI — רק ${Math.round((weAppear / totalAI) * 100)}%`,
      description: `מנועי AI מזכירים אותנו רק ב-${weAppear} מתוך ${totalAI} שאילתות.${topAICompetitor ? ` ${topAICompetitor[0]} מוזכר ${topAICompetitor[1]} פעמים.` : ''}`,
      priority: weAppear === 0 ? 'critical' : 'high',
      action: `שפר מבנה תוכן ל-AI readability: הוסף FAQ sections, הגדרות ברורות, ומבנים סמנטיים`,
      relatedCompetitors: topAICompetitor ? [topAICompetitor[0]] : [],
      estimatedTimeWeeks: 6,
    });
  }

  // Thin content disadvantage
  const thinPages = opportunities.filter(o => o.type === 'thin_coverage');
  if (thinPages.length >= 3) {
    insights.push({
      id: `insight_${insightId++}`,
      category: 'content',
      title: `${thinPages.length} דפים עם תוכן דק — פוגע בסמכות`,
      description: `${thinPages.length} דפים מכילים פחות מ-500 מילים. תוכן דק מורה למנועי חיפוש שהאתר חסר עומק. שדרג אותם לתוכן מקיף.`,
      priority: thinPages.length >= 5 ? 'high' : 'medium',
      action: `הרחב את ${thinPages.slice(0, 3).map(t => `"${t.topic}"`).join(', ')} ל-1000+ מילים`,
      relatedCompetitors: [],
      estimatedTimeWeeks: 3,
    });
  }

  return insights.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ── Main Analysis Function ─────────────────────────────────────────────────

export function analyzeCompetitors(input: CompetitorAnalysisInput): CompetitorAnalysis {
  const now = new Date().toISOString();
  const ourDomain = normalizeCompetitorDomain(input.domain);

  // Step 1: Discover competitors from SERP
  const serpCompetitors = input.serpRankings
    ? discoverFromSerp(ourDomain, input.serpRankings)
    : new Map();

  // Step 2: Discover competitors from AI scans
  const aiCompetitors = input.aiScanResults
    ? discoverFromAI(input.aiScanResults)
    : new Map();

  // Step 3: Merge competitor data
  const allDomains = new Set([
    ...serpCompetitors.keys(),
    ...aiCompetitors.keys(),
    ...(input.knownCompetitors || []).map(normalizeCompetitorDomain),
  ]);
  allDomains.delete(ourDomain);

  const competitors: DiscoveredCompetitor[] = [];

  for (const domain of allDomains) {
    const serpData = serpCompetitors.get(domain);
    const aiData = aiCompetitors.get(domain);

    if (!serpData && !aiData) continue; // known competitor but no data

    const keywordsShared = serpData?.keywords || [];
    const positions = serpData?.positions || [];
    const ourPositions = serpData?.ourPositions || [];

    const avgPos = positions.length > 0
      ? positions.reduce((s, p) => s + p, 0) / positions.length
      : 0;

    const validOurPositions = ourPositions.filter((p): p is number => p !== null);
    const ourAvgPos = validOurPositions.length > 0
      ? validOurPositions.reduce((s, p) => s + p, 0) / validOurPositions.length
      : 0;

    // Keywords they own (rank top 3, we don't rank top 20)
    const keywordsTheyOwn = keywordsShared.filter((_, idx) => {
      return positions[idx] <= 3 && (ourPositions[idx] === null || ourPositions[idx]! > 20);
    });

    // Overlap score
    const totalKeywords = keywordsShared.length + (aiData?.mentions || 0);
    const overlapScore = Math.min(100, Math.round(totalKeywords * 5));

    // Estimated authority
    let estimatedAuthority: DiscoveredCompetitor['estimatedAuthority'] = 'weak';
    if (avgPos > 0 && avgPos <= 3 && keywordsShared.length >= 5) estimatedAuthority = 'dominant';
    else if (avgPos <= 5 && keywordsShared.length >= 3) estimatedAuthority = 'strong';
    else if (avgPos <= 10 || keywordsShared.length >= 2) estimatedAuthority = 'moderate';

    // Threat level
    let threatLevel: DiscoveredCompetitor['threatLevel'] = 'low';
    if (estimatedAuthority === 'dominant' || keywordsTheyOwn.length >= 5) threatLevel = 'critical';
    else if (estimatedAuthority === 'strong' || keywordsTheyOwn.length >= 3) threatLevel = 'high';
    else if (estimatedAuthority === 'moderate') threatLevel = 'medium';

    competitors.push({
      domain,
      overlapScore,
      keywordsShared,
      keywordsTheyOwn,
      avgPosition: Math.round(avgPos * 10) / 10,
      ourAvgPosition: Math.round(ourAvgPos * 10) / 10,
      positionAdvantage: Math.round((ourAvgPos - avgPos) * 10) / 10,
      estimatedAuthority,
      threatLevel,
      aiMentions: aiData?.mentions || 0,
      source: serpData && aiData ? 'both' : serpData ? 'serp' : 'ai_scan',
    });
  }

  // Sort by threat level then overlap
  competitors.sort((a, b) => {
    const threatOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const diff = threatOrder[a.threatLevel] - threatOrder[b.threatLevel];
    if (diff !== 0) return diff;
    return b.overlapScore - a.overlapScore;
  });

  // Step 4: Find authority gaps
  const authorityGaps = findAuthorityGaps(competitors, input.serpRankings || null, ourDomain);

  // Step 5: Find content opportunities
  const contentOpportunities = findContentOpportunities(
    competitors,
    input.crawlPages || null,
    input.targetKeywords || [],
  );

  // Step 6: AI visibility comparison
  const aiComparison: AIVisibilityComparison[] = [];
  if (input.aiScanResults) {
    for (const result of input.aiScanResults) {
      aiComparison.push({
        query: result.query,
        platform: result.platform,
        weMentioned: result.found,
        competitorsMentioned: result.competitorsMentioned || [],
        opportunity: !result.found && (result.competitorsMentioned?.length || 0) > 0
          ? `מתחרים מוזכרים ב-"${result.query}" ואנחנו לא — הזדמנות GEO`
          : result.found
            ? `אנחנו מוזכרים ב-"${result.query}" — לשמור ולחזק`
            : `אף אחד לא מוזכר — הזדמנות ליצור תוכן סמכותי ראשון`,
      });
    }
  }

  // Step 7: Generate strategic insights
  const strategicInsights = generateStrategicInsights(competitors, authorityGaps, contentOpportunities, aiComparison);

  // Step 8: Build summary
  const dominantComp = competitors.find(c => c.threatLevel === 'critical');
  const bestAICompetitor = competitors.reduce((best, c) => c.aiMentions > (best?.aiMentions || 0) ? c : best, null as DiscoveredCompetitor | null);
  const weAppearInAI = aiComparison.filter(a => a.weMentioned).length;
  const bestAppearInAI = bestAICompetitor?.aiMentions || 0;

  const summary: CompetitorSummary = {
    totalCompetitors: competitors.length,
    dominantCompetitor: dominantComp?.domain || null,
    criticalGaps: authorityGaps.filter(g => g.estimatedImpact === 'high').length,
    quickWins: authorityGaps.filter(g => g.opportunity === 'quick_win').length,
    contentOpportunities: contentOpportunities.length,
    aiVisibilityGap: aiComparison.length > 0 ? Math.max(0, bestAppearInAI - weAppearInAI) : 0,
    overallThreatLevel: dominantComp
      ? 'critical'
      : competitors.filter(c => c.threatLevel === 'high').length >= 2
        ? 'high'
        : competitors.length > 0
          ? 'medium'
          : 'low',
  };

  return {
    competitors: competitors.slice(0, 15),
    authorityGaps,
    contentOpportunities,
    aiVisibilityComparison: aiComparison,
    strategicInsights,
    summary,
    analyzedAt: now,
  };
}
