// GA4 / Conversion Intelligence Engine — ניתוח נתוני המרות וחוויית משתמש
// מזהה דפים מכניסי כסף, בעיות Bounce, והזדמנויות המרה

import { generateWithAI } from '@/lib/ai/openai-client';
import type { ContentItem, ContentInventory } from './wp-content-inventory';
import type { SEOActionEntry } from './seo-action-log';
import { createActionLog } from './seo-action-log';
import type { AutomationContext } from './seo-automator';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface GA4Data {
  available: boolean;
  pages: GA4PageData[];
  conversions: GA4Conversion[];
  dateRange: { start: string; end: string };
}

export interface GA4PageData {
  pageUrl: string;
  pageviews: number;
  uniquePageviews: number;
  avgTimeOnPage: number;   // שניות
  bounceRate: number;      // 0-100
  exitRate: number;        // 0-100
  conversions: number;
  conversionRate: number;
}

export interface GA4Conversion {
  type: 'form_submit' | 'phone_click' | 'whatsapp_click' | 'email_click' | 'purchase' | 'signup' | 'other';
  pageUrl: string;
  count: number;
}

export interface ConversionInsight {
  type: 'high_converting_page' | 'money_page' | 'weak_engagement' | 'high_bounce' | 'conversion_opportunity' | 'high_value_traffic';
  pageUrl: string;
  pageTitle?: string;
  metric: string;
  value: number;
  description: string;
  recommendedActions: string[];
  businessImpact: 'critical' | 'high' | 'medium' | 'low';
}

export interface GA4IntelligenceResult {
  available: boolean;
  insights: ConversionInsight[];
  moneyPages: string[];           // URLs של דפים שמייצרים המרות
  highBouncePages: string[];
  weakEngagementPages: string[];
  conversionPaths: string[];
  summary: string;
  actions: SEOActionEntry[];
}

// ============================================================================
// תוצאה ריקה — כש-GA4 לא מחובר
// ============================================================================

function emptyResult(): GA4IntelligenceResult {
  return {
    available: false,
    insights: [],
    moneyPages: [],
    highBouncePages: [],
    weakEngagementPages: [],
    conversionPaths: [],
    summary: 'נתוני GA4 אינם זמינים. לא ניתן לבצע ניתוח המרות ללא חיבור Analytics.',
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
    return normalizedItemUrl === normalizedPageUrl || normalizedItemUrl.endsWith(normalizedPageUrl);
  });
}

/** חישוב סך ההמרות לדף */
function totalConversionsForPage(pageUrl: string, conversions: GA4Conversion[]): number {
  return conversions
    .filter(c => c.pageUrl.replace(/\/$/, '') === pageUrl.replace(/\/$/, ''))
    .reduce((sum, c) => sum + c.count, 0);
}

/** סוגי ההמרות של דף */
function conversionTypesForPage(pageUrl: string, conversions: GA4Conversion[]): string[] {
  return conversions
    .filter(c => c.pageUrl.replace(/\/$/, '') === pageUrl.replace(/\/$/, '') && c.count > 0)
    .map(c => c.type);
}

// ============================================================================
// זיהוי תובנות — Insight Detection
// ============================================================================

