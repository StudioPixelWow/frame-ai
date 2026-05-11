// SEO Weekly Email — מערכת מייל שבועי ללקוחות
// נשלח כל יום חמישי בשעה 17:00 שעון ישראל
// כולל סיכום פעילות, מדדים, תובנות ופוקוס לשבוע הבא

import { WeeklySummary } from './seo-activity-tracker';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface WeeklyEmailConfig {
  recipientEmail: string;
  recipientName: string;
  clientName: string;
  websiteUrl: string;
  planId: string;
  ccEmails?: string[];
  bccEmails?: string[];
  autoSendEnabled: boolean;
  includeDetailedTable: boolean;
  language: 'he' | 'en';
}

export interface WeeklyEmailData {
  config: WeeklyEmailConfig;
  summary: WeeklySummary;
  periodStart: string;
  periodEnd: string;
  gscData?: {
    impressions?: number;
    clicks?: number;
    ctr?: number;
    avgPosition?: number;
    changes?: { impressions?: string; clicks?: string };
  };
  planProgress: {
    currentDay: number;
    totalDays: number;
    percentComplete: number;
    currentPhase: string;
  };
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  sentAt?: string;
  recipients: string[];
  subject: string;
}

export interface EmailLogEntry {
  id: string;
  planId: string;
  clientId?: string;
  subject: string;
  recipients: string[];
  sentAt: string;
  deliveryStatus: 'sent' | 'failed' | 'pending';
  periodStart: string;
  periodEnd: string;
  actionsIncluded: number;
}

// ============================================================================
// אחסון לוג מיילים בזיכרון
// ============================================================================

const emailLogs: EmailLogEntry[] = [];

// ============================================================================
// יצירת מזהה ייחודי
// ============================================================================

function generateEmailId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `email_${timestamp}_${random}`;
}

// ============================================================================
// getReportPeriod — חישוב תקופת הדוח
// חמישי 17:00 שבוע שעבר עד חמישי 16:59 השבוע — שעון ישראל
// ============================================================================

export function getReportPeriod(): { start: string; end: string } {
  // שעון ישראל — Asia/Jerusalem
  const now = new Date();
  const israelFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // מצא את היום הנוכחי בשעון ישראל
  const parts = israelFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const currentDay = now.getDay(); // 0=Sunday ... 4=Thursday

  // חשב את יום חמישי האחרון
  // אם היום חמישי, השתמש בהיום; אחרת, חזור אחורה
  const daysBackToThursday = currentDay >= 4 ? currentDay - 4 : currentDay + 3;
  const thisThursday = new Date(now);
  thisThursday.setDate(thisThursday.getDate() - daysBackToThursday);

  // חמישי שעבר = 7 ימים לפני
  const lastThursday = new Date(thisThursday);
  lastThursday.setDate(lastThursday.getDate() - 7);

  // פורמט תאריכים — חמישי שעבר 17:00 עד חמישי הנוכחי 16:59
  const startYear = lastThursday.getFullYear();
  const startMonth = String(lastThursday.getMonth() + 1).padStart(2, '0');
  const startDay = String(lastThursday.getDate()).padStart(2, '0');

  const endYear = thisThursday.getFullYear();
  const endMonth = String(thisThursday.getMonth() + 1).padStart(2, '0');
  const endDay = String(thisThursday.getDate()).padStart(2, '0');

  return {
    start: `${startYear}-${startMonth}-${startDay}T17:00:00+03:00`,
    end: `${endYear}-${endMonth}-${endDay}T16:59:59+03:00`,
  };
}

// ============================================================================
// generateEmailSubject — נושא המייל
// ============================================================================

export function generateEmailSubject(clientName: string): string {
  return `סיכום פעילות שבועי | PIXEL SEO GEO | ${clientName}`;
}

// ============================================================================
// פורמט מספרים בעברית
// ============================================================================

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return 'הנתון עדיין לא זמין במערכת';
  return num.toLocaleString('he-IL');
}

function formatPercent(num: number | undefined): string {
  if (num === undefined || num === null) return 'הנתון עדיין לא זמין במערכת';
  return `${num.toFixed(1)}%`;
}

function formatPosition(num: number | undefined): string {
  if (num === undefined || num === null) return 'הנתון עדיין לא זמין במערכת';
  return num.toFixed(1);
}

