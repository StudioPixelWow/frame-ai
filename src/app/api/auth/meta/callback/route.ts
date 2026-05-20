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
      console.error('[meta/callback] OAuth error:', errorParam);
      return NextResponse.redirect(`${baseUrl}/clients?error=meta_oauth_denied`);
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(`${baseUrl}/clients?error=meta_missing_params`);
    }

    // Decode state
    let clientId: string;
    try {
      const state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'));
      clientId = state.clientId;
    } catch {
      return NextResponse.redirect(`${baseUrl}/clients?error=meta_invalid_state`);
    }

    if (!clientId) {
      return NextResponse.redirect(`${baseUrl}/clients?error=meta_missing_client`);
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = `${baseUrl}/api/auth/meta/callback`;

    if (!appId || !appSecret) {
      console.error('[meta/callback] Missing META_APP_ID or META_APP_SECRET');
      const errorRedirect = clientId === 'system'
        ? `${baseUrl}/settings/meta-business?error=meta_config`
        : `${baseUrl}/clients/${clientId}?tab=integrations&error=meta_config`;
      return NextResponse.redirect(errorRedirect);
    }

    // Exchange code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error('[meta/callback] Token exchange failed:', tokenData.error || tokenData);
      const errorRedirect = clientId === 'system'
        ? `${baseUrl}/settings/meta-business?error=meta_token_exchange`
        : `${baseUrl}/clients/${clientId}?tab=integrations&error=meta_token_exchange`;
      return NextResponse.redirect(errorRedirect);
    }

    const shortLivedToken = tokenData.access_token;

    // Exchange for long-lived token
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const longLivedRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${longLivedParams.toString()}`
    );
    const longLivedData = await longLivedRes.json();

    const accessToken = longLivedData.access_token || shortLivedToken;

    // ── System-level BM connection ──
    if (clientId === 'system') {
      // Fetch business info
      const meRes = await fetch(
        `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
      );
      const meData = await meRes.json();

      const configValue = {
        access_token: accessToken,
        business_id: meData.id || '',
        business_name: meData.name || '',
        connected_at: new Date().toISOString(),
        status: 'connected',
      };

      // Save to app_settings
      const { error: upsertError } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'meta_business_token', value: configValue, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );

      if (upsertError) {
        console.warn('[meta/callback] app_settings upsert failed, trying app_meta_business:', upsertError.message);
        // Fallback: app_meta_business
        await supabase.from('app_meta_business').delete().neq('id', '');
        const { error: insertError } = await supabase
          .from('app_meta_business')
          .insert({ id: 'system', config: configValue });

        if (insertError) {
          console.error('[meta/callback] System token save failed:', insertError.message);
          return NextResponse.redirect(`${baseUrl}/settings/meta-business?error=meta_save`);
        }
      }

      return NextResponse.redirect(`${baseUrl}/settings/meta-business?connected=true`);
    }

    // ── Per-client flow (existing behavior) ──

    // Fetch ad accounts
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
    );
    const adAccountsData = await adAccountsRes.json();

    let adAccountId = '';
    if (adAccountsData.data && adAccountsData.data.length > 0) {
      adAccountId = adAccountsData.data[0].id; // e.g. "act_123456789"
    }

    // Save to client record
    const updateData: Record<string, unknown> = {
      meta_access_token: accessToken,
      meta_connection_status: 'connected',
      meta_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (adAccountId) {
      updateData.meta_ad_account_id = adAccountId;
    }

    const { error: dbError } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId);

    if (dbError) {
      console.error('[meta/callback] Supabase update error:', dbError.message);
      return NextResponse.redirect(`${baseUrl}/clients/${clientId}?tab=integrations&error=meta_save`);
    }

    return NextResponse.redirect(`${baseUrl}/clients/${clientId}?tab=integrations&connected=meta`);
  } catch (err) {
    console.error('[meta/callback] Unexpected error:', err);
    return NextResponse.redirect(`${baseUrl}/clients?error=meta_unexpected`);
  }
}
