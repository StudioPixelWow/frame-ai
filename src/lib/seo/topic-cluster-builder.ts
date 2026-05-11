// ============================================================================
// מנוע אשכולות נושאיים — Topic Cluster Builder
// מזהה אשכולות נושאיים, מנתח סמכות נושאית, ומייצר המלצות לחיזוק
// ============================================================================

import { ContentItem, ContentInventory } from './wp-content-inventory';
import { AutomationContext } from './seo-automator';
import { SEOActionEntry } from './seo-action-log';
import { generateWithAI } from '@/lib/ai/openai-client';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

/** אשכול נושאי — קבוצת דפים סביב נושא מרכזי */
export interface TopicCluster {
  id: string;
  topic: string;
  pillarPage: { pageId: number; pageUrl: string; pageTitle: string } | null;
  supportingPages: Array<{ pageId: number; pageUrl: string; pageTitle: string; relevanceScore: number }>;
  coverage: number;           // 0-100 כמה טוב הנושא מכוסה
  authority: number;          // 0-100 ציון סמכות נושאית
  internalLinkDensity: number; // ממוצע קישורים פנימיים בין דפי האשכול
  missingSubtopics: string[];
  recommendations: ClusterRecommendation[];
}

/** המלצה לשיפור אשכול */
export interface ClusterRecommendation {
  type: 'create_pillar' | 'create_supporting' | 'add_link' | 'strengthen_pillar' | 'merge_weak' | 'expand_coverage';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;       // עברית
  expectedImpact: string;    // עברית
  targetKeyword?: string;
  relatedPages?: string[];
}

/** תוצאת ניתוח אשכולות מלאה */
export interface ClusterAnalysisResult {
  clusters: TopicCluster[];
  overallTopicalAuthority: number;  // 0-100
  strongestClusters: TopicCluster[];
  weakestClusters: TopicCluster[];
  orphanContent: ContentItem[];  // דפים שלא שייכים לשום אשכול
  recommendations: ClusterRecommendation[];
  actions: SEOActionEntry[];
}

// ============================================================================
// קבועים — Constants
// ============================================================================

/** מספר מינימלי של דפים תומכים לאשכול חזק */
const MIN_SUPPORTING_PAGES = 3;

/** ספי ניקוד לדירוג אשכולות */
const AUTHORITY_THRESHOLDS = {
  strong: 70,
  moderate: 40,
  weak: 20,
};

/** ניקוד עבור רכיבי עמוד עוגן */
const PILLAR_SCORING = {
  hasPillar: 25,
  supportingPagesMax: 25,
  internalLinksMax: 25,
  semanticDepthMax: 25,
};

// ============================================================================
// עוזרים — Helper Functions
// ============================================================================

/**
 * יצירת מזהה ייחודי לאשכול מתוך שם הנושא
 */
function generateClusterId(topic: string): string {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-zא-ת0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return `cluster-${slug}-${Date.now().toString(36)}`;
}

/**
 * בדיקה אם דף רלוונטי לנושא מסוים
 * מחזיר ציון רלוונטיות 0-100
 */
function calculatePageRelevance(page: ContentItem, topic: string): number {
  const topicLower = topic.toLowerCase();
  const topicWords = topicLower.split(/\s+/).filter(w => w.length > 2);
  let score = 0;

  // בדיקת כותרת — משקל גבוה
  const titleLower = page.title.toLowerCase();
  if (titleLower.includes(topicLower)) {
    score += 40; // התאמה מלאה בכותרת
  } else {
    const titleMatches = topicWords.filter(w => titleLower.includes(w)).length;
    score += Math.min(25, (titleMatches / topicWords.length) * 25);
  }

  // בדיקת Yoast focus keyword
  if (page.yoastMeta?.focusKeyword) {
    const focusLower = page.yoastMeta.focusKeyword.toLowerCase();
    if (focusLower.includes(topicLower) || topicLower.includes(focusLower)) {
      score += 20;
    }
  }

  // בדיקת כותרות H2/H3 — מעידות על כיסוי הנושא
  const headingMatches = page.headings.filter(h =>
    h.text.toLowerCase().includes(topicLower) ||
    topicWords.some(w => h.text.toLowerCase().includes(w))
  ).length;
  score += Math.min(15, headingMatches * 5);

  // בדיקת תוכן — גוף הטקסט
  const textLower = page.plainText.toLowerCase();
  const contentOccurrences = (textLower.match(new RegExp(escapeRegex(topicLower), 'g')) || []).length;
  score += Math.min(15, contentOccurrences * 3);

  // בדיקת קטגוריות ותגיות
  const categoriesMatch = (page.categories || []).some(c => c.toLowerCase().includes(topicLower));
  const tagsMatch = (page.tags || []).some(t => t.toLowerCase().includes(topicLower));
  if (categoriesMatch) score += 5;
  if (tagsMatch) score += 5;

  return Math.min(100, score);
}

