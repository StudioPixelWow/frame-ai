/**
 * GET /api/data/mailings - Get all mailings
 * POST /api/data/mailings - Create a new mailing
 */

import { NextRequest, NextResponse } from 'next/server';
import { mailings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { sendEmail } from '@/lib/email/email-service';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await mailings.getAllAsync());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch mailings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await mailings.createAsync(body);

    // Actually send the email if we have recipients
    const recipients = body.recipients || body.to;
    if (recipients && (body.subject || body.title)) {
      const toAddresses = Array.isArray(recipients)
        ? recipients.map((r: any) => typeof r === 'string' ? r : r.email).filter(Boolean)
        : typeof recipients === 'string' ? [recipients] : [];

      if (toAddresses.length > 0) {
        const emailResult = await sendEmail({
          to: toAddresses,
          subject: body.subject || body.title || '',
          html: body.html || body.content || body.body || '',
          text: body.text || body.plainText || '',
        });

        if (!emailResult.success && !emailResult.mock) {
          console.error('[Mailings] Email send failed:', emailResult.error);
          return NextResponse.json({
            ...created,
            emailSent: false,
            emailError: emailResult.error,
          }, { status: 201 });
        }

        return NextResponse.json({
          ...created,
          emailSent: !emailResult.mock,
          emailMock: emailResult.mock || false,
        }, { status: 201 });
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create mailing' },
      { status: 400 }
    );
  }
}
