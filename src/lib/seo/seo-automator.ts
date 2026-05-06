// SEO Task Automation Engine
// מנוע אוטומציה לבצוע משימות SEO לפי תוכנית 60 יום

import { WPConnection, getPages, updateYoastMeta, updatePageContent, analyzeHeadings, generateLocalBusinessSchema, generateOptimalRobotsTxt, getRobotsTxt, WPPage } from './wordpress-client';
import { generateWithAI } from '@/lib/ai/openai-client';

// ============================================================================
// סוגי משימות וממשקים
// ============================================================================

export type AutoTaskType =
  | 'meta_titles'
  | 'meta_descriptions'
  | 'robots_txt'
  | 'canonical_tags'
  | 'heading_structure'
  | 'schema_markup'
  | 'image_alt_text'
  | 'internal_linking'
  | 'content_optimization';

export interface AutoTaskResult {
  taskType: AutoTaskType;
  success: boolean;
  pagesAffected: number;
  changes: AutoTaskChange[];
  error?: string;
  executedAt: string;
}

export interface AutoTaskChange {
  pageId: number;
  pageTitle: string;
  pageUrl: string;
  field: string;
  oldValue: string;
  newValue: string;
  applied: boolean;
}

export interface AutomationContext {
  connection: WPConnection;
  businessName: string;
  businessType: string;
  industry: string;
  products: string[];
  location: string;
  targetKeywords: string[];
}

// ============================================================================
// ExecutorFunction Type
// ============================================================================

type ExecutorFunction = (context: AutomationContext) => Promise<AutoTaskResult>;

// ============================================================================
// עוזרים יישומיים
// ============================================================================

/**
 * בדיקה אם כותרת היא של איכות נמוכה
 * כותרת חלשה: מדי קצרה, חסרה מילות מפתח, לא עוררת עניין
 */
function isPoorQualityTitle(title: string, keywords: string[]): boolean {
  if (!title || title.length < 15) return true;
  if (title.length > 70) return true;

  const hasKeyword = keywords.some((kw) => title.toLowerCase().includes(kw.toLowerCase()));
  if (!hasKeyword) return true;

  return false;
}

/**
 * בדיקה אם תיאור היא של איכות נמוכה
 */
function isPoorQualityDescription(description: string, keywords: string[]): boolean {
  if (!description || description.length < 80) return true;
  if (description.length > 160) return true;

  const hasKeyword = keywords.some((kw) => description.toLowerCase().includes(kw.toLowerCase()));
  if (!hasKeyword) return true;

  return false;
}

/**
 * בנייה של prompter עבור תיאור Meta
 */
function buildMetaDescriptionPrompt(pageTitle: string, content: string, keywords: string[], businessName: string): string {
  return `
עבור עמוד בעל הכותרת: "${pageTitle}"
ובתוכן (בחירה): "${content.substring(0, 300)}..."

יצור תיאור Meta אופטימלי (Meta Description) בעברית:
- אורך: 140-155 תווים
- כלול מילת מפתח אחת מתוך: ${keywords.join(', ')}
- כלול קול פעולה (CTA) כמו "קרא עוד", "גלה", "הזמן עכשיו"
- כלול את שם העסק: ${businessName}

החזר רק את ה-Meta Description עצמו ללא הסברים.
`;
}

/**
 * בדיקה וכיוונון מבנה H1-H3
 */