// ============================================================================
// פורמט תאריך בעברית
// ============================================================================

function formatDateHe(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr.slice(0, 10);
  }
}

// ============================================================================
// תרגום קטגוריות לעברית
// ============================================================================

const CATEGORY_LABELS_HE: Record<string, string> = {
  content_optimization: 'אופטימיזציית תוכן',
  internal_linking: 'קישורים פנימיים',
  metadata: 'מטא-דאטא',
  faq_schema: 'FAQ וסכמות',
  geo_visibility: 'נראות GEO/AI',
  technical_seo: 'SEO טכני',
  strategic: 'אסטרטגיה',
  conversion: 'המרות',
  local_seo: 'SEO מקומי',
  image_seo: 'SEO תמונות',
  reporting: 'דיווח',
  monitoring: 'ניטור',
};

// ============================================================================
// generateEmailHTML — בניית תבנית HTML מלאה בעברית
// ============================================================================

export function generateEmailHTML(data: WeeklyEmailData): string {
  const { config, summary, periodStart, periodEnd, gscData, planProgress } = data;

  // בנה שורות קטגוריות עם ספירות
  const categoryRows = Object.entries(summary.actionsByCategory)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => {
      const label = CATEGORY_LABELS_HE[cat] || cat;
      return `
        <tr>
          <td style="padding: 8px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">${label}</td>
          <td style="padding: 8px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: center; font-weight: 600;">${count}</td>
        </tr>`;
    })
    .join('');

  // בנה שורות תובנות
  const insightItems = summary.insights.length > 0
    ? summary.insights.map(i => `<li style="margin-bottom: 8px; color: #333; line-height: 1.6;">${i}</li>`).join('')
    : '<li style="color: #999;">אין תובנות לשבוע זה</li>';

  // בנה שורות פוקוס לשבוע הבא
  const focusItems = summary.nextWeekFocus.length > 0
    ? summary.nextWeekFocus.map(f => `<li style="margin-bottom: 8px; color: #333; line-height: 1.6;">${f}</li>`).join('')
    : '<li style="color: #999;">יעודכן בקרוב</li>';

  // פעולות מובילות — טבלה
  let topActionsTable = '';
  if (config.includeDetailedTable && summary.topActions.length > 0) {
    const actionRows = summary.topActions.map(action => `
      <tr>
        <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #333;">${action.description}</td>
        <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #666; text-align: center;">${action.pageTitle || action.pageUrl || '—'}</td>
        <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; text-align: center;">
          <span style="background: ${action.expectedImpact === 'critical' ? '#dc3545' : action.expectedImpact === 'high' ? '#fd7e14' : action.expectedImpact === 'medium' ? '#ffc107' : '#28a745'}; color: ${action.expectedImpact === 'critical' || action.expectedImpact === 'high' ? '#fff' : '#333'}; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${action.expectedImpact}</span>
        </td>
      </tr>`).join('');

    topActionsTable = `
      <div style="margin-top: 24px;">
        <h3 style="color: #1a1a2e; font-size: 16px; margin-bottom: 12px; border-right: 3px solid #6c5ce7; padding-right: 10px;">פעולות מובילות השבוע</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e0e0e0; border-radius: 8px;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 10px 12px; text-align: right; font-size: 13px; color: #666; border-bottom: 2px solid #e0e0e0;">פעולה</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 13px; color: #666; border-bottom: 2px solid #e0e0e0;">דף</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 13px; color: #666; border-bottom: 2px solid #e0e0e0;">חשיבות</th>
            </tr>
          </thead>
          <tbody>${actionRows}</tbody>
        </table>
      </div>`;
  }

  // נתוני GSC
  let gscSection = '';
  if (gscData) {
    const impressionsChange = gscData.changes?.impressions || '';
    const clicksChange = gscData.changes?.clicks || '';

    gscSection = `
      <div style="margin-top: 24px;">
        <h3 style="color: #1a1a2e; font-size: 16px; margin-bottom: 12px; border-right: 3px solid #6c5ce7; padding-right: 10px;">נתוני Google Search Console</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 12px; text-align: center; width: 25%;">
              <div style="background: #f8f9fa; border-radius: 8px; padding: 16px;">
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">חשיפות</div>
                <div style="font-size: 20px; font-weight: 700; color: #1a1a2e;">${formatNumber(gscData.impressions)}</div>
                ${impressionsChange ? `<div style="font-size: 12px; color: ${impressionsChange.startsWith('+') ? '#28a745' : '#dc3545'}; margin-top: 4px;">${impressionsChange}</div>` : ''}
              </div>
            </td>
            <td style="padding: 12px; text-align: center; width: 25%;">
              <div style="background: #f8f9fa; border-radius: 8px; padding: 16px;">
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">קליקים</div>
                <div style="font-size: 20px; font-weight: 700; color: #1a1a2e;">${formatNumber(gscData.clicks)}</div>
                ${clicksChange ? `<div style="font-size: 12px; color: ${clicksChange.startsWith('+') ? '#28a745' : '#dc3545'}; margin-top: 4px;">${clicksChange}</div>` : ''}
              </div>
            </td>
            <td style="padding: 12px; text-align: center; width: 25%;">
              <div style="background: #f8f9fa; border-radius: 8px; padding: 16px;">
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">CTR</div>
                <div style="font-size: 20px; font-weight: 700; color: #1a1a2e;">${formatPercent(gscData.ctr)}</div>
              </div>
            </td>
            <td style="padding: 12px; text-align: center; width: 25%;">
              <div style="background: #f8f9fa; border-radius: 8px; padding: 16px;">
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">מיקום ממוצע</div>
                <div style="font-size: 20px; font-weight: 700; color: #1a1a2e;">${formatPosition(gscData.avgPosition)}</div>
              </div>
            </td>
          </tr>
        </table>
      </div>`;
  }

  // התקדמות התוכנית — progress bar
  const progressPercent = planProgress.percentComplete;
  const progressSection = `
    <div style="margin-top: 24px;">
      <h3 style="color: #1a1a2e; font-size: 16px; margin-bottom: 12px; border-right: 3px solid #6c5ce7; padding-right: 10px;">התקדמות התוכנית</h3>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 13px; color: #666;">יום ${planProgress.currentDay} מתוך ${planProgress.totalDays}</span>
        <span style="font-size: 13px; color: #666;">שלב: ${planProgress.currentPhase}</span>
      </div>
      <div style="background: #e9ecef; border-radius: 10px; height: 12px; overflow: hidden;">
        <div style="background: linear-gradient(90deg, #6c5ce7, #a29bfe); width: ${progressPercent}%; height: 100%; border-radius: 10px; transition: width 0.3s;"></div>
      </div>
      <div style="text-align: center; margin-top: 6px; font-size: 13px; color: #666; font-weight: 600;">${progressPercent}% הושלמו</div>
    </div>`;

  // בנה את ה-HTML המלא
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${generateEmailSubject(config.clientName)}</title>
</head>
<body style="margin: 0; padding: 0; background: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; direction: rtl;">
  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f4f5f7;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); overflow: hidden; max-width: 600px;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 22px; margin: 0 0 8px 0; font-weight: 700; letter-spacing: 1px;">PIXEL SEO GEO</h1>
              <p style="color: #a29bfe; font-size: 14px; margin: 0;">סיכום פעילות שבועי</p>
              <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 8px 0 0 0;">${formatDateHe(periodStart)} — ${formatDateHe(periodEnd)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 24px;">

              <!-- ברכת פתיחה -->
              <p style="font-size: 16px; color: #333; margin: 0 0 16px 0; line-height: 1.6;">
                שלום ${config.recipientName},
              </p>
              <p style="font-size: 14px; color: #555; margin: 0 0 24px 0; line-height: 1.7;">
                להלן סיכום הפעילות שבוצעה עבור <strong>${config.clientName}</strong> בתקופה ${formatDateHe(periodStart)} — ${formatDateHe(periodEnd)}.
                ${summary.completedActions > 0 ? `השבוע הושלמו ${summary.completedActions} פעולות אופטימיזציה.` : 'לא בוצעו פעולות השבוע.'}
              </p>

              <!-- מדדים מרכזיים -->
              <h3 style="color: #1a1a2e; font-size: 16px; margin-bottom: 12px; border-right: 3px solid #6c5ce7; padding-right: 10px;">מדדים מרכזיים</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 16px;">
                <tr>
                  <td style="padding: 8px; text-align: center; width: 25%;">
                    <div style="background: #e8f5e9; border-radius: 8px; padding: 14px 8px;">
                      <div style="font-size: 24px; font-weight: 700; color: #2e7d32;">${summary.completedActions}</div>
                      <div style="font-size: 11px; color: #666; margin-top: 4px;">הושלמו</div>
                    </div>
                  </td>
                  <td style="padding: 8px; text-align: center; width: 25%;">
                    <div style="background: #fff3e0; border-radius: 8px; padding: 14px 8px;">
                      <div style="font-size: 24px; font-weight: 700; color: #ef6c00;">${summary.pendingApproval}</div>
                      <div style="font-size: 11px; color: #666; margin-top: 4px;">ממתינות לאישור</div>
                    </div>
                  </td>
                  <td style="padding: 8px; text-align: center; width: 25%;">
                    <div style="background: #e3f2fd; border-radius: 8px; padding: 14px 8px;">
                      <div style="font-size: 24px; font-weight: 700; color: #1565c0;">${summary.pagesImproved}</div>
                      <div style="font-size: 11px; color: #666; margin-top: 4px;">דפים שופרו</div>
                    </div>
                  </td>
                  <td style="padding: 8px; text-align: center; width: 25%;">
                    <div style="background: #fce4ec; border-radius: 8px; padding: 14px 8px;">
                      <div style="font-size: 24px; font-weight: 700; color: #c62828;">${summary.failedActions}</div>
                      <div style="font-size: 11px; color: #666; margin-top: 4px;">נכשלו</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- פירוט לפי קטגוריה -->
              ${categoryRows ? `
              <h3 style="color: #1a1a2e; font-size: 16px; margin: 24px 0 12px 0; border-right: 3px solid #6c5ce7; padding-right: 10px;">פירוט לפי קטגוריה</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e0e0e0; border-radius: 8px;">
                <thead>
                  <tr style="background: #f8f9fa;">
                    <th style="padding: 10px 16px; text-align: right; font-size: 13px; color: #666; border-bottom: 2px solid #e0e0e0;">קטגוריה</th>
                    <th style="padding: 10px 16px; text-align: center; font-size: 13px; color: #666; border-bottom: 2px solid #e0e0e0;">פעולות</th>
                  </tr>
                </thead>
                <tbody>${categoryRows}</tbody>
              </table>` : ''}

              <!-- מדדי SEO ספציפיים -->
              <h3 style="color: #1a1a2e; font-size: 16px; margin: 24px 0 12px 0; border-right: 3px solid #6c5ce7; padding-right: 10px;">פירוט פעולות SEO</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e0e0e0; border-radius: 8px;">
                <tbody>
                  <tr>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">קישורים פנימיים</td>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: center; font-weight: 600;">${summary.internalLinksAdded}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">בלוקי FAQ</td>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: center; font-weight: 600;">${summary.faqsAdded}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">סכמות (Schema)</td>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: center; font-weight: 600;">${summary.schemasAdded}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">מטא-דאטא עודכנו</td>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: center; font-weight: 600;">${summary.metaUpdated}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">תוכן רוענן</td>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: center; font-weight: 600;">${summary.contentRefreshed}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">תמונות אופטימיזציה</td>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: center; font-weight: 600;">${summary.imagesOptimized}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">בעיות טכניות נמצאו</td>
                    <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: center; font-weight: 600;">${summary.technicalIssuesFound}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 16px; font-size: 14px; color: #333;">בעיות טכניות תוקנו</td>
                    <td style="padding: 10px 16px; font-size: 14px; color: #333; text-align: center; font-weight: 600;">${summary.technicalIssuesFixed}</td>
                  </tr>
                </tbody>
              </table>

              ${gscSection}

              ${progressSection}

              ${topActionsTable}

              <!-- תובנות -->
              <div style="margin-top: 24px;">
                <h3 style="color: #1a1a2e; font-size: 16px; margin-bottom: 12px; border-right: 3px solid #6c5ce7; padding-right: 10px;">תובנות השבוע</h3>
                <ul style="padding-right: 20px; margin: 0; list-style-type: disc;">
                  ${insightItems}
                </ul>
              </div>

              <!-- פוקוס לשבוע הבא -->
              <div style="margin-top: 24px;">
                <h3 style="color: #1a1a2e; font-size: 16px; margin-bottom: 12px; border-right: 3px solid #28a745; padding-right: 10px;">פוקוס לשבוע הבא</h3>
                <ul style="padding-right: 20px; margin: 0; list-style-type: disc;">
                  ${focusItems}
                </ul>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f8f9fa; padding: 24px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 14px; color: #333; margin: 0 0 4px 0; font-weight: 600;">בברכה,</p>
              <p style="font-size: 14px; color: #333; margin: 0 0 12px 0; font-weight: 600;">צוות PIXEL SEO GEO</p>
              <p style="font-size: 11px; color: #999; margin: 0;">
                דוח זה נוצר אוטומטית על ידי מערכת PIXEL SEO GEO.
                <br>לשאלות ובירורים ניתן להשיב למייל זה.
              </p>
              ${config.websiteUrl ? `<p style="font-size: 11px; color: #999; margin: 8px 0 0 0;">${config.websiteUrl}</p>` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// generateEmailPlainText — גרסת טקסט פשוט של המייל
// ============================================================================

export function generateEmailPlainText(data: WeeklyEmailData): string {
  const { config, summary, periodStart, periodEnd, gscData, planProgress } = data;

  const lines: string[] = [];

  // כותרת
  lines.push('='.repeat(50));
  lines.push(`PIXEL SEO GEO — סיכום פעילות שבועי`);
  lines.push(`${config.clientName}`);
  lines.push(`${formatDateHe(periodStart)} — ${formatDateHe(periodEnd)}`);
  lines.push('='.repeat(50));
  lines.push('');

  // ברכה
  lines.push(`שלום ${config.recipientName},`);
  lines.push('');
  lines.push(`להלן סיכום הפעילות שבוצעה עבור ${config.clientName} בתקופה הנ"ל.`);
  lines.push('');

  // מדדים מרכזיים
  lines.push('--- מדדים מרכזיים ---');
  lines.push(`פעולות שהושלמו: ${summary.completedActions}`);
  lines.push(`ממתינות לאישור: ${summary.pendingApproval}`);
  lines.push(`דפים שופרו: ${summary.pagesImproved}`);
  lines.push(`פעולות שנכשלו: ${summary.failedActions}`);
  lines.push('');

  // פירוט לפי קטגוריה
  const activeCategories = Object.entries(summary.actionsByCategory).filter(([_, c]) => c > 0);
  if (activeCategories.length > 0) {
    lines.push('--- פירוט לפי קטגוריה ---');
    for (const [cat, count] of activeCategories.sort((a, b) => b[1] - a[1])) {
      const label = CATEGORY_LABELS_HE[cat] || cat;
      lines.push(`  ${label}: ${count}`);
    }
    lines.push('');
  }

  // פירוט SEO ספציפי
  lines.push('--- פירוט פעולות SEO ---');
  lines.push(`  קישורים פנימיים: ${summary.internalLinksAdded}`);
  lines.push(`  בלוקי FAQ: ${summary.faqsAdded}`);
  lines.push(`  סכמות: ${summary.schemasAdded}`);
  lines.push(`  מטא-דאטא עודכנו: ${summary.metaUpdated}`);
  lines.push(`  תוכן רוענן: ${summary.contentRefreshed}`);
  lines.push(`  תמונות אופטימיזציה: ${summary.imagesOptimized}`);
  lines.push(`  בעיות טכניות נמצאו: ${summary.technicalIssuesFound}`);
  lines.push(`  בעיות טכניות תוקנו: ${summary.technicalIssuesFixed}`);
  lines.push('');

  // נתוני GSC
  if (gscData) {
    lines.push('--- נתוני Google Search Console ---');
    lines.push(`  חשיפות: ${formatNumber(gscData.impressions)}${gscData.changes?.impressions ? ` (${gscData.changes.impressions})` : ''}`);
    lines.push(`  קליקים: ${formatNumber(gscData.clicks)}${gscData.changes?.clicks ? ` (${gscData.changes.clicks})` : ''}`);
    lines.push(`  CTR: ${formatPercent(gscData.ctr)}`);
    lines.push(`  מיקום ממוצע: ${formatPosition(gscData.avgPosition)}`);
    lines.push('');
  }

  // התקדמות
  lines.push('--- התקדמות התוכנית ---');
  lines.push(`  יום ${planProgress.currentDay} מתוך ${planProgress.totalDays} (${planProgress.percentComplete}%)`);
  lines.push(`  שלב נוכחי: ${planProgress.currentPhase}`);
  lines.push('');

  // פעולות מובילות
  if (config.includeDetailedTable && summary.topActions.length > 0) {
    lines.push('--- פעולות מובילות ---');
    for (const action of summary.topActions) {
      const page = action.pageTitle || action.pageUrl || '';
      lines.push(`  [${action.expectedImpact}] ${action.description}${page ? ` — ${page}` : ''}`);
    }
    lines.push('');
  }

  // תובנות
  if (summary.insights.length > 0) {
    lines.push('--- תובנות השבוע ---');
    for (const insight of summary.insights) {
      lines.push(`  * ${insight}`);
    }
    lines.push('');
  }

  // פוקוס לשבוע הבא
  if (summary.nextWeekFocus.length > 0) {
    lines.push('--- פוקוס לשבוע הבא ---');
    for (const focus of summary.nextWeekFocus) {
      lines.push(`  * ${focus}`);
    }
    lines.push('');
  }

  // חתימה
  lines.push('---');
  lines.push('בברכה,');
  lines.push('צוות PIXEL SEO GEO');
  lines.push('');
  lines.push('דוח זה נוצר אוטומטית על ידי מערכת PIXEL SEO GEO.');
  if (config.websiteUrl) {
    lines.push(config.websiteUrl);
  }

  return lines.join('\n');
}

// ============================================================================
// shouldSendEmail — בדיקה אם צריך לשלוח מייל
// ============================================================================

export function shouldSendEmail(config: WeeklyEmailConfig): boolean {
  // בדוק שהשליחה האוטומטית מופעלת
  if (!config.autoSendEnabled) return false;

  // בדוק שיש כתובת מייל תקינה
  if (!config.recipientEmail || !config.recipientEmail.includes('@')) return false;

  // בדוק שיש שם לקוח
  if (!config.clientName || config.clientName.trim() === '') return false;

  // בדוק שיש planId
  if (!config.planId || config.planId.trim() === '') return false;

  return true;
}

// ============================================================================
// buildEmailPayload — בניית מטען המייל מוכן לשליחה
// ============================================================================

export function buildEmailPayload(data: WeeklyEmailData): {
  to: string;
  subject: string;
  html: string;
  text: string;
  cc?: string[];
  bcc?: string[];
} {
  const subject = generateEmailSubject(data.config.clientName);
  const html = generateEmailHTML(data);
  const text = generateEmailPlainText(data);

  const payload: {
    to: string;
    subject: string;
    html: string;
    text: string;
    cc?: string[];
    bcc?: string[];
  } = {
    to: data.config.recipientEmail,
    subject,
    html,
    text,
  };

  // הוסף CC ו-BCC אם קיימים
  if (data.config.ccEmails && data.config.ccEmails.length > 0) {
    payload.cc = data.config.ccEmails;
  }
  if (data.config.bccEmails && data.config.bccEmails.length > 0) {
    payload.bcc = data.config.bccEmails;
  }

  return payload;
}

// ============================================================================
// logEmailSent — תיעוד שליחת מייל
// ============================================================================

export function logEmailSent(result: EmailSendResult, data: WeeklyEmailData): EmailLogEntry {
  const logEntry: EmailLogEntry = {
    id: generateEmailId(),
    planId: data.config.planId,
    clientId: data.summary.clientId,
    subject: result.subject,
    recipients: result.recipients,
    sentAt: result.sentAt || new Date().toISOString(),
    deliveryStatus: result.success ? 'sent' : 'failed',
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    actionsIncluded: data.summary.totalActions,
  };

  // שמור בלוג
  emailLogs.push(logEntry);

  return logEntry;
}

// ============================================================================
// getEmailLogs — קבלת כל רשומות הלוג
// ============================================================================

export function getEmailLogs(): EmailLogEntry[] {
  return [...emailLogs];
}
