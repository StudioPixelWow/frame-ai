/**
 * WhatsApp Business Cloud API Service
 * High-level service layer wrapping the WhatsApp client
 * Provides: sendMessage, sendTemplate, getQRCode, connection management
 */

import {
  sendTextMessage,
  sendTemplateMessage,
  isWhatsAppConfigured,
  normalizeIsraeliPhone,
  HEBREW_TEMPLATES,
} from './whatsapp-client';
import type { SendMessageResult, WhatsAppTemplate } from './whatsapp-client';

// ===== Types =====

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  verifyToken?: string;
}

export interface WhatsAppMessage {
  to: string;
  text: string;
  templateName?: string;
  templateParams?: string[];
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppConnectionStatus {
  connected: boolean;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  displayPhone?: string;
  qualityRating?: string;
  error?: string;
}

export interface WhatsAppQRCode {
  code: string;
  prefilled_message?: string;
  deep_link_url?: string;
}

// ===== Service Functions =====

/**
 * Send a plain text message via WhatsApp Business Cloud API
 */
export async function sendMessage(to: string, text: string): Promise<WhatsAppResponse> {
  const result = await sendTextMessage(to, text);
  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send a template message via WhatsApp Business Cloud API
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  params: string[]
): Promise<WhatsAppResponse> {
  const template: WhatsAppTemplate = {
    name: templateName,
    language: 'he',
    components: params.length > 0
      ? [{ type: 'body', parameters: params.map(p => ({ type: 'text' as const, text: p })) }]
      : undefined,
  };

  const result = await sendTemplateMessage(to, template);
  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Get QR Code for WhatsApp Business linking
 * Uses the WhatsApp Business Management API endpoint
 */
export async function getQRCode(phoneNumberId: string): Promise<WhatsAppQRCode | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken || !phoneNumberId) return null;

  const apiVersion = 'v18.0';
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/message_qrdls`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const qrCodes = data?.data;
    if (qrCodes && qrCodes.length > 0) {
      return {
        code: qrCodes[0].code,
        prefilled_message: qrCodes[0].prefilled_message,
        deep_link_url: qrCodes[0].deep_link_url,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check WhatsApp Business connection status via the API
 */
export async function checkConnectionStatus(): Promise<WhatsAppConnectionStatus> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!phoneNumberId || !accessToken) {
    return {
      connected: false,
      phoneNumberId: null,
      businessAccountId: null,
      error: 'חסרים פרטי חיבור WhatsApp',
    };
  }

  const apiVersion = 'v18.0';
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        connected: false,
        phoneNumberId,
        businessAccountId: businessAccountId || null,
        error: err?.error?.message || `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      connected: true,
      phoneNumberId,
      businessAccountId: businessAccountId || null,
      displayPhone: data.display_phone_number,
      qualityRating: data.quality_rating,
    };
  } catch (err) {
    return {
      connected: false,
      phoneNumberId,
      businessAccountId: businessAccountId || null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Verify WhatsApp configuration is valid (quick check)
 */
export function isConfigured(): boolean {
  return isWhatsAppConfigured();
}

/**
 * Get available Hebrew templates
 */
export function getAvailableTemplates() {
  return HEBREW_TEMPLATES;
}

// Re-export utilities
export { normalizeIsraeliPhone, HEBREW_TEMPLATES };