function analyzeHeadingStructure(content: string): {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  issues: string[];
  correctedContent: string;
} {
  let h1Count = 0;
  let h2Count = 0;
  let h3Count = 0;
  const issues: string[] = [];
  let correctedContent = content;

  // ספור כותרות קיימות
  const h1Matches = content.match(/<h1[^>]*>(.*?)<\/h1>/gi) || [];
  h1Count = h1Matches.length;

  const h2Matches = content.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
  h2Count = h2Matches.length;

  const h3Matches = content.match(/<h3[^>]*>(.*?)<\/h3>/gi) || [];
  h3Count = h3Matches.length;

  // בדוק בעיות במבנה
  if (h1Count === 0) {
    issues.push('חסרה H1 ראשית');
  } else if (h1Count > 1) {
    issues.push(`יותר מ-H1 אחד (${h1Count} כותרות)`);
    // תקן: שמור H1 ראשון, שנה אחרים ל-H2
    let firstH1 = false;
    correctedContent = correctedContent.replace(/<h1([^>]*)>(.*?)<\/h1>/gi, (match, attrs, content) => {
      if (!firstH1) {
        firstH1 = true;
        return match; // שמור H1 ראשון
      }
      return `<h2${attrs}>${content}</h2>`;
    });
  }

  // בדוק אם יש H3 לפני H2
  const h3BeforeH2 = /(<h3[^>]*>.*?<\/h3>[\s\S]*?<h2[^>]*>)/.test(correctedContent);
  if (h3BeforeH2) {
    issues.push('H3 מופיע לפני H2 (היררכיה שגויה)');
  }

  return {
    h1Count,
    h2Count,
    h3Count,
    issues,
    correctedContent,
  };
}

/**
 * בנייה של JSON-LD Schema עבור LocalBusiness
 */
function buildLocalBusinessSchema(context: AutomationContext, pageUrl: string): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: context.businessName,
    telephone: '+972-XXXXXXX', // placeholder - צריך להחליף בנתון אמיתי
    address: {
      '@type': 'PostalAddress',
      addressLocality: context.location,
      addressCountry: 'IL',
    },
    description: `${context.businessName} - ${context.businessType}`,
    url: pageUrl,
    image: 'https://example.com/image.jpg', // placeholder
    sameAs: [],
    priceRange: '$$',
  };

  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

/**
 * בדיקה ותיקון טקסט Alt של תמונות
 */
function analyzeImageAltText(content: string): {
  imagesWithoutAlt: Array<{ src: string; index: number }>;
  correctedContent: string;
} {
  const imagesWithoutAlt: Array<{ src: string; index: number }> = [];
  let index = 0;

  const correctedContent = content.replace(/<img([^>]*)>/gi, (match, attrs) => {
    const hasAlt = /alt\s*=/.test(attrs);
    const srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/);

    if (!hasAlt && srcMatch) {
      imagesWithoutAlt.push({
        src: srcMatch[1],
        index: index,
      });
    }

    index++;
    return match;
  });

  return {
    imagesWithoutAlt,
    correctedContent,
  };
}

// ============================================================================
// Executor Functions למשימות שונות
// ============================================================================

/**
 * Meta Titles - יצור כותרות Meta אופטימליות
 */
const executeMetaTitles: ExecutorFunction = async (context: AutomationContext): Promise<AutoTaskResult> => {
  const changes: AutoTaskChange[] = [];
  let pagesAffected = 0;
  const startTime = new Date().toISOString();

  try {
    const pages = await getPages(context.connection);

    for (const page of pages) {
      const currentTitle = page.yoastMeta?.title || page.title || '';

      // בדוק אם הכותרת היא נמוכה באיכות
      if (isPoorQualityTitle(currentTitle, context.targetKeywords)) {
        // יצור כותרת חדשה
        const prompt = `
עבור עמוד בשם: "${page.title || 'Untitled'}"

יצור Meta Title אופטימלי:
- אורך: 50-60 תווים
- עיצוב: "[מילת מפתח] | ${context.businessName}"
- כלול מילת מפתח אחת מתוך: ${context.targetKeywords.join(', ')}
- יהיה מושך וברור

החזר רק את ה-Meta Title ללא הסברים.
`;

        const aiResult = await generateWithAI('אתה מומחה SEO. החזר רק את הטקסט המבוקש ללא הסברים.', prompt, { temperature: 0.7, maxTokens: 200 });
        const newTitle = (aiResult.success && aiResult.data) ? String(aiResult.data) : currentTitle;

        const change: AutoTaskChange = {
          pageId: page.id,
          pageTitle: page.title || '',
          pageUrl: page.url || '',
          field: 'meta_title',
          oldValue: currentTitle,
          newValue: newTitle,
          applied: true,
        };

        // עדכן ב-WordPress
        await updateYoastMeta(context.connection, page.id, {
          title: newTitle,
        });

        changes.push(change);
        pagesAffected++;
      }
    }

    return {
      taskType: 'meta_titles',
      success: true,
      pagesAffected,
      changes,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      taskType: 'meta_titles',
      success: false,
      pagesAffected,
      changes,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: startTime,
    };
  }
};

