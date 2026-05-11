// מנוע SEO לתמונות — שיפור אוטומטי של ALT, Title ונגישות תמונות
// Image SEO Engine — automatic ALT text, title, and accessibility improvements

import { WPConnection, updatePageContent } from './wordpress-client';
import { ContentItem, ContentInventory, ImageInfo, buildContentInventory } from './wp-content-inventory';
import { SEOActionEntry, SEOActionType } from './seo-action-log';
import { AutomationContext } from './seo-automator';
import { generateWithAI } from '@/lib/ai/openai-client';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface ImageAuditResult {
  pageId: number;
  pageUrl: string;
  pageTitle: string;
  images: ImageAuditItem[];
  issuesCount: number;
}

export interface ImageAuditItem {
  src: string;
  currentAlt: string;
  currentTitle: string;
  suggestedAlt: string;
  suggestedTitle: string;
  hasAlt: boolean;
  hasTitle: boolean;
  isOversized: boolean;
  isExternal: boolean;
  issues: string[];
}

export interface ImageSEOResult {
  pagesAudited: number;
  imagesFixed: number;
  altTextsAdded: number;
  titlesImproved: number;
  audits: ImageAuditResult[];
  actions: SEOActionEntry[];
}

// ============================================================================
// דפוסי ALT גנריים — Generic ALT Patterns (should be replaced)
// ============================================================================

const GENERIC_ALT_PATTERNS = [
  /^image$/i,
  /^img[_\-\s]?\d*/i,
  /^photo$/i,
  /^picture$/i,
  /^screenshot$/i,
  /^untitled$/i,
  /^dsc[_\-]?\d+/i,
  /^wp[_\-]image/i,
  /^attachment/i,
  /^\d+$/,
  /^image\s*\d+$/i,
  /^photo\s*\d+$/i,
  /^תמונה$/,
  /^תמונה\s*\d+$/,
];

// דפוסי URL שמרמזים על תמונות גדולות מדי
const OVERSIZED_URL_PATTERNS = [
  /[-_](\d{4,})x(\d{4,})\./,  // 4000x3000 ומעלה בשם הקובץ
  /original/i,
  /full[_-]?size/i,
  /uncompressed/i,
];

// ============================================================================
// בדיקת ALT גנרי — Is ALT Generic?
// ============================================================================

function isGenericAlt(alt: string): boolean {
  if (!alt || alt.trim().length === 0) return true;
  const trimmed = alt.trim();
  return GENERIC_ALT_PATTERNS.some(pattern => pattern.test(trimmed));
}

// ============================================================================
// זיהוי תמונה גדולה מדי — Detect Oversized Image
// ============================================================================

function isOversizedImage(src: string): boolean {
  return OVERSIZED_URL_PATTERNS.some(pattern => pattern.test(src));
}

// ============================================================================
// חילוץ רמזים משם הקובץ — Extract Filename Hints
// ============================================================================

