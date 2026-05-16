import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');
    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });
    }

    const googleClientId = process.env.GOOGLE_ADS_CLIENT_ID;
    if (!googleClientId) {
      return NextResponse.json({
        error: 'חסר GOOGLE_ADS_CLIENT_ID בהגדרות השרת. הגדר את המשתנה GOOGLE_ADS_CLIENT_ID בהגדרות Vercel Environment Variables (ניתן למצוא את הערך ב-Google Cloud Console → APIs & Services → Credentials). נדרש גם GOOGLE_ADS_CLIENT_SECRET עבור ה-callback.'
      }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/auth/google-ads/callback`;

    const scopes = 'https://www.googleapis.com/auth/adwords';

    const state = JSON.stringify({ clientId });
    const stateEncoded = Buffer.from(state).toString('base64');

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state: stateEncoded,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