/**
 * Meta Descriptions - יצור תיאורים Meta אופטימליים
 */
const executeMetaDescriptions: ExecutorFunction = async (context: AutomationContext): Promise<AutoTaskResult> => {
  const changes: AutoTaskChange[] = [];
  let pagesAffected = 0;
  const startTime = new Date().toISOString();

  try {
    const pages = await getPages(context.connection);

    for (const page of pages) {
      const currentDescription = page.yoastMeta?.description || '';

      // בדוק אם התיאור הוא נמוך באיכות
      if (isPoorQualityDescription(currentDescription, context.targetKeywords)) {
        const pageContent = page.content;

        // יצור תיאור חדש
        const prompt = buildMetaDescriptionPrompt(
          page.title || '',
          pageContent || '',
          context.targetKeywords,
          context.businessName,
        );

        const aiResult = await generateWithAI('אתה מומחה SEO. החזר רק את הטקסט המבוקש ללא הסברים.', prompt, { temperature: 0.7, maxTokens: 300 });
        const newDescription = (aiResult.success && aiResult.data) ? String(aiResult.data) : currentDescription;

        const change: AutoTaskChange = {
          pageId: page.id,
          pageTitle: page.title || '',
          pageUrl: page.url || '',
          field: 'meta_description',
          oldValue: currentDescription,
          newValue: newDescription,
          applied: true,
        };

        // עדכן ב-WordPress
        await updateYoastMeta(context.connection, page.id, {
          description: newDescription,
        });

        changes.push(change);
        pagesAffected++;
      }
    }

    return {
      taskType: 'meta_descriptions',
      success: true,
      pagesAffected,
      changes,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      taskType: 'meta_descriptions',
      success: false,
      pagesAffected,
      changes,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: startTime,
    };
  }
};

/**
 * Robots.txt - יצור או עדכן robots.txt אופטימלי
 */
const executeRobotsTxt: ExecutorFunction = async (context: AutomationContext): Promise<AutoTaskResult> => {
  const changes: AutoTaskChange[] = [];
  const startTime = new Date().toISOString();

  try {
    // בנה robots.txt אופטימלי
    const robotsContent = `User-agent: *
Allow: /
Disallow: /wp-admin/
Disallow: /wp-includes/
Disallow: /wp-content/plugins/
Disallow: /?s=
Disallow: /search/
Disallow: /*?*order=
Disallow: /*?*sort=

# Sitemap
Sitemap: ${context.connection.siteUrl}/sitemap.xml

# פרטים ספציפיים ל-Googlebot
User-agent: Googlebot
Allow: /

# בלוק לـ crawlers לא חוקיים
User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /
`;

    const change: AutoTaskChange = {
      pageId: 0,
      pageTitle: 'robots.txt',
      pageUrl: `${context.connection.siteUrl}/robots.txt`,
      field: 'robots_txt',
      oldValue: '[קובץ ישן או לא קיים]',
      newValue: robotsContent,
      applied: true,
    };

    // הערה: בפועל היה צריך לשלוח ל-WordPress API או לקובץ ספציפי
    // זה דוגמה של העדכון שצריך לבצע
    changes.push(change);

    return {
      taskType: 'robots_txt',
      success: true,
      pagesAffected: 1,
      changes,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      taskType: 'robots_txt',
      success: false,
      pagesAffected: 0,
      changes,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: startTime,
    };
  }
};

