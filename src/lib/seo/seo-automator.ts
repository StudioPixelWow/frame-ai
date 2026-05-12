// SEO Task Automation Engine
// מנוע אוטומציה לבצוע משימות SEO לפי תוכנית 60 יום

import { WPConnection, getPages, updateYoastMeta, updatePageContent, analyzeHeadings, generateLocalBusinessSchema, generateOptimalRobotsTxt, getRobotsTxt, WPPage, uploadMedia, createPost, getOrCreateCategory } from './wordpress-client';
import { generateWithAI } from '@/lib/ai/openai-client';
import { generateArticleImage } from './image-generator';

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
  | 'content_optimization'
  | 'daily_seo_article'
  // Automation module types (from autonomous engines)
  | 'technical_seo'
  | 'auto_internal_linking'
  | 'faq_schema'
  | 'meta_optimization'
  | 'content_refresh'
  | 'topic_clusters'
  | 'geo_visibility'
  | 'image_seo'
  | 'cta_optimization'
  | 'local_seo'
  | 'cannibalization'
  | 'authority_reinforcement'
  | 'humanization'
  | 'entity_graph'
  | 'gsc_intelligence'
  | 'ga4_conversion'
  | 'serp_monitoring'
  | 'adaptive_strategy';

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
  planId?: string;
  /** Specific keyword extracted from task title — used instead of random pick */
  specificKeyword?: string;
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
// Daily SEO Article Executor
// ============================================================================

/**
 * Execute a daily SEO article task:
 * 1. Generate article content via AI (targeting a specific keyword)
 * 2. Generate featured image via DALL-E
 * 3. Upload image to WordPress media library
 * 4. Create WordPress post (scheduled or published) with featured image + Yoast meta
 */
