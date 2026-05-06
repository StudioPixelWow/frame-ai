// שירות מיילים לדיווח SEO ללקוח
// SEO Email Notification Service for Client Reporting

import type { AutoTaskResult } from './seo-automator';

export interface SeoEmailData {
  to: string;
  subject: string;
  htmlBody: string;
}

/**
 * שלח מייל מיידי על פעולה שבוצעה
 * Send immediate email about a completed task
 */
export async function sendSeoTaskEmail(
  plan: any,
  taskTitle: string,
  result: AutoTaskResult,
): Promise<void> {
  const clientEmail = plan.clientEmail || plan.businessProfile?.email;
  if (!clientEmail) return;

  const emailData = buildTaskExecutionEmailData(
    plan.clientName,
    taskTitle,
    result,
    plan.websiteUrl,
  );

  await sendEmail({
    to: clientEmail,
    subject: emailData.subject,
    htmlBody: emailData.htmlBody,
  });
}

/**
 * שלח מייל סיכום יומי
 * Send daily summary email
 */
export async function sendSeoDailySummaryEmail(
  plan: any,
  dayNumber: number,
  results: any[],
  completedCount: number,
  totalCount: number,
): Promise<void> {
  const clientEmail = plan.clientEmail || plan.businessProfile?.email;
  if (!clientEmail) return;

  const emailData = buildDailySummaryEmailData(
    plan.clientName,
    dayNumber,
    results,
    completedCount,
    totalCount,
    plan.websiteUrl,
  );

  await sendEmail({
    to: clientEmail,
    subject: emailData.subject,
    htmlBody: emailData.htmlBody,
  });
}

/**
 * בנה נתוני מייל לפעולה בודדת
 * Build email data for a single task execution
 */
