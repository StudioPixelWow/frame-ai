import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');
    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });
    }

    const appId = process.env.META_APP_ID;
    if (!appId) {
      return NextResponse.json({ error: 'חסר META_APP_ID בהגדרות השרת' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/auth/meta/callback`;

    const scopes = ['ads_management', 'ads_read', 'business_management'].join(',');

    const state = JSON.stringify({ clientId });
    const stateEncoded = Buffer.from(state).toString('base64');

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: scopes,
      response_type: 'code',
      state: stateEncoded,
    });

    const url = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
