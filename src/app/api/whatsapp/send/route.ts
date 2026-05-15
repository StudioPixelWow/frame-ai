import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage, sendTemplateMessage, isWhatsAppConfigured, HEBREW_TEMPLATES } from '@/lib/whatsapp/whatsapp-client';
import { whatsappMessages } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/send — Send a WhatsApp message
 * Body: { phone, message, templateName?, clientId?, clientName?, relatedEntityType?, relatedEntityId? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, message, templateName, templateParams, clientId, clientName, relatedEntityType, relatedEntityId } = body;

    if (!phone) {
      return NextResponse.json({ error: 'חסר מספר טלפון' }, { status: 400 });
    }

    if (!isWhatsAppConfigured()) {
      // Save as draft when WhatsApp is not configured
      const record = await whatsappMessages.createAsync({
        phone,
        message: message || `[תבנית: ${templateName}]`,
        direction: 'outgoing',
        status: 'pending',
        sentAt: null,
        clientId: clientId || null,
        clientName: clientName || '',
        templateName: templateName || null,
        relatedEntityType: relatedEntityType || null,
        relatedEntityId: relatedEntityId || null,
      } as any);

      return NextResponse.json({
        ...record,
        warning: 'WhatsApp לא מוגדר — ההודעה נשמרה כטיוטה. הגדר WHATSAPP_PHONE_NUMBER_ID ו-WHATSAPP_ACCESS_TOKEN.',
      }, { status: 201 });
    }

    // Send via WhatsApp API
    let result;
    if (templateName && HEBREW_TEMPLATES[templateName]) {
      const tpl = HEBREW_TEMPLATES[templateName];
      result = await sendTemplateMessage(phone, {
        name: tpl.name,
        language: 'he',
        components: templateParams ? [{
          type: 'body',
          parameters: (templateParams as string[]).map(p => ({ type: 'text' as const, text: p })),
        }] : undefined,
      });
    } else if (message) {
      result = await sendTextMessage(phone, message);
    } else {
      return NextResponse.json({ error: 'חסר תוכן ההודעה' }, { status: 400 });
    }

    // Save to DB
    const record = await whatsappMessages.createAsync({
      phone,
      message: message || `[תבנית: ${templateName}]`,
      direction: 'outgoing',
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.messageId || null,
      sentAt: result.success ? new Date().toISOString() : null,
      clientId: clientId || null,
      clientName: clientName || '',
      templateName: templateName || null,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
      error: result.error || null,
    } as any);

    if (!result.success) {
      return NextResponse.json({ ...record, error: result.error }, { status: 502 });
    }

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
