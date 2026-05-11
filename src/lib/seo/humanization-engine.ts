// מנוע אנושיות תוכן — Humanization Engine
// מזהה טביעות אצבע של תוכן AI ומתקן לטון טבעי ומקצועי

import { WPConnection, updatePageContent } from './wordpress-client';
import {
  ContentItem,
  ContentInventory,
} from './wp-content-inventory';
import { generateWithAI } from '@/lib/ai/openai-client';
import { SEOActionEntry } from './seo-action-log';
import { AutomationContext } from './seo-automator';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface HumanizationAudit {
  pageId: number;
  pageUrl: string;
  pageTitle: string;
  humanScore: number;           // 0-100 (100 = אנושי לחלוטין)
  issues: HumanizationIssue[];
}

export interface HumanizationIssue {
  type: 'repetitive_patterns' | 'generic_intro' | 'robotic_wording' | 'low_variation' | 'filler_paragraphs' | 'unnatural_transitions' | 'excessive_lists' | 'formulaic_structure';
  description: string;
  location: string;             // היכן בתוכן
  severity: 'high' | 'medium' | 'low';
  fixable: boolean;
}

export interface HumanizationResult {
  pagesAudited: number;
  pagesImproved: number;
  issuesFound: number;
  issuesFixed: number;
  audits: HumanizationAudit[];
  actions: SEOActionEntry[];
}

// ============================================================================
// דפוסי תוכן AI בעברית — Hebrew AI Content Patterns
// ============================================================================

/** פתיחות גנריות שאופייניות ל-AI */
const GENERIC_INTROS: string[] = [
  'בעולם של היום',
  'בעידן המודרני',
  'בעולם הדיגיטלי',
  'בעידן הטכנולוגי',
  'בשנים האחרונות',
  'כולנו יודעים',
  'אין ספק ש',
  'לא סוד ש',
  'בעולם התחרותי',
  'בעידן של',
  'כיום יותר מתמיד',
  'בעולם המשתנה',
];

/** מילות קישור חזרתיות שאופייניות ל-AI */
const REPETITIVE_CONNECTORS: string[] = [
  'חשוב לציין',
  'בנוסף',
  'יתרה מכך',
  'יתר על כן',
  'כמו כן',
  'יש לציין',
  'ראוי לציין',
  'נוסף על כך',
  'מעבר לכך',
  'זאת ועוד',
  'אין להכחיש',
  'למעשה',
];

/** ניסוחים רובוטיים */
const ROBOTIC_PHRASES: string[] = [
  'לסיכום, ניתן לומר ש',
  'לסיכום הדברים',
  'כפי שניתן לראות',
  'כפי שצוין לעיל',
  'כאמור',
  'אם כן',
  'על כן',
  'לאור האמור',
  'בהתחשב בכל האמור',
  'סיכום',
];

// ============================================================================
// ביקורת אנושיות — Humanness Audit
// ============================================================================

/**
 * בודק כמה תוכן הדף נשמע אנושי ומקצועי
 * מזהה דפוסים אופייניים לתוכן שנוצר על ידי AI
 */
export function auditContentHumanness(item: ContentItem): HumanizationAudit {
  const issues: HumanizationIssue[] = [];
  const text = item.plainText;
  const sentences = splitToSentences(text);

  // בדיקה 1: פתיחות גנריות
  checkGenericIntros(text, issues);

  // בדיקה 2: חזרתיות במילות קישור
  checkRepetitiveConnectors(text, issues);

  // בדיקה 3: ניסוחים רובוטיים
  checkRoboticPhrases(text, issues);

  // בדיקה 4: שונות באורך משפטים
  checkSentenceLengthVariation(sentences, issues);

  // בדיקה 5: עודף רשימות
  checkExcessiveLists(item.content, item.wordCount, issues);

  // בדיקה 6: מבנה נוסחתי — כל סקשן אותו דפוס
  checkFormulaicStructure(item.headings, item.content, issues);

  // בדיקה 7: פסקאות מילוי ריקות
  checkFillerParagraphs(text, issues);

  // בדיקה 8: מעברים לא טבעיים
  checkUnnaturalTransitions(text, issues);

  // חישוב ציון אנושיות — 100 פחות עונשים על בעיות
  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'high': score -= 15; break;
      case 'medium': score -= 8; break;
      case 'low': score -= 3; break;
    }
  }

  return {
    pageId: item.id,
    pageUrl: item.url,
    pageTitle: item.title,
    humanScore: Math.max(0, Math.min(100, score)),
    issues,
  };
}

