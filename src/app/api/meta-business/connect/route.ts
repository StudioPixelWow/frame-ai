import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

/**
 * POST — Save the system-level BM token
 * Body: { accessToken, businessId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, businessId } = body;

    if (!accessToken) {
      return NextResponse.json({ error: 'חסר אסימון גישה' }, { status: 400 });
    }

    // Validate the token by calling the Graph API
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const meData = await meRes.json();

    if (!meRes.ok || meData.error) {
      const fbError = meData.error;
      if (fbError?.code === 190 || fbError?.error_subcode === 463) {
        return NextResponse.json({ error: 'אסימון הגישה אינו תקין או פג תוקף', code: 'TOKEN_EXPIRED' }, { status: 401 });
      }
      return NextResponse.json({ error: fbError?.message || 'אסימון גישה לא תקין' }, { status: 400 });
    }

    const configValue = {
      access_token: accessToken,
      business_id: businessId || meData.id,
      business_name: meData.name || '',
      connected_at: new Date().toISOString(),
      status: 'connected',
    };

    // Try saving to app_settings table
    let saved = false;

    // Try upsert on app_settings (key/value pattern)
    const { error: upsertError } = await supabase
      .from('app_settings')
      .upsert(
        { key: 'meta_business_token', value: configValue, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );

    if (!upsertError) {
      saved = true;
    } else {
      console.warn('[meta-business/connect] app_settings upsert failed, trying app_meta_business:', upsertError.message);

      // Fallback: try app_meta_business table
      // First try to delete existing row, then insert
      await supabase.from('app_meta_business').delete().neq('id', '');
      const { error: insertError } = await supabase
        .from('app_meta_business')
        .insert({ id: 'system', config: configValue });

      if (!insertError) {
        saved = true;
      } else {
        console.error('[meta-business/connect] app_meta_business insert also failed:', insertError.message);

        // Last resort: create the table via RPC if available, then retry
        try {
          await supabase.rpc('exec_sql', {
            query: `CREATE TABLE IF NOT EXISTS app_settings (
              key TEXT PRIMARY KEY,
              value JSONB,
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );`,
          });

          const { error: retryError } = await supabase
            .from('app_settings')
            .upsert(
              { key: 'meta_business_token', value: configValue, updated_at: new Date().toISOString() },
              { onConflict: 'key' },
            );

          if (!retryError) {
            saved = true;
          }
        } catch {
          // RPC not available
        }
      }
    }

    if (!saved) {
      return NextResponse.json({ error: 'לא ניתן לשמור את אסימון הגישה — בדוק שטבלת app_settings או app_meta_business קיימת' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      businessId: configValue.business_id,
      businessName: configValue.business_name,
      status: 'connected',
    });
  } catch (err) {
    console.error('[meta-business/connect] Error:', err);
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET — Return current BM connection status
 */
export async function GET() {
  try {
    const config = await getStoredConfig();

    if (!config) {
      return NextResponse.json({
        connected: false,
        status: 'not_connected',
        businessName: null,
        businessId: null,
      });
    }

    // Validate the stored token is still valid
    const accessToken = config.access_token;
    if (!accessToken) {
      return NextResponse.json({
        connected: false,
        status: 'no_token',
        businessName: config.business_name || null,
        businessId: config.business_id || null,
      });
    }

    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const meData = await meRes.json();

    if (!meRes.ok || meData.error) {
      return NextResponse.json({
        connected: false,
        status: 'token_expired',
        businessName: config.business_name || null,
        businessId: config.business_id || null,
        error: meData.error?.message || 'אסימון לא תקין',
      });
    }

    return NextResponse.json({
      connected: true,
      status: 'connected',
      businessName: meData.name || config.business_name || '',
      businessId: meData.id || config.business_id || '',
      connectedAt: config.connected_at || null,
    });
  } catch (err) {
    console.error('[meta-business/connect] GET error:', err);
    return NextResponse.json({
      connected: false,
      status: 'error',
      error: err instanceof Error ? err.message : 'שגיאה לא צפויה',
    });
  }
}

async function getStoredConfig(): Promise<Record<string, any> | null> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_business_token')
      .single();

    if (!error && data?.value) {
      return typeof data.value === 'object' ? data.value : { access_token: data.value };
    }

    // Fallback
    const { data: metaData, error: metaError } = await supabase
      .from('app_meta_business')
      .select('config')
      .single();

    if (!metaError && metaData?.config) {
      return metaData.config as Record<string, any>;
    }

    return null;
  } catch {
    return null;
  }
}
