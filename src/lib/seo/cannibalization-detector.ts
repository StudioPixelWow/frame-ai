// גלאי קניבליזציית מילות מפתח — זיהוי דפים שמתחרים זה בזה
// Cannibalization Detector — find pages competing for the same keywords/intent

import { ContentItem, ContentInventory, buildContentInventory, stripHtml } from './wp-content-inventory';
import { SEOActionEntry, SEOActionType } from './seo-action-log';
import { AutomationContext } from './seo-automator';
import { WPConnection } from './wordpress-client';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface CannibalizationIssue {
  keyword: string;
  intent: string;
  pages: { id: number; url: string; title: string; relevanceScore: number }[];
  severity: 'critical' | 'high' | 'medium';
  recommendation: 'merge' | 'canonical' | 'redirect' | 'differentiate' | 'deindex';
  reasoning: string;
  suggestedPrimaryPage: number;
}

export interface CannibalizationResult {
  pagesAnalyzed: number;
  issuesFound: number;
  issues: CannibalizationIssue[];
  actions: SEOActionEntry[];
}

// ============================================================================
// מילות עצירה בעברית ובאנגלית — Stop Words
// ============================================================================

const STOP_WORDS_HE = new Set([
  'של', 'את', 'על', 'עם', 'זה', 'לא', 'כי', 'מה', 'גם', 'אם', 'יש', 'אין',
  'או', 'כל', 'אבל', 'הם', 'היא', 'הוא', 'אני', 'אנחנו', 'הן', 'לי', 'לו',
  'לה', 'להם', 'שלי', 'שלו', 'שלה', 'שלנו', 'מאוד', 'רק', 'עוד', 'בין', 'כמו',
  'אחרי', 'לפני', 'כאשר', 'אז', 'עד', 'בו', 'בה', 'כך', 'מי', 'איך', 'למה',
]);

const STOP_WORDS_EN = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'and', 'or', 'but', 'if', 'then',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'not',
  'this', 'that', 'it', 'its', 'they', 'them', 'he', 'she', 'we', 'you',
]);

// ============================================================================
// עוזרים — Helper Functions
// ============================================================================

/**
 * חילוץ מילות מפתח מטקסט — הסרת מילות עצירה ופיסוק
 */
function extractKeywordTokens(text: string): string[] {
  if (!text) return [];

  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // הסר פיסוק, שמור אותיות ומספרים
    .split(/\s+/)
    .filter(word =>
      word.length > 1 &&
      !STOP_WORDS_HE.has(word) &&
      !STOP_WORDS_EN.has(word)
    );
}

/**
 * חישוב דמיון Jaccard בין שתי קבוצות מילות מפתח
 * מחזיר ערך בין 0 (שונה לגמרי) ל-1 (זהה)
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(extractKeywordTokens(text1));
  const tokens2 = new Set(extractKeywordTokens(text2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  // חישוב Jaccard Index: |A ∩ B| / |A ∪ B|
  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      intersection++;
    }
  }

  const union = new Set([...tokens1, ...tokens2]).size;
  if (union === 0) return 0;

  return intersection / union;
}

/**
 * חישוב ציון רלוונטיות של דף למילת מפתח
 * מבוסס על: כותרת, H1, H2, slug, meta title, focus keyword
 */