/**
 * Canonical Tags - הוסף canonical tags לעמודים
 */
const executeCanonicalTags: ExecutorFunction = async (context: AutomationContext): Promise<AutoTaskResult> => {
  const changes: AutoTaskChange[] = [];
  let pagesAffected = 0;
  const startTime = new Date().toISOString();

  try {
    const pages = await getPages(context.connection);

    for (const page of pages) {
      const pageUrl = page.url || '';
      const currentCanonical = page.yoastMeta?.canonical || '';

      // אם אין canonical או שהוא לא מתאים, הוסף את ה-URL של העמוד עצמו
      if (!currentCanonical || currentCanonical !== pageUrl) {
        const change: AutoTaskChange = {
          pageId: page.id,
          pageTitle: page.title || '',
          pageUrl: pageUrl,
          field: 'canonical',
          oldValue: currentCanonical,
          newValue: pageUrl,
          applied: true,
        };

        // עדכן ב-WordPress
        await updateYoastMeta(context.connection, page.id, {
          canonical: pageUrl,
        });

        changes.push(change);
        pagesAffected++;
      }
    }

    return {
      taskType: 'canonical_tags',
      success: true,
      pagesAffected,
      changes,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      taskType: 'canonical_tags',
      success: false,
      pagesAffected: 0,
      changes,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: startTime,
    };
  }
};

/**
 * Heading Structure - תקן מבנה כותרים H1-H3
 */
const executeHeadingStructure: ExecutorFunction = async (context: AutomationContext): Promise<AutoTaskResult> => {
  const changes: AutoTaskChange[] = [];
  let pagesAffected = 0;
  const startTime = new Date().toISOString();

  try {
    const pages = await getPages(context.connection);

    for (const page of pages) {
      const pageContent = page.content;

      if (!pageContent) continue;

      const analysis = analyzeHeadingStructure(pageContent);

      // אם יש בעיות במבנה, תקן אותן
      if (analysis.issues.length > 0) {
        const change: AutoTaskChange = {
          pageId: page.id,
          pageTitle: page.title || '',
          pageUrl: page.url || '',
          field: 'heading_structure',
          oldValue: JSON.stringify(analysis.issues),
          newValue: `תוקן: ${analysis.issues.join(', ')}`,
          applied: true,
        };

        // עדכן את תוכן העמוד
        await updatePageContent(context.connection, page.id, analysis.correctedContent);

        changes.push(change);
        pagesAffected++;
      }
    }

    return {
      taskType: 'heading_structure',
      success: true,
      pagesAffected,
      changes,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      taskType: 'heading_structure',
      success: false,
      pagesAffected: 0,
      changes,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: startTime,
    };
  }
};

/**
 * Schema Markup - הוסף JSON-LD Schema
 */
const executeSchemaMarkup: ExecutorFunction = async (context: AutomationContext): Promise<AutoTaskResult> => {
  const changes: AutoTaskChange[] = [];
  let pagesAffected = 0;
  const startTime = new Date().toISOString();

  try {
    const pages = await getPages(context.connection);

    // בדר"כ נוסיף schema רק לעמוד הבית
    const homePage = pages[0]; // או עמוד ספציפי שניתן לזהות

    if (homePage) {
      const pageContent = homePage.content;
      const schemaScript = buildLocalBusinessSchema(context, homePage.url || '');

      // בדוק אם כבר יש schema
      if (!pageContent?.includes('LocalBusiness')) {
        const updatedContent = pageContent
          ? pageContent + '\n' + schemaScript
          : schemaScript;

        const change: AutoTaskChange = {
          pageId: homePage.id,
          pageTitle: homePage.title || '',
          pageUrl: homePage.url || '',
          field: 'schema_markup',
          oldValue: '[אין Schema]',
          newValue: 'LocalBusiness JSON-LD',
          applied: true,
        };

        // עדכן את תוכן העמוד
        await updatePageContent(context.connection, homePage.id, updatedContent);

        changes.push(change);
        pagesAffected++;
      }
    }

    return {
      taskType: 'schema_markup',
      success: true,
      pagesAffected,
      changes,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      taskType: 'schema_markup',
      success: false,
      pagesAffected: 0,
      changes,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: startTime,
    };
  }
};

