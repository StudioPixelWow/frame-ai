/**
 * POST /api/calendar/sync — syncs all scheduled meetings to Google Calendar
 * Body: { refreshToken: string, calendarId?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { meetings } from '@/lib/db';
import { getAccessToken, syncMeetingsToCalendar } from '@/lib/calendar/google-calendar-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken, calendarId } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'חסר refreshToken. יש לחבר קודם את Google Calendar.' },
        { status: 400 }
      );
    }

    // Get fresh access token
    const accessToken = await getAccessToken(refreshToken);

    // Load all scheduled meetings
    const allMeetings = await meetings.getAllAsync();
    const scheduledMeetings = allMeetings.filter(m => m.status === 'scheduled');

    if (scheduledMeetings.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        errors: [],
        message: 'אין פגישות מתוכננות לסנכרון',
      });
    }

    // Sync to Google Calendar
    const result = await syncMeetingsToCalendar(
      scheduledMeetings,
      accessToken,
      calendarId || 'primary'
    );

    return NextResponse.json({
      success: true,
      synced: result.synced,
      total: scheduledMeetings.length,
      errors: result.errors,
      message: `סונכרנו ${result.synced} מתוך ${scheduledMeetings.length} פגישות`,
    });
  } catch (err) {
    console.error('[calendar/sync] Error:', err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
