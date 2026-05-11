// מנוע רענון תוכן — זיהוי דפים שצריכים שיפור וביצוע שדרוגים כירורגיים
// Content Refresh Engine — detects pages needing improvement and performs surgical enhancements

import type { WPConnection } from './wordpress-client';
import { updatePageContent } from './wordpress-client';
import { generateWithAI } from '@/lib/ai/openai-client';
import type { ContentItem, ContentInventory } from './wp-content-inventory';
import { buildContentInventory } from './wp-content-inventory';
import type { SEOActionEntry } from './seo-action-log';
import { createActionLog } from './seo-action-log';
import type { AutomationContext } from './seo-automator';

// ============================================================================
// סוגים וממשקים
// ============================================================================

export interface ContentIssue {
  type:
    | 'thin_content'
    | 'missing_faq'
    | 'missing_internal_links'
    | 'weak_headings'
    | 'missing_schema'
    | 'weak_cta'
    | 'missing_entities'
    | 'weak_semantic_depth'
    | 'outdated_content'
    | 'missing_answer_block'
    | 'weak_introduction';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fixable: boolean;
}

export interface RefreshRecommendation {
  pageId: number;
  pageUrl: string;
  pageTitle: string;
  issues: ContentIssue[];
  overallScore: number; // 0-100 ציון איכות תוכן
  refreshPriority: 'critical' | 'high' | 'medium' | 'low';
  suggestedActions: string[]; // תיאורים בעברית
}

export interface RefreshResult {
  pagesAnalyzed: number;
  pagesRefreshed: number;
  sectionsAdded: number;
  headingsImproved: number;
  ctasAdded: number;
  recommendations: RefreshRecommendation[];
  actions: SEOActionEntry[];
}

// ============================================================================
// ניתוח איכות תוכן
// ============================================================================

/**
 * ניתוח איכות דף — מחשב ציון 0-100 ומחזיר רשימת בעיות
 */
