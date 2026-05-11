// GSC Intelligence Engine — ניתוח נתוני Search Console לאופטימיזציה חכמה
// מזהה הזדמנויות דירוג, בעיות CTR, ומגמות עלייה/ירידה

import type { WPConnection } from './wordpress-client';
import { updateYoastMeta } from './wordpress-client';
import { generateWithAI } from '@/lib/ai/openai-client';
import type { ContentItem, ContentInventory } from './wp-content-inventory';
import type { SEOActionEntry } from './seo-action-log';
import { createActionLog } from './seo-action-log';
import type { AutomationContext } from './seo-automator';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface GSCData {
  queries: GSCQuery[];
  pages: GSCPage[];
  dateRange: { start: string; end: string };
  available: boolean;
}

export interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  page?: string;  // הדף המוביל לשאילתה זו
}

export interface GSCPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  queries: string[];
}

export interface GSCOpportunity {
  type: 'page1_potential' | 'high_impressions_low_ctr' | 'declining_page' | 'rising_page' | 'content_query_mismatch' | 'quick_win' | 'stagnating' | 'volatile';
  pageUrl?: string;
  pageTitle?: string;
  query?: string;
  currentPosition?: number;
  currentCTR?: number;
  impressions?: number;
  clicks?: number;
  description: string;
  recommendedActions: string[];
  impactPotential: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;  // 0-100
}

export interface GSCIntelligenceResult {
  available: boolean;
  opportunities: GSCOpportunity[];
  rankingTrends: {
    rising: GSCPage[];
    declining: GSCPage[];
    stagnating: GSCPage[];
    volatile: GSCPage[];
  };
  ctrOpportunities: GSCOpportunity[];
  page1Candidates: GSCOpportunity[];
  contentMismatches: GSCOpportunity[];
  summary: string;
  actions: SEOActionEntry[];
}

// ============================================================================
// תוצאה ריקה — כש-GSC לא מחובר
// ============================================================================

function emptyResult(): GSCIntelligenceResult {
  return {
    available: false,
    opportunities: [],
    rankingTrends: { rising: [], declining: [], stagnating: [], volatile: [] },
    ctrOpportunities: [],
    page1Candidates: [],
    contentMismatches: [],
    summary: 'נתוני Google Search Console אינם זמינים. לא ניתן לבצע ניתוח חכם ללא חיבור GSC.',
    actions: [],
  };
}

// ============================================================================
// עוזרים — Helpers
// ============================================================================

/** מציאת ContentItem לפי URL */
function findContentItem(pageUrl: string, inventory: ContentInventory): ContentItem | undefined {
  return inventory.items.find(item => {
    const normalizedItemUrl = item.url.replace(/\/$/, '');
    const normalizedPageUrl = pageUrl.replace(/\/$/, '');
    return normalizedItemUrl === normalizedPageUrl || normalizedItemUrl.endsWith(new URL(normalizedPageUrl).pathname.replace(/\/$/, ''));
  });
}

/** חישוב CTR צפוי לפי מיקום (CTR curves ממוצעים) */
function expectedCTR(position: number): number {
  // ממוצע CTR לפי מיקום בגוגל
  const ctrCurve: Record<number, number> = {
    1: 31.7, 2: 24.7, 3: 18.7, 4: 13.6, 5: 9.5,
    6: 6.2, 7: 4.2, 8: 3.1, 9: 2.6, 10: 2.4,
  };
  const rounded = Math.min(Math.round(position), 10);
  if (rounded < 1) return 35;
  return ctrCurve[rounded] ?? Math.max(0.5, 2.4 - (position - 10) * 0.1);
}