export function buildTaskExecutionEmailData(
  clientName: string,
  taskTitle: string,
  result: AutoTaskResult,
  websiteUrl?: string,
): { subject: string; htmlBody: string } {
  const subject = `✅ ${clientName} — בוצע: ${taskTitle}`;

  const changesHtml = result.changes.map(change => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${change.pageTitle || '—'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #999; text-decoration: line-through;">${truncate(change.oldValue, 60)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #16a34a; font-weight: 600;">${truncate(change.newValue, 60)}</td>
    </tr>
  `).join('');

  const htmlBody = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px 32px; color: white;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">PIXEL SEO/GEO</div>
      <div style="font-size: 20px; font-weight: 700; margin-top: 4px;">פעולה בוצעה בהצלחה ✓</div>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      <p style="font-size: 15px; color: #334155; margin: 0 0 8px;">שלום ${clientName},</p>
      <p style="font-size: 15px; color: #334155; margin: 0 0 24px;">
        המערכת ביצעה עבורך את הפעולה הבאה באופן אוטומטי:
      </p>

      <!-- Task Card -->
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 16px; font-weight: 700; color: #0c4a6e;">${taskTitle}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 6px;">
          ${result.pagesAffected} עמודים עודכנו · ${result.changes.length} שינויים
        </div>
      </div>

      ${result.changes.length > 0 ? `
      <!-- Changes Table -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">מה השתנה:</div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #64748b; font-weight: 600;">עמוד</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #64748b; font-weight: 600;">לפני</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #64748b; font-weight: 600;">אחרי</th>
            </tr>
          </thead>
          <tbody>${changesHtml}</tbody>
        </table>
      </div>
      ` : ''}

      ${websiteUrl ? `
      <a href="${websiteUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
        צפה באתר →
      </a>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 12px; color: #94a3b8; text-align: center;">
        מייל אוטומטי מ-PIXEL SEO/GEO · מערכת קידום אתרים חכמה
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, htmlBody };
}

/**
 * בנה נתוני מייל סיכום יומי
 * Build daily summary email data
 */
export function buildDailySummaryEmailData(
  clientName: string,
  dayNumber: number,
  results: any[],
  completedCount: number,
  totalCount: number,
  websiteUrl?: string,
): { subject: string; htmlBody: string } {
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const successfulToday = results.filter(r => r.success).length;
  const executedToday = results.filter(r => r.executed).length;

  const subject = `📊 סיכום יומי — יום ${dayNumber}/60 · ${progressPercent}% הושלמו`;

  const taskRows = results.map(r => {
    const statusIcon = r.success ? '✅' : r.executed ? '⚠️' : '⏭️';
    const statusText = r.success ? 'בוצע בהצלחה' : r.executed ? 'נכשל' : 'דורש ביצוע ידני';
    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${statusIcon}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; font-weight: 500;">${r.taskTitle}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: ${r.success ? '#16a34a' : '#ef4444'};">${statusText}</td>
      </tr>
    `;
  }).join('');

  const htmlBody = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 24px 32px; color: white;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">PIXEL SEO/GEO — סיכום יומי</div>
      <div style="font-size: 22px; font-weight: 700; margin-top: 4px;">יום ${dayNumber} מתוך 60</div>
    </div>

    <!-- Progress Bar -->
    <div style="padding: 24px 32px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 14px; font-weight: 600; color: #1e293b;">התקדמות כללית</span>
        <span style="font-size: 14px; font-weight: 700; color: #2563eb;">${progressPercent}%</span>
      </div>
      <div style="background: #e2e8f0; border-radius: 999px; height: 10px; overflow: hidden;">
        <div style="background: linear-gradient(90deg, #2563eb, #7c3aed); height: 100%; width: ${progressPercent}%; border-radius: 999px; transition: width 0.3s;"></div>
      </div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">${completedCount} מתוך ${totalCount} משימות הושלמו</div>
    </div>

    <!-- Stats -->
    <div style="display: flex; padding: 0 32px 24px; gap: 12px;">
      <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: 700; color: #16a34a;">${successfulToday}</div>
        <div style="font-size: 11px; color: #64748b;">בוצעו בהצלחה</div>
      </div>
      <div style="flex: 1; background: #fef3c7; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: 700; color: #d97706;">${results.length - executedToday}</div>
        <div style="font-size: 11px; color: #64748b;">דורשות ביצוע ידני</div>
      </div>
      <div style="flex: 1; background: #eff6ff; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: 700; color: #2563eb;">${60 - dayNumber}</div>
        <div style="font-size: 11px; color: #64748b;">ימים נותרו</div>
      </div>
    </div>

    <!-- Tasks Table -->
    <div style="padding: 0 32px 24px;">
      <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">משימות היום:</div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <tbody>${taskRows}</tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="padding: 0 32px 32px; text-align: center;">
      <p style="font-size: 14px; color: #64748b; margin: 0 0 16px;">אנחנו עובדים בשבילך 24/7 כדי לקדם את האתר שלך בגוגל ובפלטפורמות AI</p>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 12px; color: #94a3b8; text-align: center;">
        מייל אוטומטי מ-PIXEL SEO/GEO · ${clientName}
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, htmlBody };
}

/**
 * שלח מייל - כרגע לוג + API call, בפרודקשן ישתמש ב-SMTP/SendGrid
 * Send email - currently logs + API call, production uses SMTP/SendGrid
 */
async function sendEmail(data: SeoEmailData): Promise<void> {
  console.log(`[SEO-EMAIL] Sending to ${data.to}: ${data.subject}`);

  // אם יש Gmail API token מוגדר, שלח דרכו
  // If Gmail API or SMTP is configured, send through it
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    await fetch(`${baseUrl}/api/clients/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: data.to,
        subject: data.subject,
        html: data.htmlBody,
        source: 'seo-automation',
      }),
    });
  } catch (error) {
    // Fallback: לוג בלבד
    console.log(`[SEO-EMAIL] Fallback log — would send to ${data.to}`);
    console.log(`[SEO-EMAIL] Subject: ${data.subject}`);
  }
}

function truncate(str: string, max: number): string {
  if (!str) return '—';
  return str.length > max ? str.substring(0, max) + '...' : str;
}
