// מנוע FAQ וסכמה מובנית — FAQ & Schema Markup Engine
// יוצר שאלות נפוצות חכמות ו-JSON-LD schemas עבור כל עמוד

import { WPConnection, updatePageContent, getPages, extractJsonLd } from './wordpress-client';
import {
  ContentItem,
  ContentInventory,
  buildContentInventory,
  stripHtml,
} from './wp-content-inventory';
import { generateWithAI } from '@/lib/ai/openai-client';
import { SEOActionEntry } from './seo-action-log';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface FAQItem {
  question: string;
  answer: string;
}

export interface SchemaRecommendation {
  pageId: number;
  pageUrl: string;
  pageTitle: string;
  missingSchemas: string[];     // סכמות חסרות: FAQPage, Article, Service, LocalBusiness, BreadcrumbList
  existingSchemas: string[];
  recommendedFAQs: FAQItem[];
  impactPriority: 'critical' | 'high' | 'medium' | 'low';
}

export interface FAQSchemaResult {
  pagesAnalyzed: number;
  faqsAdded: number;
  schemasAdded: number;
  recommendations: SchemaRecommendation[];
  actions: SEOActionEntry[];
}

// ============================================================================
// AutomationContext (ייבוא מהמודול המרכזי)
// ============================================================================

interface AutomationContext {
  connection: WPConnection;
  businessName: string;
  businessType: string;
  industry: string;
  products: string[];
  location: string;
  targetKeywords: string[];
  planId?: string;
}

// ============================================================================
// ניתוח פערי סכמה — Schema Gap Analysis
// ============================================================================

/**
 * בודק כל עמוד באתר ומזהה סכמות חסרות
 * מייצר שאלות נפוצות רלוונטיות באמצעות AI
 */
export async function analyzeSchemaGaps(
  inventory: ContentInventory,
  context: AutomationContext
): Promise<SchemaRecommendation[]> {
  const recommendations: SchemaRecommendation[] = [];

  for (const item of inventory.items) {
    // ניתוח סכמות קיימות
    const existingSchemas = getExistingSchemaTypes(item.content);

    // קביעת סכמות מומלצות לפי סוג העמוד
    const pageType = classifyPageType(item);
    const recommendedSchemaTypes = getRecommendedSchemas(pageType);
    const missingSchemas = recommendedSchemaTypes.filter(s => !existingSchemas.includes(s));

    // אם אין פערים, דלג
    if (missingSchemas.length === 0) continue;

    // יצירת FAQ באמצעות AI — רק אם FAQPage חסר
    let recommendedFAQs: FAQItem[] = [];
    if (missingSchemas.includes('FAQPage')) {
      try {
        recommendedFAQs = await generateFAQsWithAI(item, context);
      } catch (err) {
        console.warn(`[FAQ-ENGINE] שגיאה ביצירת FAQ לעמוד ${item.id}:`, err);
        recommendedFAQs = [];
      }
    }

    // חישוב עדיפות
    const priority = calculateSchemaPriority(missingSchemas, pageType, item);

    recommendations.push({
      pageId: item.id,
      pageUrl: item.url,
      pageTitle: item.title,
      missingSchemas,
      existingSchemas,
      recommendedFAQs,
      impactPriority: priority,
    });
  }

  // מיון לפי עדיפות
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.impactPriority] - priorityOrder[b.impactPriority]);

  return recommendations;
}

// ============================================================================
// יצירת FAQ עם AI
// ============================================================================

/**
 * שולח את תוכן העמוד ל-AI ומקבל שאלות נפוצות רלוונטיות
 */
