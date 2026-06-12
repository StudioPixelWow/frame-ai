/** GET /api/auth/gbp/callback — OAuth2 callback for Google Business Profile.
 *  Exchanges the code for a refresh token, resolves the first account+location,
 *  and persists the connection. */
import { NextRequest, NextResponse } from 'next/server';
import { saveGbpConnection } from '@/lib/seo/gbp-store';

export const runtime = 'nodejs';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const ACCOUNTS_API = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const oauthError = searchParams.get('error');

  if (oauthError) return NextResponse.redirect(new URL(`/?error=gbp_denied`, req.url));
  if (!code || !stateParam) return NextResponse.redirect(new URL('/?error=gbp_missing_params', req.url));

  let clientId = '';
  try { clientId = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf-8')).clientId; } catch { /* */ }
  if (!clientId) return NextResponse.redirect(new URL('/?error=gbp_invalid_state', req.url));

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gbp/callback`;
  if (!googleClientId || !googleClientSecret) return NextResponse.redirect(new URL('/?error=gbp_missing_env', req.url));

  try {
    // 1) Exchange code → tokens.
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: googleClientId, client_secret: googleClientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    });
    if (!tokenRes.ok) return NextResponse.redirect(new URL(`/clients/${clientId}?tab=integrations&error=gbp_token_failed`, req.url));
    const tokens = await tokenRes.json();
    const { access_token, refresh_token } = tokens;
    if (!refresh_token) return NextResponse.redirect(new URL(`/clients/${clientId}?tab=integrations&error=gbp_no_refresh_token`, req.url));

    // 2) Resolve first account → first location (best-effort; save even if listing is restricted).
    let accountId = '';
    let locationId = '';
    let businessName = '';
    try {
      const accRes = await fetch(ACCOUNTS_API, { headers: { Authorization: `Bearer ${access_token}` } });
      if (accRes.ok) {
        const accData = await accRes.json();
        const acc = (accData.accounts || [])[0];
        accountId = acc?.name || '';
        if (accountId) {
          const locRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title&pageSize=1`, { headers: { Authorization: `Bearer ${access_token}` } });
          if (locRes.ok) {
            const locData = await locRes.json();
            const loc = (locData.locations || [])[0];
            locationId = loc?.name || '';
            businessName = loc?.title || '';
          }
        }
      }
    } catch { /* listing may require Business Profile API approval — still save the token */ }

    await saveGbpConnection({ clientId, locationId, accountId, refreshToken: refresh_token, status: 'connected', businessName });
    return NextResponse.redirect(new URL(`/clients/${clientId}?tab=integrations&gbp=connected`, req.url));
  } catch {
    return NextResponse.redirect(new URL(`/clients/${clientId}?tab=integrations&error=gbp_failed`, req.url));
  }
}
