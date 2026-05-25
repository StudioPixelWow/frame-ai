/**
 * GET  /api/calendar/auth — returns Google OAuth authorization URL
 * POST /api/calendar/auth — exchanges authorization code for tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl, exchangeCode } from '@/lib/calendar/google-calendar-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authUrl = getAuthUrl();

    if (!authUrl || authUrl === '?') {
      return NextResponse.json(
        { error: 'חסרים פרטי Google Calendar. הגדר GOOGLE_CALENDAR_CLIENT_ID ו-GOOGLE_CALENDAR_REDIRECT_URI.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ authUrl });
  } catch (err) {
    console.error('[calendar/auth] GET error:', err);
    return NextResponse.json(
      { error: 'שגיאה בקבלת קישור הרשאה' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'חסר קוד הרשאה (code)' },
        { status: 400 }
      );
    }

    const tokens = await exchangeCode(code);

    return NextResponse.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'חיבור Google Calendar הצליח',
    });
  } catch (err) {
    console.error('[calendar/auth] POST error:', err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
