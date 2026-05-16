import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const code = request.nextUrl.searchParams.get('code');
    const stateParam = request.nextUrl.searchParams.get('state');
    const errorParam = request.nextUrl.searchParams.get('error');

    if (errorParam) {
      console.error('[google-ads/callback] OAuth error:', errorParam);
      return NextResponse.redirect(`${baseUrl}/clients?error=google_oauth_denied`);
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(`${baseUrl}/clients?error=google_missing_params`);
    }

    // Decode state
    let clientId: string;
    try {
      const state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'));
      clientId = state.clientId;
    } catch {
      return NextResponse.redirect(`${baseUrl}/clients?error=google_invalid_state`);
    }

    if (!clientId) {
      return NextResponse.redirect(`${baseUrl}/clients?error=google_missing_client`);
    }

    const googleClientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const redirectUri = `${baseUrl}/api/auth/google-ads/callback`;

    if (!googleClientId || !googleClientSecret) {
      console.error('[google-ads/callback] Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET');
      return NextResponse.redirect(`${baseUrl}/clients/${clientId}?tab=integrations&error=google_config`);
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error('[google-ads/callback] Token exchange failed:', tokenData.error || tokenData);
      return NextResponse.redirect(`${baseUrl}/clients/${clientId}?tab=integrations&error=google_token_exchange`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!refreshToken) {
      console.error('[google-ads/callback] No refresh token received');
      return NextResponse.redirect(`${baseUrl}/clients/${clientId}?tab=integrations&error=google_no_refresh`);
    }

    // Fetch accessible customer accounts
    let customerId = '';
    try {
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
      const customersRes = await fetch(
        'https://googleads.googleapis.com/v16/customers:listAccessibleCustomers',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': developerToken,
          },
        }
      );
      const customersData = await customersRes.json();

      if (customersData.resourceNames && customersData.resourceNames.length > 0) {
        // Resource name format: "customers/1234567890"
        customerId = customersData.resourceNames[0].replace('customers/', '');
      }
    } catch (err) {
      console.error('[google-ads/callback] Failed to fetch customers:', err);
      // Continue — we still have the refresh token
    }

    // Save to client record
    const updateData: Record<string, unknown> = {
      google_refresh_token: refreshToken,
      google_connection_status: 'connected',
      google_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (customerId) {
      updateData.google_customer_id = customerId;
    }

    const { error: dbError } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId);

    if (dbError) {
      console.error('[google-ads/callback] Supabase update error:', dbError.message);
      return NextResponse.redirect(`${baseUrl}/clients/${clientId}?tab=integrations&error=google_save`);
    }

    return NextResponse.redirect(`${baseUrl}/clients/${clientId}?tab=integrations&connected=google`);
  } catch (err) {
    console.error('[google-ads/callback] Unexpected error:', err);
    return NextResponse.redirect(`${baseUrl}/clients?error=google_unexpected`);
  }
}
