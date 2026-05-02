/**
 * POST /api/settings/gmail/connect - Initiate Gmail OAuth connection
 * This simulates the OAuth flow. In production, this would redirect to Google's OAuth consent screen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { gmailSettings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function POST(request: NextRequest) {
  ensureSeeded();

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;

    const settings = gmailSettings.getAll();
    const current = settings[0];

    if (!current) {
      return NextResponse.json({ error: 'Gmail settings not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === 'connect') {
      // Simulate OAuth connection — in production this would use Google OAuth2 flow
      // with client_id, client_secret, redirect_uri, and proper token exchange
      gmailSettings.update(current.id, {
        connectionStatus: 'connected',
        connectedEmail: body.email || 'tal.pixeld@gmail.com',
        accessToken: body.accessToken || 'simulated_access_token',
        refreshToken: body.refreshToken || 'simulated_refresh_token',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        lastSyncAt: now,
        lastError: '',
        updatedAt: now,
      });

      return NextResponse.json({
        status: 'connected',
        message: 'Gmail חובר בהצלחה',
        email: body.email || 'tal.pixeld@gmail.com',
      });
    }

    if (action === 'disconnect') {
      gmailSettings.update(current.id, {
        connectionStatus: 'not_connected',
        connectedEmail: '',
        accessToken: '',
        refreshToken: '',
        tokenExpiresAt: null,
        lastSyncAt: null,
        lastError: '',
        updatedAt: now,
      });

      return NextResponse.json({
        status: 'not_connected',
        message: 'Gmail נותק בהצלחה',
      });
    }

    if (action === 'reconnect') {
      gmailSettings.update(current.id, {
        connectionStatus: 'reconnecting',
        lastError: '',
        updatedAt: now,
      });

      // Simulate re-authentication
      setTimeout(async () => {
        // This would be handled by the OAuth callback in production
      }, 0);

      gmailSettings.update(current.id, {
        connectionStatus: 'connected',
        accessToken: 'refreshed_access_token_' + Date.now(),
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        lastSyncAt: now,
        lastError: '',
        updatedAt: now,
      });

      return NextResponse.json({
        status: 'connected',
        message: 'Gmail חובר מחדש בהצלחה',
        email: current.connectedEmail,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: `שגיאה: ${error.message}`,
    }, { status: 500 });
  }
}
