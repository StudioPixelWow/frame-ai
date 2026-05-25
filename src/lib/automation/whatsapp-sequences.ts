/**
 * WhatsApp automation sequences.
 * Defines trigger-based message flows with delayed steps.
 * Immediate messages are sent now; delayed messages are saved to whatsapp_scheduled for cron processing.
 */

import { getSupabase, ensureTable } from '@/lib/db/store';
import { sendMessage, normalizeIsraeliPhone, isConfigured } from '@/lib/whatsapp/whatsapp-service';
import { whatsappMessages } from '@/lib/db';

// ===== Types =====

export type SequenceTrigger = 'new_lead' | 'new_client' | 'meeting_scheduled' | 'payment_received';

export interface WhatsAppSequenceStep {
  delayMinutes: number; // 0 = immediate, 1440 = 1 day, etc.
  message: string;      // Hebrew template with {name}, {clientName}, {meetingDate}, {meetingTime} placeholders
}

export interface WhatsAppSequence {
  trigger: SequenceTrigger;
  name: string;
  steps: WhatsAppSequenceStep[];
}

export interface ScheduledWhatsAppMessage {
  id: string;
  phone: string;
  message: string;
  clientId: string;
  trigger: SequenceTrigger;
  sequenceName: string;
  stepIndex: number;
  sendAt: string;    // ISO timestamp
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// ===== Default Sequences =====

export function getDefaultSequences(): WhatsAppSequence[] {
  return [
    {
      trigger: 'new_lead',
      name: 'ברוכים הבאים',
      steps: [
        {
          delayMinutes: 0,
          message: 'היי {name}! קיבלנו את הפנייה שלך. צוות {clientName} יחזור אליך בהקדם 🙏',
        },
        {
          delayMinutes: 120,
          message: 'שלום {name}, רק רציתי לוודא שקיבלת את ההודעה שלנו. נשמח לענות על כל שאלה 😊',
        },
        {
          delayMinutes: 1440,
          message: '{name}, רציתי לעדכן שאנחנו עדיין כאן בשבילך. יש משהו שנוכל לעזור בו?',
        },
      ],
    },
    {
      trigger: 'new_client',
      name: 'לקוח חדש',
      steps: [
        {
          delayMinutes: 0,
          message: 'ברוכים הבאים למשפחת {clientName}! 🎉 אנחנו שמחים שבחרתם בנו.',
        },
        {
          delayMinutes: 4320,
          message: 'היי, רק רציתי לבדוק שהכל בסדר מהצד שלכם. צריכים משהו?',
        },
      ],
    },
    {
      trigger: 'meeting_scheduled',
      name: 'תזכורת פגישה',
      steps: [
        {
          delayMinutes: 0,
          message: 'הפגישה שלנו נקבעה! 📅 {meetingDate} בשעה {meetingTime}. מחכים לראותך!',
        },
        {
          delayMinutes: 1440,
          message: 'תזכורת: הפגישה שלנו מחר בשעה {meetingTime}. נתראה! 💪',
        },
      ],
    },
    {
      trigger: 'payment_received',
      name: 'אישור תשלום',
      steps: [
        {
          delayMinutes: 0,
          message: 'תודה על התשלום! 🙏 קיבלנו את ההעברה. חשבונית תשלח בהקדם.',
        },
      ],
    },
  ];
}

// ===== Table Setup =====

const SCHEDULED_TABLE = 'whatsapp_scheduled';
const SCHEDULED_DDL = `
  CREATE TABLE IF NOT EXISTS public.${SCHEDULED_TABLE} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

let _tableEnsured = false;

async function ensureScheduledTable(): Promise<void> {
  if (_tableEnsured) return;
  await ensureTable(SCHEDULED_TABLE, SCHEDULED_DDL);
  _tableEnsured = true;
}

// ===== Placeholder Replacement =====

function replacePlaceholders(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

// ===== Core Functions =====

/**
 * Trigger a WhatsApp sequence by trigger type.
 * - Step 0 (immediate): sends message now
 * - Delayed steps: saves to whatsapp_scheduled for cron processing
 */
export async function triggerSequence(
  trigger: SequenceTrigger,
  phone: string,
  variables: Record<string, string>,
  clientId: string
): Promise<void> {
  const sequences = getDefaultSequences();
  const sequence = sequences.find(s => s.trigger === trigger);

  if (!sequence) {
    console.warn(`[whatsapp-sequences] לא נמצא סיקוונס לטריגר: ${trigger}`);
    return;
  }

  const normalizedPhone = normalizeIsraeliPhone(phone);
  const now = new Date();

  for (let i = 0; i < sequence.steps.length; i++) {
    const step = sequence.steps[i];
    const messageText = replacePlaceholders(step.message, variables);

    if (step.delayMinutes === 0) {
      // Send immediately
      if (isConfigured()) {
        try {
          const result = await sendMessage(normalizedPhone, messageText);

          // Save to whatsapp messages log
          await whatsappMessages.createAsync({
            clientId,
            clientName: variables.clientName || '',
            phone: normalizedPhone,
            templateName: '',
            message: messageText,
            status: result.success ? 'sent' : 'failed',
            direction: 'outgoing' as const,
            relatedEntityType: trigger,
            relatedEntityId: '',
            sentAt: result.success ? new Date().toISOString() : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any);
        } catch (err) {
          console.error(`[whatsapp-sequences] שגיאה בשליחת הודעה מיידית:`, err);
        }
      }
    } else {
      // Schedule for later
      const sendAt = new Date(now.getTime() + step.delayMinutes * 60 * 1000);

      await ensureScheduledTable();
      const sb = getSupabase();

      const scheduledData = {
        phone: normalizedPhone,
        message: messageText,
        clientId,
        trigger,
        sequenceName: sequence.name,
        stepIndex: i,
        sendAt: sendAt.toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { error } = await sb
        .from(SCHEDULED_TABLE)
        .insert({
          data: JSON.parse(JSON.stringify(scheduledData)),
          created_at: scheduledData.createdAt,
          updated_at: scheduledData.updatedAt,
        });

      if (error) {
        console.error(`[whatsapp-sequences] שגיאה בשמירת הודעה מתוזמנת:`, error.message);
      }
    }
  }
}

/**
 * Process pending scheduled messages whose send_at time has arrived.
 * Called by the cron handler every 15 minutes.
 */
export async function processScheduledMessages(): Promise<{
  sent: number;
  failed: number;
  errors: string[];
}> {
  await ensureScheduledTable();
  const sb = getSupabase();

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Fetch all pending messages
  const { data: rows, error: fetchError } = await sb
    .from(SCHEDULED_TABLE)
    .select('id, data')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error(`[whatsapp-sequences] שגיאה בטעינת הודעות מתוזמנות:`, fetchError.message);
    return { sent: 0, failed: 0, errors: [fetchError.message] };
  }

  if (!rows || rows.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const now = new Date();

  for (const row of rows) {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

    // Only process pending messages whose time has come
    if (data.status !== 'pending') continue;
    if (new Date(data.sendAt) > now) continue;

    if (!isConfigured()) {
      errors.push(`WhatsApp לא מוגדר — הודעה ${row.id} לא נשלחה`);
      continue;
    }

    try {
      const result = await sendMessage(data.phone, data.message);

      const updatedData = {
        ...data,
        status: result.success ? 'sent' : 'failed',
        error: result.error || undefined,
        updatedAt: new Date().toISOString(),
      };

      await sb
        .from(SCHEDULED_TABLE)
        .update({
          data: JSON.parse(JSON.stringify(updatedData)),
          updated_at: updatedData.updatedAt,
        })
        .eq('id', row.id);

      if (result.success) {
        sent++;

        // Save to whatsapp messages log
        await whatsappMessages.createAsync({
          clientId: data.clientId || '',
          clientName: '',
          phone: data.phone,
          templateName: '',
          message: data.message,
          status: 'sent',
          direction: 'outgoing' as const,
          relatedEntityType: data.trigger || 'sequence',
          relatedEntityId: '',
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
      } else {
        failed++;
        errors.push(`הודעה ${row.id}: ${result.error || 'שליחה נכשלה'}`);
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`הודעה ${row.id}: ${msg}`);

      // Mark as failed
      const failedData = {
        ...data,
        status: 'failed',
        error: msg,
        updatedAt: new Date().toISOString(),
      };

      await sb
        .from(SCHEDULED_TABLE)
        .update({
          data: JSON.parse(JSON.stringify(failedData)),
          updated_at: failedData.updatedAt,
        })
        .eq('id', row.id);
    }
  }

  return { sent, failed, errors };
}
