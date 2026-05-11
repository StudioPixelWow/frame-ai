// מנוע SEO מקומי — אופטימיזציה אוטומטית לעסקים מקומיים
// Local SEO Engine — automatic optimization for local businesses

import { WPConnection, updatePageContent, createPost } from './wordpress-client';
import { ContentItem, ContentInventory, buildContentInventory, stripHtml } from './wp-content-inventory';
import { SEOActionEntry, SEOActionType } from './seo-action-log';
import { AutomationContext } from './seo-automator';
import { generateWithAI } from '@/lib/ai/openai-client';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface LocalSEOAudit {
  hasLocalSchema: boolean;
  hasServiceArea: boolean;
  hasLocalPages: boolean;
  hasGBPSuggestions: boolean;
  localPages: ContentItem[];
  missingLocalContent: string[];
  localKeywords: string[];
}

export interface LocalPageSuggestion {
  title: string;
  slug: string;
  targetArea: string;
  keywords: string[];
  contentOutline: string[];
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface LocalSEOResult {
  schemasAdded: number;
  localContentAdded: number;
  gbpSuggestions: string[];
  localPageSuggestions: LocalPageSuggestion[];
  actions: SEOActionEntry[];
}

// ============================================================================
// ערים ואזורים בישראל — Israeli Cities & Regions
// ============================================================================

const MAJOR_CITIES = [
  'תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'נתניה', 'ראשון לציון',
  'פתח תקווה', 'אשדוד', 'הרצליה', 'כפר סבא', 'רעננה', 'הוד השרון',
  'רמת גן', 'גבעתיים', 'בני ברק', 'חולון', 'בת ים', 'אשקלון',
  'רחובות', 'נס ציונה', 'לוד', 'רמלה', 'מודיעין', 'עפולה',
  'נצרת', 'עכו', 'נהריה', 'קריית שמונה', 'טבריה', 'אילת',
];

const REGIONS = [
  'גוש דן', 'השרון', 'השפלה', 'הנגב', 'הגליל', 'המרכז',
  'צפון', 'דרום', 'ירושלים והסביבה', 'חיפה והקריות',
];

// ============================================================================
// דפוסי זיהוי דפים מקומיים — Local Page Detection Patterns
// ============================================================================

const LOCAL_PAGE_PATTERNS = [
  /שירות.{0,10}ב[_\-\s]?/i,
  /ב[_\-\s]?(תל[_\-\s]?אביב|ירושלים|חיפה|באר[_\-\s]?שבע|נתניה|ראשון|פתח[_\-\s]?תקווה)/i,
  /אזור\s/i,
  /סניף/i,
  /near[_\-\s]?me/i,
  /location/i,
];

// ============================================================================
// ניתוח נוכחות מקומית — Analyze Local Presence
// ============================================================================

/**
 * סורק את האתר ומנתח את הנוכחות המקומית
 * בודק: LocalBusiness Schema, דפים מקומיים, אזורי שירות, מילות מפתח מקומיות
 */
export function analyzeLocalPresence(
  inventory: ContentInventory,
  context: AutomationContext
): LocalSEOAudit {
  // בדוק LocalBusiness Schema
  const hasLocalSchema = inventory.items.some(item =>
    item.schemaTypes.some(t =>
      t.includes('LocalBusiness') ||
      t.includes('Organization') ||
      t.includes('Store') ||
      t.includes('ProfessionalService')
    )
  );

  // מצא דפים מקומיים
  const localPages = inventory.items.filter(item => {
    const combinedText = `${item.title} ${item.slug} ${item.url}`.toLowerCase();
    return LOCAL_PAGE_PATTERNS.some(p => p.test(combinedText)) ||
      MAJOR_CITIES.some(city => combinedText.includes(city));
  });

  const hasLocalPages = localPages.length > 0;

  // בדוק אם יש אזורי שירות מוגדרים
  const hasServiceArea = inventory.items.some(item => {
    const lowerContent = item.content.toLowerCase();
    return lowerContent.includes('servicearea') ||
      lowerContent.includes('service area') ||
      lowerContent.includes('אזורי שירות') ||
      lowerContent.includes('אזור שירות');
  });

  // בנה רשימת מילות מפתח מקומיות
  const localKeywords: string[] = [];
  const location = context.location;

  for (const product of context.products) {
    localKeywords.push(`${product} ב${location}`);
    localKeywords.push(`${product} ${location}`);
  }
  localKeywords.push(`${context.businessType} ב${location}`);
  localKeywords.push(`${context.businessType} ${location}`);

  // מצא תוכן מקומי חסר
  const missingLocalContent: string[] = [];

  if (!hasLocalSchema) {
    missingLocalContent.push('חסר LocalBusiness Schema — גוגל לא יודע שזה עסק מקומי');
  }
  if (!hasLocalPages) {
    missingLocalContent.push('אין דפים מקומיים ייעודיים — הזדמנות לדפי שירות לפי אזור');
  }
  if (!hasServiceArea) {
    missingLocalContent.push('אין הגדרת אזורי שירות — גוגל לא יודע לאילו אזורים משרתים');
  }

  // בדוק אם יש דף "אודות" עם כתובת
  const aboutPage = inventory.items.find(item =>
    item.slug.includes('about') || item.slug.includes('אודות')
  );
  if (aboutPage && !aboutPage.plainText.includes(location)) {
    missingLocalContent.push(`דף "אודות" לא מזכיר את המיקום "${location}"`);
  }

  return {
    hasLocalSchema,
    hasServiceArea,
    hasLocalPages,
    hasGBPSuggestions: true, // תמיד יש המלצות GBP
    localPages,
    missingLocalContent,
    localKeywords,
  };
}

// ============================================================================
// יצירת LocalBusiness Schema — Generate Local Schema
// ============================================================================

/**
 * מייצר JSON-LD Schema מסוג LocalBusiness עבור דף
 * כולל: שם העסק, כתובת, טלפון, סוג עסק, אזור שירות
 */
export function generateLocalSchema(
  page: ContentItem,
  context: AutomationContext
): string {
  // מיפוי סוגי עסקים ל-Schema types
  const businessTypeMap: Record<string, string> = {
    'מסעדה': 'Restaurant',
    'עורך דין': 'LegalService',
    'רואה חשבון': 'AccountingService',
    'רופא': 'Physician',
    'רופא שיניים': 'Dentist',
    'מספרה': 'HairSalon',
    'מוסך': 'AutoRepair',
    'שיפוצניק': 'HomeAndConstructionBusiness',
    'אינסטלטור': 'Plumber',
    'חשמלאי': 'Electrician',
    'קבלן': 'GeneralContractor',
    'מעצב': 'ProfessionalService',
    'סוכנות דיגיטל': 'ProfessionalService',
    'חנות': 'Store',
    'מכון יופי': 'BeautySalon',
    'ספא': 'DaySpa',
    'חדר כושר': 'HealthClub',
  };

  const schemaType = businessTypeMap[context.businessType.toLowerCase()] || 'LocalBusiness';

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    'name': context.businessName,
    'url': page.url,
    'description': page.yoastMeta.description || stripHtml(page.plainText).substring(0, 160),
  };