// ============================================================================
// פונקציות בדיקה פנימיות — Internal Check Functions
// ============================================================================

function splitToSentences(text: string): string[] {
  return text
    .split(/[.!?。]+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);
}

function checkGenericIntros(text: string, issues: HumanizationIssue[]): void {
  const firstParagraph = text.split('\n').find(p => p.trim().length > 20) || '';
  for (const intro of GENERIC_INTROS) {
    if (firstParagraph.includes(intro)) {
      issues.push({
        type: 'generic_intro',
        description: `פתיחה גנרית שאופיינית ל-AI: "${intro}"`,
        location: 'פסקה ראשונה',
        severity: 'high',
        fixable: true,
      });
      break; // מספיק פתיחה גנרית אחת
    }
  }
}

function checkRepetitiveConnectors(text: string, issues: HumanizationIssue[]): void {
  for (const connector of REPETITIVE_CONNECTORS) {
    const regex = new RegExp(connector, 'g');
    const matches = text.match(regex);
    if (matches && matches.length > 3) {
      issues.push({
        type: 'repetitive_patterns',
        description: `הביטוי "${connector}" מופיע ${matches.length} פעמים — חזרתיות גבוהה`,
        location: 'לאורך כל התוכן',
        severity: matches.length > 5 ? 'high' : 'medium',
        fixable: true,
      });
    }
  }
}

function checkRoboticPhrases(text: string, issues: HumanizationIssue[]): void {
  let roboticCount = 0;
  for (const phrase of ROBOTIC_PHRASES) {
    if (text.includes(phrase)) {
      roboticCount++;
    }
  }
  if (roboticCount >= 2) {
    issues.push({
      type: 'robotic_wording',
      description: `נמצאו ${roboticCount} ניסוחים רובוטיים/פורמליים מדי`,
      location: 'לאורך כל התוכן',
      severity: roboticCount >= 4 ? 'high' : 'medium',
      fixable: true,
    });
  }
}

function checkSentenceLengthVariation(sentences: string[], issues: HumanizationIssue[]): void {
  if (sentences.length < 5) return;

  const lengths = sentences.map(s => s.split(/\s+/).length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  // חישוב סטיית תקן
  const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  // אם סטיית התקן נמוכה מ-5 = כל המשפטים באותו אורך (סימן AI)
  if (stdDev < 3) {
    issues.push({
      type: 'low_variation',
      description: `שונות נמוכה מאוד באורך משפטים (סטיית תקן: ${stdDev.toFixed(1)}) — כל המשפטים דומים באורכם`,
      location: 'לאורך כל התוכן',
      severity: 'medium',
      fixable: true,
    });
  }
}

function checkExcessiveLists(html: string, wordCount: number, issues: HumanizationIssue[]): void {
  // ספירת פריטי רשימה
  const listItems = (html.match(/<li[\s>]/gi) || []).length;
  const estimatedListWords = listItems * 8; // הערכה ממוצעת של מילים בפריט

  if (wordCount > 0 && estimatedListWords / wordCount > 0.5) {
    issues.push({
      type: 'excessive_lists',
      description: `יותר מ-50% מהתוכן הוא רשימות (${listItems} פריטים) — נראה מלאכותי`,
      location: 'לאורך כל התוכן',
      severity: 'medium',
      fixable: true,
    });
  }
}

function checkFormulaicStructure(
  headings: { tag: string; text: string }[],
  html: string,
  issues: HumanizationIssue[]
): void {
  // בדיקה אם כל הסקשנים אותו דפוס — כותרת + פסקה + רשימה
  const h2Headings = headings.filter(h => h.tag === 'h2');
  if (h2Headings.length < 3) return;

  // בדיקה אם כל כותרת h2 מתחילה באותו מילה
  const firstWords = h2Headings.map(h => h.text.split(' ')[0]);
  const uniqueFirstWords = new Set(firstWords);
  if (uniqueFirstWords.size <= Math.ceil(h2Headings.length * 0.4)) {
    issues.push({
      type: 'formulaic_structure',
      description: `מבנה נוסחתי — רוב הכותרות מתחילות באותה מילה`,
      location: 'כותרות h2',
      severity: 'medium',
      fixable: true,
    });
  }

  // בדיקה אם כל סקשן באותו אורך (±30%)
  const sections = html.split(/<h2[\s>]/i).slice(1);
  if (sections.length >= 3) {
    const sectionLengths = sections.map(s => s.length);
    const avgLen = sectionLengths.reduce((a, b) => a + b, 0) / sectionLengths.length;
    const allSimilar = sectionLengths.every(len => Math.abs(len - avgLen) / avgLen < 0.3);
    if (allSimilar) {
      issues.push({
        type: 'formulaic_structure',
        description: 'כל הסקשנים באורך כמעט זהה — מבנה נוסחתי אופייני ל-AI',
        location: 'מבנה דף',
        severity: 'low',
        fixable: true,
      });
    }
  }
}

function checkFillerParagraphs(text: string, issues: HumanizationIssue[]): void {
  const paragraphs = text.split('\n').filter(p => p.trim().length > 30);
  const fillerPatterns = [
    /^(כידוע|ברור ש|אין ספק ש|מובן מאליו ש)/,
    /^(ישנם|ישנן|קיימים|קיימות) (מספר|כמה|לא מעט|מגוון)/,
  ];

  let fillerCount = 0;
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (fillerPatterns.some(p => p.test(trimmed))) {
      fillerCount++;
    }
  }

  if (fillerCount >= 2) {
    issues.push({
      type: 'filler_paragraphs',
      description: `נמצאו ${fillerCount} פסקאות מילוי ריקות שלא מוסיפות ערך`,
      location: 'לאורך כל התוכן',
      severity: fillerCount >= 4 ? 'high' : 'medium',
      fixable: true,
    });
  }
}