export function analyzeContentQuality(
  item: ContentItem,
  context: AutomationContext
): { score: number; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  let score = 100;

  // --- אורך תוכן ---
  if (item.wordCount < 150) {
    issues.push({
      type: 'thin_content',
      severity: 'critical',
      description: `תוכן דל מאוד — רק ${item.wordCount} מילים (מינימום מומלץ: 300)`,
      fixable: true,
    });
    score -= 30;
  } else if (item.wordCount < 300) {
    issues.push({
      type: 'thin_content',
      severity: 'high',
      description: `תוכן קצר — ${item.wordCount} מילים (מינימום מומלץ: 300)`,
      fixable: true,
    });
    score -= 20;
  } else if (item.wordCount < 800) {
    // תוכן סביר אך לא אופטימלי
    score -= 5;
  }
  // תוכן מעל 800 מילים — בונוס
  if (item.wordCount >= 800) {
    score += 5;
  }

  // --- מבנה כותרות ---
  if (item.h1Count === 0) {
    issues.push({
      type: 'weak_headings',
      severity: 'critical',
      description: 'חסרה כותרת H1 ראשית',
      fixable: true,
    });
    score -= 15;
  } else if (item.h1Count > 1) {
    issues.push({
      type: 'weak_headings',
      severity: 'high',
      description: `יותר מכותרת H1 אחת (${item.h1Count})`,
      fixable: true,
    });
    score -= 10;
  }

  if (item.h2Count === 0 && item.wordCount > 200) {
    issues.push({
      type: 'weak_headings',
      severity: 'high',
      description: 'חסרות כותרות H2 — תוכן ארוך ללא מבנה',
      fixable: true,
    });
    score -= 10;
  }

  // בדיקת היררכיה — H3 בלי H2
  if (item.h3Count > 0 && item.h2Count === 0) {
    issues.push({
      type: 'weak_headings',
      severity: 'medium',
      description: 'כותרות H3 ללא H2 — היררכיה שבורה',
      fixable: true,
    });
    score -= 5;
  }

  // --- קישורים פנימיים ---
  if (item.internalLinks.length === 0) {
    issues.push({
      type: 'missing_internal_links',
      severity: 'high',
      description: 'אין קישורים פנימיים כלל — הדף מבודד',
      fixable: false, // דורש ידע על דפים אחרים
    });
    score -= 15;
  } else if (item.internalLinks.length < 2) {
    issues.push({
      type: 'missing_internal_links',
      severity: 'medium',
      description: `רק ${item.internalLinks.length} קישור פנימי (מומלץ 2+)`,
      fixable: false,
    });
    score -= 8;
  }

  // --- FAQ ---
  if (!item.hasFAQ) {
    issues.push({
      type: 'missing_faq',
      severity: 'medium',
      description: 'חסר בלוק שאלות ותשובות (FAQ)',
      fixable: true,
    });
    score -= 8;
  }

  // --- Schema ---
  if (!item.hasSchema) {
    issues.push({
      type: 'missing_schema',
      severity: 'medium',
      description: 'חסר Schema markup (JSON-LD)',
      fixable: true,
    });
    score -= 8;
  }

  // --- CTA ---
  if (!item.hasCTA) {
    issues.push({
      type: 'weak_cta',
      severity: 'medium',
      description: 'חסרה קריאה לפעולה (CTA)',
      fixable: true,
    });
    score -= 8;
  }

  // --- כיסוי תמונות ALT ---
  const imagesWithoutAlt = item.images.filter((img) => !img.alt || img.alt.trim() === '');
  if (imagesWithoutAlt.length > 0) {
    score -= Math.min(imagesWithoutAlt.length * 3, 10);
  }

  // --- עומק סמנטי — צפיפות מילות מפתח ואזכורי ישויות ---
  const plainLower = item.plainText.toLowerCase();
  const keywordsFound = context.targetKeywords.filter((kw) =>
    plainLower.includes(kw.toLowerCase())
  );
  const keywordCoverage = context.targetKeywords.length > 0
    ? keywordsFound.length / context.targetKeywords.length
    : 0;

  if (keywordCoverage < 0.2) {
    issues.push({
      type: 'weak_semantic_depth',
      severity: 'high',
      description: 'כיסוי מילות מפתח חלש מאוד — פחות מ-20%',
      fixable: true,
    });
    score -= 12;
  } else if (keywordCoverage < 0.5) {
    issues.push({
      type: 'weak_semantic_depth',
      severity: 'medium',
      description: 'כיסוי מילות מפתח בינוני — פחות מ-50%',
      fixable: true,
    });
    score -= 6;
  }

  // --- ישויות (שם עסק, מיקום, מוצרים) ---
  const entityMentions = [
    context.businessName,
    context.location,
    ...context.products,
  ].filter((e) => e && plainLower.includes(e.toLowerCase()));

  const totalEntities = 1 + (context.location ? 1 : 0) + context.products.length;
  if (totalEntities > 0 && entityMentions.length / totalEntities < 0.3) {
    issues.push({
      type: 'missing_entities',
      severity: 'medium',
      description: 'חסרים אזכורי ישויות (שם עסק, מיקום, מוצרים)',
      fixable: true,
    });
    score -= 6;
  }

  // --- בלוק תשובה (answer block) ---
  // בדיקה אם הפסקה הראשונה עונה ישירות על שאלה
  const firstParagraph = item.plainText.slice(0, 200);
  const hasDirectAnswer = firstParagraph.length > 40 &&
    (keywordsFound.length > 0 || plainLower.slice(0, 200).includes(context.businessName.toLowerCase()));
  if (!hasDirectAnswer) {
    issues.push({
      type: 'missing_answer_block',
      severity: 'medium',
      description: 'חסר בלוק תשובה ישירה בתחילת הדף',
      fixable: true,
    });
    score -= 6;
  }

  // --- הקדמה חלשה ---
  if (firstParagraph.length < 40) {
    issues.push({
      type: 'weak_introduction',
      severity: 'medium',
      description: 'הקדמה קצרה מדי או חסרה',
      fixable: true,
    });
    score -= 5;
  }

  // הגבל ציון ל-0-100
  score = Math.max(0, Math.min(100, score));

  return { score, issues };
}