function calculateRelevanceScore(item: ContentItem, keyword: string): number {
  const keywordLower = keyword.toLowerCase();
  let score = 0;

  // בכותרת הדף — ציון גבוה
  if (item.title.toLowerCase().includes(keywordLower)) score += 30;

  // ב-H1 — ציון גבוה
  const h1s = item.headings.filter(h => h.tag === 'h1');
  if (h1s.some(h => h.text.toLowerCase().includes(keywordLower))) score += 25;

  // ב-slug — ציון גבוה
  if (item.slug.toLowerCase().includes(keywordLower.replace(/\s+/g, '-'))) score += 20;

  // ב-meta title — ציון בינוני
  if (item.yoastMeta.title.toLowerCase().includes(keywordLower)) score += 15;

  // ב-focus keyword — ציון גבוה
  if (item.yoastMeta.focusKeyword.toLowerCase().includes(keywordLower)) score += 25;

  // ב-H2 — ציון בינוני
  const h2s = item.headings.filter(h => h.tag === 'h2');
  if (h2s.some(h => h.text.toLowerCase().includes(keywordLower))) score += 10;

  // ב-meta description — ציון נמוך
  if (item.yoastMeta.description.toLowerCase().includes(keywordLower)) score += 5;

  // בתוכן — ציון בסיסי (צפיפות)
  const contentLower = item.plainText.toLowerCase();
  const occurrences = (contentLower.match(new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  score += Math.min(occurrences * 2, 20); // מקסימום 20 נקודות מתוכן

  return Math.min(score, 100); // מקסימום 100
}

/**
 * קביעת חומרה לפי מספר דפים וציוני רלוונטיות
 */
function determineSeverity(
  pages: { id: number; url: string; title: string; relevanceScore: number }[]
): CannibalizationIssue['severity'] {
  if (pages.length >= 4) return 'critical';
  if (pages.length >= 3) return 'high';

  // אם שני דפים עם ציון גבוה — high
  const highRelevance = pages.filter(p => p.relevanceScore > 50);
  if (highRelevance.length >= 2) return 'high';

  return 'medium';
}

/**
 * המלצה לפתרון — מבוסס על סוגי הדפים והחומרה
 */
function determineRecommendation(
  pages: { id: number; url: string; title: string; relevanceScore: number }[],
  items: Map<number, ContentItem>
): CannibalizationIssue['recommendation'] {
  // אם יש דף אחד הרבה יותר רלוונטי — canonical
  const sorted = [...pages].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const scoreDiff = sorted[0].relevanceScore - sorted[1].relevanceScore;

  if (scoreDiff > 30) return 'canonical';

  // אם שני הדפים דומים מאוד — merge
  const item1 = items.get(sorted[0].id);
  const item2 = items.get(sorted[1].id);

  if (item1 && item2) {
    const titleSim = calculateSimilarity(item1.title, item2.title);
    if (titleSim > 0.6) return 'merge';
  }

  // אם אחד מהדפים דליל — redirect
  if (item1 && item2) {
    if (item1.wordCount < 200 || item2.wordCount < 200) return 'redirect';
  }

  // ברירת מחדל — differentiate
  return 'differentiate';
}

// ============================================================================
// זיהוי קניבליזציה — Detect Cannibalization
// ============================================================================

/**
 * סורק את כל הדפים ומזהה דפים שמתחרים על אותן מילות מפתח
 * השוואה לפי: דמיון כותרות, חפיפת כותרות, מילות מפתח יעד, דמיון slug
 * מקבץ דפים שמכוונים לאותה כוונת חיפוש
 * ממליץ: merge/canonical/redirect עם הסבר ברור
 * לעולם לא מוחק אוטומטית — רק מדווח
 */
export function detectCannibalization(
  inventory: ContentInventory,
  context: AutomationContext
): CannibalizationResult {
  const startTime = Date.now();
  const actions: SEOActionEntry[] = [];
  const issues: CannibalizationIssue[] = [];

  // בנה מפת דפים לפי ID
  const itemsMap = new Map<number, ContentItem>();
  for (const item of inventory.items) {
    itemsMap.set(item.id, item);
  }

  // === שלב 1: בדוק חפיפת מילות מפתח יעד (focus keyword) ===
  const focusKeywordGroups = new Map<string, ContentItem[]>();
  for (const item of inventory.items) {
    const fk = item.yoastMeta.focusKeyword.trim().toLowerCase();
    if (!fk) continue;

    if (!focusKeywordGroups.has(fk)) {
      focusKeywordGroups.set(fk, []);
    }
    focusKeywordGroups.get(fk)!.push(item);
  }

  for (const [keyword, items] of focusKeywordGroups) {
    if (items.length < 2) continue;

    const pages = items.map(item => ({
      id: item.id,
      url: item.url,
      title: item.title,
      relevanceScore: calculateRelevanceScore(item, keyword),
    }));

    const sorted = [...pages].sort((a, b) => b.relevanceScore - a.relevanceScore);

    issues.push({
      keyword,
      intent: 'focus_keyword',
      pages: sorted,
      severity: determineSeverity(sorted),
      recommendation: determineRecommendation(sorted, itemsMap),
      reasoning: `${items.length} דפים משתמשים באותה מילת מפתח יעד "${keyword}" — גוגל לא יודע איזה דף לדרג`,
      suggestedPrimaryPage: sorted[0].id,
    });
  }

  // === שלב 2: בדוק דמיון כותרות גבוה ===
  const processedPairs = new Set<string>();

  for (let i = 0; i < inventory.items.length; i++) {
    for (let j = i + 1; j < inventory.items.length; j++) {
      const item1 = inventory.items[i];
      const item2 = inventory.items[j];

      const pairKey = `${Math.min(item1.id, item2.id)}_${Math.max(item1.id, item2.id)}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      // חשב דמיון כותרות
      const titleSimilarity = calculateSimilarity(item1.title, item2.title);

      // חשב דמיון slugs
      const slugSimilarity = calculateSimilarity(
        item1.slug.replace(/-/g, ' '),
        item2.slug.replace(/-/g, ' ')
      );

      // חשב חפיפת כותרות H2
      const h2Text1 = item1.headings.filter(h => h.tag === 'h2').map(h => h.text).join(' ');
      const h2Text2 = item2.headings.filter(h => h.tag === 'h2').map(h => h.text).join(' ');
      const headingSimilarity = calculateSimilarity(h2Text1, h2Text2);

      // ציון דמיון משוקלל
      const weightedSimilarity =
        titleSimilarity * 0.4 +
        slugSimilarity * 0.3 +
        headingSimilarity * 0.3;

      // סף: דמיון מעל 0.5 מעיד על קניבליזציה אפשרית
      if (weightedSimilarity < 0.5) continue;

      // מצא מילת מפתח משותפת לתיוג הבעיה
      const tokens1 = extractKeywordTokens(item1.title);
      const tokens2 = extractKeywordTokens(item2.title);
      const commonKeywords = tokens1.filter(t => tokens2.includes(t));
      const keyword = commonKeywords.join(' ') || item1.title;

      // בדוק שלא כבר דווח על אותו קבוצת keyword
      const alreadyReported = issues.some(issue =>
        issue.pages.some(p => p.id === item1.id) &&
        issue.pages.some(p => p.id === item2.id)
      );

      if (alreadyReported) continue;

      const score1 = calculateRelevanceScore(item1, keyword);
      const score2 = calculateRelevanceScore(item2, keyword);

      const pages = [
        { id: item1.id, url: item1.url, title: item1.title, relevanceScore: score1 },
        { id: item2.id, url: item2.url, title: item2.title, relevanceScore: score2 },
      ].sort((a, b) => b.relevanceScore - a.relevanceScore);

      issues.push({
        keyword,
        intent: 'title_similarity',
        pages,
        severity: determineSeverity(pages),
        recommendation: determineRecommendation(pages, itemsMap),
        reasoning: `כותרות דומות (${Math.round(titleSimilarity * 100)}% דמיון): "${item1.title}" ↔ "${item2.title}" — עלול לבלבל את גוגל`,
        suggestedPrimaryPage: pages[0].id,
      });
    }
  }

  // === שלב 3: בדוק מילות מפתח יעד מתוך context ===
  for (const targetKw of context.targetKeywords) {
    const kwLower = targetKw.toLowerCase();

    // מצא דפים שמכוונים למילת מפתח זו
    const matchingPages = inventory.items
      .map(item => ({
        item,
        score: calculateRelevanceScore(item, targetKw),
      }))
      .filter(({ score }) => score > 20) // סף מינימלי
      .sort((a, b) => b.score - a.score);

    if (matchingPages.length < 2) continue;

    // בדוק שלא כבר דווח
    const alreadyReported = issues.some(issue =>
      issue.keyword.toLowerCase() === kwLower ||
      (issue.pages.some(p => p.id === matchingPages[0].item.id) &&
       issue.pages.some(p => p.id === matchingPages[1].item.id))
    );

    if (alreadyReported) continue;

    const pages = matchingPages.map(({ item, score }) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      relevanceScore: score,
    }));

    issues.push({
      keyword: targetKw,
      intent: 'target_keyword',
      pages,
      severity: determineSeverity(pages),
      recommendation: determineRecommendation(pages, itemsMap),
      reasoning: `${pages.length} דפים מתחרים על מילת המפתח "${targetKw}" — מומלץ לרכז סמכות בדף אחד`,
      suggestedPrimaryPage: pages[0].id,
    });
  }

  // תעד פעולות
  for (const issue of issues) {
    actions.push({
      id: `cannibal_${issue.suggestedPrimaryPage}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      planId: context.planId || 'manual',
      date: new Date().toISOString(),
      actionType: 'cannibalization_flagged' as SEOActionType,
      module: 'cannibalization-detector',
      description: `זוהתה קניבליזציה (${issue.severity}): "${issue.keyword}" — ${issue.pages.length} דפים מתחרים. המלצה: ${issue.recommendation}`,
      seoReason: issue.reasoning,
      expectedImpact: issue.severity === 'critical' ? 'critical' : issue.severity === 'high' ? 'high' : 'medium',
      status: 'pending_approval',
      isReversible: false,
      executionTimeMs: Date.now() - startTime,
    });
  }

  return {
    pagesAnalyzed: inventory.items.length,
    issuesFound: issues.length,
    issues,
    actions,
  };
}