async function generateFAQsWithAI(
  item: ContentItem,
  context: AutomationContext
): Promise<FAQItem[]> {
  const plainText = stripHtml(item.content);
  // חיתוך תוכן ל-1500 תווים כדי לא לחרוג ממגבלת הפרומפט
  const excerpt = plainText.substring(0, 1500);

  const keywords = context.targetKeywords.length > 0
    ? context.targetKeywords.join(', ')
    : context.products.join(', ');

  const systemPrompt = `אתה מומחה SEO ו-GEO ישראלי שיוצר שאלות נפוצות (FAQ) בעברית — מותאמות גם לציטוט על-ידי מנועי AI (Google AI Overview, ChatGPT, Perplexity, Gemini).
התשובות שלך תמיד מדויקות, מותאמות לתוכן העמוד, וכוללות מילות מפתח בצורה טבעית.
אתה מחזיר תמיד JSON תקין בלבד, ללא טקסט נוסף.`;

  const userPrompt = `עבור עמוד בנושא: "${item.title}"
תוכן העמוד: "${excerpt}"
תחום עסקי: ${context.businessType}
מילות מפתח: ${keywords}

צור 4-6 שאלות נפוצות (FAQ) בעברית — מותאמות לתבניות חיפוש ישראליות ולמנועי AI:

תבניות שאלה מומלצות לשוק הישראלי:
- "מה ההבדל בין X ל-Y" (השוואה)
- "כמה עולה [שירות] בישראל" (מחיר)
- "איך [verb] [object] בישראל" (תהליך)
- "מה זה [term]" (הגדרה — מועדף ע"י AI)
- "האם [product/service] שווה" (שיקול)
- "מי הכי טוב ב[service] בישראל" (המלצה)

כללים:
- שאלות שאנשים באמת מחפשים בגוגל ושואלים מנועי AI
- תשובות קצרות ומדויקות (2-4 משפטים) — אופטימלי לציטוט AI
- תשובה ראשונה = ישירה (ללא "בוא נדבר..." / "זו שאלה מצוינת...")
- כלול מילות מפתח בצורה טבעית (כולל צורות מורפולוגיות: סמיכות, רבים)
- שאלות מגוונות: מה, למה, איך, כמה, מתי, האם, מי

החזר JSON array: [{"question": "...", "answer": "..."}]`;

  const result = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.7,
    maxTokens: 2000,
  });

  if (!result.success || !result.data) {
    console.warn(`[FAQ-ENGINE] AI לא הצליח לייצר FAQ לעמוד "${item.title}"`);
    return [];
  }

  try {
    // ניקוי התוצאה — הסרת markdown code blocks אם קיימים
    let jsonStr = String(result.data).trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    const faqs: FAQItem[] = JSON.parse(jsonStr);

    // וידוא מבנה
    if (!Array.isArray(faqs)) return [];
    return faqs
      .filter(f => f.question && f.answer && typeof f.question === 'string' && typeof f.answer === 'string')
      .slice(0, 6); // מקסימום 6 שאלות
  } catch (parseErr) {
    console.warn(`[FAQ-ENGINE] שגיאה בפענוח JSON מ-AI:`, parseErr);
    return [];
  }
}

// ============================================================================
// יצירת HTML ו-Schema — HTML & Schema Generators
// ============================================================================

/**
 * בונה קטע HTML מעוצב עבור שאלות נפוצות
 */
export function generateFAQHTML(faqs: FAQItem[]): string {
  if (faqs.length === 0) return '';

  let html = `\n<div class="faq-section" itemscope itemtype="https://schema.org/FAQPage">\n`;
  html += `<h2>שאלות נפוצות</h2>\n`;

  for (const faq of faqs) {
    html += `<div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">\n`;
    html += `  <h3 itemprop="name">${escapeHtml(faq.question)}</h3>\n`;
    html += `  <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">\n`;
    html += `    <p itemprop="text">${escapeHtml(faq.answer)}</p>\n`;
    html += `  </div>\n`;
    html += `</div>\n`;
  }

  html += `</div>\n`;
  return html;
}

/**
 * בונה FAQPage JSON-LD Schema
 */
export function generateFAQSchema(faqs: FAQItem[]): string {
  if (faqs.length === 0) return '';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
}

/**
 * בונה Article JSON-LD Schema
 */