/**
 * בריחת תווים מיוחדים ב-regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * זיהוי עמוד עוגן — העמוד המרכזי ביותר באשכול
 * קריטריונים: אורך תוכן, קישורים נכנסים, URL קצר
 */
function detectPillarPage(
  pages: Array<{ page: ContentItem; relevance: number }>,
  inventory: ContentInventory
): ContentItem | null {
  if (pages.length === 0) return null;

  // ניקוד כל דף כמועמד לעמוד עוגן
  const scored = pages.map(({ page }) => {
    let pillarScore = 0;

    // אורך תוכן — עמוד עוגן צריך להיות מקיף
    if (page.wordCount >= 2000) pillarScore += 30;
    else if (page.wordCount >= 1000) pillarScore += 20;
    else if (page.wordCount >= 500) pillarScore += 10;

    // קישורים נכנסים — כמה דפים מקשרים לדף הזה
    const inboundLinks = countInboundLinks(page.id, inventory);
    pillarScore += Math.min(25, inboundLinks * 5);

    // URL קצר — עמוד עוגן בדרך כלל ברמה גבוהה
    const slugDepth = (page.slug.match(/\//g) || []).length;
    if (slugDepth === 0) pillarScore += 20;
    else if (slugDepth === 1) pillarScore += 10;

    // נוכחות Schema ו-FAQ מחזקת סמכות
    if (page.hasSchema) pillarScore += 10;
    if (page.hasFAQ) pillarScore += 10;

    // מספר כותרות H2 — מעיד על עומק
    pillarScore += Math.min(10, page.h2Count * 2);

    // דף מסוג page עדיף על post כעמוד עוגן
    if (page.type === 'page') pillarScore += 5;

    return { page, pillarScore };
  });

  // מיון לפי ניקוד ובחירת הטוב ביותר
  scored.sort((a, b) => b.pillarScore - a.pillarScore);
  return scored[0].page;
}

/**
 * ספירת קישורים נכנסים לדף
 */
function countInboundLinks(pageId: number, inventory: ContentInventory): number {
  let count = 0;
  inventory.internalLinkMap.forEach((linkedIds) => {
    if (linkedIds.includes(pageId)) count++;
  });
  return count;
}

/**
 * חישוב צפיפות קישורים פנימיים בתוך אשכול
 * ממוצע מספר הקישורים בין דפי האשכול חלקי מספר הדפים
 */
function calculateInternalLinkDensity(
  pageIds: number[],
  inventory: ContentInventory
): number {
  if (pageIds.length <= 1) return 0;

  let totalLinks = 0;
  const pageIdSet = new Set(pageIds);

  for (const pageId of pageIds) {
    const linkedIds = inventory.internalLinkMap.get(pageId) || [];
    // ספירת קישורים רק לדפים אחרים באשכול
    const clusterLinks = linkedIds.filter(id => pageIdSet.has(id) && id !== pageId);
    totalLinks += clusterLinks.length;
  }

  // ממוצע קישורים לכל דף
  return totalLinks / pageIds.length;
}

/**
 * חישוב כיסוי נושאי — כמה תת-נושאים מכוסים
 */
function calculateCoverage(
  pages: ContentItem[],
  topic: string
): number {
  if (pages.length === 0) return 0;

  // תת-נושאים נפוצים: שאלות, מדריכים, השוואות, מחירים, דוגמאות
  const commonSubtopicPatterns = [
    'מה זה', 'איך', 'למה', 'מתי', 'כמה עולה',
    'מדריך', 'טיפים', 'יתרונות', 'חסרונות', 'השוואה',
    'מחיר', 'עלות', 'דוגמאות', 'סוגים', 'שאלות נפוצות',
  ];

  // בדיקה כמה דפוסי תת-נושאים מכוסים בדפים הקיימים
  let coveredPatterns = 0;
  const allText = pages.map(p => p.plainText.toLowerCase()).join(' ');
  const allHeadings = pages.flatMap(p => p.headings.map(h => h.text.toLowerCase())).join(' ');

  for (const pattern of commonSubtopicPatterns) {
    if (allText.includes(pattern) || allHeadings.includes(pattern)) {
      coveredPatterns++;
    }
  }

  // ניקוד בסיסי מכמות דפים (עד 40 נקודות)
  const pageCountScore = Math.min(40, pages.length * 10);

  // ניקוד ממגוון תת-נושאים (עד 40 נקודות)
  const subtopicScore = Math.min(40, (coveredPatterns / commonSubtopicPatterns.length) * 40);

  // ניקוד מעומק תוכן (עד 20 נקודות)
  const totalWords = pages.reduce((sum, p) => sum + p.wordCount, 0);
  const depthScore = Math.min(20, (totalWords / 5000) * 20);

  return Math.round(pageCountScore + subtopicScore + depthScore);
}

/**
 * חישוב סמכות נושאית של אשכול
 */
function calculateAuthority(
  pages: ContentItem[],
  pillarPage: ContentItem | null,
  inventory: ContentInventory
): number {
  if (pages.length === 0) return 0;

  let score = 0;

  // סמכות עמוד עוגן (עד 30 נקודות)
  if (pillarPage) {
    const wordScore = Math.min(15, (pillarPage.wordCount / 2000) * 15);
    const schemaBonus = pillarPage.hasSchema ? 5 : 0;
    const faqBonus = pillarPage.hasFAQ ? 5 : 0;
    const headingBonus = Math.min(5, pillarPage.h2Count);
    score += wordScore + schemaBonus + faqBonus + headingBonus;
  }

  // כמות דפים תומכים (עד 25 נקודות)
  score += Math.min(25, pages.length * 5);

  // צפיפות קישורים פנימיים (עד 25 נקודות)
  const pageIds = pages.map(p => p.id);
  const linkDensity = calculateInternalLinkDensity(pageIds, inventory);
  score += Math.min(25, linkDensity * 10);

  // Schema ו-FAQ באשכול (עד 20 נקודות)
  const schemaCount = pages.filter(p => p.hasSchema).length;
  const faqCount = pages.filter(p => p.hasFAQ).length;
  score += Math.min(10, (schemaCount / pages.length) * 10);
  score += Math.min(10, (faqCount / pages.length) * 10);

  return Math.round(Math.min(100, score));
}

// ============================================================================
// פונקציות ראשיות — Main Functions
// ============================================================================

/**
 * זיהוי אשכולות נושאיים מתוך מלאי התוכן
 * משתמש במילות מפתח, מוצרים וסוג עסק להגדרת אשכולות צפויים
 */
export function identifyTopicClusters(
  inventory: ContentInventory,
  context: AutomationContext
): TopicCluster[] {
  const clusters: TopicCluster[] = [];

  // בניית רשימת נושאים מצפויים — מילות מפתח + מוצרים
  const topics = new Set<string>();
  for (const kw of context.targetKeywords) {
    topics.add(kw);
  }
  for (const product of context.products) {
    topics.add(product);
  }
  // הוספת סוג העסק כנושא אם אינו כבר ברשימה
  if (context.businessType && !topics.has(context.businessType)) {
    topics.add(context.businessType);
  }

  // עבור כל נושא — זיהוי דפים רלוונטיים וסיווגם
  for (const topic of topics) {
    // מציאת כל הדפים הרלוונטיים לנושא
    const relevantPages = inventory.items
      .map(page => ({
        page,
        relevance: calculatePageRelevance(page, topic),
      }))
      .filter(({ relevance }) => relevance >= 15) // סף מינימלי לרלוונטיות
      .sort((a, b) => b.relevance - a.relevance);

    if (relevantPages.length === 0) {
      // נושא ללא כיסוי כלל — אשכול ריק עם המלצות
      clusters.push({
        id: generateClusterId(topic),
        topic,
        pillarPage: null,
        supportingPages: [],
        coverage: 0,
        authority: 0,
        internalLinkDensity: 0,
        missingSubtopics: [`עמוד ראשי בנושא ${topic}`, `מדריך מקיף ל${topic}`, `שאלות נפוצות על ${topic}`],
        recommendations: [],
      });
      continue;
    }

    // זיהוי עמוד עוגן
    const pillarPage = detectPillarPage(relevantPages, inventory);

    // הגדרת דפים תומכים — כל הדפים מלבד עמוד העוגן
    const supportingPages = relevantPages
      .filter(({ page }) => !pillarPage || page.id !== pillarPage.id)
      .map(({ page, relevance }) => ({
        pageId: page.id,
        pageUrl: page.url,
        pageTitle: page.title,
        relevanceScore: relevance,
      }));

    // חישוב מדדים
    const allClusterPages = relevantPages.map(({ page }) => page);
    const pageIds = allClusterPages.map(p => p.id);
    const coverage = calculateCoverage(allClusterPages, topic);
    const authority = calculateAuthority(allClusterPages, pillarPage, inventory);
    const internalLinkDensity = calculateInternalLinkDensity(pageIds, inventory);

    // זיהוי תת-נושאים חסרים בצורה בסיסית (ללא AI)
    const missingSubtopics = findBasicMissingSubtopics(topic, allClusterPages);

    clusters.push({
      id: generateClusterId(topic),
      topic,
      pillarPage: pillarPage
        ? { pageId: pillarPage.id, pageUrl: pillarPage.url, pageTitle: pillarPage.title }
        : null,
      supportingPages,
      coverage,
      authority,
      internalLinkDensity: Math.round(internalLinkDensity * 100) / 100,
      missingSubtopics,
      recommendations: [], // ימולא בשלב ההמלצות
    });
  }

  return clusters;
}

/**
 * זיהוי תת-נושאים חסרים ללא שימוש ב-AI
 * בודק תבניות נפוצות שלא קיימות בתוכן הנוכחי
 */
function findBasicMissingSubtopics(topic: string, pages: ContentItem[]): string[] {
  const missing: string[] = [];
  const allText = pages.map(p => p.plainText.toLowerCase()).join(' ');
  const allHeadings = pages.flatMap(p => p.headings.map(h => h.text.toLowerCase())).join(' ');
  const combined = allText + ' ' + allHeadings;

  // תבניות תוכן שכדאי שיהיו לכל נושא
  const expectedPatterns: Array<{ pattern: string; subtopic: string }> = [
    { pattern: 'מדריך', subtopic: `מדריך מקיף ל${topic}` },
    { pattern: 'מחיר', subtopic: `מחירי ${topic} — כמה עולה ומה משפיע` },
    { pattern: 'שאלות נפוצות', subtopic: `שאלות נפוצות על ${topic}` },
    { pattern: 'יתרונות', subtopic: `יתרונות וחסרונות של ${topic}` },
    { pattern: 'השוואה', subtopic: `השוואת ${topic} — מה עדיף` },
    { pattern: 'טיפים', subtopic: `טיפים לבחירת ${topic}` },
    { pattern: 'סוגים', subtopic: `סוגים שונים של ${topic}` },
    { pattern: 'תהליך', subtopic: `תהליך העבודה ב${topic}` },
    { pattern: 'המלצות', subtopic: `המלצות מומחים ל${topic}` },
  ];

  for (const { pattern, subtopic } of expectedPatterns) {
    if (!combined.includes(pattern)) {
      missing.push(subtopic);
    }
  }

  return missing;
}

// ============================================================================
// ניתוח עוצמת אשכול — Cluster Strength Analysis
// ============================================================================

/**
 * ניתוח עוצמת אשכול בודד
 * ציון 0-100 המבוסס על: עמוד עוגן, דפים תומכים, קישורים, עומק סמנטי
 */
export function analyzeClusterStrength(
  cluster: TopicCluster,
  inventory: ContentInventory
): number {
  let score = 0;

  // 1) קיום עמוד עוגן (25 נקודות)
  if (cluster.pillarPage) {
    score += PILLAR_SCORING.hasPillar;
  }

  // 2) כמות דפים תומכים (מקסימום 25 נקודות עבור 5+)
  const supportingCount = cluster.supportingPages.length;
  const supportingScore = Math.min(
    PILLAR_SCORING.supportingPagesMax,
    (supportingCount / 5) * PILLAR_SCORING.supportingPagesMax
  );
  score += supportingScore;

  // 3) קישורים פנימיים בין דפי האשכול (25 נקודות)
  const allPageIds = [
    ...(cluster.pillarPage ? [cluster.pillarPage.pageId] : []),
    ...cluster.supportingPages.map(p => p.pageId),
  ];
  const linkDensity = calculateInternalLinkDensity(allPageIds, inventory);
  // צפיפות 2+ נחשבת מעולה
  const linkScore = Math.min(
    PILLAR_SCORING.internalLinksMax,
    (linkDensity / 2) * PILLAR_SCORING.internalLinksMax
  );
  score += linkScore;

  // 4) עומק סמנטי של עמוד העוגן (25 נקודות)
  if (cluster.pillarPage) {
    const pillar = inventory.items.find(p => p.id === cluster.pillarPage!.pageId);
    if (pillar) {
      let depthScore = 0;
      // אורך תוכן (עד 8 נקודות)
      depthScore += Math.min(8, (pillar.wordCount / 2500) * 8);
      // כמות כותרות H2 (עד 5 נקודות)
      depthScore += Math.min(5, pillar.h2Count);
      // Schema (3 נקודות)
      if (pillar.hasSchema) depthScore += 3;
      // FAQ (3 נקודות)
      if (pillar.hasFAQ) depthScore += 3;
      // CTA (2 נקודות)
      if (pillar.hasCTA) depthScore += 2;
      // קישורים יוצאים לדפים תומכים (עד 4 נקודות)
      const outboundLinks = inventory.internalLinkMap.get(pillar.id) || [];
      const linksToCluster = outboundLinks.filter(id =>
        cluster.supportingPages.some(sp => sp.pageId === id)
      ).length;
      depthScore += Math.min(4, linksToCluster * 2);

      score += Math.min(PILLAR_SCORING.semanticDepthMax, depthScore);
    }
  }

  return Math.round(Math.min(100, score));
}

// ============================================================================
// יצירת תת-נושאים חסרים באמצעות AI
// ============================================================================

/**
 * יצירת רשימת תת-נושאים חסרים בעזרת AI
 * מחזירה 5-10 כותרות של תת-נושאים שהאתר לא מכסה
 */
export async function generateMissingSubtopics(
  topic: string,
  existingPages: string[],
  context: AutomationContext
): Promise<string[]> {
  const systemPrompt = `אתה מומחה SEO ישראלי המתמחה באסטרטגיית תוכן ואשכולות נושאיים.
תפקידך לזהות תת-נושאים חסרים שעסק צריך לכסות כדי לבנות סמכות נושאית מלאה.
ענה אך ורק בעברית. החזר רשימת כותרות בפורמט JSON.`;

  const existingList = existingPages.length > 0
    ? existingPages.map((p, i) => `${i + 1}. ${p}`).join('\n')
    : 'אין דפים קיימים';

  const userPrompt = `נושא ראשי: ${topic}
סוג עסק: ${context.businessType}
תעשייה: ${context.industry}
מיקום: ${context.location}
מוצרים/שירותים: ${context.products.join(', ')}

דפים קיימים באתר בנושא:
${existingList}

צור רשימה של 5-10 תת-נושאים חסרים שהאתר צריך לכסות כדי לבנות סמכות נושאית מלאה בנושא "${topic}".
כל תת-נושא צריך להיות כותרת מאמר מוכנה לפרסום.
התמקד בנושאים עם פוטנציאל חיפוש גבוה.

החזר תשובה בפורמט JSON בלבד:
{ "subtopics": ["כותרת 1", "כותרת 2", ...] }`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: 1000,
    });

    if (!result.success || !result.data) {
      // במקרה כשל — החזרת תת-נושאים גנריים
      return generateFallbackSubtopics(topic);
    }

    // פרסור תשובת AI
    const responseText = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = responseText.match(/\{[\s\S]*"subtopics"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.subtopics) && parsed.subtopics.length > 0) {
        return parsed.subtopics.slice(0, 10);
      }
    }

    return generateFallbackSubtopics(topic);
  } catch (error) {
    console.error('[TopicCluster] שגיאה ביצירת תת-נושאים:', error);
    return generateFallbackSubtopics(topic);
  }
}