/** זיהוי "דפי כסף" — דפים שמייצרים המרות */
function findMoneyPages(data: GA4Data, inventory: ContentInventory): ConversionInsight[] {
  const insights: ConversionInsight[] = [];

  for (const page of data.pages) {
    const convCount = totalConversionsForPage(page.pageUrl, data.conversions);
    if (convCount <= 0) continue;

    const item = findContentItem(page.pageUrl, inventory);
    const convTypes = conversionTypesForPage(page.pageUrl, data.conversions);
    const isHighConverter = page.conversionRate > 3 || convCount > 10;

    insights.push({
      type: isHighConverter ? 'high_converting_page' : 'money_page',
      pageUrl: page.pageUrl,
      pageTitle: item?.title,
      metric: 'conversions',
      value: convCount,
      description: isHighConverter
        ? `הדף "${item?.title || page.pageUrl}" ממיר ב-${page.conversionRate.toFixed(1)}% (${convCount} המרות) — דף קריטי לעסק!`
        : `הדף "${item?.title || page.pageUrl}" מייצר ${convCount} המרות (${convTypes.join(', ')})`,
      recommendedActions: [
        'חיזוק קישורים פנימיים לדף הזה מכל הדפים',
        'שיפור SEO — הגדלת תנועה אורגנית לדף',
        'בדיקת מהירות טעינה — כל שנייה עולה כסף',
        'הוספת Schema מתאים (Product/Service)',
        ...(isHighConverter ? ['שכפול הנוסחה — מה עובד כאן?'] : []),
      ],
      businessImpact: isHighConverter ? 'critical' : 'high',
    });
  }

  return insights;
}

/** זיהוי דפים עם Bounce Rate גבוה */
function findHighBouncePages(data: GA4Data, inventory: ContentInventory): ConversionInsight[] {
  const insights: ConversionInsight[] = [];

  for (const page of data.pages) {
    if (page.bounceRate > 70 && page.pageviews >= 100) {
      const item = findContentItem(page.pageUrl, inventory);
      const severity = page.bounceRate > 85 ? 'critical' : page.bounceRate > 75 ? 'high' : 'medium';

      insights.push({
        type: 'high_bounce',
        pageUrl: page.pageUrl,
        pageTitle: item?.title,
        metric: 'bounceRate',
        value: page.bounceRate,
        description: `הדף "${item?.title || page.pageUrl}" עם ${page.bounceRate.toFixed(0)}% Bounce Rate (${page.pageviews} צפיות) — מבקרים עוזבים מהר`,
        recommendedActions: [
          'שיפור פסקת הפתיחה — הנעת המשך קריאה',
          'הוספת CTA ברור בחלק העליון',
          'שיפור מהירות טעינה',
          'בדיקת התאמת תוכן לשאילתות הכניסה',
          'הוספת קישורים פנימיים לתוכן רלוונטי',
          'בדיקת חוויית מובייל — רוב הגלישה ממובייל',
        ],
        businessImpact: severity,
      });
    }
  }

  return insights;
}

/** זיהוי דפים עם חוויית משתמש חלשה */
function findWeakEngagementPages(data: GA4Data, inventory: ContentInventory): ConversionInsight[] {
  const insights: ConversionInsight[] = [];

  for (const page of data.pages) {
    if (page.avgTimeOnPage < 30 && page.pageviews >= 100) {
      const item = findContentItem(page.pageUrl, inventory);

      insights.push({
        type: 'weak_engagement',
        pageUrl: page.pageUrl,
        pageTitle: item?.title,
        metric: 'avgTimeOnPage',
        value: page.avgTimeOnPage,
        description: `הדף "${item?.title || page.pageUrl}" עם זמן שהייה ממוצע ${page.avgTimeOnPage.toFixed(0)} שניות — תוכן לא מעניין או לא רלוונטי`,
        recommendedActions: [
          'שיפור איכות התוכן — הוספת ערך ייחודי',
          'הוספת תמונות, טבלאות, ואינפוגרפיקה',
          'פירוק טקסט ארוך לפסקאות קצרות עם כותרות משנה',
          'הוספת FAQ או תוכן אינטראקטיבי',
          'בדיקת התאמה לכוונת חיפוש',
        ],
        businessImpact: page.pageviews > 500 ? 'high' : 'medium',
      });
    }
  }

  return insights;
}

