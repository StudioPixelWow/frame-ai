/**
 * Meeting reminder automation.
 * Queries meetings for tomorrow and today, sends WhatsApp reminders to client phones.
 */

import { meetings, whatsappMessages } from '@/lib/db';
import { getClientById } from '@/lib/db/client-helpers';
import { sendMessage, normalizeIsraeliPhone, isConfigured } from '@/lib/whatsapp/whatsapp-service';

/**
 * Format a date to YYYY-MM-DD in Israel timezone.
 */
function toIsraelDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

/**
 * Send WhatsApp reminders for meetings happening today and tomorrow.
 * Updates reminderSent / reminderDayBefore / reminderSameDay flags.
 */
export async function sendMeetingReminders(): Promise<{
  sent: number;
  errors: string[];
}> {
  if (!isConfigured()) {
    return { sent: 0, errors: ['WhatsApp לא מוגדר'] };
  }

  const now = new Date();
  const today = toIsraelDate(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toIsraelDate(tomorrow);

  // Fetch all scheduled meetings
  const allMeetings = await meetings.getAllAsync();
  const scheduledMeetings = allMeetings.filter(m => m.status === 'scheduled');

  let sent = 0;
  const errors: string[] = [];

  for (const meeting of scheduledMeetings) {
    if (!meeting.clientId) continue;

    const isTomorrow = meeting.date === tomorrowStr;
    const isToday = meeting.date === today;

    // Skip if not today or tomorrow
    if (!isTomorrow && !isToday) continue;

    // Skip if reminder already sent for this period
    if (isTomorrow && meeting.reminderDayBefore) continue;
    if (isToday && meeting.reminderSameDay) continue;

    // Look up client phone
    const client = await getClientById(meeting.clientId);
    if (!client || !client.phone) {
      errors.push(`פגישה "${meeting.title}": לקוח ${meeting.clientId} ללא טלפון`);
      continue;
    }

    // Build reminder message
    const whenText = isToday ? 'היום' : 'מחר';
    const message =
      `📅 תזכורת פגישה\n` +
      `${meeting.title}\n` +
      `${whenText} בשעה ${meeting.startTime}\n` +
      `${meeting.location || ''}`.trim();

    const normalizedPhone = normalizeIsraeliPhone(client.phone);

    try {
      const result = await sendMessage(normalizedPhone, message);

      if (result.success) {
        sent++;

        // Update reminder flags
        const updateData: Record<string, any> = { reminderSent: true };
        if (isTomorrow) updateData.reminderDayBefore = true;
        if (isToday) updateData.reminderSameDay = true;
        await meetings.updateAsync(meeting.id, updateData as any);

        // Save to whatsapp messages collection
        await whatsappMessages.createAsync({
          clientId: meeting.clientId,
          clientName: meeting.clientName || '',
          phone: normalizedPhone,
          templateName: '',
          message,
          status: 'sent',
          direction: 'outgoing' as const,
          relatedEntityType: 'meeting',
          relatedEntityId: meeting.id,
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
      } else {
        errors.push(`פגישה "${meeting.title}": ${result.error || 'שליחה נכשלה'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`פגישה "${meeting.title}": ${msg}`);
    }
  }

  return { sent, errors };
}