/** חישוב ציון השפעה פוטנציאלית */
function calculateImpact(impressions: number, position: number, ctr: number): 'critical' | 'high' | 'medium' | 'low' {
  const expectedClick = impressions * (expectedCTR(position) / 100);
  const actualClick = impressions * (ctr / 100);
  const missedClicks = expectedClick - actualClick;

  if (missedClicks > 500 || (impressions > 5000 && position <= 5)) return 'critical';
  if (missedClicks > 200 || (impressions > 2000 && position <= 10)) return 'high';
  if (missedClicks > 50 || impressions > 500) return 'medium';
  return 'low';
}

// ============================================================================
// זיהוי הזדמנויות — Opportunity Detection
// ============================================================================

/** מועמדים לעמוד 1 — דפים במיקום 4-20 עם חשיפות גבוהות */
function findPage1Candidates(data: GSCData, inventory: ContentInventory): GSCOpportunity[] {
  const opportunities: GSCOpportunity[] = [];

  for (const page of data.pages) {
    if (page.position >= 4 && page.position <= 20 && page.impressions >= 100) {
      const item = findContentItem(page.page, inventory);
      const isQuickWin = page.position >= 8 && page.position <= 15;

      opportunities.push({
        type: isQuickWin ? 'quick_win' : 'page1_potential',
        pageUrl: page.page,
        pageTitle: item?.title,
        currentPosition: page.position,
        currentCTR: page.ctr,
        impressions: page.impressions,
        clicks: page.clicks,
        description: isQuickWin
          ? `הדף "${item?.title || page.page}" במיקום ${page.position.toFixed(1)} עם ${page.impressions} חשיפות — דחיפה קטנה יכולה להביא אותו לעמוד 1`
          : `הדף "${item?.title || page.page}" במיקום ${page.position.toFixed(1)} — פוטנציאל להגיע לעמוד 1 עם ${page.impressions} חשיפות`,
        recommendedActions: [
          'שיפור כותרת וDescription למשיכת קליקים',
          'הוספת קישורים פנימיים מדפים חזקים',
          'העשרת תוכן סביב מילות מפתח רלוונטיות',
          'הוספת FAQ Schema עם שאלות נפוצות',
          ...(isQuickWin ? ['עדכון מהיר — זו הזדמנות לניצחון מהיר'] : []),
        ],
        impactPotential: page.impressions > 1000 ? 'critical' : page.impressions > 500 ? 'high' : 'medium',
        confidence: page.impressions > 500 ? 85 : page.impressions > 200 ? 70 : 55,
      });
    }
  }

  return opportunities;
}

/** חשיפות גבוהות, CTR נמוך — בעיית כותרת/תיאור */
function findLowCTROpportunities(data: GSCData, inventory: ContentInventory): GSCOpportunity[] {
  const opportunities: GSCOpportunity[] = [];

  for (const page of data.pages) {
    if (page.impressions >= 500 && page.ctr < 2) {
      const item = findContentItem(page.page, inventory);
      const expected = expectedCTR(page.position);

      opportunities.push({
        type: 'high_impressions_low_ctr',
        pageUrl: page.page,
        pageTitle: item?.title,
        currentPosition: page.position,
        currentCTR: page.ctr,
        impressions: page.impressions,
        clicks: page.clicks,
        description: `הדף "${item?.title || page.page}" מקבל ${page.impressions} חשיפות אך רק ${page.ctr.toFixed(1)}% CTR (צפוי: ${expected.toFixed(1)}%) — כנראה בעיית כותרת/תיאור`,
        recommendedActions: [
          'שכתוב כותרת Meta עם מילות כוח ו-CTR גבוה',
          'שכתוב Description עם הנעה לפעולה ברורה',
          'הוספת מספרים ושנה בכותרת',
          'בדיקת Rich Snippets — FAQ/Schema יכולים לשפר CTR',
        ],
        impactPotential: calculateImpact(page.impressions, page.position, page.ctr),
        confidence: 80,
      });
    }
  }

  return opportunities;
}