/** זיהוי הזדמנויות המרה — תנועה גבוהה, 0 המרות */
function findConversionOpportunities(data: GA4Data, inventory: ContentInventory): ConversionInsight[] {
  const insights: ConversionInsight[] = [];

  for (const page of data.pages) {
    const convCount = totalConversionsForPage(page.pageUrl, data.conversions);
    if (convCount > 0 || page.pageviews < 100) continue;

    const item = findContentItem(page.pageUrl, inventory);
    const hasCTA = item?.hasCTA ?? false;

    insights.push({
      type: 'conversion_opportunity',
      pageUrl: page.pageUrl,
      pageTitle: item?.title,
      metric: 'pageviews_no_conversion',
      value: page.pageviews,
      description: `הדף "${item?.title || page.pageUrl}" מקבל ${page.pageviews} צפיות אך 0 המרות — ${hasCTA ? 'ה-CTA לא עובד' : 'חסר CTA'}`,
      recommendedActions: hasCTA
        ? [
          'שיפור ה-CTA הקיים — מיקום, צבע, טקסט',
          'בדיקת A/B לניסוחי CTA שונים',
          'הוספת CTA נוסף בגוף התוכן (לא רק בסוף)',
          'הוספת Social Proof ליד ה-CTA',
        ]
        : [
          'הוספת CTA ברור — וואטסאפ / טלפון / טופס',
          'הוספת CTA בחלק העליון וגם בסוף',
          'הוספת הנעה לפעולה ברורה בתיאור השירות',
          'הוספת Social Proof — ביקורות, מספר לקוחות',
        ],
      businessImpact: page.pageviews > 500 ? 'critical' : page.pageviews > 200 ? 'high' : 'medium',
    });
  }

  return insights;
}

/** זיהוי דפים עם תנועה גבוהה ואיכותית */
function findHighValueTraffic(data: GA4Data, inventory: ContentInventory): ConversionInsight[] {
  const insights: ConversionInsight[] = [];

  for (const page of data.pages) {
    // תנועה גבוהה, זמן שהייה טוב, bounce נמוך — אבל אין המרות
    if (
      page.pageviews >= 200 &&
      page.avgTimeOnPage >= 60 &&
      page.bounceRate < 50 &&
      page.conversions === 0
    ) {
      const item = findContentItem(page.pageUrl, inventory);

      insights.push({
        type: 'high_value_traffic',
        pageUrl: page.pageUrl,
        pageTitle: item?.title,
        metric: 'high_engagement_no_conversion',
        value: page.pageviews,
        description: `הדף "${item?.title || page.pageUrl}" עם תנועה איכותית (${page.avgTimeOnPage.toFixed(0)}שׂ שהייה, ${page.bounceRate.toFixed(0)}% bounce) אך ללא המרות — הזדמנות זהב`,
        recommendedActions: [
          'הוספת CTA חזק — המבקרים כבר מתעניינים',
          'הוספת טופס קצר או WhatsApp בתוך התוכן',
          'הוספת Pop-up חכם (exit intent)',
          'שיקול שימוש בדף כ-landing page',
        ],
        businessImpact: 'critical',
      });
    }
  }

  return insights;
}

// ============================================================================
// ניתוח מרכזי — Main Analysis
// ============================================================================

/**
 * ניתוח מלא של נתוני GA4 — זיהוי דפי כסף, בעיות, והזדמנויות המרה
 */
