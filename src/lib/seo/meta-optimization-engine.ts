// מנוע אופטימיזציית Meta מתקדם — מעבר ל-Meta בסיסי שקיים ב-seo-automator
// Advanced Meta Optimization Engine — goes beyond the basic meta in seo-automator.ts

import type { WPConnection } from './wordpress-client';
import { updateYoastMeta } from './wordpress-client';
import { generateWithAI } from '@/lib/ai/openai-client';
import type { ContentItem, ContentInventory } from './wp-content-inventory';
import { buildContentInventory } from './wp-content-inventory';
import type { SEOActionEntry } from './seo-action-log';
import { createActionLog } from './seo-action-log';
import type { AutomationContext } from './seo-automator';

// ============================================================================
// סוגים וממשקים
// ============================================================================

export interface MetaAuditResult {
  pageId: number;
  pageUrl: string;
  pageTitle: string;
  issues: MetaIssue[];
  currentMeta: {
    title: string;
    description: string;
    slug: string;
    ogTitle: string;
    ogDescription: string;
    focusKeyword: string;
  };
  optimizedMeta?: {
    title?: string;
    description?: string;
    slug?: string;
    ogTitle?: string;
    ogDescription?: string;
    focusKeyword?: string;
    secondaryKeywords?: string[];
  };
}

