/**
 * POST /api/settings/gmail/connect
 * Connect Gmail using App Password — tests connection then saves credentials.
 *
 * Actions:
 *  - connect: { email, appPassword, senderName } — test + save
 *  - disconnect: {} — clear credentials
 *  - test: { email, appPassword } — test only, don't save
 */

import { NextRequest, NextResponse } from 'next/server';
import { gmailSettings } from '@/lib/db';
import { testGmailConnection, clearEmailCredentialCache } from '@/lib/email/email-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = (body.action as string) || 'connect';
    const now = new Date().toISOString();

    // ── Disconnect ──
    if (action === 'disconnect') {
      const existing = await gmailSettings.getAllAsync();
      if (existing[0]) {
        await gmailSettings.updateAsync(existing[0].id, {
          connectionStatus: 'not_connected',
          connectedEmail: '',
          accessToken: '',
          refreshToken: '',
          tokenExpiresAt: null,
          lastSyncAt: null,
          lastError: '',
          updatedAt: now,
        });
      }
      clearEmailCredentialCache();
      return NextResponse.json({ status: 'not_connected', message: 'Gmail נותק בהצלחה' });
    }

    // ── Connect or Test ──
    const { email, appPassword, senderName } = body;
    if (!email || !appPassword) {
      return NextResponse.json({ success: false, error: 'חסר אימייל או סיסמת אפליקציה' }, { status: 400 });
    }

    // Test SMTP connection
    const testResult = await testGmailConnection(email, appPassword);
    if (!testResult.success) {
      return NextResponse.json({
        success: false,
        status: 'error',
        error: testResult.error || 'החיבור נכשל — בדוק את סיסמת האפליקציה',
      });
    }

    // If just testing, return success without saving
    if (action === 'test') {
      return NextResponse.json({ success: true, status: 'valid', message: 'החיבור תקין!' });
    }

    // Save credentials to DB
    const existing = await gmailSettings.getAllAsync();
    const settingsData = {
      connectedEmail: email,
      accessToken: appPassword, // App password stored in accessToken field
      refreshToken: '',
      senderDisplayName: senderName || 'PIXEL Studio',
      replyToEmail: email,
      connectionStatus: 'connected' as const,
      lastSyncAt: now,
      lastError: '',
      isSystemEmailOrigin: true,
      updatedAt: now,
    };

    if (existing.length > 0) {
      await gmailSettings.updateAsync(existing[0].id, settingsData);
    } else {
      await gmailSettings.createAsync({
        ...settingsData,
        tokenExpiresAt: null,
        defaultSignature: '',
        createdAt: now,
      });
    }

    clearEmailCredentialCache();

    return NextResponse.json({
      success: true,
      status: 'connected',
      email,
      senderName: senderName || 'PIXEL Studio',
      message: 'Gmail מחובר בהצלחה — כל הדיוור במערכת ישלח מהכתובת הזו',
    });
  } catch (error: any) {
    console.error('[Gmail-Connect] Error:', error);
    return NextResponse.json({
      success: false,
      status: 'error',
      error: `שגיאה: ${error.message}`,
    }, { status: 500 });
  }
}