export function analyzeGA4Data(
  data: GA4Data,
  inventory: ContentInventory,
  context: AutomationContext
): GA4IntelligenceResult {
  if (!data.available || !data.pages.length) {
    return emptyResult();
  }

  // זיהוי כל סוגי התובנות
  const moneyPageInsights = findMoneyPages(data, inventory);
  const highBounce = findHighBouncePages(data, inventory);
  const weakEngagement = findWeakEngagementPages(data, inventory);
  const conversionOps = findConversionOpportunities(data, inventory);
  const highValueTraffic = findHighValueTraffic(data, inventory);

  // איחוד כל התובנות
  const allInsights = [
    ...moneyPageInsights,
    ...highBounce,
    ...weakEngagement,
    ...conversionOps,
    ...highValueTraffic,
  ];

  // מיון לפי חשיבות עסקית
  const impactOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  allInsights.sort((a, b) => (impactOrder[b.businessImpact] || 0) - (impactOrder[a.businessImpact] || 0));

  // רשימות ייעודיות
  const moneyPages = moneyPageInsights.map(i => i.pageUrl);
  const highBouncePages = highBounce.map(i => i.pageUrl);
  const weakEngagementPages = weakEngagement.map(i => i.pageUrl);

  // מסלולי המרה — דפי כסף עם הנתיבים אליהם
  const conversionPaths = moneyPages.map(url => {
    const item = findContentItem(url, inventory);
    if (!item) return url;
    const linksTo = inventory.items
      .filter(i => i.internalLinks.some(l => l.href.includes(item.slug)))
      .map(i => i.title);
    return `${item.title} ← ${linksTo.slice(0, 3).join(', ') || 'אין קישורים פנימיים'}`;
  });

  // סיכום בעברית
  const summary = buildGA4Summary(allInsights, data, context);

  return {
    available: true,
    insights: allInsights,
    moneyPages,
    highBouncePages,
    weakEngagementPages,
    conversionPaths,
    summary,
    actions: [],
  };
}

/** בניית סיכום טקסטואלי */
function buildGA4Summary(insights: ConversionInsight[], data: GA4Data, context: AutomationContext): string {
  const totalPageviews = data.pages.reduce((sum, p) => sum + p.pageviews, 0);
  const totalConversions = data.conversions.reduce((sum, c) => sum + c.count, 0);
  const criticalInsights = insights.filter(i => i.businessImpact === 'critical').length;

  const moneyCount = insights.filter(i => i.type === 'money_page' || i.type === 'high_converting_page').length;
  const bounceCount = insights.filter(i => i.type === 'high_bounce').length;
  const opportunityCount = insights.filter(i => i.type === 'conversion_opportunity').length;

  const lines: string[] = [
    `📈 ניתוח המרות עבור ${context.businessName}:`,
    `• ${totalPageviews.toLocaleString()} צפיות כלליות, ${totalConversions} המרות`,
    `• ${moneyCount} דפי כסף מזוהים`,
    `• ${bounceCount} דפים עם Bounce גבוה`,
    `• ${opportunityCount} דפים עם תנועה ללא המרות — הזדמנויות`,
  ];

  if (criticalInsights > 0) {
    lines.push(`• ${criticalInsights} תובנות קריטיות שדורשות טיפול מיידי`);
  }

  return lines.join('\n');
}

// ============================================================================
// המלצות המרה בעברית
// ============================================================================

/**
 * יצירת המלצות פעולה בעברית לשיפור המרות
 */