/** דפים בירידה — מיקום >15 עם חשיפות גבוהות */
function findDecliningPages(data: GSCData, inventory: ContentInventory): GSCOpportunity[] {
  const opportunities: GSCOpportunity[] = [];

  // ללא נתונים היסטוריים, מזהים דפים שסביר שהם בירידה:
  // מיקום גבוה (>15) אך עם חשיפות סבירות → היו פעם גבוהים יותר
  for (const page of data.pages) {
    if (page.position > 15 && page.impressions >= 200) {
      const item = findContentItem(page.page, inventory);
      opportunities.push({
        type: 'declining_page',
        pageUrl: page.page,
        pageTitle: item?.title,
        currentPosition: page.position,
        impressions: page.impressions,
        clicks: page.clicks,
        description: `הדף "${item?.title || page.page}" במיקום ${page.position.toFixed(1)} עם ${page.impressions} חשיפות — יתכן שהיה מדורג גבוה יותר בעבר`,
        recommendedActions: [
          'רענון תוכן — עדכון מידע ותאריכים',
          'בדיקת מתחרים — מה השתנה?',
          'שיפור עומק התוכן והוספת ערך ייחודי',
          'בניית קישורים פנימיים חדשים',
        ],
        impactPotential: page.impressions > 500 ? 'high' : 'medium',
        confidence: 50, // ביטחון נמוך יותר ללא נתונים היסטוריים
      });
    }
  }

  return opportunities;
}

/** דפים בעלייה — מיקום טוב ו-CTR טוב */
function findRisingPages(data: GSCData, inventory: ContentInventory): GSCOpportunity[] {
  const opportunities: GSCOpportunity[] = [];

  for (const page of data.pages) {
    if (page.position < 10 && page.ctr >= expectedCTR(page.position) * 0.8) {
      const item = findContentItem(page.page, inventory);
      opportunities.push({
        type: 'rising_page',
        pageUrl: page.page,
        pageTitle: item?.title,
        currentPosition: page.position,
        currentCTR: page.ctr,
        impressions: page.impressions,
        clicks: page.clicks,
        description: `הדף "${item?.title || page.page}" מדורג טוב (${page.position.toFixed(1)}) עם CTR חזק (${page.ctr.toFixed(1)}%) — כדאי לחזק אותו`,
        recommendedActions: [
          'חיזוק קישורים פנימיים לדף',
          'הרחבת תוכן סביב שאילתות קשורות',
          'שמירה על עדכניות התוכן',
        ],
        impactPotential: page.impressions > 1000 ? 'high' : 'medium',
        confidence: 75,
      });
    }
  }

  return opportunities;
}

/** אי-התאמה בין תוכן לשאילתות — דף מדורג לשאילתות שלא תואמות */
function findContentQueryMismatches(data: GSCData, inventory: ContentInventory): GSCOpportunity[] {
  const opportunities: GSCOpportunity[] = [];

  for (const page of data.pages) {
    const item = findContentItem(page.page, inventory);
    if (!item) continue;

    const titleLower = item.title.toLowerCase();
    const textLower = item.plainText.toLowerCase().slice(0, 2000); // בדיקת 2000 תווים ראשונים

    for (const query of page.queries) {
      const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const matchingWords = queryWords.filter(w => titleLower.includes(w) || textLower.includes(w));
      const matchRatio = queryWords.length > 0 ? matchingWords.length / queryWords.length : 1;

      // אם פחות מ-40% מהמילים נמצאות בתוכן — אי-התאמה
      if (matchRatio < 0.4 && queryWords.length >= 2) {
        // נמצא את הנתונים של השאילתה הזו
        const queryData = data.queries.find(q => q.query === query);
        if (queryData && queryData.impressions >= 50) {
          opportunities.push({
            type: 'content_query_mismatch',
            pageUrl: page.page,
            pageTitle: item.title,
            query,
            currentPosition: queryData.position,
            impressions: queryData.impressions,
            description: `הדף "${item.title}" מדורג לשאילתה "${query}" אך התוכן לא מתמקד בה — הזדמנות להתאמה`,
            recommendedActions: [
              `הוספת פסקה או FAQ שעונה ישירות על "${query}"`,
              'שיפור H2/H3 לכלול את מילות המפתח',
              'שיקול ליצירת דף ייעודי אם השאילתה מצדיקה',
            ],
            impactPotential: queryData.impressions > 500 ? 'high' : 'medium',
            confidence: 65,
          });
        }
      }
    }
  }

  return opportunities;
}

