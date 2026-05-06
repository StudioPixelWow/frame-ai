/**
 * POST /api/data/reports/[id]/send — Send report to client via email
 *
 * Body: { email }
 *
 * Currently a placeholder — logs the send intent and updates report status.
 * In production, integrate with email service (e.g., Resend, SendGrid).
 */

import { NextRequest, NextResponse } from 'next/server';
import { reports } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const role = req.headers.get('x-user-role') || 'admin';
    if (role === 'client') {
      return NextResponse.json({ error: 'לקוחות לא יכולים לשלוח דוחות' }, { status: 403 });
    }

    const { id } = await params;
    const report = await reports.getByIdAsync(id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const body = await req.json();
    const { email } = body as { email: string };

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    // Send real email with report info
    const htmlBody = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px 32px; color: white;">
      <div style="font-size: 20px; font-weight: 700;">📊 דוח חדש</div>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 15px; color: #334155;">שלום,</p>
      <p style="font-size: 15px; color: #334155;">מצורף דוח: <strong>${report.title || 'דוח'}</strong></p>
      ${(report as any).pdfUrl ? `<a href="${(report as any).pdfUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; margin-top: 16px;">צפה בדוח →</a>` : ''}
    </div>
    <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 12px; color: #94a3b8; text-align: center;">נשלח באמצעות PixelManageAI · סטודיו פיקסל</div>
    </div>
  </div>
</body>
</html>`;

    const emailResult = await sendEmail({
      to: email,
      subject: `דוח: ${report.title || 'דוח חדש'} — סטודיו פיקסל`,
      html: htmlBody,
    });

    // Update report with send info
    await reports.updateAsync(id, {
      status: 'sent',
      sentTo: email,
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: emailResult.success,
      mock: emailResult.mock || false,
      message: emailResult.success ? `הדוח נשלח ל-${email}` : `שגיאה בשליחת הדוח: ${emailResult.error}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