  // הוסף מיקום
  if (context.location) {
    schema.address = {
      '@type': 'PostalAddress',
      'addressLocality': context.location,
      'addressCountry': 'IL',
    };
  }

  // הוסף אזור שירות
  schema.areaServed = {
    '@type': 'City',
    'name': context.location,
  };

  // הוסף שירותים
  if (context.products.length > 0) {
    schema.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      'name': `שירותי ${context.businessName}`,
      'itemListElement': context.products.map((product, index) => ({
        '@type': 'Offer',
        'itemOffered': {
          '@type': 'Service',
          'name': product,
        },
      })),
    };
  }

  // הוסף מילות מפתח
  if (context.targetKeywords.length > 0) {
    schema.keywords = context.targetKeywords.join(', ');
  }

  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
}

// ============================================================================
// הצעות לדפים מקומיים — Suggest Local Pages
// ============================================================================

/**
 * מציע דפים מקומיים חדשים בהתבסס על שירותים ואזורים
 * מונע ספאם — לא מייצר דפים כפולים לאותו שירות+אזור
 */
export function suggestLocalPages(
  context: AutomationContext,
  existingPages: ContentItem[]
): LocalPageSuggestion[] {
  const suggestions: LocalPageSuggestion[] = [];
  const existingSlugs = new Set(existingPages.map(p => p.slug.toLowerCase()));
  const existingTitles = new Set(existingPages.map(p => p.title.toLowerCase()));

  // מצא ערים קרובות למיקום העסק (אם רלוונטי)
  const targetAreas = [context.location];

  // הוסף 2-3 ערים נוספות אם העסק משרת אזור רחב
  const nearbyIndex = MAJOR_CITIES.indexOf(context.location);
  if (nearbyIndex === -1) {
    // המיקום לא ברשימה — הוסף ערים גדולות קרובות
    targetAreas.push(...MAJOR_CITIES.slice(0, 3));
  }

  for (const product of context.products) {
    for (const area of targetAreas) {
      // בנה slug פוטנציאלי
      const potentialSlug = `${product}-ב${area}`
        .replace(/\s+/g, '-')
        .toLowerCase();

      const potentialTitle = `${product} ב${area}`;

      // בדוק שלא קיים כבר דף דומה
      const isDuplicate =
        existingSlugs.has(potentialSlug) ||
        existingTitles.has(potentialTitle.toLowerCase()) ||
        existingPages.some(p => {
          const pLower = `${p.title} ${p.slug}`.toLowerCase();
          return pLower.includes(product.toLowerCase()) && pLower.includes(area);
        });

      if (isDuplicate) continue;

      // קבע עדיפות — אזור ראשי = גבוה, אזורים נוספים = בינוני/נמוך
      const priority = area === context.location ? 'high' : 'medium';

      suggestions.push({
        title: potentialTitle,
        slug: potentialSlug,
        targetArea: area,
        keywords: [
          `${product} ב${area}`,
          `${product} ${area}`,
          `${context.businessType} ב${area}`,
        ],
        contentOutline: [
          `כותרת H1: ${product} ב${area} — ${context.businessName}`,
          `מבוא: הצגת השירות והקשר לאזור`,
          `H2: למה לבחור ${context.businessName} ל${product} ב${area}?`,
          `H2: השירותים שלנו ב${area}`,
          `H2: איך התהליך עובד?`,
          `H2: שאלות נפוצות על ${product} ב${area}`,
          `CTA: יצירת קשר והזמנת שירות`,
        ],
        reason: `דף ייעודי לשירות "${product}" באזור "${area}" — ימקד מילות מפתח מקומיות ויופיע בחיפושים גאוגרפיים`,
        priority,
      });
    }
  }

  // הגבל ל-10 הצעות מקסימום למניעת ספאם
  return suggestions
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 10);
}