/** דפים שסטגנטים — חשיפות גבוהות, מיקום יציב, אין צמיחה */
function findStagnatingPages(data: GSCData, inventory: ContentInventory): GSCOpportunity[] {
  const opportunities: GSCOpportunity[] = [];

  for (const page of data.pages) {
    // מיקום בינוני-גבוה (10-30) עם חשיפות סבירות — כנראה תקוע
    if (page.position >= 10 && page.position <= 30 && page.impressions >= 300) {
      const item = findContentItem(page.page, inventory);
      opportunities.push({
        type: 'stagnating',
        pageUrl: page.page,
        pageTitle: item?.title,
        currentPosition: page.position,
        impressions: page.impressions,
        clicks: page.clicks,
        currentCTR: page.ctr,
        description: `הדף "${item?.title || page.page}" תקוע במיקום ${page.position.toFixed(1)} עם ${page.impressions} חשיפות — צריך גישה שונה`,
        recommendedActions: [
          'ניתוח מתחרים בעמוד 1 — מה חסר?',
          'הוספת ערך ייחודי שאין למתחרים',
          'שיפור E-E-A-T (מומחיות, סמכות, אמינות)',
          'בניית קישורים פנימיים איכותיים',
        ],
        impactPotential: page.impressions > 1000 ? 'high' : 'medium',
        confidence: 60,
      });
    }
  }

  return opportunities;
}

// ============================================================================
// ניתוח מרכזי — Main Analysis
// ============================================================================

/**
 * ניתוח מלא של נתוני GSC — זיהוי הזדמנויות, מגמות, ופעולות מומלצות
 */
export function analyzeGSCData(
  data: GSCData,
  inventory: ContentInventory,
  context: AutomationContext
): GSCIntelligenceResult {
  if (!data.available || (!data.queries.length && !data.pages.length)) {
    return emptyResult();
  }

  // זיהוי כל סוגי ההזדמנויות
  const page1Candidates = findPage1Candidates(data, inventory);
  const ctrOpportunities = findLowCTROpportunities(data, inventory);
  const decliningPages = findDecliningPages(data, inventory);
  const risingPages = findRisingPages(data, inventory);
  const contentMismatches = findContentQueryMismatches(data, inventory);
  const stagnating = findStagnatingPages(data, inventory);

  // איחוד כל ההזדמנויות
  const allOpportunities = [
    ...page1Candidates,
    ...ctrOpportunities,
    ...decliningPages,
    ...risingPages,
    ...contentMismatches,
    ...stagnating,
  ];

  // מגמות דירוג
  const rankingTrends = {
    rising: data.pages.filter(p => p.position < 10 && p.ctr >= expectedCTR(p.position) * 0.7),
    declining: data.pages.filter(p => p.position > 15 && p.impressions >= 200),
    stagnating: data.pages.filter(p => p.position >= 10 && p.position <= 30 && p.impressions >= 300),
    volatile: [], // דורש נתונים היסטוריים
  };

  // סיכום בעברית
  const summary = buildSummary(allOpportunities, data, context);

  return {
    available: true,
    opportunities: prioritizeGSCActions(allOpportunities),
    rankingTrends,
    ctrOpportunities,
    page1Candidates,
    contentMismatches,
    summary,
    actions: [],
  };
}

