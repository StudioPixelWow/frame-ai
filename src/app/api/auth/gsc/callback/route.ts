/**
 * GET /api/auth/gsc/callback — OAuth2 callback for GSC connection
 * Exchanges authorization code for refresh token, saves to client record
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const runtime = 'nodejs';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/?error=gsc_auth_denied&message=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(
        new URL('/?error=gsc_missing_params', req.url)
      );
    }

    // Decode state
    let clientId: string;
    try {
      const stateJson = Buffer.from(stateParam, 'base64url').toString('utf-8');
      const state = JSON.parse(stateJson);
      clientId = state.clientId;
    } catch {
      return NextResponse.redirect(new URL('/?error=gsc_invalid_state', req.url));
    }

    if (!clientId) {
      return NextResponse.redirect(new URL('/?error=gsc_no_client', req.url));
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gsc/callback`;

    if (!googleClientId || !googleClientSecret) {
      return NextResponse.redirect(new URL('/?error=gsc_missing_env', req.url));
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('[GSC Callback] Token exchange failed:', errText);
      return NextResponse.redirect(
        new URL(`/clients/${clientId}?tab=seo&error=gsc_token_failed`, req.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token } = tokens;

    if (!refresh_token) {
      console.error('[GSC Callback] No refresh_token returned. User may need to revoke and re-authorize.');
      return NextResponse.redirect(
        new URL(`/clients/${clientId}?tab=seo&error=gsc_no_refresh_token`, req.url)
      );
    }

    // Get the user's sites to determine the siteUrl
    const sitesResponse = await fetch(`${GSC_API_BASE}/sites`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    let siteUrl = '';
    if (sitesResponse.ok) {
      const sitesData = await sitesResponse.json();
      const sites = sitesData.siteEntry || [];
      // Pick the first verified site, or first site
      const verified = sites.find((s: { permissionLevel: string }) =>
        s.permissionLevel === 'siteOwner' || s.permissionLevel === 'siteFullUser'
      );
      siteUrl = verified?.siteUrl || sites[0]?.siteUrl || '';
    }

    // Save to client record
    const sb = getSupabase();
    const { error: updateError } = await sb
      .from('clients')
      .update({
        gsc_refresh_token: refresh_token,
        gsc_site_url: siteUrl,
        gsc_connection_status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('[GSC Callback] Failed to save credentials:', updateError.message);
      return NextResponse.redirect(
        new URL(`/clients/${clientId}?tab=seo&error=gsc_save_failed`, req.url)
      );
    }

    // Redirect to client SEO tab with success
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      new URL(`/clients/${clientId}?tab=seo&connected=gsc`, appUrl)
    );
  } catch (error) {
    console.error('[GSC Callback] Unexpected error:', error);
    return NextResponse.redirect(new URL('/?error=gsc_unexpected', req.url));
  }
}
