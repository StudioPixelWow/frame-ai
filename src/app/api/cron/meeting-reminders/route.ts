/**
 * GET /api/cron/meeting-reminders
 * Vercel cron handler — sends WhatsApp reminders for meetings today/tomorrow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendMeetingReminders } from '@/lib/automation/meeting-reminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Auth check for Vercel cron
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[cron/meeting-reminders] התחלת שליחת תזכורות פגישות', new Date().toISOString());

  try {
    const result = await sendMeetingReminders();

    console.log(`[cron/meeting-reminders] נשלחו ${result.sent} תזכורות, ${result.errors.length} שגיאות`);

    return NextResponse.json({
      success: true,
      sent: result.sent,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron/meeting-reminders] שגיאה:', err);
    return NextResponse.json(
      { error: 'שגיאה בשליחת תזכורות' },
      { status: 500 }
    );
  }
}
