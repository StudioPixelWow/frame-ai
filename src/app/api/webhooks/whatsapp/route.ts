import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, parseWebhookEvent } from '@/lib/whatsapp/whatsapp-client';
import { whatsappMessages } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/webhooks/whatsapp — Meta webhook verification
 * Meta sends a GET request to verify the webhook URL during setup
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const result = verifyWebhook(mode, token, challenge);

  if (result.valid) {
    return new NextResponse(result.challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp — Incoming messages + status updates
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = parseWebhookEvent(body);

    if (event.type === 'message' && event.from && event.text) {
      // Save incoming message
      await whatsappMessages.createAsync({
        phone: event.from,
        message: event.text,
        direction: 'incoming',
        status: 'delivered',
        sentAt: event.timestamp ? new Date(parseInt(event.timestamp) * 1000).toISOString() : new Date().toISOString(),
        clientId: null,
        clientName: '',
        templateName: null,
        relatedEntityType: null,
        relatedEntityId: null,
      } as any);
    }

    if (event.type === 'status' && event.messageId && event.status) {
      // Update message status (sent → delivered → read)
      try {
        const all = await whatsappMessages.getAllAsync();
        const match = all.find((m: any) => m.whatsappMessageId === event.messageId);
        if (match) {
          await whatsappMessages.updateAsync(match.id, { status: event.status } as any);
        }
      } catch { /* non-critical */ }
    }

    // Meta expects 200 response within 5 seconds
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error);
    return NextResponse.json({ status: 'ok' }); // Still return 200 to prevent retries
  }
}
