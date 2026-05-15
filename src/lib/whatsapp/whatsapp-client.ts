/**
 * WhatsApp Business Cloud API Client
 * Uses Meta's WhatsApp Business Platform (Cloud API)
 * Requires: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN
 */

// ===== Types =====

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  apiVersion: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: { type: 'text'; text: string }[];
}

// ===== Hebrew Message Templates =====

export const HEBREW_TEMPLATES: Record<string, { name: string; hebrewLabel: string; params: string[] }> = {
  payment_reminder: {
    name: 'payment_reminder',
    hebrewLabel: 'תזכורת תשלום',
    params: ['clientName', 'amount', 'dueDate'],
  },
  project_update: {
    name: 'project_update',
    hebrewLabel: 'עדכון פרויקט',
    params: ['clientName', 'projectName', 'status'],
  },
  gantt_ready: {
    name: 'gantt_ready',
    hebrewLabel: 'גאנט מוכן',
    params: ['clientName', 'projectName'],
  },
  materials_ready: {
    name: 'materials_ready',
    hebrewLabel: 'חומרים מוכנים',
    params: ['clientName', 'description'],
  },
  approval_needed: {
    name: 'approval_needed',
    hebrewLabel: 'ממתין לאישור',
    params: ['clientName', 'itemDescription'],
  },
  meeting_reminder: {
    name: 'meeting_reminder',
    hebrewLabel: 'תזכורת פגישה',
    params: ['clientName', 'dateTime', 'topic'],
  },
};

// ===== Client =====

function getConfig(): WhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'pixelmanage_verify';

  if (!phoneNumberId || !accessToken) return null;

  return {
    phoneNumberId,
    accessToken,
    verifyToken,
    apiVersion: 'v18.0',
  };
}

export function isWhatsAppConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Send a text message via WhatsApp Business Cloud API
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<SendMessageResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp לא מוגדר — חסרים WHATSAPP_PHONE_NUMBER_ID ו-WHATSAPP_ACCESS_TOKEN' };
  }

  const phone = normalizeIsraeliPhone(to);

  try {
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err?.error?.message || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send a template message via WhatsApp Business Cloud API
 */
export async function sendTemplateMessage(
  to: string,
  template: WhatsAppTemplate
): Promise<SendMessageResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp לא מוגדר' };
  }

  const phone = normalizeIsraeliPhone(to);

  try {
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language },
          components: template.components,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err?.error?.message || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verify webhook callback from Meta (for webhook setup)
 */
export function verifyWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null
): { valid: boolean; challenge?: string } {
  const config = getConfig();
  if (!config) return { valid: false };

  if (mode === 'subscribe' && token === config.verifyToken) {
    return { valid: true, challenge: challenge || '' };
  }
  return { valid: false };
}

/**
 * Parse incoming webhook event from WhatsApp
 */
export function parseWebhookEvent(body: any): {
  type: 'message' | 'status' | 'unknown';
  from?: string;
  messageId?: string;
  text?: string;
  status?: string;
  timestamp?: string;
} {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Incoming message
    if (value?.messages?.[0]) {
      const msg = value.messages[0];
      return {
        type: 'message',
        from: msg.from,
        messageId: msg.id,
        text: msg.text?.body || '',
        timestamp: msg.timestamp,
      };
    }

    // Status update (sent, delivered, read)
    if (value?.statuses?.[0]) {
      const s = value.statuses[0];
      return {
        type: 'status',
        messageId: s.id,
        status: s.status, // sent | delivered | read | failed
        from: s.recipient_id,
        timestamp: s.timestamp,
      };
    }

    return { type: 'unknown' };
  } catch {
    return { type: 'unknown' };
  }
}

// ===== Israeli Phone Normalization =====

/**
 * Normalize Israeli phone number to international format (972...)
 * Handles: 050-1234567, 0501234567, +972501234567, 972501234567
 */
export function normalizeIsraeliPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);

  // Already international
  if (cleaned.startsWith('972') && cleaned.length >= 12) return cleaned;

  // Local format: 05x...
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '972' + cleaned.slice(1);
  }

  return cleaned;
}