export interface MetaIssue {
  field: string;
  type: 'missing' | 'weak' | 'too_long' | 'too_short' | 'duplicate' | 'no_keyword' | 'low_ctr';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface MetaOptimizationResult {
  pagesAudited: number;
  pagesOptimized: number;
  titlesUpdated: number;
  descriptionsUpdated: number;
  slugsUpdated: number;
  focusKeywordsSet: number;
  audits: MetaAuditResult[];
  actions: SEOActionEntry[];
}

// ============================================================================
// מילות כוח לשיפור CTR
// ============================================================================

const POWER_WORDS_HE = [
  'מדריך', 'מלא', 'מקיף', 'חינם', 'מומלץ', 'הטוב ביותר',
  'חדש', 'מעודכן', 'בדוק', 'מוכח', 'מקצועי', 'פשוט',
  'מהיר', 'קל', 'יעיל', 'בטוח', 'אמין', 'מושלם',
  'סודות', 'טיפים', 'שלב אחר שלב', 'למתחילים', 'למומחים',
];

const POWER_WORDS_EN = [
  'guide', 'complete', 'free', 'best', 'top', 'ultimate',
  'proven', 'professional', 'easy', 'fast', 'essential',
  'updated', 'review', 'tips', 'secrets', 'step-by-step',
];

// ============================================================================
// ביקורת Meta
// ============================================================================

/**
 * ביקורת Meta מקיפה לדף בודד
 * בודק: חסרון, אורך, מילות מפתח, כפילויות, פוטנציאל CTR
 */
export function auditPageMeta(
  item: ContentItem,
  allItems: ContentItem[],
  context: AutomationContext
): MetaAuditResult {
  const issues: MetaIssue[] = [];

  const title = item.yoastMeta?.title || item.title || '';
  const description = item.yoastMeta?.description || '';
  const focusKeyword = item.yoastMeta?.focusKeyword || '';
  const slug = item.slug || '';

  // מטא נוכחית
  const currentMeta = {
    title,
    description,
    slug,
    ogTitle: title, // OG בדרך-כלל זהה ב-Yoast
    ogDescription: description,
    focusKeyword,
  };

  // --- כותרת ---
  if (!title || title.trim().length === 0) {
    issues.push({
      field: 'title',
      type: 'missing',
      description: 'חסרה כותרת Meta לחלוטין',
      severity: 'critical',
    });
  } else {
    if (title.length < 30) {
      issues.push({
        field: 'title',
        type: 'too_short',
        description: `כותרת Meta קצרה מדי (${title.length} תווים, מומלץ 30-60)`,
        severity: 'high',
      });
    }
    if (title.length > 60) {
      issues.push({
        field: 'title',
        type: 'too_long',
        description: `כותרת Meta ארוכה מדי (${title.length} תווים, מקסימום 60)`,
        severity: 'high',
      });
    }

    // בדוק מילת מפתח בכותרת
    const titleLower = title.toLowerCase();
    const hasKeywordInTitle = context.targetKeywords.some((kw) =>
      titleLower.includes(kw.toLowerCase())
    );
    if (!hasKeywordInTitle && context.targetKeywords.length > 0) {
      issues.push({
        field: 'title',
        type: 'no_keyword',
        description: 'כותרת Meta לא מכילה אף מילת מפתח יעד',
        severity: 'high',
      });
    }

    // בדוק פוטנציאל CTR — מילות כוח, מספרים, דחיפות
    const hasPowerWord = [...POWER_WORDS_HE, ...POWER_WORDS_EN].some((pw) =>
      titleLower.includes(pw.toLowerCase())
    );
    const hasNumber = /\d/.test(title);
    if (!hasPowerWord && !hasNumber) {
      issues.push({
        field: 'title',
        type: 'low_ctr',
        description: 'כותרת חלשה — חסרות מילות כוח או מספרים (CTR נמוך)',
        severity: 'medium',
      });
    }

    // בדוק כפילויות
    const duplicateTitles = allItems.filter(
      (other) =>
        other.id !== item.id &&
        (other.yoastMeta?.title || other.title || '').toLowerCase() === titleLower
    );
    if (duplicateTitles.length > 0) {
      issues.push({
        field: 'title',
        type: 'duplicate',
        description: `כותרת Meta זהה לדפים אחרים (${duplicateTitles.length} כפילויות)`,
        severity: 'high',
      });
    }
  }

  // --- תיאור ---
  if (!description || description.trim().length === 0) {
    issues.push({
      field: 'description',
      type: 'missing',
      description: 'חסר תיאור Meta לחלוטין',
      severity: 'critical',
    });
  } else {
    if (description.length < 80) {
      issues.push({
        field: 'description',
        type: 'too_short',
        description: `תיאור Meta קצר מדי (${description.length} תווים, מומלץ 80-160)`,
        severity: 'medium',
      });
    }
    if (description.length > 160) {
      issues.push({
        field: 'description',
        type: 'too_long',
        description: `תיאור Meta ארוך מדי (${description.length} תווים, מקסימום 160)`,
        severity: 'medium',
      });
    }

    // מילת מפתח בתיאור
    const descLower = description.toLowerCase();
    const hasKeywordInDesc = context.targetKeywords.some((kw) =>
      descLower.includes(kw.toLowerCase())
    );
    if (!hasKeywordInDesc && context.targetKeywords.length > 0) {
      issues.push({
        field: 'description',
        type: 'no_keyword',
        description: 'תיאור Meta לא מכיל אף מילת מפתח יעד',
        severity: 'medium',
      });
    }

    // כפילויות תיאור
    const duplicateDescs = allItems.filter(
      (other) =>
        other.id !== item.id &&
        (other.yoastMeta?.description || '').toLowerCase() === descLower
    );
    if (duplicateDescs.length > 0) {
      issues.push({
        field: 'description',
        type: 'duplicate',
        description: `תיאור Meta זהה לדפים אחרים (${duplicateDescs.length} כפילויות)`,
        severity: 'high',
      });
    }
  }

  // --- Focus Keyword ---
  if (!focusKeyword || focusKeyword.trim().length === 0) {
    issues.push({
      field: 'focusKeyword',
      type: 'missing',
      description: 'לא הוגדרה מילת מפתח מוקד (Focus Keyword) ב-Yoast',
      severity: 'medium',
    });
  }

  // --- Slug ---
  if (slug.length > 75) {
    issues.push({
      field: 'slug',
      type: 'too_long',
      description: `ה-Slug ארוך מדי (${slug.length} תווים) — קשה לקריאה ולשיתוף`,
      severity: 'low',
    });
  }

  // בדוק אם ה-slug מכיל מילים מיותרות
  const stopWords = ['את', 'של', 'על', 'עם', 'אל', 'מן', 'the', 'and', 'or', 'is', 'in', 'to', 'a'];
  const slugParts = slug.split('-');
  const hasStopWords = slugParts.some((p) => stopWords.includes(p.toLowerCase()));
  if (hasStopWords && slugParts.length > 4) {
    issues.push({
      field: 'slug',
      type: 'weak',
      description: 'ה-Slug מכיל מילים מיותרות — ניתן לקצר ולמקד',
      severity: 'low',
    });
  }

  return {
    pageId: item.id,
    pageUrl: item.url,
    pageTitle: item.title,
    issues,
    currentMeta,
  };
}

// ============================================================================
// יצירת Meta אופטימלי בעזרת AI
// ============================================================================

/**
 * יצירת כותרת SEO אופטימלית — 50-60 תווים, כוללת מילת מפתח + שם עסק
 */
export async function generateOptimizedTitle(
  page: ContentItem,
  context: AutomationContext
): Promise<string> {
  const keyword = context.targetKeywords[0] || page.title;

  const systemPrompt = `אתה מומחה SEO שכותב כותרות Meta מושלמות בעברית.
כללים קפדניים:
- אורך: 50-60 תווים בדיוק
- חובה לכלול את מילת המפתח: "${keyword}"
- חובה לכלול את שם העסק: ${context.businessName}
- השתמש במילות כוח (מדריך, מלא, מומלץ, הטוב ביותר, וכו')
- מבנה מומלץ: מילת מפתח + מילת כוח | שם עסק
- החזר רק את הכותרת עצמה, ללא הסברים`;

  const userPrompt = `כותרת הדף הנוכחית: "${page.title}"
תוכן הדף (קיצור): ${page.plainText.substring(0, 300)}
מילות מפתח: ${context.targetKeywords.join(', ')}

כתוב כותרת Meta אופטימלית. טקסט בלבד.`;

  const result = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.7,
    maxTokens: 200,
  });

  if (!result.success || !result.data) return '';
  return String(result.data).trim().replace(/^["']|["']$/g, '');
}

/**
 * יצירת תיאור Meta אופטימלי — 140-155 תווים, כולל מילת מפתח + CTA
 */
export async function generateOptimizedDescription(
  page: ContentItem,
  context: AutomationContext
): Promise<string> {
  const keyword = context.targetKeywords[0] || page.title;

  const systemPrompt = `אתה מומחה SEO שכותב תיאורי Meta מושלמים בעברית.
כללים קפדניים:
- אורך: 140-155 תווים בדיוק
- חובה לכלול את מילת המפתח: "${keyword}"
- חובה לכלול קריאה לפעולה (CTA): "גלו", "קראו", "הזמינו", "התחילו"
- כתוב משפט שמשכנע ללחוץ
- אל תכלול סימני פיסוק מיותרים
- החזר רק את התיאור עצמו`;

  const userPrompt = `כותרת הדף: "${page.title}"
תוכן הדף (קיצור): ${page.plainText.substring(0, 300)}
שם עסק: ${context.businessName}
מילות מפתח: ${context.targetKeywords.join(', ')}

כתוב תיאור Meta אופטימלי. טקסט בלבד.`;

  const result = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.7,
    maxTokens: 300,
  });

  if (!result.success || !result.data) return '';
  return String(result.data).trim().replace(/^["']|["']$/g, '');
}

/**
 * הצעת Slug אופטימלי — דטרמיניסטי, קצר, עשיר במילות מפתח
 */
export function suggestOptimalSlug(
  page: ContentItem,
  context: AutomationContext
): string {
  // מילות עצירה להסרה
  const stopWords = new Set([
    'את', 'של', 'על', 'עם', 'אל', 'מן', 'כל', 'הוא', 'היא', 'זה', 'זו',
    'אני', 'אנחנו', 'לא', 'כן', 'גם', 'או', 'אם', 'כי', 'מה', 'איך',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
    'this', 'that', 'these', 'those', 'it', 'its',
  ]);

  // התחל עם מילת המפתח הראשונה אם קיימת
  const keyword = context.targetKeywords[0] || '';
  const title = page.title || '';

  // פרק את הכותרת למילים
  let words = title
    .replace(/[^\w\s֐-׿-]/g, '') // שמור על עברית, אנגלית, מקפים
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase());

  // הסר מילות עצירה
  words = words.filter((w) => !stopWords.has(w));

  // אם יש מילת מפתח, וודא שהיא בהתחלה
  if (keyword) {
    const kwParts = keyword.toLowerCase().split(/\s+/);
    const kwInSlug = kwParts.filter((p) => !stopWords.has(p));
    // הסר מילות מפתח ממיקומם הנוכחי
    words = words.filter((w) => !kwInSlug.includes(w));
    // הוסף בהתחלה
    words = [...kwInSlug, ...words];
  }

  // הגבל ל-5 מילים
  words = words.slice(0, 5);

  // חבר עם מקפים
  let slug = words.join('-');

  // ניקוי — הסר מקפים כפולים ובקצוות
  slug = slug.replace(/-+/g, '-').replace(/^-|-$/g, '');

  // אם ריק, השתמש ב-slug הנוכחי
  return slug || page.slug;
}

