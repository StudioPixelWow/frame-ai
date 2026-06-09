/** POST /api/google-ads/reports/:id/send
 *  body: { email?: string }
 *  - With an email → sends a branded email with the report attached, marks "sent".
 *  - Without → just marks the report as "sent" (manual send) and returns the summary. */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { ensureSeeded } from '@/lib/db/seed';
import { googleAdsReports, logGoogleAds } from '@/lib/google-ads/db';
import { sendEmail } from '@/lib/email/email-service';

function emailHtml(clientName: string, reportUrl: string): string {
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#F4F7FB;font-family:Arial,'Heebo',sans-serif;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #E8EAF0">
    <div style="background:linear-gradient(135deg,#00B5FE,#0077B6);padding:26px 28px;color:#fff">
      <div style="font-size:12px;letter-spacing:2px;font-weight:800;opacity:.85">GOOGLE ADS</div>
      <div style="font-size:22px;font-weight:900;margin-top:3px">דוח ביצועים תקופתי</div>
    </div>
    <div style="padding:26px 28px;color:#1A1A2E;font-size:15px;line-height:1.9">
      <p>היי ${clientName},</p>
      <p>מצורף דוח נתונים תקופתי.<br/>שמחים לעמוד לשירותכם!</p>
      <p style="margin-top:18px">
        <a href="${reportUrl}" style="display:inline-block;background:#00B5FE;color:#fff;text-decoration:none;font-weight:800;border-radius:10px;padding:11px 22px">📊 צפייה בדוח</a>
      </p>
      <p style="margin-top:22px;color:#5A5A7A">ניפגש בדוח הבא ✨</p>
      <p style="font-weight:800">צוות Studio Pixel</p>
    </div>
  </div>
</body></html>`;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  ensureSeeded();
  const { id } = await context.params;
  const report = await googleAdsReports.getByIdAsync(id);
  if (!report) return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 });

  let email = '';
  try { email = (await req.json())?.email?.trim() || ''; } catch { /* none */ }

  if (email) {
    const origin = req.nextUrl.origin;
    const reportUrl = `${origin}/api/google-ads/reports/${id}?format=html`;
    const html = report.jsonData?.html as string | undefined;
    const result = await sendEmail({
      to: email,
      subject: `דוח ביצועי Google Ads — ${report.clientName}`,
      html: emailHtml(report.clientName, reportUrl),
      attachments: html ? [{ filename: `google-ads-report-${report.clientName}.html`, content: Buffer.from(html, 'utf8').toString('base64'), contentType: 'text/html' }] : undefined,
    });
    if (!result.success && !result.mock) {
      await logGoogleAds(report.clientId, 'error', `Email send failed to ${email}: ${result.error}`, id);
      return NextResponse.json({ error: 'שליחת המייל נכשלה. ודא שחיבור Gmail מוגדר בהגדרות.' }, { status: 502 });
    }
    try { await googleAdsReports.updateAsync(id, { status: 'sent', sentAt: new Date().toISOString() } as any); } catch { /* ok */ }
    await logGoogleAds(report.clientId, 'success', `Report ${id} emailed to ${email}${result.mock ? ' (mock — no Gmail creds)' : ''}.`, id);
    return NextResponse.json({ success: true, mock: !!result.mock, sentTo: email });
  }

  // No email → just mark sent.
  try { await googleAdsReports.updateAsync(id, { status: 'sent', sentAt: new Date().toISOString() } as any); } catch { /* ok */ }
  await logGoogleAds(report.clientId, 'success', `Report ${id} marked as sent.`, id);
  return NextResponse.json({ success: true, summary: report.summaryText });
}
