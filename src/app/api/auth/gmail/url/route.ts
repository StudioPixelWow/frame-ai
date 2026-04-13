import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/gmail/callback';

  if (!clientId) {
    return NextResponse.json({ error: 'חסר GOOGLE_CLIENT_ID בהגדרות השרת' }, { status: 500 });
  }

  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent select_account',
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.json({ url });
}