function checkUnnaturalTransitions(text: string, issues: HumanizationIssue[]): void {
  // מעברים לא טבעיים — כל פסקה מתחילה במילת קישור
  const paragraphs = text.split('\n').filter(p => p.trim().length > 20);
  if (paragraphs.length < 4) return;

  const transitionStarters = ['בנוסף', 'כמו כן', 'יתרה מכך', 'מעבר לכך', 'נוסף על כך', 'זאת ועוד', 'יתר על כן'];
  let transitionCount = 0;
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (transitionStarters.some(t => trimmed.startsWith(t))) {
      transitionCount++;
    }
  }

  const ratio = transitionCount / paragraphs.length;
  if (ratio > 0.4) {
    issues.push({
      type: 'unnatural_transitions',
      description: `${Math.round(ratio * 100)}% מהפסקאות מתחילות במילת קישור — מעברים לא טבעיים`,
      location: 'תחילת פסקאות',
      severity: ratio > 0.6 ? 'high' : 'medium',
      fixable: true,
    });
  }
}

// ============================================================================
// אנושיות תוכן עם AI — Humanize Content with AI
// ============================================================================

/**
 * משתמש ב-AI כדי לשכתב חלקים בעייתיים בלבד — לא משכתב את כל הדף
 */
export async function humanizeContent(
  item: ContentItem,
  issues: HumanizationIssue[],
  context: AutomationContext
): Promise<string> {
  const fixableIssues = issues.filter(i => i.fixable);
  if (fixableIssues.length === 0) return item.content;

  const issueDescriptions = fixableIssues
    .map(i => `- ${i.type}: ${i.description} (${i.location})`)
    .join('\n');

  const result = await generateWithAI(
    `אתה עורך תוכן מקצועי. המשימה שלך: לתקן סימני AI בתוכן קיים.
כללים חשובים:
1. תקן רק את הבעיות שצוינו — אל תשכתב הכל
2. שמור על המסר, המידע והמבנה הכללי
3. הוסף שונות באורך משפטים — חלקם קצרים, חלקם ארוכים
4. החלף פתיחות גנריות בפתיחה ספציפית לעסק
5. הסר חזרתיות — השתמש בחיבורים שונים
6. שמור על שפה מקצועית אבל טבעית ונגישה
7. העסק: "${context.businessName}", תחום: ${context.industry}
8. החזר את ה-HTML המתוקן בלבד, ללא הסברים`,
    `תוכן HTML לתיקון:
${item.content}

בעיות שנמצאו:
${issueDescriptions}

החזר את ה-HTML המתוקן בלבד.`,
    { temperature: 0.6, maxTokens: 4000 }
  );

  if (result.success && result.data) {
    return result.data as string;
  }

  return item.content;
}