export function generateArticleSchema(
  page: ContentItem,
  context: AutomationContext
): string {
  const plainText = stripHtml(page.content);
  const description = plainText.substring(0, 160).replace(/\s+/g, ' ').trim();

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description,
    url: page.url,
    author: {
      '@type': 'Organization',
      name: context.businessName,
    },
    publisher: {
      '@type': 'Organization',
      name: context.businessName,
    },
  };

  // הוספת מילות מפתח ככאלו שקיימות
  if (context.targetKeywords.length > 0) {
    schema.keywords = context.targetKeywords.join(', ');
  }

  // הוספת תאריכים אם זמינים
  if ((page as any).datePublished) {
    schema.datePublished = (page as any).datePublished;
  }
  if ((page as any).dateModified) {
    schema.dateModified = (page as any).dateModified;
  }

  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
}

/**
 * בונה Service JSON-LD Schema
 */
export function generateServiceSchema(
  page: ContentItem,
  context: AutomationContext
): string {
  const plainText = stripHtml(page.content);
  const description = plainText.substring(0, 200).replace(/\s+/g, ' ').trim();

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.title,
    description,
    url: page.url,
    provider: {
      '@type': 'LocalBusiness',
      name: context.businessName,
    },
  };

  // הוספת אזור שירות אם יש מיקום
  if (context.location) {
    schema.areaServed = {
      '@type': 'Place',
      name: context.location,
    };
  }

  // הוספת קטגוריה
  if (context.industry) {
    schema.serviceType = context.industry;
  }

  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
}

/**
 * בונה BreadcrumbList JSON-LD Schema
 */
