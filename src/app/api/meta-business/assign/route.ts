import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adAccountId, clientId, accessToken } = body;

    if (!adAccountId && !clientId) {
      return NextResponse.json({ error: 'חסר מזהה חשבון מודעות או מזהה לקוח' }, { status: 400 });
    }

    // Unassign: clear meta fields from client
    if (!clientId) {
      // Find which client has this ad account and clear it
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id')
        .eq('meta_ad_account_id', adAccountId);

      if (existingClients && existingClients.length > 0) {
        for (const c of existingClients) {
          const { error: clearError } = await supabase
            .from('clients')
            .update({
              meta_ad_account_id: null,
              meta_access_token: null,
              meta_connection_status: 'not_connected',
              updated_at: new Date().toISOString(),
            })
            .eq('id', c.id);

          if (clearError) {
            console.error('[meta-business/assign] Clear error:', clearError.message);
            return NextResponse.json({ error: `שגיאה בביטול שיוך: ${clearError.message}` }, { status: 500 });
          }
        }
      }

      return NextResponse.json({ success: true, action: 'unassigned', adAccountId });
    }

    // Assign: get access token (from body or system token)
    let token = accessToken;
    if (!token) {
      token = await getSystemToken();
    }

    if (!token) {
      return NextResponse.json({ error: 'חסר אסימון גישה — יש לחבר את Meta Business Manager תחילה' }, { status: 400 });
    }

    // First, clear any other client that had this ad account
    const { data: prevClients } = await supabase
      .from('clients')
      .select('id')
      .eq('meta_ad_account_id', adAccountId)
      .neq('id', clientId);

    if (prevClients && prevClients.length > 0) {
      for (const c of prevClients) {
        await supabase
          .from('clients')
          .update({
            meta_ad_account_id: null,
            meta_access_token: null,
            meta_connection_status: 'not_connected',
            updated_at: new Date().toISOString(),
          })
          .eq('id', c.id);
      }
    }

    // Assign the ad account to the target client
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        meta_ad_account_id: adAccountId,
        meta_access_token: token,
        meta_connection_status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('[meta-business/assign] Update error:', updateError.message);
      return NextResponse.json({ error: `שגיאה בעדכון לקוח: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: 'assigned', adAccountId, clientId });
  } catch (err) {
    console.error('[meta-business/assign] Error:', err);
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function getSystemToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_business_token')
      .single();

    if (!error && data?.value) {
      return typeof data.value === 'string' ? data.value : (data.value as any).access_token || null;
    }

    const { data: metaData, error: metaError } = await supabase
      .from('app_meta_business')
      .select('config')
      .single();

    if (!metaError && metaData?.config) {
      return (metaData.config as any).access_token || null;
    }

    return null;
  } catch {
    return null;
  }
}
