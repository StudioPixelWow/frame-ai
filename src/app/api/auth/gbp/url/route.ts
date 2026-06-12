/** GET /api/auth/gbp/url?clientId=… — OAuth2 authorization URL for Google Business Profile. */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SCOPES = ['https://www.googleapis.com/auth/business.manage'];

export async function GET(req: NextRequest) {
  try {
    const clientId = new URL(req.url).searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'נדרש clientId' }, { status: 400 });

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) return NextResponse.json({ error: 'GOOGLE_CLIENT_ID לא מוגדר' }, { status: 500 });

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gbp/callback`;
    const encodedState = Buffer.from(JSON.stringify({ clientId })).toString('base64url');
    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: encodedState,
    });
    return NextResponse.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'שגיאה' }, { status: 500 });
  }
}
