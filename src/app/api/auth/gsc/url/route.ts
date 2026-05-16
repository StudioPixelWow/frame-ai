/**
 * GET /api/auth/gsc/url — Generate OAuth2 authorization URL for GSC
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/webmasters',
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'נדרש clientId' }, { status: 400 });
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gsc/callback`;

    if (!googleClientId) {
      return NextResponse.json(
        { error: 'GOOGLE_CLIENT_ID לא מוגדר בהגדרות הסביבה' },
        { status: 500 }
      );
    }

    const state = JSON.stringify({ clientId });
    const encodedState = Buffer.from(state).toString('base64url');

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: encodedState,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('[GSC Auth URL] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}
