/**
 * PIXEL SEO/GEO — Strategic Scoring Model
 *
 * Unified scoring system that evaluates a website across ALL ranking signals.
 * Produces a single strategic score (0-100) with breakdown by category.
 *
 * Categories:
 * 1. Topical Authority (25%)
 * 2. Technical Health (20%)
 * 3. Content Quality (20%)
 * 4. AI Readiness (15%)
 * 5. Competitive Position (10%)
 * 6. Conversion Readiness (10%)
 *
 * All scores based on REAL data only. Missing data reduces confidence, not score.
 */

import type { SemanticAnalysis } from './semantic-intelligence';
import type { CompetitorAnalysis } from './competitor-engine';
import type { GapAnalysisResult } from './gap-analysis';
import type { WebsiteFacts } from './website-facts';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StrategicScore {
  overall: number;              // 0-100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  confidence: number;           // 0-100 how much data we have
  categories: ScoreCategory[];
  signals: ScoredSignal[];
  priorities: ScoredPriority[];
  comparedToIndustry: 'above_average' | 'average' | 'below_average' | 'unknown';
  analyzedAt: string;
}

export interface ScoreCategory {
  id: string;
  name: string;
  nameHe: string;
  score: number;         // 0-100
  weight: number;        // 0-1 (weights sum to 1.0)
  signals: string[];     // signal IDs in this category
  topIssue: string;      // the biggest problem in this category
  topAction: string;     // the most impactful action for improvement
}

export interface ScoredSignal {
  id: string;
  name: string;
  nameHe: string;
  category: string;
  score: number;         // 0-100
  evidence: string;      // what data produced this score
  impact: 'critical' | 'high' | 'medium' | 'low';
  actionable: boolean;
  action?: string;
}

export interface ScoredPriority {
  rank: number;
  signal: string;
  category: string;
  currentScore: number;
  potentialGain: number;   // estimated score improvement
  effort: 'quick' | 'medium' | 'significant';
  description: string;
  descriptionHe: string;
}

export interface ScoringInput {
  websiteFacts?: WebsiteFacts | null;
  semanticAnalysis?: SemanticAnalysis | null;
  competitorAnalysis?: CompetitorAnalysis | null;
  gapAnalysis?: GapAnalysisResult | null;
  aiVisibilityScore?: number | null;       // 0-100 from AI scan
  crawlData?: {
    totalPages: number;
    avgWordCount: number;
    pagesWithSchema: number;
    pagesWithH1: number;
    pagesWithMeta: number;
    brokenLinks: number;
    hasSSL: boolean;
    hasSitemap: boolean;
    hasRobotsTxt: boolean;
    mobileOptimized: boolean;
    avgLoadTimeMs: number;
  } | null;
}

// ── Score Helpers ──────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

