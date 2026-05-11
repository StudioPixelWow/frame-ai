// מוניטור SEO טכני — ביקורת יומית וזיהוי בעיות טכניות
// Technical SEO Monitor — daily audit and issue detection

import { WPConnection, updatePageContent, buildSmartApiUrl } from './wordpress-client';
import { ContentItem, ContentInventory, buildContentInventory, stripHtml } from './wp-content-inventory';
import { SEOActionEntry, SEOActionType } from './seo-action-log';
import { AutomationContext } from './seo-automator';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface TechnicalIssue {
  type:
    | 'broken_link'
    | 'missing_h1'
    | 'duplicate_h1'
    | 'missing_canonical'
    | 'missing_schema'
    | 'noindex_mistake'
    | 'slow_page'
    | 'mobile_issue'
    | 'sitemap_issue'
    | 'robots_issue'
    | 'missing_alt'
    | 'redirect_chain'
    | 'mixed_content';
  severity: 'critical' | 'high' | 'medium' | 'low';
  pageId?: number;
  pageUrl?: string;
  pageTitle?: string;
  description: string;
  fixable: boolean;
  autoFixAvailable: boolean;
  suggestedFix?: string;
}

export interface TechnicalAuditResult {
  issuesFound: number;
  criticalIssues: number;
  fixableIssues: number;
  autoFixedIssues: number;
  issues: TechnicalIssue[];
  actions: SEOActionEntry[];
}

// ============================================================================
// בדיקות טכניות — Technical Checks
// ============================================================================

/**
 * בדיקת קישורים שבורים — קישור פנימי שלא מצביע לאף דף קיים
 */
