import { NextRequest, NextResponse } from 'next/server';
import { gmailSettings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function POST(request: NextRequest) {
  ensureSeeded();

  try {
    const body = await request.json();
    const code = body.code as string;

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/gmail/callback';

    if (!clientId || !clientSecret) {
      console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return NextResponse.json(
        { error: 'חסרים פרטי הגדרה חיוניים בשרת' },
        { status: 500 }
      );
    }

    // Exchange authorization code for tokens
    let tokenResponse: any;
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errorData = await tokenRes.json();
        console.error('Token exchange error:', errorData);
        return NextResponse.json(
          { error: 'Failed to exchange authorization code' },
          { status: 400 }
        );
      }

      tokenResponse = await tokenRes.json();
    } catch (error) {
      console.error('Token exchange fetch error:', error);
      return NextResponse.json(
        { error: 'שגיאה בהחלפת הקוד' },
        { status: 500 }
      );
    }

    const accessToken = tokenResponse.access_token;
    const refreshToken = tokenResponse.refresh_token;
    const expiresIn = tokenResponse.expires_in || 3600;

    // Fetch user email from Google userinfo endpoint
    let userEmail: string;
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userRes.ok) {
        console.error('Failed to fetch user info');
        return NextResponse.json(
          { error: 'Failed to fetch user information' },
          { status: 400 }
        );
      }

      const userData = await userRes.json();
      userEmail = userData.email;
    } catch (error) {
      console.error('User info fetch error:', error);
      return NextResponse.json(
        { error: 'שגיאה בשליפת פרטי המשתמש' },
        { status: 500 }
      );
    }

    // Update gmail settings in database
    const settings = gmailSettings.getAll();
    const current = settings[0];

    if (!current) {
      console.error('Gmail settings collection not initialized');
      return NextResponse.json(
        { error: 'Gmail settings not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    gmailSettings.update(current.id, {
      connectionStatus: 'connected',
      connectedEmail: userEmail,
      accessToken,
      refreshToken: refreshToken || current.refreshToken,
      tokenExpiresAt,
      lastSyncAt: now,
      lastError: '',
      updatedAt: now,
    });

    return NextResponse.json({
      status: 'success',
      email: userEmail,
    });
  } catch (error: any) {
    console.error('Gmail OAuth callback error:', error);
    return NextResponse.json(
      { error: `שגיאה: ${error.message}` },
      { status: 500 }
    );
  }
}