// ============================================================================
// ביצוע אנושיות מלא — Execute Humanization
// ============================================================================

/**
 * מריץ ביקורת אנושיות על כל האתר ומתקן בעיות
 */
export async function executeHumanization(
  inventory: ContentInventory,
  connection: WPConnection,
  context: AutomationContext,
  options?: { dryRun?: boolean; minScoreThreshold?: number; maxPages?: number }
): Promise<HumanizationResult> {
  const dryRun = options?.dryRun ?? true;
  const minScoreThreshold = options?.minScoreThreshold ?? 70; // תקן דפים עם ציון נמוך מ-70
  const maxPages = options?.maxPages ?? 10;

  const audits: HumanizationAudit[] = [];
  const actions: SEOActionEntry[] = [];
  let pagesImproved = 0;
  let issuesFixed = 0;

  // שלב 1: ביקורת כל הדפים
  for (const item of inventory.items) {
    if (item.wordCount < 100) continue; // דלג על דפים קצרים מדי
    const audit = auditContentHumanness(item);
    audits.push(audit);
  }

  // שלב 2: מיון לפי ציון — הנמוכים ביותר קודם
  const pagesToFix = audits
    .filter(a => a.humanScore < minScoreThreshold && a.issues.some(i => i.fixable))
    .sort((a, b) => a.humanScore - b.humanScore)
    .slice(0, maxPages);

  // שלב 3: תיקון (אם לא dryRun)
  if (!dryRun) {
    for (const audit of pagesToFix) {
      const contentItem = inventory.items.find(i => i.id === audit.pageId);
      if (!contentItem) continue;

      const humanizedContent = await humanizeContent(contentItem, audit.issues, context);

      if (humanizedContent !== contentItem.content) {
        const updateResult = await updatePageContent(connection, audit.pageId, humanizedContent);

        if (updateResult.success) {
          pagesImproved++;
          issuesFixed += audit.issues.filter(i => i.fixable).length;

          actions.push({
            id: `humanize-${audit.pageId}-${Date.now()}`,
            planId: context.planId || '',
            date: new Date().toISOString(),
            pageId: audit.pageId,
            pageUrl: audit.pageUrl,
            pageTitle: audit.pageTitle,
            actionType: 'content_refreshed',
            module: 'humanization-engine',
            description: `שופר ציון אנושיות מ-${audit.humanScore} — תוקנו ${audit.issues.filter(i => i.fixable).length} בעיות AI`,
            beforeValue: contentItem.content.slice(0, 200),
            afterValue: humanizedContent.slice(0, 200),
            seoReason: 'תוכן שנשמע אנושי ומקצועי מדורג טוב יותר בגוגל ומשפר E-E-A-T',
            expectedImpact: audit.humanScore < 40 ? 'high' : 'medium',
            status: 'completed',
            isReversible: true,
            rollbackData: JSON.stringify({ pageId: audit.pageId, originalContent: contentItem.content }),
          });
        }
      }
    }
  }

  // תיעוד הניתוח
  const totalIssues = audits.reduce((sum, a) => sum + a.issues.length, 0);
  actions.push({
    id: `humanize-audit-${Date.now()}`,
    planId: context.planId || '',
    date: new Date().toISOString(),
    actionType: 'technical_issue_found',
    module: 'humanization-engine',
    description: `ביקורת אנושיות: ${audits.length} דפים נבדקו, ${totalIssues} בעיות נמצאו, ${pagesToFix.length} דפים זקוקים לתיקון`,
    seoReason: 'גילוי ותיקון טביעות AI שומר על אמינות ואיכות התוכן',
    expectedImpact: pagesToFix.length > 3 ? 'high' : 'medium',
    status: 'completed',
    isReversible: false,
  });

  return {
    pagesAudited: audits.length,
    pagesImproved,
    issuesFound: totalIssues,
    issuesFixed,
    audits,
    actions,
  };
}