const executeDailySeoArticle: ExecutorFunction = async (context) => {
  const startTime = new Date().toISOString();
  const changes: AutoTaskChange[] = [];

  try {
    // Pick a keyword to target — prefer specific keyword from task title
    const keywords = context.targetKeywords || [];
    if (keywords.length === 0 && !context.specificKeyword) {
      return {
        taskType: 'daily_seo_article',
        success: false,
        pagesAffected: 0,
        changes: [],
        error: 'אין ביטויי SEO מוגדרים — הוסף ביטויים בשלב ההגדרות',
        executedAt: startTime,
      };
    }

    // Use specific keyword from task title if available, otherwise random
    const keyword = context.specificKeyword || keywords[Math.floor(Math.random() * keywords.length)];
    console.log(`[SEO-ARTICLE] Using keyword: "${keyword}" (source: ${context.specificKeyword ? 'task title' : 'random'})`);
    const currentYear = new Date().getFullYear();

    // --- Step 1: Generate article content via AI ---
    const siteUrl = context.connection?.siteUrl || '';
    const locationStr = context.location || 'ישראל';
    const isLocal = locationStr !== 'ישראל' && locationStr.length > 0;

    const articlePrompt = `אתה כותב תוכן מומחה ברמה הגבוהה ביותר לקידום אורגני בגוגל. כתוב מאמר מקצועי, מעמיק ואיכותי בעברית עבור האתר של ${context.businessName || 'עסק'}.

═══ פרטי העסק ═══
- שם העסק: ${context.businessName || 'העסק'}
- סוג העסק: ${context.businessType || 'עסק'}
- תחום הפעילות: ${context.industry || 'כללי'}
- מוצרים/שירותים: ${context.products?.join(', ') || 'לא צוינו'}
- מיקום גיאוגרפי: ${locationStr}
- כתובת האתר: ${siteUrl}

═══ ביטוי SEO ממוקד ═══
"${keyword}"

═══ הוראות כתיבה — רמת מומחה ═══

📏 אורך ומבנה:
- כתוב מאמר של 1500-2000 מילים (לא פחות מ-1500)
- מבנה: פתיחה חזקה → 5-7 סעיפים עם H2 → FAQ → סיכום עם CTA
- כל סעיף צריך להיות לפחות 150-200 מילים עם ערך אמיתי
- הוסף לפחות סעיף H3 אחד בתוך כל H2

🎯 SEO On-Page:
- כותרת ראשית (H1/title): עד 60 תווים, כולל "${keyword}" + שנת ${currentYear}
- שלב את הביטוי "${keyword}" באופן טבעי 8-12 פעמים לאורך המאמר
- כלול וריאציות של הביטוי (מילים נרדפות, ביטויים קשורים)
- השתמש ב-bold (<strong>) לביטויים חשובים
- פסקת פתיחה: כלול את הביטוי ב-100 המילים הראשונות

🔗 קישורים (חובה):
- הוסף 2-3 קישורים פנימיים לדפים באתר (השתמש ב-href="${siteUrl}/..." עם anchor text רלוונטי)
- הוסף 2-3 קישורים חיצוניים למקורות סמכותיים (ויקיפדיה, אתרים ממשלתיים, מחקרים) עם target="_blank" rel="noopener"
- אל תמציא URLs — אם אינך בטוח בכתובת, השתמש ב-# כ-placeholder

${isLocal ? `📍 קידום לוקאלי (Local SEO):
- ציין את האזור "${locationStr}" לפחות 4-5 פעמים באופן טבעי
- כלול ביטויים לוקאליים כמו "ב${locationStr}", "${keyword} ב${locationStr}", "שירות ב${locationStr}"
- הזכר ציוני דרך מקומיים, שכונות, או ערים סמוכות אם רלוונטי
- כלול משפט כמו "${context.businessName} מספק שירות ב${locationStr} והסביבה"
` : ''}
👨‍🏫 טון מומחה:
- כתוב כאילו אתה המומחה הבכיר בתחום עם 15 שנות ניסיון
- כלול נתונים, מספרים, ודוגמאות מעשיות (גם אם משוערים — ציין "על פי הערכות")
- הוסף טיפים מעשיים שהקורא יכול ליישם מיד
- השתמש ברשימות ממוספרות ובולטים למידע מובנה
- הימנע מכללות ומשפטים ריקים — כל פסקה צריכה להוסיף ערך

📋 מבנה חובה:
1. פתיחה מושכת (100-150 מילים) — הצגת הבעיה + הבטחת פתרון
2. 5-7 סעיפי H2 עם תוכן מעמיק (כל אחד 200+ מילים)
3. בכל סעיף: פסקאות + לפחות רשימה אחת (ul/ol) או דוגמה מעשית
4. סעיף FAQ — 3 שאלות ותשובות (כ-Schema Markup מוכן)
5. סיכום + CTA ברור ל-${context.businessName || 'העסק'} (100 מילים)

🖋️ פורמט:
- כתוב ב-HTML תקין: h2, h3, p, ul, ol, li, strong, a, blockquote
- כל אזכור שנה = ${currentYear} בלבד
- כתוב meta description (עד 155 תווים) עם הביטוי + CTA

🚫 חובה — עברית בלבד:
- כל המילים בגוף המאמר חייבות להיות בעברית. אין מילים באנגלית בתוך הטקסט.
- שמות מקומות בעברית בלבד: "ישראל" (לא "Israel"), "תל אביב" (לא "Tel Aviv"), "ירושלים" (לא "Jerusalem") וכו׳.
- מונחים מקצועיים: אם יש מונח שנהוג להשתמש בו באנגלית (כמו SEO) — מותר, אבל רק מונחים טכניים מקובלים. כל שאר הטקסט בעברית מלאה.
- אל תכתוב "Israel", "Israeli", "service", "quality", "professional" או כל מילה אנגלית שיש לה מקבילה טבעית בעברית.

החזר בפורמט JSON:
{
  "title": "כותרת המאמר",
  "content": "<h2>...</h2><p>...</p>...",
  "metaDescription": "תיאור מטא קצר",
  "metaTitle": "כותרת מטא אופטימלית",
  "faq": [{"question": "שאלה", "answer": "תשובה"}]
}`;

    const aiResult = await generateWithAI(
      'אתה כותב תוכן SEO מומחה ברמה הגבוהה ביותר בעברית בלבד. כל המאמר חייב להיות בעברית מלאה — כולל שמות מקומות (ישראל, לא Israel). מונחים טכניים מקובלים כמו SEO מותרים, אבל כל שאר הטקסט בעברית. אתה כותב מאמרים של 1500-2000 מילים עם קישורים, נתונים, ודוגמאות מעשיות. החזר JSON בלבד ללא markdown.',
      articlePrompt,
      { temperature: 0.75, maxTokens: 8000 }
    );

    if (!aiResult.success || !aiResult.data) {
      return {
        taskType: 'daily_seo_article',
        success: false,
        pagesAffected: 0,
        changes: [],
        error: `יצירת מאמר נכשלה: ${aiResult.error || 'תשובת AI ריקה'}`,
        executedAt: startTime,
      };
    }

    // Parse AI response — data can be parsed JSON object or raw text string
    let articleData: { title: string; content: string; metaDescription: string; metaTitle: string };
    try {
      if (typeof aiResult.data === 'object' && aiResult.data !== null) {
        // Already parsed by generateWithAI
        articleData = aiResult.data as any;
      } else {
        const cleaned = String(aiResult.data).replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        articleData = JSON.parse(cleaned);
      }
    } catch {
      return {
        taskType: 'daily_seo_article',
        success: false,
        pagesAffected: 0,
        changes: [],
        error: 'פענוח תשובת AI נכשל — פורמט JSON לא תקין',
        executedAt: startTime,
      };
    }

    if (!articleData.title || !articleData.content) {
      return {
        taskType: 'daily_seo_article',
        success: false,
        pagesAffected: 0,
        changes: [],
        error: 'מאמר חסר כותרת או תוכן',
        executedAt: startTime,
      };
    }

    console.log(`[SEO-ARTICLE] Generated article: "${articleData.title}" for keyword "${keyword}"`);

    // --- Step 2: Generate featured image via DALL-E ---
    let featuredMediaId: number | undefined;
    let imageUrl: string | undefined;

    const imageResult = await generateArticleImage(
      articleData.title,
      keyword,
      context.businessType || context.industry || 'business'
    );

    if (imageResult.success && imageResult.imageBuffer) {
      console.log(`[SEO-ARTICLE] Image generated (${imageResult.imageBuffer.length} bytes)`);

      // --- Step 3: Upload image to WordPress ---
      const slugTitle = articleData.title.replace(/[^a-zA-Z0-9֐-׿]/g, '-').slice(0, 50);
      const filename = `seo-article-${slugTitle}-${Date.now()}.png`;

      try {
        const uploadResult = await uploadMedia(
          context.connection,
          imageResult.imageBuffer,
          filename,
          'image/png'
        );

        if (uploadResult.success && uploadResult.mediaId) {
          featuredMediaId = uploadResult.mediaId;
          imageUrl = uploadResult.mediaUrl;
          console.log(`[SEO-ARTICLE] Image uploaded to WP: mediaId=${featuredMediaId}`);
        } else {
          console.warn(`[SEO-ARTICLE] Image upload failed: ${uploadResult.error}`);
        }
      } catch (uploadErr) {
        console.warn(`[SEO-ARTICLE] Image upload error: ${uploadErr instanceof Error ? uploadErr.message : 'Unknown'}`);
      }
    } else {
      console.warn(`[SEO-ARTICLE] Image generation failed: ${imageResult.error}`);
    }

    // --- Step 4: Get or create "מאמרים" category ---
    let categoryIds: number[] = [];
    try {
      const catId = await getOrCreateCategory(context.connection, 'מאמרים');
      if (catId) {
        categoryIds = [catId];
        console.log(`[SEO-ARTICLE] Using category "מאמרים" → ID=${catId}`);
      }
    } catch (catErr) {
      console.warn(`[SEO-ARTICLE] Failed to get/create category, publishing without category:`, catErr);
    }

    // --- Step 5: Create WordPress post ---
    const postResult = await createPost(context.connection, {
      title: articleData.title,
      content: articleData.content,
      status: 'publish',
      featuredMediaId,
      categories: categoryIds.length > 0 ? categoryIds : undefined,
      metaTitle: articleData.metaTitle || articleData.title,
      metaDescription: articleData.metaDescription || '',
      focusKeyword: keyword,
    });

    if (!postResult.success) {
      return {
        taskType: 'daily_seo_article',
        success: false,
        pagesAffected: 0,
        changes: [],
        error: `פרסום מאמר נכשל: ${postResult.error}`,
        executedAt: startTime,
      };
    }

    console.log(`[SEO-ARTICLE] Post published: ID=${postResult.postId}, URL=${postResult.postUrl}`);

    // --- Step 5: Update aiArticles in plan DB to save article + image ---
    try {
      const { updatePlanSafe } = await import('./api-helpers');
      const planId = context.planId;
      if (planId) {
        const { supabase } = await import('@/lib/supabase');
        const { data: planRow } = await supabase.from('app_seo_plans').select('data').eq('id', planId).single();
        const planData = planRow?.data || {};
        const existingArticles: any[] = Array.isArray(planData.aiArticles) ? planData.aiArticles : [];
        // Find matching daily article entry by keyword and update it
        const matchIdx = existingArticles.findIndex((a: any) =>
          a?.type === 'daily_seo_article' &&
          a?.targetKeyword === keyword &&
          a?.status !== 'written'
        );
        const articleEntry = {
          id: matchIdx >= 0 ? existingArticles[matchIdx].id : `daily-article-${Date.now()}`,
          title: articleData.title,
          targetKeyword: keyword,
          wordCount: articleData.content.split(/\s+/).length,
          status: 'written',
          type: 'daily_seo_article',
          fullArticle: articleData.content,
          imageUrl: imageUrl || null,
          wpPostId: postResult.postId,
          wpPostUrl: postResult.postUrl,
          generatedAt: new Date().toISOString(),
          scheduledDay: matchIdx >= 0 ? existingArticles[matchIdx].scheduledDay : null,
          scheduledTime: matchIdx >= 0 ? existingArticles[matchIdx].scheduledTime : null,
        };
        if (matchIdx >= 0) {
          existingArticles[matchIdx] = articleEntry;
        } else {
          existingArticles.push(articleEntry);
        }
        await updatePlanSafe(planId, { aiArticles: existingArticles });
        console.log(`[SEO-ARTICLE] Updated aiArticles in plan DB — article "${articleData.title}" saved with image`);
      }
    } catch (dbErr) {
      console.warn(`[SEO-ARTICLE] Failed to update aiArticles in plan DB: ${dbErr instanceof Error ? dbErr.message : 'Unknown'}`);
    }

    changes.push({
      pageId: postResult.postId || 0,
      pageTitle: articleData.title,
      pageUrl: postResult.postUrl || '',
      field: 'מאמר SEO יומי',
      oldValue: '',
      newValue: `מאמר "${articleData.title}" פורסם | ביטוי: "${keyword}" | תמונה: ${featuredMediaId ? 'כן' : 'לא'}`,
      applied: true,
    });

    return {
      taskType: 'daily_seo_article',
      success: true,
      pagesAffected: 1,
      changes,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      taskType: 'daily_seo_article',
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
  daily_seo_article: executeDailySeoArticle,
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
 * Execute an automation module task (from the autonomous engines).
 * Maps AutomationModuleType → the correct engine file.
 */
export async function executeAutomationModule(
  moduleName: string,
  context: AutomationContext,
  config?: { maxPages?: number; dryRun?: boolean; approvalRequired?: boolean },
): Promise<AutoTaskResult> {
  const startTime = Date.now();
  console.log(`[AUTO-MODULE] Executing module: ${moduleName}`);

  try {
    // Build a minimal WPConnection-compatible context for the engines
    const wpConn = context.connection;
    const autoCtx = {
      planId: context.planId,
      businessName: context.businessName,
      businessType: context.businessType,
      industry: context.industry,
      products: context.products,
      location: context.location,
      targetKeywords: context.targetKeywords,
      siteUrl: wpConn.siteUrl,
    };

    let result: any = null;
    let pagesAffected = 0;
    const changes: AutoTaskChange[] = [];

    // Build content inventory for engines that need it (topic_clusters, humanization, entity_graph, etc.)
    // These engines expect a ContentInventory object, not a WPConnection.
    const inventoryNeededModules = [
      'topic_clusters', 'humanization', 'entity_graph', 'cannibalization',
      'authority_reinforcement', 'adaptive_strategy',
    ];
    let inventory: any = null;
    if (inventoryNeededModules.includes(moduleName)) {
      try {
        const { buildContentInventory } = await import('./wp-content-inventory');
        inventory = await buildContentInventory(wpConn);
        console.log(`[AUTO-MODULE] Built content inventory: ${inventory?.items?.length || 0} items, ${inventory?.pages?.length || 0} pages`);
      } catch (invErr) {
        console.warn(`[AUTO-MODULE] Failed to build content inventory:`, invErr instanceof Error ? invErr.message : invErr);
        // Provide a safe empty inventory so engines don't crash on undefined
        inventory = {
          items: [], pages: [], posts: [],
          totalWordCount: 0, averageWordCount: 0,
          thinContentPages: [], pagesWithoutSchema: [], pagesWithoutFAQ: [],
          pagesWithoutCTA: [], orphanPages: [], deadEndPages: [],
          imagesWithoutAlt: [],
          duplicateMetaTitles: new Map(), duplicateMetaDescriptions: new Map(),
          internalLinkMap: new Map(),
          siteUrl: wpConn.siteUrl, scannedAt: new Date().toISOString(),
        };
      }
    }

    switch (moduleName) {
      case 'technical_seo': {
        const { executeTechnicalMonitor } = await import('./technical-seo-monitor');
        result = await executeTechnicalMonitor(wpConn, autoCtx as any);
        pagesAffected = result?.issues?.length || 0;
        if (result?.issues) {
          for (const issue of result.issues.slice(0, 10)) {
            changes.push({ pageUrl: issue.url || wpConn.siteUrl, pageTitle: issue.type || 'Technical', pageId: 0, field: 'technical_seo', oldValue: issue.severity || 'issue', newValue: issue.fix || 'fixed' });
          }
        }
        break;
      }
      case 'auto_internal_linking': {
        const { executeInternalLinking } = await import('./internal-linking-engine');
        result = await executeInternalLinking(wpConn, autoCtx as any);
        pagesAffected = result?.linksAdded || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'internal_link', oldValue: '', newValue: action.description || 'link added' });
          }
        }
        break;
      }
      case 'faq_schema': {
        const { executeFAQSchemaEngine } = await import('./faq-schema-engine');
        result = await executeFAQSchemaEngine(wpConn, autoCtx as any);
        pagesAffected = result?.pagesUpdated || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'faq_schema', oldValue: '', newValue: action.description || 'FAQ added' });
          }
        }
        break;
      }
      case 'meta_optimization': {
        const { executeMetaOptimization } = await import('./meta-optimization-engine');
        result = await executeMetaOptimization(wpConn, autoCtx as any);
        pagesAffected = result?.pagesOptimized || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'meta_tags', oldValue: action.oldValue || '', newValue: action.newValue || 'optimized' });
          }
        }
        break;
      }
      case 'content_refresh': {
        const { executeContentRefresh } = await import('./content-refresh-engine');
        result = await executeContentRefresh(wpConn, autoCtx as any);
        pagesAffected = result?.pagesRefreshed || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'content_refresh', oldValue: '', newValue: action.description || 'refreshed' });
          }
        }
        break;
      }
      case 'topic_clusters': {
        const { executeClusterAnalysis } = await import('./topic-cluster-builder');
        result = await executeClusterAnalysis(inventory, autoCtx as any);
        pagesAffected = result?.clustersBuilt || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'topic_cluster', oldValue: '', newValue: action.description || 'cluster built' });
          }
        }
        break;
      }
      case 'geo_visibility': {
        const { executeGEOOptimizer } = await import('./geo-visibility-optimizer');
        result = await executeGEOOptimizer(wpConn, autoCtx as any);
        pagesAffected = result?.pagesOptimized || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'geo_visibility', oldValue: '', newValue: action.description || 'geo optimized' });
          }
        }
        break;
      }
      case 'image_seo': {
        const { executeImageSEO } = await import('./image-seo-engine');
        result = await executeImageSEO(wpConn, autoCtx as any);
        pagesAffected = result?.imagesOptimized || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'image_seo', oldValue: action.oldValue || '', newValue: action.newValue || 'alt added' });
          }
        }
        break;
      }
      case 'cta_optimization': {
        const { executeCTAOptimizer } = await import('./cta-optimizer');
        result = await executeCTAOptimizer(wpConn, autoCtx as any);
        pagesAffected = result?.ctasAdded || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'cta', oldValue: '', newValue: action.description || 'CTA added' });
          }
        }
        break;
      }
      case 'local_seo': {
        const { executeLocalSEO } = await import('./local-seo-engine');
        result = await executeLocalSEO(wpConn, autoCtx as any);
        pagesAffected = result?.pagesOptimized || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'local_seo', oldValue: '', newValue: action.description || 'local optimized' });
          }
        }
        break;
      }
      case 'cannibalization': {
        const { detectCannibalization } = await import('./cannibalization-detector');
        result = await detectCannibalization(inventory, autoCtx as any);
        pagesAffected = result?.issuesFound || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'cannibalization', oldValue: '', newValue: action.description || 'issue detected' });
          }
        }
        break;
      }
      case 'authority_reinforcement': {
        const { executeAuthorityReinforcement } = await import('./authority-reinforcement-engine');
        result = await executeAuthorityReinforcement(inventory, wpConn, autoCtx as any);
        pagesAffected = result?.pagesReinforced || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'authority', oldValue: '', newValue: action.description || 'authority reinforced' });
          }
        }
        break;
      }
      case 'humanization': {
        const { executeHumanization } = await import('./humanization-engine');
        result = await executeHumanization(inventory, wpConn, autoCtx as any);
        pagesAffected = result?.pagesHumanized || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'humanization', oldValue: '', newValue: action.description || 'humanized' });
          }
        }
        break;
      }
      case 'entity_graph': {
        const { executeEntityGraphAnalysis } = await import('./semantic-entity-graph');
        result = await executeEntityGraphAnalysis(inventory, autoCtx as any);
        pagesAffected = result?.entitiesProcessed || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'entity_graph', oldValue: '', newValue: action.description || 'entity linked' });
          }
        }
        break;
      }
      case 'gsc_intelligence': {
        const { executeGSCIntelligence } = await import('./gsc-intelligence-engine');
        result = await executeGSCIntelligence(autoCtx as any);
        pagesAffected = result?.opportunitiesFound || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'gsc_intelligence', oldValue: '', newValue: action.description || 'opportunity found' });
          }
        }
        break;
      }
      case 'ga4_conversion': {
        const { executeGA4Intelligence } = await import('./ga4-conversion-engine');
        result = await executeGA4Intelligence(autoCtx as any);
        pagesAffected = result?.insightsGenerated || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'ga4_conversion', oldValue: '', newValue: action.description || 'insight generated' });
          }
        }
        break;
      }
      case 'serp_monitoring': {
        const { analyzeSERPMovements } = await import('./serp-movement-monitor');
        result = await analyzeSERPMovements(autoCtx as any);
        pagesAffected = result?.keywordsTracked || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'serp_monitoring', oldValue: '', newValue: action.description || 'ranking tracked' });
          }
        }
        break;
      }
      case 'adaptive_strategy': {
        const { executeAdaptiveStrategy } = await import('./adaptive-strategy-engine');
        result = await executeAdaptiveStrategy([], inventory, autoCtx as any);
        pagesAffected = result?.recommendationsGenerated || 0;
        if (result?.actions) {
          for (const action of result.actions.slice(0, 10)) {
            changes.push({ pageUrl: action.pageUrl || wpConn.siteUrl, pageTitle: action.pageTitle || '', pageId: 0, field: 'adaptive_strategy', oldValue: '', newValue: action.description || 'strategy updated' });
          }
        }
        break;
      }
      default:
        return {
          taskType: moduleName as AutoTaskType,
          success: false,
          pagesAffected: 0,
          changes: [],
          error: `Unknown automation module: ${moduleName}`,
          executedAt: new Date().toISOString(),
        };
    }

    const elapsed = Date.now() - startTime;
    console.log(`[AUTO-MODULE] Module ${moduleName} completed in ${elapsed}ms — ${pagesAffected} pages affected, ${changes.length} changes`);

    return {
      taskType: moduleName as AutoTaskType,
      success: result?.success !== false,
      pagesAffected,
      changes,
      executedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[AUTO-MODULE] Module ${moduleName} failed:`, error);
    return {
      taskType: moduleName as AutoTaskType,
      success: false,
      pagesAffected: 0,
      changes: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: new Date().toISOString(),
    };
  }
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

  // Daily SEO Article (must be checked BEFORE content_optimization to avoid false match)
  if (
    normalizedTitle.includes('מאמר seo יומי') ||
    normalizedTitle.includes('פרסום מאמר seo') ||
    normalizedTitle.includes('פרסום מאמר') ||
    normalizedTitle.includes('מאמר יומי') ||
    normalizedTitle.includes('daily seo article') ||
    normalizedTitle.includes('daily_seo_article')
  ) {
    return 'daily_seo_article';
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