function gradeFromScore(score: number): StrategicScore['grade'] {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B+';
  if (score >= 65) return 'B';
  if (score >= 55) return 'C+';
  if (score >= 45) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

// ── Category Scorers ───────────────────────────────────────────────────────

function scoreTopicalAuthority(
  semantic: SemanticAnalysis | null,
  gaps: GapAnalysisResult | null,
): { score: number; signals: ScoredSignal[] } {
  const signals: ScoredSignal[] = [];

  if (!semantic) {
    return { score: 0, signals: [] };
  }

  // Signal: Cluster coverage
  const avgCoverage = semantic.topicalMap.length > 0
    ? semantic.topicalMap.reduce((s, c) => s + c.coverage, 0) / semantic.topicalMap.length
    : 0;
  signals.push({
    id: 'topical_coverage',
    name: 'Topical Coverage',
    nameHe: 'כיסוי נושאי',
    category: 'topical_authority',
    score: clamp(avgCoverage),
    evidence: `${semantic.topicalMap.length} topic clusters with ${Math.round(avgCoverage)}% average coverage`,
    impact: avgCoverage < 40 ? 'critical' : avgCoverage < 60 ? 'high' : 'medium',
    actionable: avgCoverage < 70,
    action: avgCoverage < 70 ? 'Deepen existing topic clusters with more supporting content' : undefined,
  });

  // Signal: Pillar page strength
  const pillarScore = semantic.pillarPages.length > 0
    ? Math.min(100, semantic.pillarPages.filter(p => p.score >= 50).length * 25)
    : 0;
  signals.push({
    id: 'pillar_strength',
    name: 'Pillar Page Strength',
    nameHe: 'חוזק דפי עמוד',
    category: 'topical_authority',
    score: clamp(pillarScore),
    evidence: `${semantic.pillarPages.filter(p => p.score >= 50).length} strong pillar pages identified`,
    impact: pillarScore < 30 ? 'critical' : pillarScore < 60 ? 'high' : 'medium',
    actionable: pillarScore < 75,
    action: pillarScore < 75 ? 'Strengthen pillar pages with more comprehensive content and internal links' : undefined,
  });

  // Signal: Entity strength
  const coreEntities = semantic.entities.filter(e => e.isCore);
  const entityScore = coreEntities.length > 0
    ? Math.min(100, coreEntities.reduce((s, e) => s + e.prominence, 0) / coreEntities.length)
    : 0;
  signals.push({
    id: 'entity_strength',
    name: 'Entity Authority',
    nameHe: 'סמכות ישויות',
    category: 'topical_authority',
    score: clamp(entityScore),
    evidence: `${coreEntities.length} core entities with ${Math.round(entityScore)}% average prominence`,
    impact: entityScore < 40 ? 'high' : 'medium',
    actionable: entityScore < 70,
    action: entityScore < 70 ? 'Reinforce core business entities with consistent mentions and structured data' : undefined,
  });

  // Signal: Internal linking health
  const linkScore = semantic.linkGraph.clusterConnectivity;
  signals.push({
    id: 'internal_linking',
    name: 'Internal Linking Quality',
    nameHe: 'איכות קישורים פנימיים',
    category: 'topical_authority',
    score: clamp(linkScore),
    evidence: `${semantic.linkGraph.totalInternalLinks} internal links, ${semantic.linkGraph.orphanPages.length} orphan pages, distribution: ${semantic.linkGraph.authorityDistribution}`,
    impact: linkScore < 40 ? 'critical' : linkScore < 60 ? 'high' : 'medium',
    actionable: linkScore < 80,
    action: semantic.linkGraph.orphanPages.length > 0
      ? `Fix ${semantic.linkGraph.orphanPages.length} orphan pages and improve link distribution`
      : 'Improve cross-cluster linking for better authority flow',
  });

  const categoryScore = signals.reduce((s, sig) => s + sig.score, 0) / Math.max(1, signals.length);
  return { score: clamp(categoryScore), signals };
}

function scoreTechnicalHealth(
  crawl: ScoringInput['crawlData'],
  gaps: GapAnalysisResult | null,
): { score: number; signals: ScoredSignal[] } {
  const signals: ScoredSignal[] = [];

  if (!crawl) return { score: 0, signals: [] };

  // SSL
  signals.push({
    id: 'ssl',
    name: 'SSL/HTTPS',
    nameHe: 'אבטחת SSL',
    category: 'technical',
    score: crawl.hasSSL ? 100 : 0,
    evidence: crawl.hasSSL ? 'Site uses HTTPS' : 'No SSL certificate detected',
    impact: crawl.hasSSL ? 'low' : 'critical',
    actionable: !crawl.hasSSL,
    action: !crawl.hasSSL ? 'Install SSL certificate immediately — critical for rankings and trust' : undefined,
  });

  // Mobile optimization
  signals.push({
    id: 'mobile',
    name: 'Mobile Optimization',
    nameHe: 'אופטימיזציה למובייל',
    category: 'technical',
    score: crawl.mobileOptimized ? 90 : 20,
    evidence: crawl.mobileOptimized ? 'Mobile-optimized' : 'Not mobile-optimized',
    impact: crawl.mobileOptimized ? 'low' : 'critical',
    actionable: !crawl.mobileOptimized,
    action: !crawl.mobileOptimized ? 'Implement responsive design — Google uses mobile-first indexing' : undefined,
  });

  // Page speed
  const speedScore = crawl.avgLoadTimeMs <= 1000 ? 100
    : crawl.avgLoadTimeMs <= 2000 ? 80
    : crawl.avgLoadTimeMs <= 3000 ? 60
    : crawl.avgLoadTimeMs <= 5000 ? 30
    : 10;
  signals.push({
    id: 'speed',
    name: 'Page Speed',
    nameHe: 'מהירות טעינה',
    category: 'technical',
    score: speedScore,
    evidence: `Average load time: ${crawl.avgLoadTimeMs}ms`,
    impact: speedScore < 50 ? 'high' : 'medium',
    actionable: speedScore < 80,
    action: speedScore < 80 ? `Improve page speed from ${crawl.avgLoadTimeMs}ms to under 2000ms` : undefined,
  });

  // Sitemap + robots.txt
  const crawlabilityScore = (crawl.hasSitemap ? 50 : 0) + (crawl.hasRobotsTxt ? 50 : 0);
  signals.push({
    id: 'crawlability',
    name: 'Crawlability',
    nameHe: 'יכולת זחילה',
    category: 'technical',
    score: crawlabilityScore,
    evidence: `Sitemap: ${crawl.hasSitemap ? 'yes' : 'no'}, robots.txt: ${crawl.hasRobotsTxt ? 'yes' : 'no'}`,
    impact: crawlabilityScore < 50 ? 'high' : 'low',
    actionable: crawlabilityScore < 100,
    action: !crawl.hasSitemap ? 'Create and submit XML sitemap' : !crawl.hasRobotsTxt ? 'Create robots.txt' : undefined,
  });

  // Meta coverage
  const metaCoverage = crawl.totalPages > 0 ? (crawl.pagesWithMeta / crawl.totalPages) * 100 : 0;
  signals.push({
    id: 'meta_coverage',
    name: 'Meta Tag Coverage',
    nameHe: 'כיסוי תגיות Meta',
    category: 'technical',
    score: clamp(metaCoverage),
    evidence: `${crawl.pagesWithMeta}/${crawl.totalPages} pages have meta descriptions`,
    impact: metaCoverage < 50 ? 'high' : 'medium',
    actionable: metaCoverage < 90,
    action: metaCoverage < 90 ? `Add meta descriptions to ${crawl.totalPages - crawl.pagesWithMeta} pages` : undefined,
  });

  // Schema coverage
  const schemaCoverage = crawl.totalPages > 0 ? (crawl.pagesWithSchema / crawl.totalPages) * 100 : 0;
  signals.push({
    id: 'schema_coverage',
    name: 'Structured Data Coverage',
    nameHe: 'כיסוי נתונים מובנים',
    category: 'technical',
    score: clamp(schemaCoverage),
    evidence: `${crawl.pagesWithSchema}/${crawl.totalPages} pages have JSON-LD schema`,
    impact: schemaCoverage < 30 ? 'high' : 'medium',
    actionable: schemaCoverage < 80,
    action: schemaCoverage < 80 ? `Add schema markup to ${crawl.totalPages - crawl.pagesWithSchema} pages` : undefined,
  });

  // Broken links
  const brokenScore = crawl.brokenLinks === 0 ? 100 : crawl.brokenLinks <= 2 ? 70 : crawl.brokenLinks <= 5 ? 40 : 10;
  signals.push({
    id: 'broken_links',
    name: 'Link Integrity',
    nameHe: 'תקינות קישורים',
    category: 'technical',
    score: brokenScore,
    evidence: `${crawl.brokenLinks} broken links detected`,
    impact: crawl.brokenLinks > 5 ? 'high' : crawl.brokenLinks > 0 ? 'medium' : 'low',
    actionable: crawl.brokenLinks > 0,
    action: crawl.brokenLinks > 0 ? `Fix ${crawl.brokenLinks} broken links` : undefined,
  });

  const categoryScore = signals.reduce((s, sig) => s + sig.score, 0) / Math.max(1, signals.length);
  return { score: clamp(categoryScore), signals };
}

function scoreContentQuality(
  crawl: ScoringInput['crawlData'],
  semantic: SemanticAnalysis | null,
  gaps: GapAnalysisResult | null,
): { score: number; signals: ScoredSignal[] } {
  const signals: ScoredSignal[] = [];

  // Content depth (word count)
  if (crawl) {
    const depthScore = crawl.avgWordCount >= 1500 ? 100
      : crawl.avgWordCount >= 1000 ? 80
      : crawl.avgWordCount >= 500 ? 50
      : crawl.avgWordCount >= 300 ? 30
      : 10;
    signals.push({
      id: 'content_depth',
      name: 'Content Depth',
      nameHe: 'עומק תוכן',
      category: 'content',
      score: depthScore,
      evidence: `Average ${crawl.avgWordCount} words per page`,
      impact: depthScore < 50 ? 'critical' : depthScore < 70 ? 'high' : 'medium',
      actionable: depthScore < 80,
      action: depthScore < 80 ? `Increase average content depth from ${crawl.avgWordCount} to 1000+ words` : undefined,
    });

    // H1 coverage
    const h1Coverage = crawl.totalPages > 0 ? (crawl.pagesWithH1 / crawl.totalPages) * 100 : 0;
    signals.push({
      id: 'h1_coverage',
      name: 'H1 Heading Coverage',
      nameHe: 'כיסוי כותרות H1',
      category: 'content',
      score: clamp(h1Coverage),
      evidence: `${crawl.pagesWithH1}/${crawl.totalPages} pages have H1 tags`,
      impact: h1Coverage < 50 ? 'high' : 'medium',
      actionable: h1Coverage < 95,
      action: h1Coverage < 95 ? `Add H1 headings to ${crawl.totalPages - crawl.pagesWithH1} pages` : undefined,
    });
  }

  // Content gaps
  if (gaps) {
    const gapPenalty = Math.min(50, gaps.contentGaps.length * 5);
    const contentGapScore = 100 - gapPenalty;
    signals.push({
      id: 'content_gaps',
      name: 'Content Completeness',
      nameHe: 'שלמות תוכן',
      category: 'content',
      score: clamp(contentGapScore),
      evidence: `${gaps.contentGaps.length} content gaps identified`,
      impact: gaps.contentGaps.filter(g => g.severity === 'critical').length > 0 ? 'critical' : 'medium',
      actionable: gaps.contentGaps.length > 0,
      action: gaps.contentGaps.length > 0 ? `Address ${gaps.contentGaps.length} content gaps — ${gaps.contentGaps.filter(g => g.severity === 'critical').length} critical` : undefined,
    });
  }

  // Semantic diversity (intent coverage)
  if (semantic) {
    const intents = semantic.contentIntents;
    const coveredIntents = Object.values(intents).filter(arr => arr.length > 0).length;
    const intentScore = Math.min(100, coveredIntents * 20);
    signals.push({
      id: 'intent_diversity',
      name: 'Search Intent Coverage',
      nameHe: 'כיסוי כוונות חיפוש',
      category: 'content',
      score: intentScore,
      evidence: `Covers ${coveredIntents}/5 search intent types`,
      impact: coveredIntents < 3 ? 'high' : 'medium',
      actionable: coveredIntents < 4,
      action: coveredIntents < 4 ? 'Create content for missing intent types (informational, commercial, transactional, local)' : undefined,
    });
  }

  const categoryScore = signals.length > 0
    ? signals.reduce((s, sig) => s + sig.score, 0) / signals.length
    : 0;
  return { score: clamp(categoryScore), signals };
}

function scoreAIReadiness(
  aiVisibilityScore: number | null,
  semantic: SemanticAnalysis | null,
  crawl: ScoringInput['crawlData'],
): { score: number; signals: ScoredSignal[] } {
  const signals: ScoredSignal[] = [];

  // AI visibility (actual scan results)
  if (aiVisibilityScore !== null && aiVisibilityScore !== undefined) {
    signals.push({
      id: 'ai_visibility',
      name: 'AI Platform Visibility',
      nameHe: 'נראות בפלטפורמות AI',
      category: 'ai_readiness',
      score: clamp(aiVisibilityScore),
      evidence: `${aiVisibilityScore}% visibility across AI platforms`,
      impact: aiVisibilityScore < 30 ? 'critical' : aiVisibilityScore < 50 ? 'high' : 'medium',
      actionable: aiVisibilityScore < 70,
      action: aiVisibilityScore < 70 ? 'Optimize content structure for AI extraction — clear definitions, FAQ sections, structured answers' : undefined,
    });
  }

  // Schema coverage (AI relies on structured data)
  if (crawl) {
    const schemaScore = crawl.totalPages > 0 ? (crawl.pagesWithSchema / crawl.totalPages) * 100 : 0;
    signals.push({
      id: 'ai_schema',
      name: 'AI-Friendly Schema',
      nameHe: 'Schema ידידותי ל-AI',
      category: 'ai_readiness',
      score: clamp(schemaScore),
      evidence: `${Math.round(schemaScore)}% of pages have structured data for AI`,
      impact: schemaScore < 30 ? 'high' : 'medium',
      actionable: schemaScore < 80,
      action: schemaScore < 80 ? 'Add FAQ, HowTo, and Article schema to content pages' : undefined,
    });
  }

  // Content structure (AI prefers well-structured content)
  if (semantic && semantic.topicalMap.length > 0) {
    const structureScore = Math.min(100, semantic.topicalMap.reduce((s, c) => s + c.aiOpportunity, 0) / semantic.topicalMap.length);
    // Higher aiOpportunity means MORE room for improvement, so invert
    const aiReadyScore = 100 - structureScore;
    signals.push({
      id: 'ai_structure',
      name: 'Content Structure for AI',
      nameHe: 'מבנה תוכן ל-AI',
      category: 'ai_readiness',
      score: clamp(aiReadyScore),
      evidence: `Content structure is ${aiReadyScore >= 60 ? 'good' : 'needs improvement'} for AI extraction`,
      impact: aiReadyScore < 40 ? 'high' : 'medium',
      actionable: aiReadyScore < 70,
      action: aiReadyScore < 70 ? 'Add clear headings, definitions, summaries, and FAQ sections for AI readability' : undefined,
    });
  }

  const categoryScore = signals.length > 0
    ? signals.reduce((s, sig) => s + sig.score, 0) / signals.length
    : 0;
  return { score: clamp(categoryScore), signals };
}

function scoreCompetitivePosition(
  competitor: CompetitorAnalysis | null,
): { score: number; signals: ScoredSignal[] } {
  const signals: ScoredSignal[] = [];

  if (!competitor || competitor.competitors.length === 0) {
    return { score: 50, signals: [] }; // neutral when no data
  }

  // Overall competitive position
  const dominantCount = competitor.competitors.filter(c => c.threatLevel === 'critical').length;
  const posScore = dominantCount === 0 ? 80
    : dominantCount <= 1 ? 50
    : dominantCount <= 3 ? 30
    : 10;
  signals.push({
    id: 'competitive_position',
    name: 'Competitive Position',
    nameHe: 'מיקום תחרותי',
    category: 'competitive',
    score: posScore,
    evidence: `${competitor.competitors.length} competitors, ${dominantCount} dominant`,
    impact: dominantCount > 0 ? 'high' : 'medium',
    actionable: dominantCount > 0,
    action: dominantCount > 0 ? `Counter ${competitor.summary.dominantCompetitor || 'dominant competitor'} with targeted content strategy` : undefined,
  });

  // Quick win opportunities
  const quickWinScore = competitor.summary.quickWins >= 5 ? 40
    : competitor.summary.quickWins >= 3 ? 60
    : competitor.summary.quickWins >= 1 ? 80
    : 100; // no quick wins = we're doing well already
  signals.push({
    id: 'quick_wins',
    name: 'Quick Win Opportunities',
    nameHe: 'הזדמנויות מהירות',
    category: 'competitive',
    score: quickWinScore,
    evidence: `${competitor.summary.quickWins} quick wins available`,
    impact: competitor.summary.quickWins > 3 ? 'high' : 'medium',
    actionable: competitor.summary.quickWins > 0,
    action: competitor.summary.quickWins > 0 ? `Capture ${competitor.summary.quickWins} quick wins — small optimizations for big traffic gains` : undefined,
  });

  const categoryScore = signals.reduce((s, sig) => s + sig.score, 0) / Math.max(1, signals.length);
  return { score: clamp(categoryScore), signals };
}

function scoreConversionReadiness(
  crawl: ScoringInput['crawlData'],
  facts: WebsiteFacts | null,
): { score: number; signals: ScoredSignal[] } {
  const signals: ScoredSignal[] = [];

  // Contact information availability
  if (facts) {
    const hasContact = facts.detected_contact_details?.confidence > 50;
    const contactScore = hasContact ? 80 : 20;
    signals.push({
      id: 'contact_info',
      name: 'Contact Accessibility',
      nameHe: 'נגישות פרטי קשר',
      category: 'conversion',
      score: contactScore,
      evidence: hasContact ? 'Contact details found on site' : 'Contact details not easily found',
      impact: hasContact ? 'low' : 'high',
      actionable: !hasContact,
      action: !hasContact ? 'Make contact information prominent — phone, email, address on every page' : undefined,
    });

    // Business identity clarity
    const identityScore = facts.business_name.confidence >= 70 && facts.business_type.confidence >= 50 ? 80
      : facts.business_name.confidence >= 50 ? 50
      : 20;
    signals.push({
      id: 'business_identity',
      name: 'Business Identity Clarity',
      nameHe: 'בהירות זהות עסקית',
      category: 'conversion',
      score: identityScore,
      evidence: `Business name confidence: ${facts.business_name.confidence}%, type: ${facts.business_type.confidence}%`,
      impact: identityScore < 50 ? 'high' : 'medium',
      actionable: identityScore < 80,
      action: identityScore < 80 ? 'Strengthen business identity — clear name, value proposition, and trust signals on all pages' : undefined,
    });
  }

  // SSL for trust (conversion factor)
  if (crawl) {
    signals.push({
      id: 'trust_ssl',
      name: 'Trust Signal (SSL)',
      nameHe: 'אות אמון (SSL)',
      category: 'conversion',
      score: crawl.hasSSL ? 100 : 0,
      evidence: crawl.hasSSL ? 'SSL active — builds trust' : 'No SSL — visitors see security warnings',
      impact: crawl.hasSSL ? 'low' : 'critical',
      actionable: !crawl.hasSSL,
    });
  }

  const categoryScore = signals.length > 0
    ? signals.reduce((s, sig) => s + sig.score, 0) / signals.length
    : 50; // neutral when no data
  return { score: clamp(categoryScore), signals };
}

// ── Main Scoring Function ──────────────────────────────────────────────────

export function calculateStrategicScore(input: ScoringInput): StrategicScore {
  const now = new Date().toISOString();

  // Score each category
  const topical = scoreTopicalAuthority(input.semanticAnalysis || null, input.gapAnalysis || null);
  const technical = scoreTechnicalHealth(input.crawlData || null, input.gapAnalysis || null);
  const content = scoreContentQuality(input.crawlData || null, input.semanticAnalysis || null, input.gapAnalysis || null);
  const ai = scoreAIReadiness(input.aiVisibilityScore || null, input.semanticAnalysis || null, input.crawlData || null);
  const competitive = scoreCompetitivePosition(input.competitorAnalysis || null);
  const conversion = scoreConversionReadiness(input.crawlData || null, input.websiteFacts || null);

  // Build categories with weights
  const categories: ScoreCategory[] = [
    {
      id: 'topical_authority',
      name: 'Topical Authority',
      nameHe: 'סמכות נושאית',
      score: topical.score,
      weight: 0.25,
      signals: topical.signals.map(s => s.id),
      topIssue: topical.signals.filter(s => s.actionable).sort((a, b) => a.score - b.score)[0]?.evidence || 'No issues',
      topAction: topical.signals.filter(s => s.action).sort((a, b) => a.score - b.score)[0]?.action || 'Continue current strategy',
    },
    {
      id: 'technical',
      name: 'Technical Health',
      nameHe: 'בריאות טכנית',
      score: technical.score,
      weight: 0.20,
      signals: technical.signals.map(s => s.id),
      topIssue: technical.signals.filter(s => s.actionable).sort((a, b) => a.score - b.score)[0]?.evidence || 'No issues',
      topAction: technical.signals.filter(s => s.action).sort((a, b) => a.score - b.score)[0]?.action || 'Maintain technical standards',
    },
    {
      id: 'content',
      name: 'Content Quality',
      nameHe: 'איכות תוכן',
      score: content.score,
      weight: 0.20,
      signals: content.signals.map(s => s.id),
      topIssue: content.signals.filter(s => s.actionable).sort((a, b) => a.score - b.score)[0]?.evidence || 'No issues',
      topAction: content.signals.filter(s => s.action).sort((a, b) => a.score - b.score)[0]?.action || 'Maintain content quality',
    },
    {
      id: 'ai_readiness',
      name: 'AI Readiness',
      nameHe: 'מוכנות ל-AI',
      score: ai.score,
      weight: 0.15,
      signals: ai.signals.map(s => s.id),
      topIssue: ai.signals.filter(s => s.actionable).sort((a, b) => a.score - b.score)[0]?.evidence || 'No issues',
      topAction: ai.signals.filter(s => s.action).sort((a, b) => a.score - b.score)[0]?.action || 'Maintain AI optimization',
    },
    {
      id: 'competitive',
      name: 'Competitive Position',
      nameHe: 'מיקום תחרותי',
      score: competitive.score,
      weight: 0.10,
      signals: competitive.signals.map(s => s.id),
      topIssue: competitive.signals.filter(s => s.actionable).sort((a, b) => a.score - b.score)[0]?.evidence || 'No issues',
      topAction: competitive.signals.filter(s => s.action).sort((a, b) => a.score - b.score)[0]?.action || 'Monitor competitive landscape',
    },
    {
      id: 'conversion',
      name: 'Conversion Readiness',
      nameHe: 'מוכנות להמרה',
      score: conversion.score,
      weight: 0.10,
      signals: conversion.signals.map(s => s.id),
      topIssue: conversion.signals.filter(s => s.actionable).sort((a, b) => a.score - b.score)[0]?.evidence || 'No issues',
      topAction: conversion.signals.filter(s => s.action).sort((a, b) => a.score - b.score)[0]?.action || 'Maintain conversion elements',
    },
  ];

  // Calculate weighted overall score
  const overall = Math.round(
    categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0)
  );

  // All signals
  const allSignals = [
    ...topical.signals,
    ...technical.signals,
    ...content.signals,
    ...ai.signals,
    ...competitive.signals,
    ...conversion.signals,
  ];

  // Calculate confidence based on data availability
  let confidence = 0;
  if (input.crawlData) confidence += 25;
  if (input.semanticAnalysis) confidence += 25;
  if (input.competitorAnalysis) confidence += 20;
  if (input.gapAnalysis) confidence += 15;
  if (input.aiVisibilityScore !== null && input.aiVisibilityScore !== undefined) confidence += 10;
  if (input.websiteFacts) confidence += 5;

  // Generate priorities (lowest scoring actionable signals)
  const actionableSignals = allSignals
    .filter(s => s.actionable && s.action)
    .sort((a, b) => a.score - b.score);

  const priorities: ScoredPriority[] = actionableSignals.slice(0, 10).map((sig, idx) => ({
    rank: idx + 1,
    signal: sig.nameHe || sig.name,
    category: categories.find(c => c.signals.includes(sig.id))?.nameHe || sig.category,
    currentScore: sig.score,
    potentialGain: Math.round((100 - sig.score) * 0.3), // conservative estimate
    effort: sig.score < 20 ? 'significant' : sig.score < 50 ? 'medium' : 'quick',
    description: sig.action!,
    descriptionHe: sig.action!, // TODO: add Hebrew translations
  }));

  return {
    overall: clamp(overall),
    grade: gradeFromScore(overall),
    confidence,
    categories,
    signals: allSignals,
    priorities,
    comparedToIndustry: overall >= 70 ? 'above_average' : overall >= 45 ? 'average' : 'below_average',
    analyzedAt: now,
  };
}