// ============================================================================
// יצירת תוכן בעזרת AI
// ============================================================================

/**
 * יצירת סקשן תוכן חדש — 2-4 פסקאות בעברית שמוסיפות עומק סמנטי
 */
export async function generateContentSection(
  topic: string,
  pageContext: string,
  keywords: string[],
  businessName: string
): Promise<string> {
  const systemPrompt = `אתה כותב תוכן SEO מקצועי בעברית. אתה כותב סקשנים קצרים ותכליתיים שמוסיפים ערך אמיתי לדף.
כללים:
- כתוב 2-4 פסקאות בלבד
- שלב את מילות המפתח בצורה טבעית
- הוסף כותרת H2 מתאימה בתחילת הסקשן
- אל תחזור על תוכן שכבר קיים בדף
- כתוב בסגנון מקצועי ונגיש
- החזר HTML תקני`;

  const userPrompt = `צור סקשן תוכן חדש עבור הנושא: "${topic}"

שם העסק: ${businessName}
מילות מפתח לשלב: ${keywords.join(', ')}

הקשר הדף הנוכחי (קיצור):
${pageContext.substring(0, 500)}

החזר HTML בלבד (H2 + פסקאות). ללא הסברים.`;

  const result = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.7,
    maxTokens: 1500,
  });

  if (!result.success || !result.data) {
    return '';
  }

  let html = String(result.data);
  // ניקוי — הסר markdown wrapping אם קיים
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');
  return html.trim();
}

/**
 * יצירת בלוק תשובה — תשובה ישירה וקצרה (50-100 מילים) מתאימה למנועי AI
 */
export async function generateAnswerBlock(
  question: string,
  context: string,
  businessName: string
): Promise<string> {
  const systemPrompt = `אתה כותב תשובות ישירות וקצרות בעברית, מותאמות לציטוט על-ידי מנועי חיפוש AI (Google AI Overview, ChatGPT, Perplexity).
כללים:
- 50-100 מילים בלבד
- תשובה ישירה בלי הקדמה
- משפט פתיחה שעונה על השאלה מיד
- כלול את שם העסק כשרלוונטי
- החזר HTML: פסקה אחת עטופה ב-<p>`;

  const userPrompt = `שאלה: ${question}
שם עסק: ${businessName}
הקשר: ${context.substring(0, 400)}

כתוב בלוק תשובה ישירה. החזר HTML בלבד.`;

  const result = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.5,
    maxTokens: 500,
  });

  if (!result.success || !result.data) {
    return '';
  }

  let html = String(result.data);
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');
  return html.trim();
}

// ============================================================================
// רענון כירורגי של דף
// ============================================================================

/**
 * ביצוע שיפורים כירורגיים בדף — אף פעם לא כותב מחדש את כל הדף
 */