/** בניית סיכום טקסטואלי בעברית */
function buildSummary(opportunities: GSCOpportunity[], data: GSCData, context: AutomationContext): string {
  const totalPages = data.pages.length;
  const totalQueries = data.queries.length;
  const page1Count = data.pages.filter(p => p.position <= 10).length;
  const criticalOps = opportunities.filter(o => o.impactPotential === 'critical').length;
  const highOps = opportunities.filter(o => o.impactPotential === 'high').length;

  const lines: string[] = [
    `📊 ניתוח GSC עבור ${context.businessName}:`,
    `• ${totalPages} דפים מדורגים, ${totalQueries} שאילתות ייחודיות`,
    `• ${page1Count} דפים בעמוד 1 מתוך ${totalPages}`,
    `• נמצאו ${opportunities.length} הזדמנויות (${criticalOps} קריטיות, ${highOps} גבוהות)`,
  ];

  const quickWins = opportunities.filter(o => o.type === 'quick_win');
  if (quickWins.length > 0) {
    lines.push(`• ${quickWins.length} ניצחונות מהירים — דפים קרובים לעמוד 1`);
  }

  const ctrIssues = opportunities.filter(o => o.type === 'high_impressions_low_ctr');
  if (ctrIssues.length > 0) {
    lines.push(`• ${ctrIssues.length} דפים עם בעיית CTR — שכתוב כותרות יכול לשפר משמעותית`);
  }

  return lines.join('\n');
}

// ============================================================================
// יצירת אופטימיזציות CTR באמצעות AI
// ============================================================================

/**
 * שיפור כותרות ותיאורים עבור דפים עם CTR נמוך
 * משתמש ב-AI ליצור Meta משכנע יותר
 */
export async function generateCTROptimizations(
  opportunities: GSCOpportunity[],
  inventory: ContentInventory,
  context: AutomationContext
): Promise<Array<{ pageUrl: string; newTitle: string; newDescription: string; reason: string }>> {
  // רק הזדמנויות CTR ו-page1
  const ctrOps = opportunities.filter(
    o => o.type === 'high_impressions_low_ctr' || o.type === 'page1_potential' || o.type === 'quick_win'
  );

  if (ctrOps.length === 0) return [];

  const results: Array<{ pageUrl: string; newTitle: string; newDescription: string; reason: string }> = [];

  // מעבד עד 10 דפים בבת אחת
  const batch = ctrOps.slice(0, 10);

  const pagesInfo = batch.map(op => {
    const item = op.pageUrl ? findContentItem(op.pageUrl, inventory) : undefined;
    return {
      url: op.pageUrl || '',
      currentTitle: item?.yoastMeta.title || item?.title || '',
      currentDescription: item?.yoastMeta.description || '',
      position: op.currentPosition || 0,
      ctr: op.currentCTR || 0,
      impressions: op.impressions || 0,
      query: op.query || '',
    };
  }).filter(p => p.url);

  if (pagesInfo.length === 0) return results;

  const systemPrompt = `אתה מומחה SEO ישראלי שמתמחה בשיפור CTR בגוגל.
המשימה: לשכתב כותרות (title) ותיאורים (meta description) שמושכים יותר קליקים.
כללים:
- כותרת: 30-60 תווים, כוללת מילת מפתח, מספר או שנה אם רלוונטי
- תיאור: 120-155 תווים, הנעה לפעולה, ערך ברור
- בעברית טבעית, לא clickbait
- התמקד בערך ללקוח, לא רק מילות מפתח
- עסק: ${context.businessName} | תחום: ${context.industry} | מיקום: ${context.location}

החזר JSON בפורמט:
[{ "url": "...", "title": "...", "description": "...", "reason": "..." }]`;

  const userPrompt = `שפר כותרות ותיאורים עבור הדפים הבאים:\n${JSON.stringify(pagesInfo, null, 2)}`;

  try {
    const aiResult = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.7 });
    if (!aiResult.success || !aiResult.data) return results;

    const parsed = typeof aiResult.data === 'string' ? JSON.parse(aiResult.data) : aiResult.data;
    if (!Array.isArray(parsed)) return results;

    for (const item of parsed) {
      if (item.url && item.title && item.description) {
        results.push({
          pageUrl: item.url,
          newTitle: item.title,
          newDescription: item.description,
          reason: item.reason || 'שיפור CTR על בסיס ניתוח GSC',
        });
      }
    }
  } catch {
    // שגיאת AI — מחזירים מה שיש
  }

  return results;
}