/**
 * תת-נושאים גנריים למקרה שה-AI לא זמין
 */
function generateFallbackSubtopics(topic: string): string[] {
  return [
    `מדריך מקיף ל${topic} — כל מה שצריך לדעת`,
    `כמה עולה ${topic}? מחירון מעודכן`,
    `${topic} — שאלות נפוצות ותשובות`,
    `5 טיפים לבחירת ${topic} הטוב ביותר`,
    `יתרונות וחסרונות של ${topic}`,
  ];
}

// ============================================================================
// בניית המלצות — Recommendation Builder
// ============================================================================

/**
 * בניית המלצות לשיפור אשכולות נושאיים
 * מנתח כל אשכול ומייצר המלצות ממוקדות
 */
export function buildClusterRecommendations(
  clusters: TopicCluster[],
  inventory: ContentInventory,
  context: AutomationContext
): ClusterRecommendation[] {
  const recommendations: ClusterRecommendation[] = [];

  // זיהוי נושאים בעלי ערך גבוה — מילות מפתח ראשיות
  const highValueTopics = new Set(context.targetKeywords.slice(0, 5));

  for (const cluster of clusters) {
    const isHighValue = highValueTopics.has(cluster.topic);

    // אשכול ללא עמוד עוגן — המלצה קריטית
    if (!cluster.pillarPage) {
      recommendations.push({
        type: 'create_pillar',
        priority: isHighValue ? 'critical' : 'high',
        description: `יצירת עמוד עוגן מקיף בנושא "${cluster.topic}" — עמוד ראשי שמרכז את כל המידע`,
        expectedImpact: `עמוד עוגן חזק יבנה סמכות נושאית ויעזור לדרג את כל הדפים הקשורים ל"${cluster.topic}" גבוה יותר`,
        targetKeyword: cluster.topic,
      });
      continue; // אם אין עמוד עוגן, שאר ההמלצות פחות רלוונטיות
    }

    // אשכול עם מעט דפים תומכים — נדרש תוכן נוסף
    if (cluster.supportingPages.length < MIN_SUPPORTING_PAGES && isHighValue) {
      const needed = MIN_SUPPORTING_PAGES - cluster.supportingPages.length;
      recommendations.push({
        type: 'create_supporting',
        priority: 'high',
        description: `יצירת ${needed} מאמרים תומכים בנושא "${cluster.topic}" לחיזוק האשכול הנושאי`,
        expectedImpact: `הוספת תוכן תומך תגדיל את הכיסוי הנושאי ותחזק את דירוג עמוד העוגן`,
        targetKeyword: cluster.topic,
        relatedPages: cluster.missingSubtopics.slice(0, needed),
      });
    }

    // צפיפות קישורים פנימיים נמוכה — חסר חיבור בין הדפים
    if (cluster.internalLinkDensity < 1 && cluster.supportingPages.length > 0) {
      const pagesWithoutLinks = findPagesWithoutClusterLinks(cluster, inventory);
      recommendations.push({
        type: 'add_link',
        priority: cluster.internalLinkDensity === 0 ? 'high' : 'medium',
        description: `הוספת קישורים פנימיים בין דפי אשכול "${cluster.topic}" — ${pagesWithoutLinks.length} דפים לא מקושרים`,
        expectedImpact: `קישור פנימי בין דפי האשכול מעביר סמכות ועוזר לגוגל להבין את מבנה התוכן`,
        targetKeyword: cluster.topic,
        relatedPages: pagesWithoutLinks,
      });
    }

    // עמוד עוגן חלש — חסרים רכיבים חשובים
    if (cluster.pillarPage) {
      const pillar = inventory.items.find(p => p.id === cluster.pillarPage!.pageId);
      if (pillar) {
        const weaknesses: string[] = [];
        if (pillar.wordCount < 1500) weaknesses.push('תוכן קצר');
        if (!pillar.hasFAQ) weaknesses.push('חסר FAQ');
        if (!pillar.hasSchema) weaknesses.push('חסר Schema');
        if (pillar.h2Count < 3) weaknesses.push('מעט כותרות');
        if (!pillar.hasCTA) weaknesses.push('חסר CTA');

        if (weaknesses.length >= 2) {
          recommendations.push({
            type: 'strengthen_pillar',
            priority: isHighValue ? 'high' : 'medium',
            description: `חיזוק עמוד העוגן "${pillar.title}" — ${weaknesses.join(', ')}`,
            expectedImpact: `עמוד עוגן מקיף יותר ישפר דירוג ויחזק את כל האשכול הנושאי`,
            targetKeyword: cluster.topic,
            relatedPages: [pillar.url],
          });
        }
      }
    }

    // חיפוש אשכולות חופפים שכדאי למזג
    const overlapping = findOverlappingClusters(cluster, clusters);
    if (overlapping.length > 0) {
      recommendations.push({
        type: 'merge_weak',
        priority: 'low',
        description: `שקול מיזוג אשכול "${cluster.topic}" עם: ${overlapping.map(c => c.topic).join(', ')} — חפיפה בדפים`,
        expectedImpact: `מיזוג אשכולות חופפים ימנע קניבליזציה ויחזק את הסמכות הנושאית המשולבת`,
        targetKeyword: cluster.topic,
      });
    }

    // כיסוי נמוך — נדרש הרחבת תוכן
    if (cluster.coverage < 40 && cluster.supportingPages.length >= MIN_SUPPORTING_PAGES) {
      recommendations.push({
        type: 'expand_coverage',
        priority: isHighValue ? 'medium' : 'low',
        description: `הרחבת הכיסוי הנושאי של "${cluster.topic}" — כיסוי נוכחי ${cluster.coverage}%`,
        expectedImpact: `כיסוי רחב יותר של תת-נושאים ישפר את הסמכות הנושאית ויתפוס יותר מילות מפתח ארוכות-זנב`,
        targetKeyword: cluster.topic,
        relatedPages: cluster.missingSubtopics.slice(0, 3),
      });
    }
  }

  // מיון לפי עדיפות
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

/**
 * מציאת דפים באשכול שלא מקושרים לדפים אחרים באשכול
 */
function findPagesWithoutClusterLinks(
  cluster: TopicCluster,
  inventory: ContentInventory
): string[] {
  const clusterPageIds = new Set([
    ...(cluster.pillarPage ? [cluster.pillarPage.pageId] : []),
    ...cluster.supportingPages.map(p => p.pageId),
  ]);

  const unlinkedPages: string[] = [];

  for (const pageId of clusterPageIds) {
    const linkedIds = inventory.internalLinkMap.get(pageId) || [];
    const hasClusterLink = linkedIds.some(id => clusterPageIds.has(id) && id !== pageId);
    if (!hasClusterLink) {
      const page = inventory.items.find(p => p.id === pageId);
      if (page) unlinkedPages.push(page.url);
    }
  }

  return unlinkedPages;
}

/**
 * מציאת אשכולות חופפים — אשכולות ששותפים דפים
 */
function findOverlappingClusters(
  cluster: TopicCluster,
  allClusters: TopicCluster[]
): TopicCluster[] {
  const clusterPageIds = new Set([
    ...(cluster.pillarPage ? [cluster.pillarPage.pageId] : []),
    ...cluster.supportingPages.map(p => p.pageId),
  ]);

  return allClusters.filter(other => {
    if (other.id === cluster.id) return false;

    const otherPageIds = [
      ...(other.pillarPage ? [other.pillarPage.pageId] : []),
      ...other.supportingPages.map(p => p.pageId),
    ];

    // חפיפה אם יותר מ-50% מהדפים משותפים
    const sharedCount = otherPageIds.filter(id => clusterPageIds.has(id)).length;
    const minSize = Math.min(clusterPageIds.size, otherPageIds.length);
    return minSize > 0 && sharedCount / minSize > 0.5;
  });
}

// ============================================================================
// ניתוח אשכולות ראשי — Main Cluster Analysis
// ============================================================================

/**
 * הרצת ניתוח אשכולות מלא
 * נקודת כניסה ראשית — מריצה את כל השלבים ומחזירה תוצאות מלאות
 */
export async function executeClusterAnalysis(
  inventory: ContentInventory,
  context: AutomationContext,
  options?: { generateMissing?: boolean }
): Promise<ClusterAnalysisResult> {
  const actions: SEOActionEntry[] = [];
  const analysisDate = new Date().toISOString();

  // שלב 1: זיהוי אשכולות נושאיים
  const clusters = identifyTopicClusters(inventory, context);

  // שלב 2: ניתוח עוצמה לכל אשכול
  for (const cluster of clusters) {
    const strength = analyzeClusterStrength(cluster, inventory);
    // עדכון ציון הסמכות בהתאם לניתוח העוצמה
    cluster.authority = Math.round((cluster.authority + strength) / 2);
  }

  // שלב 3: יצירת תת-נושאים חסרים באמצעות AI (אם נדרש)
  if (options?.generateMissing) {
    for (const cluster of clusters) {
      try {
        const existingTitles = [
          ...(cluster.pillarPage ? [cluster.pillarPage.pageTitle] : []),
          ...cluster.supportingPages.map(p => p.pageTitle),
        ];
        const aiSubtopics = await generateMissingSubtopics(
          cluster.topic,
          existingTitles,
          context
        );
        // שילוב תת-נושאים מ-AI עם אלו שזוהו בסיסית — ללא כפילויות
        const existingSet = new Set(cluster.missingSubtopics.map(s => s.toLowerCase()));
        for (const subtopic of aiSubtopics) {
          if (!existingSet.has(subtopic.toLowerCase())) {
            cluster.missingSubtopics.push(subtopic);
          }
        }
      } catch (error) {
        console.error(`[TopicCluster] שגיאה ביצירת תת-נושאים עבור "${cluster.topic}":`, error);
      }
    }
  }

  // שלב 4: בניית המלצות
  const recommendations = buildClusterRecommendations(clusters, inventory, context);

  // שיוך המלצות לאשכולות הרלוונטיים
  for (const rec of recommendations) {
    const matchingCluster = clusters.find(c => c.topic === rec.targetKeyword);
    if (matchingCluster) {
      matchingCluster.recommendations.push(rec);
    }
  }

  // שלב 5: זיהוי תוכן יתום — דפים שלא שייכים לשום אשכול
  const allClusterPageIds = new Set<number>();
  for (const cluster of clusters) {
    if (cluster.pillarPage) allClusterPageIds.add(cluster.pillarPage.pageId);
    for (const sp of cluster.supportingPages) {
      allClusterPageIds.add(sp.pageId);
    }
  }
  const orphanContent = inventory.items.filter(p => !allClusterPageIds.has(p.id));

  // שלב 6: סיווג אשכולות חזקים וחלשים
  const sortedByAuthority = [...clusters].sort((a, b) => b.authority - a.authority);
  const strongestClusters = sortedByAuthority.filter(c => c.authority >= AUTHORITY_THRESHOLDS.strong);
  const weakestClusters = sortedByAuthority.filter(c => c.authority < AUTHORITY_THRESHOLDS.weak);

  // שלב 7: חישוב סמכות נושאית כללית
  const overallTopicalAuthority = clusters.length > 0
    ? Math.round(clusters.reduce((sum, c) => sum + c.authority, 0) / clusters.length)
    : 0;

  // שלב 8: רישום פעולות ביומן
  actions.push({
    id: `cluster-analysis-${Date.now().toString(36)}`,
    planId: context.planId || '',
    date: analysisDate,
    actionType: 'technical_issue_found',
    module: 'topic-cluster-builder',
    description: `ניתוח אשכולות נושאיים: ${clusters.length} אשכולות זוהו, ${strongestClusters.length} חזקים, ${weakestClusters.length} חלשים, ${orphanContent.length} דפים יתומים`,
    seoReason: 'ניתוח אשכולות נושאיים מזהה פערים בכיסוי תוכן ומייצר המלצות לחיזוק סמכות נושאית',
    expectedImpact: weakestClusters.length > 2 ? 'high' : 'medium',
    status: 'completed',
    isReversible: false,
  });

  // רישום המלצות קריטיות כפעולות
  for (const rec of recommendations.filter(r => r.priority === 'critical')) {
    actions.push({
      id: `cluster-rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      planId: context.planId || '',
      date: analysisDate,
      actionType: 'approval_requested',
      module: 'topic-cluster-builder',
      description: rec.description,
      seoReason: rec.expectedImpact,
      expectedImpact: 'critical',
      status: 'pending_approval',
      isReversible: false,
    });
  }

  return {
    clusters,
    overallTopicalAuthority,
    strongestClusters,
    weakestClusters,
    orphanContent,
    recommendations,
    actions,
  };
}
