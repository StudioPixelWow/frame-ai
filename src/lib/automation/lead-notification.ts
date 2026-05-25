/**
 * WhatsApp notification when a new lead arrives.
 * Sends a Hebrew summary to the CLIENT's phone via WhatsApp Business Cloud API.
 */

import { getClientById } from '@/lib/db/client-helpers';
import { sendMessage, normalizeIsraeliPhone, isConfigured } from '@/lib/whatsapp/whatsapp-service';
import { whatsappMessages } from '@/lib/db';

export async function notifyClientOnNewLead(lead: {
  name: string;
  phone: string;
  email: string;
  source: string;
  clientId: string;
  clientName: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Look up client to get their phone number
    const client = await getClientById(lead.clientId);
    if (!client) {
      return { success: false, error: `לקוח לא נמצא: ${lead.clientId}` };
    }

    if (!client.phone) {
      return { success: false, error: `ללקוח ${client.name} אין מספר טלפון` };
    }

    if (!isConfigured()) {
      return { success: false, error: 'WhatsApp לא מוגדר' };
    }

    // 2. Build Hebrew notification message
    const message =
      `🔔 ליד חדש!\n` +
      `שם: ${lead.name}\n` +
      `טלפון: ${lead.phone}\n` +
      `אימייל: ${lead.email}\n` +
      `מקור: ${lead.source}\n\n` +
      `נכנס עכשיו למערכת של ${lead.clientName}.`;

    // 3. Send WhatsApp message to the client's phone
    const normalizedPhone = normalizeIsraeliPhone(client.phone);
    const result = await sendMessage(normalizedPhone, message);

    // 4. Save to whatsapp_messages collection
    await whatsappMessages.createAsync({
      clientId: lead.clientId,
      clientName: lead.clientName,
      phone: normalizedPhone,
      templateName: '',
      message,
      status: result.success ? 'sent' : 'failed',
      direction: 'outgoing' as const,
      relatedEntityType: 'lead',
      relatedEntityId: '',
      sentAt: result.success ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    if (!result.success) {
      return { success: false, error: result.error || 'שליחת הודעה נכשלה' };
    }

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[lead-notification] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
