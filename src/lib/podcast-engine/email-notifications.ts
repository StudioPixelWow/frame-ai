/**
 * ── Podcast Email Notifications ──
 *
 * Sends branded PIXEL email notifications for podcast processing events.
 * Uses the existing email service (Gmail SMTP) from @/lib/email/email-service.
 */

import { sendEmail } from '@/lib/email/email-service';

// ── Types ────────────────────────────────────────────────────────────────────

interface NotificationResult {
  success: boolean;
  error?: string;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Notify user that podcast processing is complete and clips are ready.
 */
export async function sendProcessingCompleteEmail(
  episodeTitle: string,
  recipientEmail: string,
  clipCount: number,
  dashboardUrl: string
): Promise<NotificationResult> {
  try {
    const result = await sendEmail({
      to: recipientEmail,
      subject: `✅ העיבוד הושלם — ${episodeTitle}`,
      html: buildHtmlTemplate({
        title: 'העיבוד הושלם בהצלחה!',
        body: `
          <p>הפודקאסט <strong>${escapeHtml(episodeTitle)}</strong> עובד בהצלחה.</p>
          <p>מצאנו <strong>${clipCount}</strong> קליפים פוטנציאליים מוכנים לעריכה ורינדור.</p>
        `,
        ctaText: 'צפה בקליפים',
        ctaUrl: dashboardUrl,
      }),
    });

    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('[PodcastEmail] sendProcessingCompleteEmail failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Notify user that clip rendering is complete and ready for download.
 */
export async function sendRenderCompleteEmail(
  episodeTitle: string,
  recipientEmail: string,
  downloadUrl: string
): Promise<NotificationResult> {
  try {
    const result = await sendEmail({
      to: recipientEmail,
      subject: `🎬 הרינדור הושלם — ${episodeTitle}`,
      html: buildHtmlTemplate({
        title: 'הקליפים מוכנים להורדה!',
        body: `
          <p>הקליפים של <strong>${escapeHtml(episodeTitle)}</strong> רונדרו בהצלחה וזמינים להורדה.</p>
          <p>לחץ על הכפתור למטה כדי להוריד את חבילת הקליפים.</p>
        `,
        ctaText: 'הורד קליפים',
        ctaUrl: downloadUrl,
      }),
    });

    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('[PodcastEmail] sendRenderCompleteEmail failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Notify user that podcast processing encountered an error.
 */
export async function sendProcessingErrorEmail(
  episodeTitle: string,
  recipientEmail: string,
  errorMessage: string
): Promise<NotificationResult> {
  try {
    const result = await sendEmail({
      to: recipientEmail,
      subject: `⚠️ שגיאה בעיבוד — ${episodeTitle}`,
      html: buildHtmlTemplate({
        title: 'אירעה שגיאה בעיבוד הפודקאסט',
        body: `
          <p>העיבוד של <strong>${escapeHtml(episodeTitle)}</strong> נכשל.</p>
          <div style="background:#fff3f3;border:1px solid #ffcccc;border-radius:8px;padding:12px 16px;margin:16px 0;direction:rtl;">
            <strong>פרטי השגיאה:</strong><br/>
            <code style="font-size:13px;color:#c00;">${escapeHtml(errorMessage)}</code>
          </div>
          <p>ניתן לנסות שוב או לפנות לתמיכה אם הבעיה חוזרת.</p>
        `,
        ctaText: 'חזרה לדאשבורד',
        ctaUrl: `${getBaseUrl()}/podcast`,
      }),
    });

    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('[PodcastEmail] sendProcessingErrorEmail failed:', err);
    return { success: false, error: err.message };
  }
}

// ── HTML Template Builder ────────────────────────────────────────────────────

interface TemplateOptions {
  title: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
}

function buildHtmlTemplate(options: TemplateOptions): string {
  const ctaButton = options.ctaText && options.ctaUrl
    ? `
      <div style="text-align:center;margin:24px 0;">
        <a href="${options.ctaUrl}"
           style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:16px;font-weight:600;">
          ${escapeHtml(options.ctaText)}
        </a>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:2px;">PIXEL</span>
              <span style="display:block;font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;">Podcast Studio</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;direction:rtl;text-align:right;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#18181b;">${escapeHtml(options.title)}</h1>
              <div style="font-size:15px;line-height:1.7;color:#3f3f46;">
                ${options.body}
              </div>
              ${ctaButton}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                נשלח אוטומטית על ידי PIXEL Studio
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
}