export function generateBreadcrumbSchema(
  page: ContentItem,
  siteUrl: string
): string {
  const breadcrumbs: { name: string; url: string }[] = [];

  // דף הבית תמיד ראשון
  breadcrumbs.push({
    name: 'דף הבית',
    url: siteUrl.replace(/\/+$/, ''),
  });

  // פירוק הנתיב ל-breadcrumbs
  try {
    const parsed = new URL(page.url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    let currentPath = '';
    for (let i = 0; i < pathParts.length; i++) {
      currentPath += `/${pathParts[i]}`;
      const isLast = i === pathParts.length - 1;
      const name = isLast ? page.title : formatSlugAsTitle(pathParts[i]);

      breadcrumbs.push({
        name,
        url: `${parsed.origin}${currentPath}`,
      });
    }
  } catch {
    // אם ה-URL לא תקין, הוסף רק את העמוד הנוכחי
    breadcrumbs.push({ name: page.title, url: page.url });
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };

  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
}

// ============================================================================
// החלת FAQ וסכמה — Apply FAQ & Schema
// ============================================================================

/**
 * מחיל את המלצות הסכמה על העמודים:
 * מוסיף קטע FAQ לתוכן, מוסיף JSON-LD script tags
 */
export async function applyFAQAndSchema(
  recommendations: SchemaRecommendation[],
  connection: WPConnection,
  context: AutomationContext,
  dryRun: boolean = false
): Promise<{ applied: number; failed: number; actions: SEOActionEntry[] }> {
  let appliedCount = 0;
  let failedCount = 0;
  const actions: SEOActionEntry[] = [];

  // טעינת תוכן עדכני של כל העמודים
  const pages = await getPages(connection);
  const pageContentMap = new Map<number, string>();
  const pageUrlMap = new Map<number, string>();
  for (const page of pages) {
    pageContentMap.set(page.id, page.content);
    pageUrlMap.set(page.id, page.url);
  }

  const siteUrl = extractSiteUrl(pages);

  for (const rec of recommendations) {
    let content = pageContentMap.get(rec.pageId);
    if (!content) {
      failedCount++;
      continue;
    }

    let contentModified = false;
    const schemasAdded: string[] = [];

    // הוספת FAQ — תוכן HTML + Schema
    if (rec.missingSchemas.includes('FAQPage') && rec.recommendedFAQs.length > 0) {
      const faqHtml = generateFAQHTML(rec.recommendedFAQs);
      const faqSchema = generateFAQSchema(rec.recommendedFAQs);

      // הכנס את ה-FAQ לפני סוף התוכן
      content = insertBeforeClosing(content, faqHtml);
      content = appendSchema(content, faqSchema);
      contentModified = true;
      schemasAdded.push('FAQPage');
    }

    // הוספת Article Schema
    if (rec.missingSchemas.includes('Article')) {
      const item = inventoryItemFromPage(rec, content);
      const articleSchema = generateArticleSchema(item, context);
      content = appendSchema(content, articleSchema);
      contentModified = true;
      schemasAdded.push('Article');
    }

    // הוספת Service Schema
    if (rec.missingSchemas.includes('Service')) {
      const item = inventoryItemFromPage(rec, content);
      const serviceSchema = generateServiceSchema(item, context);
      content = appendSchema(content, serviceSchema);
      contentModified = true;
      schemasAdded.push('Service');
    }

    // הוספת BreadcrumbList Schema
    if (rec.missingSchemas.includes('BreadcrumbList')) {
      const item = inventoryItemFromPage(rec, content);
      const breadcrumbSchema = generateBreadcrumbSchema(item, siteUrl);
      content = appendSchema(content, breadcrumbSchema);
      contentModified = true;
      schemasAdded.push('BreadcrumbList');
    }

    // שמירת התוכן המעודכן
    if (contentModified) {
      if (!dryRun) {
        try {
          await updatePageContent(connection, rec.pageId, content);
          appliedCount++;
        } catch (err: any) {
          failedCount++;
          console.error(`[FAQ-ENGINE] שגיאה בשמירת עמוד ${rec.pageId}:`, err.message);
          continue;
        }
      } else {
        appliedCount++;
      }

      // רישום פעולות
      if (schemasAdded.includes('FAQPage')) {
        actions.push({
          id: `faq-${rec.pageId}-${Date.now()}`,
          planId: context.planId || '',
          date: new Date().toISOString(),
          actionType: 'faq_added',
          module: 'faq-schema-engine',
          status: 'completed',
          pageId: rec.pageId,
          pageUrl: rec.pageUrl,
          pageTitle: rec.pageTitle,
          description: `נוספו ${rec.recommendedFAQs.length} שאלות נפוצות + FAQPage Schema`,
          seoReason: 'שאלות נפוצות משפרות את הסיכוי להופיע בתוצאות חיפוש מוצגות (Rich Results)',
          expectedImpact: rec.impactPriority,
          isReversible: true,
          rollbackData: JSON.stringify({ faqCount: rec.recommendedFAQs.length }),
        });
      }

      for (const schemaType of schemasAdded.filter(s => s !== 'FAQPage')) {
        actions.push({
          id: `schema-${rec.pageId}-${schemaType}-${Date.now()}`,
          planId: context.planId || '',
          date: new Date().toISOString(),
          actionType: 'schema_added',
          module: 'faq-schema-engine',
          status: 'completed',
          pageId: rec.pageId,
          pageUrl: rec.pageUrl,
          pageTitle: rec.pageTitle,
          description: `נוסף ${schemaType} Schema`,
          seoReason: `סכמת ${schemaType} עוזרת לגוגל להבין את תוכן העמוד ולהציג תוצאות עשירות`,
          expectedImpact: rec.impactPriority,
          isReversible: true,
          rollbackData: JSON.stringify({ schemaType }),
        });
      }
    }
  }

  return { applied: appliedCount, failed: failedCount, actions };
}

// ============================================================================
// תזמור — Orchestration
// ============================================================================

export interface FAQSchemaOptions {
  maxPagesPerRun?: number;
  dryRun?: boolean;
}

/**
 * הרצה מלאה של מנוע FAQ + Schema:
 * בניית מלאי → ניתוח פערים → יצירת FAQ → החלה
 */
export async function executeFAQSchemaEngine(
  connection: WPConnection,
  context: AutomationContext,
  inventory?: ContentInventory,
  options: FAQSchemaOptions = {}
): Promise<FAQSchemaResult> {
  const {
    maxPagesPerRun = 20,
    dryRun = false,
  } = options;

  const actions: SEOActionEntry[] = [];

  console.log('[FAQ-ENGINE] שלב 1: בניית מלאי תוכן...');
  const inv = inventory || await buildContentInventory(connection);

  console.log(`[FAQ-ENGINE] שלב 2: ניתוח פערי סכמה (${inv.items.length} עמודים)...`);
  let recommendations = await analyzeSchemaGaps(inv, context);

  // הגבלת מספר עמודים לריצה
  if (recommendations.length > maxPagesPerRun) {
    console.log(`[FAQ-ENGINE] מגביל ל-${maxPagesPerRun} עמודים מתוך ${recommendations.length}`);
    recommendations = recommendations.slice(0, maxPagesPerRun);
  }

  const totalFaqsToAdd = recommendations.reduce(
    (sum, r) => sum + r.recommendedFAQs.length, 0
  );
  const totalSchemasToAdd = recommendations.reduce(
    (sum, r) => sum + r.missingSchemas.length, 0
  );

  console.log(
    `[FAQ-ENGINE] שלב 3: החלת ${totalFaqsToAdd} שאלות נפוצות ו-${totalSchemasToAdd} סכמות (dryRun=${dryRun})...`
  );

  const result = await applyFAQAndSchema(recommendations, connection, context, dryRun);
  actions.push(...result.actions);

  console.log(
    `[FAQ-ENGINE] סיום: ${result.applied} עמודים עודכנו, ${result.failed} נכשלו`
  );

  return {
    pagesAnalyzed: inv.items.length,
    faqsAdded: totalFaqsToAdd,
    schemasAdded: totalSchemasToAdd,
    recommendations,
    actions,
  };
}

// ============================================================================
// פונקציות עזר — Helper Functions
// ============================================================================

/** חילוץ סוגי סכמה קיימים מתוכן HTML */
function getExistingSchemaTypes(content: string): string[] {
  const schemas = extractJsonLd(content);
  const types: string[] = [];

  for (const schema of schemas) {
    if (schema['@type']) {
      const schemaType = Array.isArray(schema['@type'])
        ? schema['@type']
        : [schema['@type']];
      types.push(...schemaType);
    }
  }

  return types;
}

/** סיווג סוג העמוד לפי תוכן, כותרת ו-slug */
type PageType = 'article' | 'service' | 'location' | 'faq' | 'homepage' | 'generic';

function classifyPageType(item: ContentItem): PageType {
  const title = item.title.toLowerCase();
  const slug = item.slug.toLowerCase();
  const plainContent = stripHtml(item.content).toLowerCase();

  // דף הבית
  if (slug === '' || slug === 'home' || slug === 'homepage' || slug === 'דף-הבית') {
    return 'homepage';
  }

  // עמוד FAQ קיים
  if (
    title.includes('שאלות') || title.includes('faq') ||
    slug.includes('faq') || slug.includes('שאלות')
  ) {
    return 'faq';
  }

  // עמוד שירות
  const serviceIndicators = ['שירות', 'service', 'מחיר', 'pricing', 'חבילות', 'packages', 'הזמנ'];
  if (serviceIndicators.some(s => title.includes(s) || slug.includes(s))) {
    return 'service';
  }

  // עמוד מיקום
  const locationIndicators = ['סניף', 'branch', 'מיקום', 'location', 'כתובת', 'address', 'צור קשר', 'contact'];
  if (locationIndicators.some(s => title.includes(s) || slug.includes(s))) {
    return 'location';
  }

  // מאמר/בלוג — תוכן ארוך עם כותרות משנה
  const headingCount = item.headings.length;
  const contentLength = plainContent.length;
  if (contentLength > 800 && headingCount >= 2) {
    return 'article';
  }

  return 'generic';
}

/** קביעת סכמות מומלצות לפי סוג עמוד */
function getRecommendedSchemas(pageType: PageType): string[] {
  switch (pageType) {
    case 'article':
      return ['Article', 'FAQPage', 'BreadcrumbList'];
    case 'service':
      return ['Service', 'FAQPage', 'BreadcrumbList'];
    case 'location':
      return ['LocalBusiness', 'BreadcrumbList'];
    case 'faq':
      return ['FAQPage'];
    case 'homepage':
      return ['LocalBusiness'];
    case 'generic':
      return ['FAQPage', 'BreadcrumbList'];
    default:
      return ['BreadcrumbList'];
  }
}

/** חישוב עדיפות לפי פערים ומשקל העמוד */
function calculateSchemaPriority(
  missingSchemas: string[],
  pageType: PageType,
  item: ContentItem
): 'critical' | 'high' | 'medium' | 'low' {
  // עמודי שירות ודף הבית — עדיפות גבוהה
  if (pageType === 'homepage' && missingSchemas.includes('LocalBusiness')) return 'critical';
  if (pageType === 'service' && missingSchemas.includes('Service')) return 'critical';

  // הרבה סכמות חסרות
  if (missingSchemas.length >= 3) return 'high';

  // מאמרים ארוכים ללא schema כלשהי
  const contentLength = stripHtml(item.content).length;
  if (pageType === 'article' && contentLength > 2000) return 'high';

  // FAQPage חסר — תמיד לפחות medium
  if (missingSchemas.includes('FAQPage')) return 'medium';

  return 'low';
}

/** הכנסת תוכן לפני סוף התוכן — לפני תגית סגירה אחרונה */
function insertBeforeClosing(content: string, insertion: string): string {
  // חפש את הפסקה האחרונה ותכניס לפניה
  const lastParagraphEnd = content.lastIndexOf('</p>');
  if (lastParagraphEnd !== -1) {
    const insertPoint = lastParagraphEnd + 4; // אחרי </p>
    return content.substring(0, insertPoint) + insertion + content.substring(insertPoint);
  }

  // אם אין פסקאות, הוסף בסוף
  return content + insertion;
}

/** הוספת script tag של Schema בסוף התוכן */
function appendSchema(content: string, schemaScript: string): string {
  return content + '\n' + schemaScript;
}

/** חילוץ URL בסיסי מרשימת עמודים */
function extractSiteUrl(pages: { url: string }[]): string {
  if (pages.length === 0) return '';
  try {
    const parsed = new URL(pages[0].url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

/** המרת slug לכותרת קריאה */
function formatSlugAsTitle(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** יצירת ContentItem ממידע ההמלצה — מילוי שדות מינימליים לצורך יצירת schema */
function inventoryItemFromPage(rec: SchemaRecommendation, content: string): ContentItem {
  const plain = stripHtml(content);
  return {
    id: rec.pageId,
    type: 'page',
    title: rec.pageTitle,
    slug: extractSlugFromUrl(rec.pageUrl),
    url: rec.pageUrl,
    content,
    plainText: plain,
    wordCount: plain.split(/\s+/).filter(Boolean).length,
    headings: [],
    h1Count: 0,
    h2Count: 0,
    h3Count: 0,
    images: [],
    internalLinks: [],
    externalLinks: [],
    hasSchema: rec.existingSchemas.length > 0,
    schemaTypes: rec.existingSchemas,
    hasFAQ: rec.existingSchemas.includes('FAQPage'),
    yoastMeta: { title: '', description: '', canonical: '', focusKeyword: '' },
    hasCTA: false,
    ctaTypes: [],
    estimatedReadTime: 0,
  };
}

/** חילוץ slug מ-URL */
function extractSlugFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}

/** בריחה מתווים מיוחדים ב-HTML */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
