/**
 * GET /api/data/whatsapp-messages - Get all WhatsApp messages
 * POST /api/data/whatsapp-messages - Create a new WhatsApp message
 *   When direction is 'outgoing', also sends via WhatsApp Business Cloud API
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsappMessages } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { sendMessage, sendTemplate, isConfigured } from '@/lib/whatsapp/whatsapp-service';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await whatsappMessages.getAllAsync());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch WhatsApp messages' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();

    // If this is an outgoing message and WhatsApp is configured, send it
    if (body.direction === 'outgoing' && body.phone && isConfigured()) {
      let result;

      if (body.templateName) {
        result = await sendTemplate(
          body.phone,
          body.templateName,
          body.templateParams || []
        );
      } else if (body.message) {
        result = await sendMessage(body.phone, body.message);
      }

      if (result) {
        body.status = result.success ? 'sent' : 'failed';
        body.whatsappMessageId = result.messageId || null;
        body.sentAt = result.success ? new Date().toISOString() : null;
        if (result.error) body.error = result.error;
      }
    } else if (body.direction === 'outgoing' && body.phone && !isConfigured()) {
      // WhatsApp not configured — save as pending
      body.status = body.status || 'pending';
    }

    const created = await whatsappMessages.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create WhatsApp message' },
      { status: 400 }
    );
  }
}