function extractFilenameHints(src: string): string {
  try {
    const url = new URL(src, 'https://placeholder.com');
    const filename = url.pathname.split('/').pop() || '';
    // הסר סיומת ותווים מיוחדים
    const name = filename.replace(/\.[^.]+$/, '');
    // פצל על מקפים, קווים תחתונים ורווחים
    const words = name.split(/[-_\s]+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
    return words.join(' ');
  } catch {
    return '';
  }
}

// ============================================================================
// ביקורת תמונות בדף — Audit Page Images
// ============================================================================

/**
 * בודק כל תמונה בדף ומזהה בעיות SEO
 * בדיקות: ALT חסר/ריק, ALT גנרי, Title חסר, תמונות חיצוניות, תמונות גדולות מדי
 */
export function auditPageImages(
  item: ContentItem,
  context: AutomationContext
): ImageAuditResult {
  const auditItems: ImageAuditItem[] = [];

  for (const img of item.images) {
    const issues: string[] = [];

    // בדוק ALT חסר או ריק
    if (!img.hasAlt || !img.alt.trim()) {
      issues.push('חסר טקסט ALT — פוגע בנגישות וב-SEO');
    }

    // בדוק ALT גנרי
    if (img.hasAlt && isGenericAlt(img.alt)) {
      issues.push(`ALT גנרי "${img.alt}" — לא תורם ל-SEO`);
    }

    // בדוק Title חסר
    if (!img.hasTitle) {
      issues.push('חסר Title attribute — הזדמנות SEO שהוחמצה');
    }

    // בדוק תמונה חיצונית
    if (img.isExternal) {
      issues.push('תמונה חיצונית — מומלץ להעלות לשרת המקומי');
    }

    // בדוק תמונה גדולה מדי
    const oversized = isOversizedImage(img.src);
    if (oversized) {
      issues.push('תמונה עלולה להיות גדולה מדי — משפיע על מהירות טעינה');
    }

    auditItems.push({
      src: img.src,
      currentAlt: img.alt,
      currentTitle: img.title,
      suggestedAlt: '', // ימולא בשלב הבא עם AI
      suggestedTitle: '',
      hasAlt: img.hasAlt && !isGenericAlt(img.alt),
      hasTitle: img.hasTitle,
      isOversized: oversized,
      isExternal: img.isExternal,
      issues,
    });
  }

  return {
    pageId: item.id,
    pageUrl: item.url,
    pageTitle: item.title,
    images: auditItems,
    issuesCount: auditItems.reduce((sum, img) => sum + img.issues.length, 0),
  };
}

// ============================================================================
// יצירת ALT עם AI — Generate Image ALT with AI
// ============================================================================

/**
 * מייצר טקסט ALT תיאורי בעברית בהתבסס על הקשר הדף, שם הקובץ ומילות מפתח
 */
export async function generateImageAlt(
  imageSrc: string,
  pageTitle: string,
  pageContent: string,
  keywords: string[]
): Promise<string> {
  const filenameHints = extractFilenameHints(imageSrc);

  // קצר את התוכן כדי לא לחרוג ממגבלת טוקנים
  const truncatedContent = pageContent.substring(0, 500);

  const systemPrompt = `אתה מומחה SEO ונגישות. צור טקסט ALT בעברית לתמונה.
הטקסט חייב להיות:
- תיאורי וספציפי (לא גנרי)
- 5-15 מילים
- כולל מילת מפתח רלוונטית אם מתאים טבעית
- בעברית טבעית
- ללא "תמונה של" בתחילה
החזר רק את טקסט ה-ALT, בלי הסברים נוספים.`;

  const userPrompt = `כותרת הדף: ${pageTitle}
רמזים משם הקובץ: ${filenameHints || 'אין'}
מילות מפתח: ${keywords.join(', ')}
תוכן הדף (קטע): ${truncatedContent}

צור טקסט ALT מתאים לתמונה.`;

  try {
    const alt = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.3,
      maxTokens: 100,
    });
    return alt.trim().replace(/^["']|["']$/g, ''); // הסר גרשיים אם יש
  } catch (error) {
    // אם ה-AI נכשל, צור ALT בסיסי מהכותרת
    console.error('[IMAGE-SEO] שגיאה ביצירת ALT עם AI:', error);
    return `${pageTitle}${filenameHints ? ' - ' + filenameHints : ''}`;
  }
}

// ============================================================================
// החלפת תגיות IMG בתוכן — Apply Image Fixes
// ============================================================================

/**
 * מחליף תגיות img בתוכן הדף עם alt ו-title מתוקנים
 * במצב dryRun לא שומר לוורדפרס — רק מחזיר את התיקונים
 */
export async function applyImageFixes(
  audits: ImageAuditResult[],
  connection: WPConnection,
  dryRun: boolean = false
): Promise<{ pagesUpdated: number; imagesFixed: number }> {
  let pagesUpdated = 0;
  let imagesFixed = 0;

  for (const audit of audits) {
    // סנן רק תמונות שצריכות תיקון ויש להן הצעות
    const fixableImages = audit.images.filter(
      img => img.issues.length > 0 && (img.suggestedAlt || img.suggestedTitle)
    );

    if (fixableImages.length === 0) continue;

    // צריך לשלוף את התוכן הנוכחי מהחיבור — נשתמש בתוכן מה-audit
    // נבנה regex להחלפת כל תמונה
    let contentModified = false;
    let currentContent = ''; // יטען רק אם צריך

    // טען תוכן הדף — נעשה רק אם יש מה לתקן
    if (!dryRun) {
      // נקבל את התוכן מתוך ה-API
      try {
        const { buildSmartApiUrl } = await import('./wordpress-client');
        const pageUrl = buildSmartApiUrl(connection, `/pages/${audit.pageId}`);
        const response = await fetch(pageUrl, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${connection.username}:${connection.applicationPassword}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        });
        const pageData = await response.json();
        currentContent = pageData.content?.rendered || '';
      } catch (err) {
        console.error(`[IMAGE-SEO] שגיאה בטעינת תוכן דף ${audit.pageId}:`, err);
        continue;
      }
    }

    for (const img of fixableImages) {
      if (!currentContent && !dryRun) continue;

      if (!dryRun && currentContent) {
        // בנה regex לאיתור תגית IMG הספציפית
        const escapedSrc = img.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const imgRegex = new RegExp(`(<img\\s+[^>]*src=["']${escapedSrc}["'][^>]*)>`, 'gi');

        currentContent = currentContent.replace(imgRegex, (match, tagContent) => {
          let updated = tagContent;

          // עדכן ALT
          if (img.suggestedAlt) {
            if (/alt=["'][^"']*["']/i.test(updated)) {
              updated = updated.replace(/alt=["'][^"']*["']/i, `alt="${img.suggestedAlt}"`);
            } else {
              updated = updated + ` alt="${img.suggestedAlt}"`;
            }
          }

          // עדכן Title
          if (img.suggestedTitle) {
            if (/title=["'][^"']*["']/i.test(updated)) {
              updated = updated.replace(/title=["'][^"']*["']/i, `title="${img.suggestedTitle}"`);
            } else {
              updated = updated + ` title="${img.suggestedTitle}"`;
            }
          }

          contentModified = true;
          return updated + '>';
        });
      }

      imagesFixed++;
    }

    // שמור תוכן מעודכן לוורדפרס
    if (!dryRun && contentModified && currentContent) {
      try {
        await updatePageContent(connection, audit.pageId, currentContent);
        pagesUpdated++;
      } catch (err) {
        console.error(`[IMAGE-SEO] שגיאה בעדכון דף ${audit.pageId}:`, err);
      }
    }
  }

  return { pagesUpdated, imagesFixed };
}

