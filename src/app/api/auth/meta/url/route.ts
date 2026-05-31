import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');
    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });
    }

    const appId = process.env.META_APP_ID;
    if (!appId) {
      return NextResponse.json({
        error: 'חסר META_APP_ID בהגדרות השרת. הגדר את המשתנה META_APP_ID בהגדרות Vercel Environment Variables (ניתן למצוא את הערך בהגדרות האפליקציה ב-Meta for Developers). נדרש גם META_APP_SECRET עבור ה-callback.'
      }, { status: 500 });
    }

    // Use the deployed origin so the redirect_uri matches the real domain.
    // (Previously fell back to localhost when NEXT_PUBLIC_APP_URL was unset →
    // produced an invalid localhost redirect on production.)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/auth/meta/callback`;

    // Full set so one user token can read AND create ads/creatives (needs the page),
    // pull leads, and cover Instagram — across all ad accounts the user can access.
    const scopes = [
      'ads_management',
      'ads_read',
      'business_management',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_ads',
      'leads_retrieval',
      'instagram_basic',
      'read_insights',
    ].join(',');

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