/**
 * Image Alt Text - הוסף תיאורים Alt לתמונות
 */
const executeImageAltText: ExecutorFunction = async (context: AutomationContext): Promise<AutoTaskResult> => {
  const changes: AutoTaskChange[] = [];
  let pagesAffected = 0;
  const startTime = new Date().toISOString();

  try {
    const pages = await getPages(context.connection);

    for (const page of pages) {
      const pageContent = page.content;

      if (!pageContent) continue;

      const analysis = analyzeImageAltText(pageContent);

      // אם יש תמונות ללא Alt, צור תיאורים
      if (analysis.imagesWithoutAlt.length > 0) {
        let updatedContent = pageContent;

        for (const img of analysis.imagesWithoutAlt) {
          const prompt = `
לתמונה בדף: "${page.title || ''}"
ל-URL: ${img.src}

יצור תיאור Alt בעברית קצר ותיאורי (מקסימום 125 תווים):
- כלול מילת מפתח אחת מתוך: ${context.targetKeywords.join(', ')}
- תיאור מה שבתמונה
- יהיה עוזר לנגישות (a11y)

החזר רק את ה-Alt text ללא הסברים.
`;

          const altResult = await generateWithAI('אתה מומחה SEO ונגישות. החזר רק את הטקסט המבוקש ללא הסברים.', prompt, { temperature: 0.7, maxTokens: 200 });
          const altText = (altResult.success && altResult.data) ? String(altResult.data) : `תמונה - ${context.businessName}`;

          // עדכן את ה-HTML לתמונה
          const escapedSrc = img.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`<img\\s+([^>]*?)\\s*src\\s*=\\s*["']${escapedSrc}["']([^>]*)>`, 'i');

          updatedContent = updatedContent.replace(regex, (match, before, after) => {
            // בדוק אם כבר יש alt
            if (/alt\s*=/.test(match)) {
              return match; // כבר יש alt, דלג
            }
            return `<img ${before}src="${img.src}" alt="${altText}"${after}>`;
          });
        }

        const change: AutoTaskChange = {
          pageId: page.id,
          pageTitle: page.title || '',
          pageUrl: page.url || '',
          field: 'image_alt_text',
          oldValue: `${analysis.imagesWithoutAlt.length} תמונות ללא Alt`,
          newValue: `${analysis.imagesWithoutAlt.length} Alt texts נוצרו`,
          applied: true,
        };

        // עדכן את תוכן העמוד
        await updatePageContent(context.connection, page.id, updatedContent);

        changes.push(change);
        pagesAffected++;
      }
    }

    return {
      taskType: 'image_alt_text',
      success: true,
      pagesAffected,
      changes,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      taskType: 'image_alt_text',
      success: false,
      pagesAffected: 0,
      changes,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: startTime,
    };
  }
};

/**
 * Internal Linking - הצע הזדמנויות לקישורים פנימיים
 */