// ============================================================================
// הרצה ראשית — Execute Image SEO
// ============================================================================

/**
 * מנוע SEO לתמונות — סורק את כל הדפים, מזהה בעיות ומתקן
 * שלב 1: ביקורת כל הדפים
 * שלב 2: יצירת ALT חכם עם AI
 * שלב 3: החלת התיקונים בתוכן
 */
export async function executeImageSEO(
  connection: WPConnection,
  context: AutomationContext,
  inventory?: ContentInventory,
  options?: { dryRun?: boolean; maxPages?: number }
): Promise<ImageSEOResult> {
  const startTime = Date.now();
  const actions: SEOActionEntry[] = [];
  const dryRun = options?.dryRun ?? false;
  const maxPages = options?.maxPages ?? 50;

  // שלב 1: בנה inventory אם לא סופק
  const inv = inventory || await buildContentInventory(connection);
  const itemsToProcess = inv.items.slice(0, maxPages);

  // שלב 2: בצע ביקורת על כל הדפים
  const audits: ImageAuditResult[] = [];
  for (const item of itemsToProcess) {
    if (item.images.length === 0) continue;
    const audit = auditPageImages(item, context);
    if (audit.issuesCount > 0) {
      audits.push(audit);
    }
  }

  // שלב 3: יצירת ALT עם AI לכל תמונה שצריכה
  let altTextsAdded = 0;
  let titlesImproved = 0;

  for (const audit of audits) {
    for (const img of audit.images) {
      // יצירת ALT אם חסר או גנרי
      if (!img.hasAlt || isGenericAlt(img.currentAlt)) {
        try {
          const item = itemsToProcess.find(i => i.id === audit.pageId);
          const suggestedAlt = await generateImageAlt(
            img.src,
            audit.pageTitle,
            item?.plainText || '',
            context.targetKeywords
          );
          img.suggestedAlt = suggestedAlt;
          altTextsAdded++;
        } catch (err) {
          console.error(`[IMAGE-SEO] שגיאה ביצירת ALT עבור ${img.src}:`, err);
        }
      }

      // יצירת Title אם חסר
      if (!img.hasTitle && img.suggestedAlt) {
        img.suggestedTitle = img.suggestedAlt;
        titlesImproved++;
      }
    }
  }

  // שלב 4: החלת התיקונים
  const { pagesUpdated, imagesFixed } = await applyImageFixes(audits, connection, dryRun);

  // שלב 5: תיעוד פעולות בלוג
  for (const audit of audits) {
    const fixedInPage = audit.images.filter(img => img.suggestedAlt || img.suggestedTitle);
    if (fixedInPage.length > 0) {
      actions.push({
        id: `img_${audit.pageId}_${Date.now()}`,
        planId: context.planId || 'manual',
        date: new Date().toISOString(),
        pageId: audit.pageId,
        pageUrl: audit.pageUrl,
        pageTitle: audit.pageTitle,
        actionType: 'image_alt_updated' as SEOActionType,
        module: 'image-seo-engine',
        description: `עודכנו ${fixedInPage.length} תמונות בדף "${audit.pageTitle}" — ALT ו-Title שופרו`,
        beforeValue: fixedInPage.map(i => `ALT: "${i.currentAlt}"`).join('; '),
        afterValue: fixedInPage.map(i => `ALT: "${i.suggestedAlt}"`).join('; '),
        seoReason: 'טקסט ALT תיאורי משפר נגישות, מאפשר לגוגל להבין את התמונות ומשפר דירוג תמונות',
        expectedImpact: 'medium',
        status: dryRun ? 'pending_approval' : 'completed',
        isReversible: true,
        rollbackData: JSON.stringify({
          pageId: audit.pageId,
          originalImages: fixedInPage.map(i => ({
            src: i.src,
            alt: i.currentAlt,
            title: i.currentTitle,
          })),
        }),
        executionTimeMs: Date.now() - startTime,
      });
    }
  }

  return {
    pagesAudited: audits.length,
    imagesFixed,
    altTextsAdded,
    titlesImproved,
    audits,
    actions,
  };
}
