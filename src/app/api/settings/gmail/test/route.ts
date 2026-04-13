/**
 * POST /api/settings/gmail/test - Test Gmail connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { gmailSettings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function POST(request: NextRequest) {
  ensureSeeded();

  try {
    const settings = gmailSettings.getAll();
    const current = settings[0];

    if (!current || current.connectionStatus === 'not_connected') {
      return NextResponse.json({
        status: 'not_connected',
        message: 'Gmail לא מחובר'
      });
    }

    if (!current.accessToken) {
      return NextResponse.json({
        status: 'error',
        message: 'אין טוקן גישה — נדרש חיבור מחדש'
      });
    }

    // Test the connection by fetching user profile
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        'Authorization': `Bearer ${current.accessToken}`,
      },
    });

    const now = new Date().toISOString();

    if (response.ok) {
      const profile = await response.json();
      gmailSettings.update(current.id, {
        connectionStatus: 'connected',
        connectedEmail: profile.emailAddress || current.connectedEmail,
        lastSyncAt: now,
        lastError: '',
        updatedAt: now,
      });
      return NextResponse.json({
        status: 'connected',
        message: 'החיבור תקין',
        email: profile.emailAddress,
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || response.statusText || 'Unknown error';
      gmailSettings.update(current.id, {
        connectionStatus: 'error',
        lastError: errorMsg,
        updatedAt: now,
      });
      return NextResponse.json({
        status: 'error',
        message: `שגיאת חיבור: ${errorMsg}`,
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: `שגיאה: ${error.message}`,
    }, { status: 500 });
  }
}
