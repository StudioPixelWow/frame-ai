// אופטימיזציית CTA — שיפור אוטומטי של קריאות לפעולה בדפי האתר
// CTA Optimizer — automatic conversion optimization for WordPress pages

import { WPConnection, updatePageContent } from './wordpress-client';
import { ContentItem, ContentInventory, buildContentInventory, stripHtml } from './wp-content-inventory';
import { SEOActionEntry, SEOActionType } from './seo-action-log';
import { AutomationContext } from './seo-automator';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface CTARecommendation {
  pageId: number;
  pageUrl: string;
  pageTitle: string;
  pageIntent: 'informational' | 'commercial' | 'transactional' | 'navigational' | 'local';
  currentCTAs: string[];
  missingCTAs: CTABlock[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface CTABlock {
  type: 'whatsapp' | 'phone' | 'form' | 'email' | 'service' | 'trust' | 'consultation';
  position: 'end_of_article' | 'mid_article' | 'after_intro' | 'sidebar';
  html: string;
  strength: 'soft' | 'medium' | 'strong';
  reason: string;
}

export interface CTAResult {
  pagesAnalyzed: number;
  ctasAdded: number;
  recommendations: CTARecommendation[];
  actions: SEOActionEntry[];
}

// ============================================================================
// דפוסי URL לזיהוי כוונת דף — URL Patterns for Intent Classification
// ============================================================================

// דפוסים מסחריים
const COMMERCIAL_URL_PATTERNS = [
  /שירות/i, /services?/i, /מחיר/i, /pricing/i, /תעריף/i, /עלות/i,
  /חבילות/i, /packages/i, /מסלולים/i,
];

// דפוסים טרנזקציוניים
const TRANSACTIONAL_URL_PATTERNS = [
  /הזמנ/i, /order/i, /checkout/i, /buy/i, /קנ[הי]/i,
  /רכיש/i, /purchase/i, /book/i, /הרשמ/i, /signup/i,
];

// דפוסים מידעיים
const INFORMATIONAL_URL_PATTERNS = [
  /בלוג/i, /blog/i, /מדריך/i, /guide/i, /מה[_-]זה/i,
  /what[_-]is/i, /how[_-]to/i, /איך/i, /tips/i, /טיפים/i,
];

// דפוסים מקומיים
const LOCAL_URL_PATTERNS = [
  /ב[_-]?תל[_-]?אביב/i, /ב[_-]?ירושלים/i, /ב[_-]?חיפה/i,
  /ב[_-]?באר[_-]?שבע/i, /ב[_-]?נתניה/i, /ב[_-]?ראשון/i,
  /אזור/i, /area/i, /location/i, /near[_-]me/i,
];

// דפוסים ניווטיים
const NAVIGATIONAL_URL_PATTERNS = [
  /אודות/i, /about/i, /צוות/i, /team/i, /צור[_-]?קשר/i,
  /contact/i, /מפת[_-]?אתר/i, /sitemap/i,
];

// ============================================================================
// זיהוי כוונת דף — Classify Page Intent
// ============================================================================

/**
 * מסווג את כוונת הדף לפי URL, תוכן וכותרות
 * משמש לקביעת סוג ועוצמת ה-CTA המתאים
 */
export function classifyPageIntent(
  item: ContentItem,
  keywords: string[]
): 'informational' | 'commercial' | 'transactional' | 'navigational' | 'local' {
  const url = item.url.toLowerCase();
  const slug = item.slug.toLowerCase();
  const title = item.title.toLowerCase();
  const combinedText = `${url} ${slug} ${title}`;

  // בדוק דפוסי URL
  if (TRANSACTIONAL_URL_PATTERNS.some(p => p.test(combinedText))) return 'transactional';
  if (LOCAL_URL_PATTERNS.some(p => p.test(combinedText))) return 'local';
  if (COMMERCIAL_URL_PATTERNS.some(p => p.test(combinedText))) return 'commercial';
  if (NAVIGATIONAL_URL_PATTERNS.some(p => p.test(combinedText))) return 'navigational';
  if (INFORMATIONAL_URL_PATTERNS.some(p => p.test(combinedText))) return 'informational';

  // ניתוח תוכן — חפש מילות מפתח מסחריות בתוכן
  const plainLower = item.plainText.toLowerCase();
  const commercialKeywords = ['מחיר', 'עלות', 'תעריף', 'הצעת מחיר', 'ייעוץ', 'שירות'];
  const transactionalKeywords = ['הזמינו', 'קנו', 'רכשו', 'הירשמו', 'התחילו'];

  const commercialScore = commercialKeywords.filter(kw => plainLower.includes(kw)).length;
  const transactionalScore = transactionalKeywords.filter(kw => plainLower.includes(kw)).length;

  if (transactionalScore >= 2) return 'transactional';
  if (commercialScore >= 2) return 'commercial';

  // ברירת מחדל — פוסטים הם מידעיים, דפים הם מסחריים
  return item.type === 'post' ? 'informational' : 'commercial';
}

// ============================================================================
// זיהוי CTAs קיימים — Detect Existing CTAs
// ============================================================================

/**
 * מזהה קריאות לפעולה קיימות בתוכן הדף
 * בודק: קישורי WhatsApp, טלפון, טפסים, mailto, כפתורים עם טקסט CTA
 */
export function detectExistingCTAs(content: string): string[] {
  if (!content) return [];

  const ctas: string[] = [];
  const lowerContent = content.toLowerCase();

  // וואטסאפ
  if (
    lowerContent.includes('wa.me/') ||
    lowerContent.includes('api.whatsapp.com') ||
    lowerContent.includes('whatsapp.com/send')
  ) {
    ctas.push('whatsapp');
  }

  // טלפון
  if (lowerContent.includes('tel:') || lowerContent.includes('href="tel')) {
    ctas.push('phone');
  }

  // טופס
  if (
    lowerContent.includes('<form') ||
    lowerContent.includes('wpforms') ||
    lowerContent.includes('contact-form') ||
    lowerContent.includes('elementor-form') ||
    lowerContent.includes('wpcf7')
  ) {
    ctas.push('form');
  }

  // אימייל
  if (lowerContent.includes('mailto:')) {
    ctas.push('email');
  }

  // כפתורים עם טקסט CTA
  const ctaButtonPatterns = [
    /צור\s*קשר/i, /צרו\s*קשר/i, /התקשרו/i, /הזמינו/i,
    /קבלו\s*הצעת/i, /דברו\s*איתנו/i, /שלחו\s*הודעה/i,
    /contact\s*us/i, /get\s*a?\s*quote/i, /book\s*now/i,
    /call\s*us/i, /schedule/i, /ייעוץ/i,
  ];
  for (const pattern of ctaButtonPatterns) {
    if (pattern.test(content)) {
      ctas.push('button_cta');
      break;
    }
  }

  return [...new Set(ctas)]; // הסר כפילויות
}

// ============================================================================
// יצירת בלוקי CTA בעברית — Generate CTA HTML
// ============================================================================

/**
 * מייצר HTML של בלוק CTA בעברית לפי סוג ועוצמה
 * soft — מידעי ("רוצה לדעת עוד?")
 * medium — מסחרי ("צור קשר לייעוץ")
 * strong — טרנזקציוני ("הזמן עכשיו")
 */
export function generateCTAHTML(
  type: CTABlock['type'],
  businessName: string,
  phone?: string,
  whatsapp?: string,
  strength: CTABlock['strength'] = 'medium'
): string {
  const containerStyle = `
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-right: 4px solid #0d6efd;
    padding: 24px 28px;
    margin: 32px 0;
    border-radius: 8px;
    text-align: center;
    font-family: inherit;
  `.replace(/\s+/g, ' ').trim();

  const buttonStyle = `
    display: inline-block;
    padding: 12px 32px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: bold;
    font-size: 16px;
    margin: 8px 4px;
    transition: opacity 0.2s;
  `.replace(/\s+/g, ' ').trim();

  const primaryBtnStyle = `${buttonStyle} background: #0d6efd; color: #fff;`;
  const whatsappBtnStyle = `${buttonStyle} background: #25D366; color: #fff;`;
  const phoneBtnStyle = `${buttonStyle} background: #198754; color: #fff;`;

  // טקסטים לפי עוצמה
  const headings: Record<CTABlock['strength'], Record<CTABlock['type'], string>> = {
    soft: {
      whatsapp: 'רוצים לשמוע עוד?',
      phone: 'יש לכם שאלה?',
      form: 'רוצים לדעת עוד?',
      email: 'מעוניינים במידע נוסף?',
      service: 'מחפשים פתרון מקצועי?',
      trust: 'למה לבחור בנו?',
      consultation: 'רוצים ייעוץ ראשוני?',
    },
    medium: {
      whatsapp: 'צרו קשר לייעוץ חינם',
      phone: 'דברו איתנו — נשמח לעזור',
      form: 'השאירו פרטים ונחזור אליכם',
      email: 'שלחו לנו הודעה',
      service: `${businessName} — כאן בשבילכם`,
      trust: `לקוחות מרוצים בוחרים ב${businessName}`,
      consultation: 'קבלו ייעוץ מקצועי ללא עלות',
    },
    strong: {
      whatsapp: 'הזמינו עכשיו בוואטסאפ!',
      phone: 'התקשרו עכשיו וקבלו הנחה!',
      form: 'מלאו פרטים וקבלו הצעת מחיר מיידית',
      email: 'פנו אלינו עוד היום',
      service: `הזמינו שירות מ${businessName} עוד היום`,
      trust: `הצטרפו למאות הלקוחות המרוצים של ${businessName}`,
      consultation: 'קבעו ייעוץ חינם — מקומות מוגבלים!',
    },
  };

  const heading = headings[strength][type] || headings.medium[type];

  // בנה את ה-HTML לפי סוג ה-CTA
  let buttonsHtml = '';

  switch (type) {
    case 'whatsapp':
      if (whatsapp) {
        buttonsHtml = `<a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener" style="${whatsappBtnStyle}">💬 שלחו הודעה בוואטסאפ</a>`;
      }
      break;

    case 'phone':
      if (phone) {
        buttonsHtml = `<a href="tel:${phone}" style="${phoneBtnStyle}">📞 ${phone}</a>`;
      }
      break;

    case 'consultation':
      if (whatsapp) {
        buttonsHtml = `<a href="https://wa.me/${whatsapp}?text=${encodeURIComponent('שלום, אשמח לקבל ייעוץ')}" target="_blank" rel="noopener" style="${whatsappBtnStyle}">💬 ייעוץ בוואטסאפ</a>`;
      }
      if (phone) {
        buttonsHtml += `<a href="tel:${phone}" style="${phoneBtnStyle}">📞 התקשרו עכשיו</a>`;
      }
      break;

    case 'service':
      if (phone) {
        buttonsHtml = `<a href="tel:${phone}" style="${primaryBtnStyle}">📞 קבלו הצעת מחיר</a>`;
      }
      if (whatsapp) {
        buttonsHtml += `<a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener" style="${whatsappBtnStyle}">💬 פנו אלינו</a>`;
      }
      break;

    case 'trust':
      buttonsHtml = `<p style="color: #6c757d; font-size: 14px; margin: 8px 0 0;">✅ ניסיון מוכח | ⭐ שירות מקצועי | 🏆 לקוחות מרוצים</p>`;
      break;

    case 'email':
      buttonsHtml = `<a href="mailto:info@${businessName.toLowerCase().replace(/\s+/g, '')}.co.il" style="${primaryBtnStyle}">✉️ שלחו אימייל</a>`;
      break;

    case 'form':
    default:
      // טופס יצירת קשר גנרי — הכוונה לדף צור קשר
      buttonsHtml = `<a href="/צור-קשר/" style="${primaryBtnStyle}">📋 השאירו פרטים</a>`;
      if (phone) {
        buttonsHtml += ` <a href="tel:${phone}" style="${phoneBtnStyle}">📞 ${phone}</a>`;
      }
      break;
  }

  return `
<div style="${containerStyle}" class="seo-cta-block" data-cta-type="${type}" data-cta-strength="${strength}">
  <h3 style="margin: 0 0 12px; color: #212529; font-size: 20px;">${heading}</h3>
  <div style="margin-top: 12px;">
    ${buttonsHtml}
  </div>
</div>`.trim();
}

// ============================================================================
// קביעת עדיפות CTA — Determine CTA Priority
// ============================================================================

function determineCTAPriority(
  intent: CTARecommendation['pageIntent'],
  existingCTAs: string[],
  wordCount: number
): CTARecommendation['priority'] {
  // דפים טרנזקציוניים/מסחריים ללא CTA — קריטי
  if ((intent === 'transactional' || intent === 'commercial') && existingCTAs.length === 0) {
    return 'critical';
  }

  // דפים מקומיים ללא CTA — גבוה
  if (intent === 'local' && existingCTAs.length === 0) {
    return 'high';
  }

  // דפים מידעיים ארוכים ללא CTA — גבוה
  if (intent === 'informational' && existingCTAs.length === 0 && wordCount > 500) {
    return 'high';
  }

  // דפים עם CTA חלקי — בינוני
  if (existingCTAs.length > 0 && existingCTAs.length < 2) {
    return 'medium';
  }

  return 'low';
}

// ============================================================================
// המלצת CTAs חסרים — Recommend Missing CTAs
// ============================================================================

function recommendMissingCTAs(
  intent: CTARecommendation['pageIntent'],
  existingCTAs: string[],
  businessName: string,
  phone?: string,
  whatsapp?: string
): CTABlock[] {
  const missing: CTABlock[] = [];
  const hasWhatsapp = existingCTAs.includes('whatsapp');
  const hasPhone = existingCTAs.includes('phone');
  const hasForm = existingCTAs.includes('form');

  // קבע עוצמה לפי כוונת הדף
  const strength: CTABlock['strength'] =
    intent === 'transactional' ? 'strong' :
    intent === 'commercial' || intent === 'local' ? 'medium' : 'soft';

  // דפים מסחריים/טרנזקציוניים — צריכים CTA חזק בסוף
  if (intent === 'commercial' || intent === 'transactional' || intent === 'local') {
    if (!hasWhatsapp && whatsapp) {
      missing.push({
        type: 'whatsapp',
        position: 'end_of_article',
        html: generateCTAHTML('whatsapp', businessName, phone, whatsapp, strength),
        strength,
        reason: 'דף מסחרי ללא קישור וואטסאפ — הוספת CTA לסוף הדף תשפר המרות',
      });
    }

    if (!hasPhone && phone) {
      missing.push({
        type: 'phone',
        position: 'after_intro',
        html: generateCTAHTML('phone', businessName, phone, whatsapp, strength),
        strength,
        reason: 'דף שירות ללא מספר טלפון בולט — הוספת CTA טלפוני',
      });
    }
  }

  // דפים מידעיים — CTA רך באמצע ובסוף
  if (intent === 'informational') {
    if (!hasWhatsapp && !hasPhone && !hasForm) {
      missing.push({
        type: 'consultation',
        position: 'end_of_article',
        html: generateCTAHTML('consultation', businessName, phone, whatsapp, 'soft'),
        strength: 'soft',
        reason: 'מאמר מידעי ללא שום CTA — הוספת CTA רך בסוף לייעוץ ראשוני',
      });
    }
  }

  // דפים מקומיים — CTA שירות + אמון
  if (intent === 'local') {
    if (!hasForm) {
      missing.push({
        type: 'service',
        position: 'end_of_article',
        html: generateCTAHTML('service', businessName, phone, whatsapp, 'medium'),
        strength: 'medium',
        reason: 'דף מקומי ללא טופס — הוספת CTA שירות עם פרטי קשר',
      });
    }
  }

  // כל דף ללא CTA — לפחות הוסף CTA בסיסי
  if (existingCTAs.length === 0 && missing.length === 0) {
    missing.push({
      type: 'form',
      position: 'end_of_article',
      html: generateCTAHTML('form', businessName, phone, whatsapp, 'soft'),
      strength: 'soft',
      reason: 'דף ללא שום CTA — הוספת קריאה בסיסית לפעולה בסוף הדף',
    });
  }

  return missing;
}

// ============================================================================
// הרצה ראשית — Execute CTA Optimizer
// ============================================================================

/**
 * מנוע CTA — סורק את כל הדפים, מזהה דפים ללא CTA ומוסיף בלוקי CTA מותאמים
 */
export async function executeCTAOptimizer(
  connection: WPConnection,
  context: AutomationContext,
  inventory?: ContentInventory,
  options?: { dryRun?: boolean; maxPages?: number; phone?: string; whatsapp?: string }
): Promise<CTAResult> {
  const startTime = Date.now();
  const actions: SEOActionEntry[] = [];
  const dryRun = options?.dryRun ?? false;
  const maxPages = options?.maxPages ?? 50;

  // שלב 1: בנה inventory אם לא סופק
  const inv = inventory || await buildContentInventory(connection);
  const itemsToProcess = inv.items.slice(0, maxPages);

  // שלב 2: נתח כל דף ובנה המלצות
  const recommendations: CTARecommendation[] = [];
  let ctasAdded = 0;

  for (const item of itemsToProcess) {
    const intent = classifyPageIntent(item, context.targetKeywords);
    const existingCTAs = detectExistingCTAs(item.content);
    const missingCTAs = recommendMissingCTAs(
      intent,
      existingCTAs,
      context.businessName,
      options?.phone,
      options?.whatsapp
    );

    if (missingCTAs.length === 0) continue;

    const priority = determineCTAPriority(intent, existingCTAs, item.wordCount);

    recommendations.push({
      pageId: item.id,
      pageUrl: item.url,
      pageTitle: item.title,
      pageIntent: intent,
      currentCTAs: existingCTAs,
      missingCTAs: missingCTAs,
      priority,
    });

    // שלב 3: החל CTA אם לא dryRun ועדיפות גבוהה מספיק
    if (!dryRun && (priority === 'critical' || priority === 'high')) {
      for (const cta of missingCTAs) {
        try {
          let updatedContent = item.content;

          // הכנס בלוק CTA לפי המיקום המומלץ
          if (cta.position === 'end_of_article') {
            updatedContent = updatedContent + '\n' + cta.html;
          } else if (cta.position === 'after_intro') {
            // מצא סוף הפסקה הראשונה
            const firstParagraphEnd = updatedContent.indexOf('</p>');
            if (firstParagraphEnd > -1) {
              const insertPoint = firstParagraphEnd + 4;
              updatedContent =
                updatedContent.slice(0, insertPoint) +
                '\n' + cta.html + '\n' +
                updatedContent.slice(insertPoint);
            } else {
              updatedContent = updatedContent + '\n' + cta.html;
            }
          } else if (cta.position === 'mid_article') {
            // מצא אמצע התוכן — אחרי H2 באמצע
            const h2Matches = [...updatedContent.matchAll(/<\/h2>/gi)];
            if (h2Matches.length >= 2) {
              const midIndex = Math.floor(h2Matches.length / 2);
              const midMatch = h2Matches[midIndex];
              if (midMatch.index !== undefined) {
                const insertPoint = midMatch.index + midMatch[0].length;
                updatedContent =
                  updatedContent.slice(0, insertPoint) +
                  '\n' + cta.html + '\n' +
                  updatedContent.slice(insertPoint);
              }
            } else {
              updatedContent = updatedContent + '\n' + cta.html;
            }
          } else {
            updatedContent = updatedContent + '\n' + cta.html;
          }

          await updatePageContent(connection, item.id, updatedContent);
          ctasAdded++;

          // תיעוד פעולה
          actions.push({
            id: `cta_${item.id}_${Date.now()}`,
            planId: context.planId || 'manual',
            date: new Date().toISOString(),
            pageId: item.id,
            pageUrl: item.url,
            pageTitle: item.title,
            actionType: 'cta_added' as SEOActionType,
            module: 'cta-optimizer',
            description: `נוסף בלוק CTA מסוג "${cta.type}" (${cta.strength}) בדף "${item.title}" — ${cta.reason}`,
            beforeValue: `CTAs קיימים: ${existingCTAs.join(', ') || 'אין'}`,
            afterValue: `נוסף: ${cta.type} במיקום ${cta.position}`,
            seoReason: 'הוספת CTA מתאים משפרת שיעורי המרה ומעודדת מעורבות משתמשים',
            expectedImpact: priority === 'critical' ? 'high' : 'medium',
            status: 'completed',
            isReversible: true,
            rollbackData: JSON.stringify({
              pageId: item.id,
              originalContent: item.content,
            }),
            executionTimeMs: Date.now() - startTime,
          });
        } catch (err) {
          console.error(`[CTA-OPT] שגיאה בהוספת CTA לדף ${item.id}:`, err);
          actions.push({
            id: `cta_err_${item.id}_${Date.now()}`,
            planId: context.planId || 'manual',
            date: new Date().toISOString(),
            pageId: item.id,
            pageUrl: item.url,
            pageTitle: item.title,
            actionType: 'cta_added' as SEOActionType,
            module: 'cta-optimizer',
            description: `נכשלה הוספת CTA לדף "${item.title}"`,
            seoReason: 'הוספת CTA מתאים משפרת שיעורי המרה',
            expectedImpact: 'medium',
            status: 'failed',
            isReversible: false,
          });
        }
      }
    } else if (dryRun) {
      // במצב dryRun — רק תעד את ההמלצות
      for (const cta of missingCTAs) {
        actions.push({
          id: `cta_dry_${item.id}_${Date.now()}`,
          planId: context.planId || 'manual',
          date: new Date().toISOString(),
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          actionType: 'cta_added' as SEOActionType,
          module: 'cta-optimizer',
          description: `המלצה: הוספת CTA מסוג "${cta.type}" (${cta.strength}) בדף "${item.title}"`,
          seoReason: cta.reason,
          expectedImpact: priority === 'critical' ? 'high' : 'medium',
          status: 'pending_approval',
          isReversible: true,
        });
      }
    }
  }

  return {
    pagesAnalyzed: itemsToProcess.length,
    ctasAdded,
    recommendations,
    actions,
  };
}