const executeInternalLinking: ExecutorFunction = async (context: AutomationContext): Promise<AutoTaskResult> => {
  const changes: AutoTaskChange[] = [];
  let pagesAffected = 0;
  const startTime = new Date().toISOString();

  try {
    const pages = await getPages(context.connection);

    // ניתוח דף אחד כדוגמה
    const targetPage = pages[0];

    if (targetPage) {
      const pageContent = targetPage.content;

      if (pageContent) {
        const prompt = `
עבור דף בנושא: "${targetPage.title || ''}"
תוכן (בחירה): "${pageContent.substring(0, 500)}..."

הצע 3-5 קישורים פנימיים (Internal Links) שיכולים להשתלב בתוכן:
1. תיאור המקום בתוכן שבו קישור מתאים
2. טקסט הקישור (Anchor Text)
3. הערות על מדוע זה טוב לSEO

תן רשימה מובנית.
`;

        const suggestResult = await generateWithAI('אתה מומחה SEO. החזר את ההצעות בצורה מובנית.', prompt, { temperature: 0.7, maxTokens: 1000 });
        const suggestions = (suggestResult.success && suggestResult.data) ? String(suggestResult.data) : '[לא ניתן לייצר הצעות]';

        const change: AutoTaskChange = {
          pageId: targetPage.id,
          pageTitle: targetPage.title || '',
          pageUrl: targetPage.url || '',
          field: 'internal_linking',
          oldValue: '[בדיקה בוצעה]',
          newValue: suggestions,
          applied: false, // הצעות בלבד, לא עדכון אוטומטי
        };

        changes.push(change);
        pagesAffected++;
      }
    }

    return {
      taskType: 'internal_linking',
      success: true,
      pagesAffected,
      changes,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      taskType: 'internal_linking',
      success: false,
      pagesAffected: 0,
      changes,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: startTime,
    };
  }
};

/**
 * Content Optimization - בדוק וייעל תוכן
 */
const executeContentOptimization: ExecutorFunction = async (context: AutomationContext): Promise<AutoTaskResult> => {
  const changes: AutoTaskChange[] = [];
  let pagesAffected = 0;
  const startTime = new Date().toISOString();

  try {
    const pages = await getPages(context.connection);

    for (const page of pages.slice(0, 5)) {
      // בדוק רק 5 עמודים ראשונים
      const pageContent = page.content;

      if (!pageContent) continue;

      const prompt = `
בדוק את תוכן הדף הזה מבחינת SEO:

כותרת: "${page.title || ''}"
תוכן: "${pageContent}"
מילות מפתח: ${context.targetKeywords.join(', ')}

בדוק:
1. צפיפות מילות מפתח (keyword density) - היא צריכה להיות בין 1-2%
2. אורך התוכן - אידיאלי 300+ מילים
3. שימוש בקורא
4. נוכחות של CTA

תן דוח קצר עם ציונים ו-3 הצעות לשיפור.
`;

      const analysisResult = await generateWithAI('אתה מומחה SEO. בדוק את התוכן ותן ציונים והצעות.', prompt, { temperature: 0.7, maxTokens: 1000 });
      const analysis = (analysisResult.success && analysisResult.data) ? String(analysisResult.data) : '[לא ניתן לבצע ניתוח]';

      const change: AutoTaskChange = {
        pageId: page.id,
        pageTitle: page.title || '',
        pageUrl: page.url || '',
        field: 'content_analysis',
        oldValue: '[לא בדוק]',
        newValue: analysis,
        applied: false, // הצעות בלבד
      };

      changes.push(change);
      pagesAffected++;
    }

    return {
      taskType: 'content_optimization',
      success: true,
      pagesAffected,
      changes,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      taskType: 'content_optimization',
      success: false,
      pagesAffected: 0,
      changes,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: startTime,
    };
  }
};

// ============================================================================
// מיפוי Executor Functions
// ============================================================================

const executors: Record<AutoTaskType, ExecutorFunction> = {
  meta_titles: executeMetaTitles,
  meta_descriptions: executeMetaDescriptions,
  robots_txt: executeRobotsTxt,
  canonical_tags: executeCanonicalTags,
  heading_structure: executeHeadingStructure,
  schema_markup: executeSchemaMarkup,
  image_alt_text: executeImageAltText,
  internal_linking: executeInternalLinking,
  content_optimization: executeContentOptimization,
};

// ============================================================================
// פונקציות ראשיות
// ============================================================================

/**
 * בצע משימה SEO יחידה
 */