// ============================================================================
// תעדוף — Prioritization
// ============================================================================

/** מיון הזדמנויות לפי השפעה × ביטחון */
export function prioritizeGSCActions(opportunities: GSCOpportunity[]): GSCOpportunity[] {
  const impactScore: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  return [...opportunities].sort((a, b) => {
    const scoreA = (impactScore[a.impactPotential] || 1) * (a.confidence / 100);
    const scoreB = (impactScore[b.impactPotential] || 1) * (b.confidence / 100);
    return scoreB - scoreA;
  });
}

// ============================================================================
// ביצוע מלא — Execute
// ============================================================================

/**
 * ביצוע ניתוח GSC מלא — כולל אופציה להחלת תיקוני CTR
 * אם data הוא null, מחזיר תוצאה ריקה עם available: false
 */
export async function executeGSCIntelligence(
  data: GSCData | null,
  inventory: ContentInventory,
  connection: WPConnection,
  context: AutomationContext,
  options?: { applyCTRFixes?: boolean; dryRun?: boolean }
): Promise<GSCIntelligenceResult> {
  // GSC לא מחובר — מחזירים תוצאה ריקה
  if (!data || !data.available) {
    return emptyResult();
  }

  // ניתוח
  const result = analyzeGSCData(data, inventory, context);
  const actionLog = createActionLog();

  // החלת תיקוני CTR אם מתבקש
  if (options?.applyCTRFixes && !options?.dryRun) {
    const ctrFixes = await generateCTROptimizations(result.opportunities, inventory, context);

    for (const fix of ctrFixes) {
      const item = findContentItem(fix.pageUrl, inventory);
      if (!item) continue;

      try {
        await updateYoastMeta(connection, item.id, {
          title: fix.newTitle,
          description: fix.newDescription,
        });

        actionLog.log({
          planId: context.planId || 'gsc-intelligence',
          pageId: item.id,
          pageUrl: fix.pageUrl,
          pageTitle: item.title,
          actionType: 'meta_title_updated',
          module: 'gsc-intelligence-engine',
          description: `שכתוב כותרת ותיאור על בסיס ניתוח CTR — ${fix.reason}`,
          beforeValue: item.yoastMeta.title,
          afterValue: fix.newTitle,
          seoReason: `CTR נמוך (${result.opportunities.find(o => o.pageUrl === fix.pageUrl)?.currentCTR?.toFixed(1)}%) עם חשיפות גבוהות — שיפור Meta צפוי להגדיל קליקים`,
          expectedImpact: 'high',
          status: 'completed',
          isReversible: true,
          rollbackData: JSON.stringify({
            pageId: item.id,
            oldTitle: item.yoastMeta.title,
            oldDescription: item.yoastMeta.description,
          }),
        });
      } catch {
        actionLog.log({
          planId: context.planId || 'gsc-intelligence',
          pageId: item.id,
          pageUrl: fix.pageUrl,
          pageTitle: item.title,
          actionType: 'meta_title_updated',
          module: 'gsc-intelligence-engine',
          description: `נכשל בעדכון Meta עבור ${item.title}`,
          seoReason: 'שיפור CTR',
          expectedImpact: 'high',
          status: 'failed',
          isReversible: false,
        });
      }
    }
  }

  result.actions = actionLog.getAllEntries();
  return result;
}