// ============================================================================
// החלת אופטימיזציות
// ============================================================================

/**
 * החלת אופטימיזציות Meta על דפים
 */
export async function applyMetaOptimizations(
  audits: MetaAuditResult[],
  connection: WPConnection,
  dryRun: boolean = false,
  planId: string = ''
): Promise<MetaOptimizationResult> {
  const actionLog = createActionLog();
  const result: MetaOptimizationResult = {
    pagesAudited: audits.length,
    pagesOptimized: 0,
    titlesUpdated: 0,
    descriptionsUpdated: 0,
    slugsUpdated: 0,
    focusKeywordsSet: 0,
    audits,
    actions: [],
  };

  for (const audit of audits) {
    if (!audit.optimizedMeta) continue;
    if (audit.issues.length === 0) continue;

    const meta = audit.optimizedMeta;
    const updates: Record<string, string> = {};
    const changeDescriptions: string[] = [];

    // כותרת
    if (meta.title && meta.title !== audit.currentMeta.title) {
      updates.title = meta.title;
      changeDescriptions.push(`כותרת: "${audit.currentMeta.title}" → "${meta.title}"`);
      result.titlesUpdated++;
    }

    // תיאור
    if (meta.description && meta.description !== audit.currentMeta.description) {
      updates.description = meta.description;
      changeDescriptions.push(`תיאור: עודכן (${meta.description.length} תווים)`);
      result.descriptionsUpdated++;
    }

    // Focus Keyword
    if (meta.focusKeyword && meta.focusKeyword !== audit.currentMeta.focusKeyword) {
      updates.focusKeyword = meta.focusKeyword;
      changeDescriptions.push(`מילת מפתח מוקד: "${meta.focusKeyword}"`);
      result.focusKeywordsSet++;
    }

    if (Object.keys(updates).length === 0) continue;

    // קבע סוג פעולה לפי מה שעודכן
    const primaryActionType: import('./seo-action-log').SEOActionType =
      updates.title ? 'meta_title_updated' : 'meta_description_updated';

    if (dryRun) {
      actionLog.log({
        planId,
        actionType: primaryActionType,
        module: 'meta-optimization-engine',
        status: 'skipped',
        pageId: audit.pageId,
        pageUrl: audit.pageUrl,
        pageTitle: audit.pageTitle,
        description: `[DRY RUN] ${changeDescriptions.join(' | ')}`,
        seoReason: 'שיפור כותרות ותיאורי Meta לדירוג ו-CTR טובים יותר',
        expectedImpact: 'high',
        isReversible: false,
      });
      continue;
    }

    try {
      // עדכן Yoast Meta
      const yoastMeta: Record<string, string> = {};
      if (updates.title) yoastMeta.title = updates.title;
      if (updates.description) yoastMeta.description = updates.description;
      if (updates.focusKeyword) yoastMeta.focusKeyword = updates.focusKeyword;

      const updateResult = await updateYoastMeta(connection, audit.pageId, yoastMeta);

      if (updateResult.success) {
        result.pagesOptimized++;
        actionLog.log({
          planId,
          actionType: primaryActionType,
          module: 'meta-optimization-engine',
          status: 'completed',
          pageId: audit.pageId,
          pageUrl: audit.pageUrl,
          pageTitle: audit.pageTitle,
          description: changeDescriptions.join(' | '),
          beforeValue: JSON.stringify({
            title: audit.currentMeta.title,
            description: audit.currentMeta.description,
            focusKeyword: audit.currentMeta.focusKeyword,
          }),
          afterValue: JSON.stringify(updates),
          seoReason: 'שיפור כותרות ותיאורי Meta לדירוג ו-CTR טובים יותר',
          expectedImpact: 'high',
          isReversible: true,
          rollbackData: JSON.stringify({
            title: audit.currentMeta.title,
            description: audit.currentMeta.description,
            focusKeyword: audit.currentMeta.focusKeyword,
          }),
        });
      } else {
        actionLog.log({
          planId,
          actionType: primaryActionType,
          module: 'meta-optimization-engine',
          status: 'failed',
          pageId: audit.pageId,
          pageUrl: audit.pageUrl,
          pageTitle: audit.pageTitle,
          description: `שגיאה בעדכון: ${updateResult.error || 'שגיאה לא ידועה'}`,
          seoReason: 'שיפור Meta',
          expectedImpact: 'high',
          isReversible: false,
        });
      }
    } catch (error) {
      console.error(`[META] שגיאה בעדכון Meta לדף ${audit.pageId}:`, error);
      actionLog.log({
        planId,
        actionType: primaryActionType,
        module: 'meta-optimization-engine',
        status: 'failed',
        pageId: audit.pageId,
        pageUrl: audit.pageUrl,
        pageTitle: audit.pageTitle,
        description: `שגיאה: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
        seoReason: 'שיפור Meta',
        expectedImpact: 'high',
        isReversible: false,
      });
    }
  }

  result.actions = actionLog.getAllEntries();
  return result;
}

// ============================================================================
// אורקסטרציה ראשית
// ============================================================================

/**
 * הרצת אופטימיזציית Meta מלאה — ביקורת, יצירה, והחלה
 */
export async function executeMetaOptimization(
  connection: WPConnection,
  context: AutomationContext,
  inventory?: ContentInventory,
  options?: {
    maxPagesPerRun?: number;
    dryRun?: boolean;
  }
): Promise<MetaOptimizationResult> {
  const maxPages = options?.maxPagesPerRun ?? 20;
  const dryRun = options?.dryRun ?? false;

  // שלב 1: בנה אינוונטורי אם לא סופק
  const inv = inventory ?? await buildContentInventory(connection);

  // שלב 2: בקר את כל הדפים
  const audits: MetaAuditResult[] = [];
  for (const item of inv.items) {
    const audit = auditPageMeta(item, inv.items, context);
    audits.push(audit);
  }

  // שלב 3: מיין לפי חומרת בעיות (הקריטיות קודם)
  const severityWeight: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  audits.sort((a, b) => {
    const scoreA = a.issues.reduce((sum, i) => sum + (severityWeight[i.severity] || 0), 0);
    const scoreB = b.issues.reduce((sum, i) => sum + (severityWeight[i.severity] || 0), 0);
    return scoreB - scoreA;
  });

  // שלב 4: יצור Meta אופטימלי לדפים עם בעיות (עד maxPages)
  const auditsToOptimize = audits
    .filter((a) => a.issues.length > 0)
    .slice(0, maxPages);

  for (const audit of auditsToOptimize) {
    const item = inv.items.find((i) => i.id === audit.pageId);
    if (!item) continue;

    const optimized: MetaAuditResult['optimizedMeta'] = {};

    // כותרת — יצור אם חסרה, קצרה מדי, ארוכה מדי, ללא מילת מפתח, או CTR נמוך
    const titleIssues = audit.issues.filter((i) => i.field === 'title');
    if (titleIssues.length > 0) {
      const newTitle = await generateOptimizedTitle(item, context);
      if (newTitle) {
        optimized.title = newTitle;
        optimized.ogTitle = newTitle; // OG זהה
      }
    }

    // תיאור — יצור אם חסר, קצר, ארוך, או ללא מילת מפתח
    const descIssues = audit.issues.filter((i) => i.field === 'description');
    if (descIssues.length > 0) {
      const newDesc = await generateOptimizedDescription(item, context);
      if (newDesc) {
        optimized.description = newDesc;
        optimized.ogDescription = newDesc;
      }
    }

    // Slug — הצע אם ארוך או חלש
    const slugIssues = audit.issues.filter((i) => i.field === 'slug');
    if (slugIssues.length > 0) {
      const newSlug = suggestOptimalSlug(item, context);
      if (newSlug && newSlug !== item.slug) {
        optimized.slug = newSlug;
      }
    }

    // Focus Keyword — הגדר אם חסר
    const fkIssues = audit.issues.filter((i) => i.field === 'focusKeyword');
    if (fkIssues.length > 0 && context.targetKeywords.length > 0) {
      // בחר מילת מפתח רלוונטית — העדף מילה שמופיעה בתוכן
      const plainLower = item.plainText.toLowerCase();
      const bestKeyword = context.targetKeywords.find((kw) =>
        plainLower.includes(kw.toLowerCase())
      ) || context.targetKeywords[0];
      optimized.focusKeyword = bestKeyword;

      // מילות מפתח משניות
      optimized.secondaryKeywords = context.targetKeywords
        .filter((kw) => kw !== bestKeyword)
        .slice(0, 3);
    }

    // שמור אם יש שינויים
    if (Object.keys(optimized).length > 0) {
      audit.optimizedMeta = optimized;
    }
  }

  // שלב 5: החל שינויים
  const result = await applyMetaOptimizations(audits, connection, dryRun, context.planId || '');

  console.log(
    `[META] סיום — ${result.pagesAudited} דפים נבדקו, ` +
    `${result.pagesOptimized} עודכנו, ` +
    `${result.titlesUpdated} כותרות, ${result.descriptionsUpdated} תיאורים`
  );

  return result;
}