export async function refreshPageContent(
  item: ContentItem,
  issues: ContentIssue[],
  connection: WPConnection,
  context: AutomationContext
): Promise<{ success: boolean; changes: string[] }> {
  const changes: string[] = [];
  let content = item.content;
  const fixableIssues = issues.filter((i) => i.fixable);

  if (fixableIssues.length === 0) {
    return { success: true, changes: ['אין בעיות שניתנות לתיקון אוטומטי'] };
  }

  // --- תוכן דל: הוסף סקשן חדש ---
  const thinContent = fixableIssues.find((i) => i.type === 'thin_content');
  if (thinContent) {
    const topic = context.targetKeywords[0] || item.title;
    const section = await generateContentSection(
      topic,
      item.plainText,
      context.targetKeywords.slice(0, 3),
      context.businessName
    );
    if (section) {
      // הוסף לפני סוף התוכן
      content = insertBeforeClosing(content, section);
      changes.push('נוסף סקשן תוכן חדש לעמידה בסף תוכן מינימלי');
    }
  }

  // --- כותרות חלשות: תקן מבנה ---
  const weakHeadings = fixableIssues.filter((i) => i.type === 'weak_headings');
  if (weakHeadings.length > 0) {
    const headingResult = fixHeadingStructure(content, item);
    if (headingResult.changed) {
      content = headingResult.content;
      changes.push(...headingResult.changes);
    }
  }

  // --- בלוק תשובה חסר: הוסף בתחילת הדף ---
  const missingAnswer = fixableIssues.find((i) => i.type === 'missing_answer_block');
  if (missingAnswer) {
    const keyword = context.targetKeywords[0] || item.title;
    const question = `מה זה ${keyword}?`;
    const answerBlock = await generateAnswerBlock(
      question,
      item.plainText,
      context.businessName
    );
    if (answerBlock) {
      content = insertAfterFirstElement(content, answerBlock);
      changes.push('נוסף בלוק תשובה ישירה בתחילת הדף');
    }
  }

  // --- הקדמה חלשה: הוסף פסקת פתיחה ---
  const weakIntro = fixableIssues.find((i) => i.type === 'weak_introduction');
  if (weakIntro && !missingAnswer) {
    // רק אם לא כבר הוספנו answer block (שמשמש גם כהקדמה)
    const introSection = await generateContentSection(
      `הקדמה ל-${item.title}`,
      item.plainText.substring(0, 300),
      context.targetKeywords.slice(0, 2),
      context.businessName
    );
    if (introSection) {
      content = insertAfterFirstElement(content, introSection);
      changes.push('נוספה פסקת הקדמה משופרת');
    }
  }

  // --- CTA חסרה ---
  const weakCta = fixableIssues.find((i) => i.type === 'weak_cta');
  if (weakCta) {
    const ctaHtml = generateCTABlock(context.businessName, item.title);
    content = insertBeforeClosing(content, ctaHtml);
    changes.push('נוספה קריאה לפעולה (CTA)');
  }

  // --- עומק סמנטי חלש: הוסף סקשן עם מילות מפתח ---
  const weakSemantic = fixableIssues.find((i) => i.type === 'weak_semantic_depth');
  if (weakSemantic && !thinContent) {
    // רק אם לא כבר הוספנו תוכן בגלל thin_content
    const missingKeywords = context.targetKeywords.filter(
      (kw) => !item.plainText.toLowerCase().includes(kw.toLowerCase())
    );
    if (missingKeywords.length > 0) {
      const section = await generateContentSection(
        missingKeywords[0],
        item.plainText,
        missingKeywords.slice(0, 3),
        context.businessName
      );
      if (section) {
        content = insertBeforeClosing(content, section);
        changes.push('נוסף סקשן לשיפור עומק סמנטי');
      }
    }
  }

  // --- ישויות חסרות ---
  const missingEntities = fixableIssues.find((i) => i.type === 'missing_entities');
  if (missingEntities) {
    // הוסף אזכור ישויות בסוף התוכן
    const entityParagraph = buildEntityParagraph(context);
    if (entityParagraph) {
      content = insertBeforeClosing(content, entityParagraph);
      changes.push('נוספו אזכורי ישויות (שם עסק, מיקום, מוצרים)');
    }
  }

  // --- עדכן את הדף אם היו שינויים ---
  if (changes.length === 0) {
    return { success: true, changes: ['לא בוצעו שינויים'] };
  }

  const updateResult = await updatePageContent(connection, item.id, content);
  if (!updateResult.success) {
    return {
      success: false,
      changes: [`שגיאה בעדכון הדף: ${updateResult.error || 'שגיאה לא ידועה'}`],
    };
  }

  return { success: true, changes };
}

// ============================================================================
// אורקסטרציה ראשית
// ============================================================================

/**
 * הרצת רענון תוכן מלא — סריקה, ניתוח, ותיקון
 */
