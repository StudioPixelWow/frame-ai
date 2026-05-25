/**
 * GET /api/cron/whatsapp-scheduled
 * Vercel cron handler — runs every 15 minutes.
 * Processes pending scheduled WhatsApp messages (from automation sequences).
 */

import { NextRequest, NextResponse } from 'next/server';
import { processScheduledMessages } from '@/lib/automation/whatsapp-sequences';

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

  console.log('[cron/whatsapp-scheduled] התחלת עיבוד הודעות מתוזמנות', new Date().toISOString());

  try {
    const result = await processScheduledMessages();

    console.log(
      `[cron/whatsapp-scheduled] נשלחו: ${result.sent}, נכשלו: ${result.failed}, שגיאות: ${result.errors.length}`
    );

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron/whatsapp-scheduled] שגיאה:', err);
    return NextResponse.json(
      { error: 'שגיאה בעיבוד הודעות מתוזמנות' },
      { status: 500 }
    );
  }
}