// ============================================================================
// הצעות Google Business Profile — GBP Suggestions
// ============================================================================

/**
 * מייצר רעיונות לפוסטים ב-Google Business Profile
 * מבוסס על העסק, השירותים והאזור
 */
export function generateGBPSuggestions(context: AutomationContext): string[] {
  const suggestions: string[] = [];
  const { businessName, businessType, products, location } = context;

  // פוסטים על שירותים
  for (const product of products.slice(0, 3)) {
    suggestions.push(
      `📢 פוסט GBP: "${product} ב${location}" — הציגו את השירות עם תמונה איכותית ו-CTA ליצירת קשר`
    );
  }

  // פוסטים עונתיים/אקטואליים
  suggestions.push(
    `🎯 פוסט GBP: עדכון שעות פעילות ומידע חדש על ${businessName} ב${location}`,
    `⭐ פוסט GBP: שתפו ביקורת לקוח מרוצה (עם אישור) — מחזק אמון מקומי`,
    `💡 פוסט GBP: טיפ מקצועי מ${businessName} — תוכן ערך שמראה מומחיות`,
    `🏆 פוסט GBP: הכריזו על מבצע/הנחה מיוחדת — משפר CTR בתוצאות מקומיות`,
  );

  // תמונות
  suggestions.push(
    `📸 העלו תמונות עדכניות של העסק, הצוות והעבודות — תמונות משפיעות על דירוג מקומי`,
    `🗺️ ודאו שהכתובת ב-Google Maps מדויקת ושהקטגוריה הראשית מתאימה ל"${businessType}"`,
  );

  // שאלות ותשובות
  suggestions.push(
    `❓ הוסיפו שאלות ותשובות ב-GBP — ענו על 5 השאלות הנפוצות ביותר על ${businessType} ב${location}`
  );

  return suggestions;
}

// ============================================================================
// הרצה ראשית — Execute Local SEO
// ============================================================================

/**
 * מנוע SEO מקומי — סורק את האתר, מנתח נוכחות מקומית ומשפר
 * שלב 1: ניתוח נוכחות מקומית
 * שלב 2: הוספת LocalBusiness Schema לדפים ראשיים
 * שלב 3: יצירת המלצות לדפים מקומיים חדשים
 * שלב 4: יצירת המלצות GBP
 */