export async function executeContentRefresh(
  connection: WPConnection,
  context: AutomationContext,
  inventory?: ContentInventory,
  options?: {
    maxPagesPerRun?: number;
    minScoreThreshold?: number;
    dryRun?: boolean;
  }
): Promise<RefreshResult> {
  const maxPages = options?.maxPagesPerRun ?? 10;
  const minScore = options?.minScoreThreshold ?? 70;
  const dryRun = options?.dryRun ?? false;

  const actionLog = createActionLog();

  // שלב 1: בנה אינוונטורי אם לא סופק
  const inv = inventory ?? await buildContentInventory(connection);

  const result: RefreshResult = {
    pagesAnalyzed: 0,
    pagesRefreshed: 0,
    sectionsAdded: 0,
    headingsImproved: 0,
    ctasAdded: 0,
    recommendations: [],
    actions: [],
  };

  // שלב 2: נתח את כל הדפים
  const scored: Array<{ item: ContentItem; score: number; issues: ContentIssue[] }> = [];

  for (const item of inv.items) {
    const { score, issues } = analyzeContentQuality(item, context);
    result.pagesAnalyzed++;

    scored.push({ item, score, issues });
  }

  // שלב 3: מיין לפי ציון (הגרוע ביותר קודם) וסנן
  scored.sort((a, b) => a.score - b.score);
  const pagesToRefresh = scored
    .filter((s) => s.score < minScore)
    .slice(0, maxPages);

  // שלב 4: צור המלצות לכל הדפים מתחת לסף
  for (const { item, score, issues } of scored.filter((s) => s.score < minScore)) {
    const priority = score < 30 ? 'critical' : score < 50 ? 'high' : score < 70 ? 'medium' : 'low';
    const suggestedActions = issues.map((i) => i.description);

    result.recommendations.push({
      pageId: item.id,
      pageUrl: item.url,
      pageTitle: item.title,
      issues,
      overallScore: score,
      refreshPriority: priority,
      suggestedActions,
    });
  }

  // שלב 5: בצע רענון (אם לא dry run)
  if (!dryRun) {
    for (const { item, issues } of pagesToRefresh) {
      try {
        console.log(`[REFRESH] מרענן דף: ${item.title} (ID: ${item.id})`);
        const refreshResult = await refreshPageContent(item, issues, connection, context);

        if (refreshResult.success && refreshResult.changes.length > 0) {
          result.pagesRefreshed++;

          // ספור סוגי שינויים
          for (const change of refreshResult.changes) {
            if (change.includes('סקשן')) result.sectionsAdded++;
            if (change.includes('כותרת') || change.includes('H1') || change.includes('H2')) result.headingsImproved++;
            if (change.includes('CTA') || change.includes('קריאה לפעולה')) result.ctasAdded++;
          }

          // רשום בלוג פעולות
          actionLog.log({
            planId: context.planId || '',
            actionType: 'content_refreshed',
            module: 'content-refresh-engine',
            status: 'completed',
            pageId: item.id,
            pageUrl: item.url,
            pageTitle: item.title,
            description: `רענון תוכן: ${refreshResult.changes.join(', ')}`,
            seoReason: 'שיפור איכות תוכן ומבנה הדף לדירוג טוב יותר',
            expectedImpact: 'high',
            isReversible: true,
            rollbackData: JSON.stringify({ originalContent: item.content }),
          });
        }
      } catch (error) {
        console.error(`[REFRESH] שגיאה ברענון דף ${item.id}:`, error);
        actionLog.log({
          planId: context.planId || '',
          actionType: 'content_refreshed',
          module: 'content-refresh-engine',
          status: 'failed',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `שגיאה ברענון: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
          seoReason: 'שיפור איכות תוכן',
          expectedImpact: 'high',
          isReversible: false,
        });
      }
    }
  }

  result.actions = actionLog.getAllEntries();
  return result;
}

// ============================================================================
// פונקציות עזר פנימיות
// ============================================================================

/**
 * תיקון מבנה כותרות — H1 כפולות, היררכיה שבורה
 */
function fixHeadingStructure(
  content: string,
  item: ContentItem
): { content: string; changed: boolean; changes: string[] } {
  let result = content;
  const changes: string[] = [];
  let changed = false;

  // תקן H1 כפולות — שמור ראשון, המר את השאר ל-H2
  if (item.h1Count > 1) {
    let firstH1Found = false;
    result = result.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/gi, (match, attrs, text) => {
      if (!firstH1Found) {
        firstH1Found = true;
        return match;
      }
      changed = true;
      return `<h2${attrs}>${text}</h2>`;
    });
    if (changed) {
      changes.push(`תוקנו ${item.h1Count - 1} כותרות H1 כפולות → H2`);
    }
  }

  // אם אין H2 כלל ויש תוכן ארוך, נסה להוסיף H2 לפני פסקאות ארוכות
  if (item.h2Count === 0 && item.wordCount > 300) {
    // מידה שמרנית — לא מוסיפים כותרות אוטומטית, רק מדווחים
    changes.push('מומלץ להוסיף כותרות H2 ידנית לחלוקת התוכן');
  }

  return { content: result, changed, changes };
}

/**
 * הוספת תוכן לפני סוף התוכן (לפני התג האחרון או בסוף)
 */
function insertBeforeClosing(content: string, newHtml: string): string {
  // חפש את הפסקה/div האחרונה כדי להוסיף לפניה
  const lastBlockIndex = Math.max(
    content.lastIndexOf('</p>'),
    content.lastIndexOf('</div>'),
    content.lastIndexOf('</section>')
  );

  if (lastBlockIndex > 0) {
    return (
      content.substring(0, lastBlockIndex) +
      '\n\n' +
      newHtml +
      '\n\n' +
      content.substring(lastBlockIndex)
    );
  }

  // אם לא נמצא, הוסף בסוף
  return content + '\n\n' + newHtml;
}

/**
 * הוספת תוכן אחרי האלמנט הראשון (H1 או פסקה ראשונה)
 */
function insertAfterFirstElement(content: string, newHtml: string): string {
  // חפש סוף H1 הראשון
  const h1End = content.indexOf('</h1>');
  if (h1End > 0) {
    const insertPos = h1End + '</h1>'.length;
    return content.substring(0, insertPos) + '\n\n' + newHtml + '\n\n' + content.substring(insertPos);
  }

  // אם אין H1, חפש סוף פסקה ראשונה
  const pEnd = content.indexOf('</p>');
  if (pEnd > 0) {
    const insertPos = pEnd + '</p>'.length;
    return content.substring(0, insertPos) + '\n\n' + newHtml + '\n\n' + content.substring(insertPos);
  }

  // אחרת, הוסף בתחילה
  return newHtml + '\n\n' + content;
}

/**
 * יצירת בלוק CTA גנרי
 */
function generateCTABlock(businessName: string, pageTitle: string): string {
  return `<div class="cta-block" style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
<h3>רוצים לשמוע עוד?</h3>
<p>צרו קשר עם ${businessName} לייעוץ מקצועי בנושא ${pageTitle}.</p>
<a href="/contact" class="cta-button" style="display:inline-block;padding:12px 24px;background:#0073aa;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">צרו קשר עכשיו</a>
</div>`;
}

/**
 * בניית פסקת ישויות — שם עסק, מיקום, מוצרים
 */
function buildEntityParagraph(context: AutomationContext): string {
  const parts: string[] = [];

  if (context.businessName) {
    parts.push(context.businessName);
  }
  if (context.location) {
    parts.push(`ב${context.location}`);
  }
  if (context.products.length > 0) {
    const productList = context.products.slice(0, 3).join(', ');
    parts.push(`מתמחה ב${productList}`);
  }
  if (context.industry) {
    parts.push(`בתחום ה${context.industry}`);
  }

  if (parts.length < 2) return '';

  return `<p>${parts.join(' ')} — מעניקים שירות מקצועי ואמין ללקוחות בכל רחבי הארץ.</p>`;
}