function checkBrokenLinks(
  item: ContentItem,
  allUrls: Set<string>,
  allSlugs: Set<string>
): TechnicalIssue[] {
  const issues: TechnicalIssue[] = [];

  for (const link of item.internalLinks) {
    // בדוק אם ה-href מצביע לדף קיים
    if (link.targetPageId !== undefined) continue; // הקישור תקין — יש לו pageId

    // קישורים פנימיים ללא targetPageId = אולי שבורים
    const href = link.href.toLowerCase();

    // דלג על אנקורים, טלפונים, מיילים
    if (href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:')) continue;
    if (href.startsWith('javascript:')) continue;

    // בדוק אם ה-URL או ה-slug קיים
    const normalizedHref = href.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '').replace(/^\//, '');
    if (allSlugs.has(normalizedHref)) continue;

    // דלג על קישורים לקבצים (PDF, תמונות וכו')
    if (/\.(pdf|jpg|jpeg|png|gif|svg|zip|doc|docx|xls|xlsx)$/i.test(href)) continue;

    issues.push({
      type: 'broken_link',
      severity: 'high',
      pageId: item.id,
      pageUrl: item.url,
      pageTitle: item.title,
      description: `קישור פנימי שבור בדף "${item.title}": ${link.href} (אנקור: "${link.anchorText}")`,
      fixable: true,
      autoFixAvailable: false,
      suggestedFix: `הסר או עדכן את הקישור "${link.href}" — בדוק שכתובת היעד נכונה`,
    });
  }

  return issues;
}

/**
 * בדיקת H1 חסר
 */
function checkMissingH1(item: ContentItem): TechnicalIssue | null {
  if (item.h1Count === 0) {
    return {
      type: 'missing_h1',
      severity: 'high',
      pageId: item.id,
      pageUrl: item.url,
      pageTitle: item.title,
      description: `חסר תג H1 בדף "${item.title}" — חיוני לגוגל להבין את נושא הדף`,
      fixable: true,
      autoFixAvailable: true,
      suggestedFix: `הוסף H1 עם הכותרת "${item.title}" בתחילת הדף`,
    };
  }
  return null;
}

/**
 * בדיקת H1 כפול
 */
function checkDuplicateH1(item: ContentItem): TechnicalIssue | null {
  if (item.h1Count > 1) {
    const h1Texts = item.headings
      .filter(h => h.tag === 'h1')
      .map(h => h.text)
      .join(', ');

    return {
      type: 'duplicate_h1',
      severity: 'medium',
      pageId: item.id,
      pageUrl: item.url,
      pageTitle: item.title,
      description: `${item.h1Count} תגי H1 בדף "${item.title}" (${h1Texts}) — צריך להיות רק H1 אחד`,
      fixable: true,
      autoFixAvailable: true,
      suggestedFix: `השאר את H1 הראשון והמר את האחרים ל-H2`,
    };
  }
  return null;
}

/**
 * בדיקת Schema חסר
 */
function checkMissingSchema(item: ContentItem): TechnicalIssue | null {
  if (!item.hasSchema && item.type === 'page') {
    return {
      type: 'missing_schema',
      severity: 'medium',
      pageId: item.id,
      pageUrl: item.url,
      pageTitle: item.title,
      description: `חסר Schema markup בדף "${item.title}" — Rich Results לא יוצגו בגוגל`,
      fixable: true,
      autoFixAvailable: false,
      suggestedFix: `הוסף JSON-LD Schema מתאים (LocalBusiness, Service, FAQPage וכד')`,
    };
  }
  return null;
}

/**
 * בדיקת Canonical חסר
 */
function checkMissingCanonical(item: ContentItem): TechnicalIssue | null {
  if (!item.yoastMeta.canonical && item.type === 'page') {
    // בדוק אם יש Yoast בכלל — אם כן, canonical נקבע אוטומטית ע"י Yoast
    // נדווח רק אם יש כפילויות אפשריות
    return null; // Yoast מטפל ב-canonical אוטומטית ברוב המקרים
  }
  return null;
}

/**
 * בדיקת noindex בתוכן — טעות שחוסמת דירוג
 */
function checkNoindexMistake(item: ContentItem): TechnicalIssue | null {
  const lowerContent = item.content.toLowerCase();

  if (
    lowerContent.includes('noindex') &&
    !lowerContent.includes('googlebot') // לא בשורת robots מכוונת
  ) {
    return {
      type: 'noindex_mistake',
      severity: 'critical',
      pageId: item.id,
      pageUrl: item.url,
      pageTitle: item.title,
      description: `נמצא noindex בדף "${item.title}" — הדף לא יופיע בגוגל בכלל!`,
      fixable: true,
      autoFixAvailable: false,
      suggestedFix: `בדוק אם ה-noindex מכוון. אם לא — הסר אותו מ-Yoast או מתגית meta robots`,
    };
  }
  return null;
}

/**
 * בדיקת תמונות ללא ALT
 */
function checkMissingAlt(item: ContentItem): TechnicalIssue[] {
  const issues: TechnicalIssue[] = [];

  const missingAltImages = item.images.filter(img => !img.hasAlt);
  if (missingAltImages.length > 0) {
    issues.push({
      type: 'missing_alt',
      severity: 'medium',
      pageId: item.id,
      pageUrl: item.url,
      pageTitle: item.title,
      description: `${missingAltImages.length} תמונות ללא ALT text בדף "${item.title}" — פוגע בנגישות וב-SEO תמונות`,
      fixable: true,
      autoFixAvailable: true,
      suggestedFix: `הוסף טקסט ALT תיאורי לכל תמונה — השתמש במנוע image-seo-engine`,
    });
  }

  return issues;
}

/**
 * בדיקת Mixed Content — HTTP בתוך HTTPS
 */
function checkMixedContent(item: ContentItem): TechnicalIssue | null {
  // חפש קישורים ותמונות שטוענים ב-HTTP (לא HTTPS)
  const httpPattern = /(?:src|href)=["']http:\/\//gi;
  const matches = item.content.match(httpPattern);

  if (matches && matches.length > 0) {
    return {
      type: 'mixed_content',
      severity: 'high',
      pageId: item.id,
      pageUrl: item.url,
      pageTitle: item.title,
      description: `${matches.length} משאבים נטענים ב-HTTP (לא HTTPS) בדף "${item.title}" — Mixed Content פוגע באבטחה ובדירוג`,
      fixable: true,
      autoFixAvailable: false,
      suggestedFix: `החלף את כל קישורי http:// ב-https:// — או הסר את הפרוטוקול (//)`,
    };
  }
  return null;
}

// ============================================================================
// תיקון אוטומטי — Auto Fix
// ============================================================================

/**
 * תיקון אוטומטי של בעיות טכניות שניתנות לתיקון
 * תומך: H1 חסר, H1 כפול, ALT חסר בסיסי
 */
export async function autoFixIssue(
  issue: TechnicalIssue,
  connection: WPConnection,
  inventory: ContentInventory
): Promise<boolean> {
  if (!issue.autoFixAvailable || !issue.pageId) return false;

  const item = inventory.items.find(i => i.id === issue.pageId);
  if (!item) return false;

  try {
    switch (issue.type) {
      case 'missing_h1': {
        // הוסף H1 מהכותרת בתחילת התוכן
        const h1Tag = `<h1>${item.title}</h1>\n`;
        const updatedContent = h1Tag + item.content;
        const result = await updatePageContent(connection, item.id, updatedContent);
        return result.success;
      }

      case 'duplicate_h1': {
        // המר את ה-H1 השני ואילך ל-H2
        let content = item.content;
        let h1Count = 0;

        content = content.replace(/<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/gi, (match, attrs, text) => {
          h1Count++;
          if (h1Count === 1) {
            return match; // שמור את ה-H1 הראשון
          }
          // המר ל-H2
          return `<h2${attrs || ''}>${text}</h2>`;
        });

        if (h1Count > 1) {
          const result = await updatePageContent(connection, item.id, content);
          return result.success;
        }
        return false;
      }

      case 'missing_alt': {
        // הוסף ALT בסיסי מהכותרת — תיקון מינימלי
        let content = item.content;
        let fixed = false;

        content = content.replace(/<img\s+([^>]*?)>/gi, (match, attrs) => {
          // בדוק אם כבר יש ALT
          if (/alt=["'][^"']+["']/i.test(attrs)) return match;
          if (/alt=["']["']/i.test(attrs)) {
            // ALT ריק — מלא אותו
            fixed = true;
            return match.replace(/alt=["']["']/i, `alt="${item.title}"`);
          }
          // אין ALT בכלל — הוסף
          fixed = true;
          return `<img alt="${item.title}" ${attrs}>`;
        });

        if (fixed) {
          const result = await updatePageContent(connection, item.id, content);
          return result.success;
        }
        return false;
      }

      default:
        return false;
    }
  } catch (err) {
    console.error(`[TECH-SEO] שגיאה בתיקון אוטומטי לדף ${issue.pageId}:`, err);
    return false;
  }
}

// ============================================================================
// ביקורת טכנית מלאה — Run Technical Audit
// ============================================================================

/**
 * מריץ ביקורת טכנית מלאה על כל דפי האתר
 * בודק: קישורים שבורים, H1 חסר/כפול, Schema חסר, noindex, תמונות ללא ALT, Mixed Content
 */
export function runTechnicalAudit(
  inventory: ContentInventory,
  connection: WPConnection,
  context: AutomationContext
): TechnicalAuditResult {
  const issues: TechnicalIssue[] = [];
  const actions: SEOActionEntry[] = [];

  // בנה מאגר URLs ו-slugs לבדיקת קישורים שבורים
  const allUrls = new Set<string>();
  const allSlugs = new Set<string>();
  for (const item of inventory.items) {
    if (item.url) allUrls.add(item.url.toLowerCase());
    if (item.slug) allSlugs.add(item.slug.toLowerCase());
  }

  // בדוק כל דף
  for (const item of inventory.items) {
    // קישורים שבורים
    const brokenLinkIssues = checkBrokenLinks(item, allUrls, allSlugs);
    issues.push(...brokenLinkIssues);

    // H1 חסר
    const missingH1 = checkMissingH1(item);
    if (missingH1) issues.push(missingH1);

    // H1 כפול
    const duplicateH1 = checkDuplicateH1(item);
    if (duplicateH1) issues.push(duplicateH1);

    // Schema חסר
    const missingSchema = checkMissingSchema(item);
    if (missingSchema) issues.push(missingSchema);

    // noindex טעות
    const noindex = checkNoindexMistake(item);
    if (noindex) issues.push(noindex);

    // תמונות ללא ALT
    const missingAltIssues = checkMissingAlt(item);
    issues.push(...missingAltIssues);

    // Mixed Content
    const mixedContent = checkMixedContent(item);
    if (mixedContent) issues.push(mixedContent);
  }

  // חשב סטטיסטיקות
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const fixableIssues = issues.filter(i => i.fixable).length;

  // תעד פעולות
  for (const issue of issues) {
    actions.push({
      id: `tech_${issue.type}_${issue.pageId || 'site'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      planId: context.planId || 'manual',
      date: new Date().toISOString(),
      pageId: issue.pageId,
      pageUrl: issue.pageUrl,
      pageTitle: issue.pageTitle,
      actionType: 'technical_issue_found' as SEOActionType,
      module: 'technical-seo-monitor',
      description: issue.description,
      seoReason: issue.suggestedFix || 'בעיה טכנית שפוגעת בדירוג',
      expectedImpact: issue.severity === 'critical' ? 'critical' : issue.severity === 'high' ? 'high' : 'medium',
      status: issue.autoFixAvailable ? 'pending_approval' : 'pending_approval',
      isReversible: issue.autoFixAvailable,
    });
  }

  return {
    issuesFound: issues.length,
    criticalIssues,
    fixableIssues,
    autoFixedIssues: 0, // ימולא בשלב ההרצה
    issues,
    actions,
  };
}

// ============================================================================
// הרצה ראשית — Execute Technical Monitor
// ============================================================================

/**
 * מנוע מוניטור טכני — סורק את כל הדפים, מזהה בעיות טכניות ומתקן אוטומטית
 * שלב 1: ביקורת טכנית מלאה
 * שלב 2: תיקון אוטומטי של בעיות שניתנות לתיקון
 * שלב 3: דיווח על בעיות שדורשות התערבות ידנית
 */
export async function executeTechnicalMonitor(
  connection: WPConnection,
  context: AutomationContext,
  inventory?: ContentInventory,
  options?: { dryRun?: boolean; autoFix?: boolean }
): Promise<TechnicalAuditResult> {
  const dryRun = options?.dryRun ?? false;
  const autoFix = options?.autoFix ?? true;

  // שלב 1: בנה inventory אם לא סופק
  const inv = inventory || await buildContentInventory(connection);

  // שלב 2: ביקורת טכנית
  const auditResult = runTechnicalAudit(inv, connection, context);

  // שלב 3: תיקון אוטומטי
  if (!dryRun && autoFix) {
    let autoFixedCount = 0;

    for (const issue of auditResult.issues) {
      if (!issue.autoFixAvailable) continue;

      try {
        const fixed = await autoFixIssue(issue, connection, inv);
        if (fixed) {
          autoFixedCount++;

          // עדכן את הפעולה בלוג
          const action = auditResult.actions.find(a =>
            a.pageId === issue.pageId && a.description === issue.description
          );
          if (action) {
            action.status = 'completed';
            action.description = `[תוקן אוטומטית] ${issue.description}`;
          }
        }
      } catch (err) {
        console.error(`[TECH-SEO] שגיאה בתיקון ${issue.type} בדף ${issue.pageId}:`, err);
      }
    }

    auditResult.autoFixedIssues = autoFixedCount;
  }

  return auditResult;
}