export async function executeLocalSEO(
  connection: WPConnection,
  context: AutomationContext,
  inventory?: ContentInventory,
  options?: { dryRun?: boolean; maxSchemas?: number }
): Promise<LocalSEOResult> {
  const startTime = Date.now();
  const actions: SEOActionEntry[] = [];
  const dryRun = options?.dryRun ?? false;
  const maxSchemas = options?.maxSchemas ?? 5;

  // שלב 1: בנה inventory אם לא סופק
  const inv = inventory || await buildContentInventory(connection);

  // שלב 2: ניתוח נוכחות מקומית
  const audit = analyzeLocalPresence(inv, context);

  // שלב 3: הוסף LocalBusiness Schema לדפים שחסר להם
  let schemasAdded = 0;
  const pagesNeedingSchema = inv.items
    .filter(item => !item.schemaTypes.some(t =>
      t.includes('LocalBusiness') || t.includes('Organization')
    ))
    // העדף דפי שירות ודף בית
    .sort((a, b) => {
      const aIsHome = a.slug === '' || a.slug === 'home' || a.url.endsWith('/');
      const bIsHome = b.slug === '' || b.slug === 'home' || b.url.endsWith('/');
      if (aIsHome && !bIsHome) return -1;
      if (!aIsHome && bIsHome) return 1;
      // העדף דפים (לא פוסטים)
      if (a.type === 'page' && b.type !== 'page') return -1;
      if (a.type !== 'page' && b.type === 'page') return 1;
      return 0;
    })
    .slice(0, maxSchemas);

  for (const page of pagesNeedingSchema) {
    const schemaHtml = generateLocalSchema(page, context);

    if (!dryRun) {
      try {
        const updatedContent = page.content + '\n' + schemaHtml;
        await updatePageContent(connection, page.id, updatedContent);
        schemasAdded++;

        actions.push({
          id: `local_schema_${page.id}_${Date.now()}`,
          planId: context.planId || 'manual',
          date: new Date().toISOString(),
          pageId: page.id,
          pageUrl: page.url,
          pageTitle: page.title,
          actionType: 'schema_added' as SEOActionType,
          module: 'local-seo-engine',
          description: `נוסף LocalBusiness Schema לדף "${page.title}" — מזהה את העסק כמקומי לגוגל`,
          afterValue: schemaHtml.substring(0, 200) + '...',
          seoReason: 'LocalBusiness Schema עוזר לגוגל להבין שזה עסק מקומי ולהציג Rich Results במפות',
          expectedImpact: 'high',
          status: 'completed',
          isReversible: true,
          rollbackData: JSON.stringify({
            pageId: page.id,
            originalContent: page.content,
          }),
          executionTimeMs: Date.now() - startTime,
        });
      } catch (err) {
        console.error(`[LOCAL-SEO] שגיאה בהוספת Schema לדף ${page.id}:`, err);
      }
    } else {
      actions.push({
        id: `local_schema_dry_${page.id}_${Date.now()}`,
        planId: context.planId || 'manual',
        date: new Date().toISOString(),
        pageId: page.id,
        pageUrl: page.url,
        pageTitle: page.title,
        actionType: 'schema_added' as SEOActionType,
        module: 'local-seo-engine',
        description: `המלצה: הוספת LocalBusiness Schema לדף "${page.title}"`,
        seoReason: 'LocalBusiness Schema עוזר לגוגל להבין שזה עסק מקומי',
        expectedImpact: 'high',
        status: 'pending_approval',
        isReversible: true,
      });
    }
  }

  // שלב 4: הצעות לדפים מקומיים חדשים
  const localPageSuggestions = suggestLocalPages(context, inv.items);

  // תעד הצעות לדפים מקומיים
  for (const suggestion of localPageSuggestions) {
    actions.push({
      id: `local_page_suggestion_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      planId: context.planId || 'manual',
      date: new Date().toISOString(),
      actionType: 'local_content_added' as SEOActionType,
      module: 'local-seo-engine',
      description: `המלצה ליצירת דף מקומי: "${suggestion.title}" — ${suggestion.reason}`,
      seoReason: `דף מקומי ממוקד למילות מפתח: ${suggestion.keywords.join(', ')}`,
      expectedImpact: suggestion.priority === 'high' ? 'high' : 'medium',
      status: 'pending_approval',
      isReversible: false,
    });
  }

  // שלב 5: הצעות GBP
  const gbpSuggestions = generateGBPSuggestions(context);

  // סכם תוכן מקומי שנוסף
  const localContentAdded = schemasAdded;

  return {
    schemasAdded,
    localContentAdded,
    gbpSuggestions,
    localPageSuggestions,
    actions,
  };
}
