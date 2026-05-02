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

    // Update report with send info
    await reports.updateAsync(id, {
      status: 'sent',
      sentTo: email,
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // TODO: Actually send email with PDF attachment via email service
    console.log(`[Reports] Would send report "${report.title}" to ${email}`);

    return NextResponse.json({
      success: true,
      message: `הדוח נשלח ל-${email}`,
      note: 'Email sending is a placeholder — integrate with email service for production',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