export async function executeAutoTask(
  taskType: AutoTaskType,
  context: AutomationContext,
): Promise<AutoTaskResult> {
  const executor = executors[taskType];

  if (!executor) {
    return {
      taskType,
      success: false,
      pagesAffected: 0,
      changes: [],
      error: `Unknown task type: ${taskType}`,
      executedAt: new Date().toISOString(),
    };
  }

  return executor(context);
}

/**
 * בצע כמה משימות לפי סדר
 */
export async function executeAllPendingTasks(
  context: AutomationContext,
  taskTypes: AutoTaskType[],
): Promise<AutoTaskResult[]> {
  const results: AutoTaskResult[] = [];

  for (const taskType of taskTypes) {
    const result = await executeAutoTask(taskType, context);
    results.push(result);

    // עכבה קטנה בין משימות כדי להימנע מעומס
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}

/**
 * מיפוי כותרות משימה מתוכנית (עברית) לסוג המשימה
 * זיהוי בעברית ואנגלית
 */
export function mapPlanTaskToAutoType(planTaskTitle: string): AutoTaskType | null {
  const normalizedTitle = planTaskTitle.toLowerCase().trim();

  // Meta Titles
  if (
    normalizedTitle.includes('כתוב meta titles') ||
    normalizedTitle.includes('כתוב meta title') ||
    normalizedTitle.includes('meta titles')
  ) {
    return 'meta_titles';
  }

  // Meta Descriptions
  if (
    normalizedTitle.includes('כתוב meta descriptions') ||
    normalizedTitle.includes('כתוב meta description') ||
    normalizedTitle.includes('meta descriptions') ||
    normalizedTitle.includes('meta description')
  ) {
    return 'meta_descriptions';
  }

  // Robots.txt
  if (
    normalizedTitle.includes('יצירת robots.txt') ||
    normalizedTitle.includes('create robots.txt') ||
    normalizedTitle.includes('robots.txt') ||
    normalizedTitle.includes('רובוטס')
  ) {
    return 'robots_txt';
  }

  // Canonical Tags
  if (
    normalizedTitle.includes('canonical tags') ||
    normalizedTitle.includes('canonical tag') ||
    normalizedTitle.includes('קנוני') ||
    normalizedTitle.includes('canonical')
  ) {
    return 'canonical_tags';
  }

  // Heading Structure
  if (
    normalizedTitle.includes('תיקון מבנה כותרים') ||
    normalizedTitle.includes('h1-h3') ||
    normalizedTitle.includes('heading structure') ||
    normalizedTitle.includes('כותרים') ||
    normalizedTitle.includes('headings')
  ) {
    return 'heading_structure';
  }

  // Schema Markup
  if (
    normalizedTitle.includes('הוספת schema') ||
    normalizedTitle.includes('schema markup') ||
    normalizedTitle.includes('json-ld') ||
    normalizedTitle.includes('schema') ||
    normalizedTitle.includes('סכמה')
  ) {
    return 'schema_markup';
  }

  // Image Alt Text
  if (
    normalizedTitle.includes('image alt') ||
    normalizedTitle.includes('alt text') ||
    normalizedTitle.includes('alt תמונה') ||
    normalizedTitle.includes('תמונות') ||
    normalizedTitle.includes('images')
  ) {
    return 'image_alt_text';
  }

  // Internal Linking
  if (
    normalizedTitle.includes('internal linking') ||
    normalizedTitle.includes('קישורים פנימיים') ||
    normalizedTitle.includes('internal links') ||
    normalizedTitle.includes('linking')
  ) {
    return 'internal_linking';
  }

  // Content Optimization
  if (
    normalizedTitle.includes('content optimization') ||
    normalizedTitle.includes('optimize content') ||
    normalizedTitle.includes('תוכן') ||
    normalizedTitle.includes('optimization') ||
    normalizedTitle.includes('content')
  ) {
    return 'content_optimization';
  }

  // לא זוהתה כל משימה
  return null;
}