export function generateConversionRecommendations(
  insights: ConversionInsight[],
  context: AutomationContext
): string[] {
  const recommendations: string[] = [];

  // סדר עדיפויות: דפי כסף → הזדמנויות → bounce → engagement
  const moneyPages = insights.filter(i => i.type === 'money_page' || i.type === 'high_converting_page');
  const opportunities = insights.filter(i => i.type === 'conversion_opportunity' || i.type === 'high_value_traffic');
  const bounceIssues = insights.filter(i => i.type === 'high_bounce');
  const engagementIssues = insights.filter(i => i.type === 'weak_engagement');

  if (moneyPages.length > 0) {
    recommendations.push(
      `🎯 יש ${moneyPages.length} דפי כסף — חיזוק SEO שלהם הוא עדיפות מספר 1`,
      ...moneyPages.slice(0, 3).map(p =>
        `   • "${p.pageTitle || p.pageUrl}" — ${p.value} המרות. להגדיל קישורים פנימיים ולשפר מיקום.`
      ),
    );
  }

  if (opportunities.length > 0) {
    recommendations.push(
      `💡 ${opportunities.length} דפים עם תנועה ללא המרות — הוספת CTA יכולה לשנות`,
      ...opportunities.slice(0, 3).map(p =>
        `   • "${p.pageTitle || p.pageUrl}" — ${p.value} צפיות, 0 המרות. להוסיף WhatsApp/טופס.`
      ),
    );
  }

  if (bounceIssues.length > 0) {
    recommendations.push(
      `⚠️ ${bounceIssues.length} דפים עם Bounce גבוה — מבקרים עוזבים מהר`,
      ...bounceIssues.slice(0, 2).map(p =>
        `   • "${p.pageTitle || p.pageUrl}" — ${p.value.toFixed(0)}% bounce. לשפר פתיחה ותוכן.`
      ),
    );
  }

  if (engagementIssues.length > 0) {
    recommendations.push(
      `📉 ${engagementIssues.length} דפים עם Engagement חלש — תוכן לא מחזיק`,
      ...engagementIssues.slice(0, 2).map(p =>
        `   • "${p.pageTitle || p.pageUrl}" — ${p.value.toFixed(0)} שניות שהייה. לשדרג תוכן.`
      ),
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ לא זוהו בעיות המרה משמעותיות — המשך מעקב שוטף');
  }

  return recommendations;
}

// ============================================================================
// ביצוע מלא — Execute
// ============================================================================

/**
 * ביצוע ניתוח GA4 מלא
 * אם data הוא null, מחזיר תוצאה ריקה עם available: false
 */
export async function executeGA4Intelligence(
  data: GA4Data | null,
  inventory: ContentInventory,
  context: AutomationContext
): Promise<GA4IntelligenceResult> {
  // GA4 לא מחובר
  if (!data || !data.available) {
    return emptyResult();
  }

  // ניתוח
  const result = analyzeGA4Data(data, inventory, context);
  const actionLog = createActionLog();

  // יצירת פעולות מומלצות מתוך התובנות
  for (const insight of result.insights) {
    // רק תובנות קריטיות או גבוהות מייצרות פעולות
    if (insight.businessImpact !== 'critical' && insight.businessImpact !== 'high') continue;

    const item = findContentItem(insight.pageUrl, inventory);

    // פעולה מתאימה לסוג התובנה
    if (insight.type === 'conversion_opportunity' || insight.type === 'high_value_traffic') {
      actionLog.log({
        planId: context.planId || 'ga4-intelligence',
        pageId: item?.id,
        pageUrl: insight.pageUrl,
        pageTitle: insight.pageTitle || item?.title,
        actionType: 'cta_added',
        module: 'ga4-conversion-engine',
        description: `הדף מקבל ${insight.value} צפיות ללא המרות — מומלץ להוסיף CTA`,
        seoReason: 'תנועה גבוהה ללא המרות — הוספת CTA תשפר ROI',
        expectedImpact: insight.businessImpact,
        status: 'pending_approval',
        isReversible: true,
      });
    } else if (insight.type === 'high_bounce') {
      actionLog.log({
        planId: context.planId || 'ga4-intelligence',
        pageId: item?.id,
        pageUrl: insight.pageUrl,
        pageTitle: insight.pageTitle || item?.title,
        actionType: 'content_refreshed',
        module: 'ga4-conversion-engine',
        description: `Bounce Rate ${insight.value.toFixed(0)}% — מומלץ לשפר פתיחה ותוכן`,
        seoReason: 'Bounce Rate גבוה פוגע בדירוג ובהמרות',
        expectedImpact: insight.businessImpact,
        status: 'pending_approval',
        isReversible: true,
      });
    } else if (insight.type === 'high_converting_page' || insight.type === 'money_page') {
      actionLog.log({
        planId: context.planId || 'ga4-intelligence',
        pageId: item?.id,
        pageUrl: insight.pageUrl,
        pageTitle: insight.pageTitle || item?.title,
        actionType: 'internal_link_added',
        module: 'ga4-conversion-engine',
        description: `דף כסף עם ${insight.value} המרות — מומלץ לחזק קישורים פנימיים`,
        seoReason: 'חיזוק דפי כסף מגדיל את שורת הרווח',
        expectedImpact: insight.businessImpact,
        status: 'pending_approval',
        isReversible: true,
      });
    }
  }

  result.actions = actionLog.getAllEntries();
  return result;
}
