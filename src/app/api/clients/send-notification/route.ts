import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/email-service';
import { clientEmailLogs } from '@/lib/db';

/**
 * POST /api/clients/send-notification
 * Send a notification email to a client. Used by SEO email service and other modules.
 *
 * Body: { to, subject, html, text?, clientId?, emailType? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, html, text, clientId, emailType } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'חסר שדה to או subject' }, { status: 400 });
    }

    // Send via Gmail SMTP
    const result = await sendEmail({
      to,
      subject,
      html: html || undefined,
      text: text || undefined,
    });

    // Log the email
    const now = new Date().toISOString();
    try {
      clientEmailLogs.create({
        clientId: clientId || 'system',
        emailType: emailType || 'general',
        subject,
        recipientEmail: Array.isArray(to) ? to.join(', ') : to,
        sentAt: now,
        status: result.success ? 'sent' : 'failed',
        createdAt: now,
      });
    } catch (e) {
      console.warn('[SendNotification] Failed to log email:', e);
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        mock: result.mock || false,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[SendNotification] Error:', error);
    return NextResponse.json({ error: 'שגיאה בשליחת הודעה' }, { status: 500 });
  }
}
