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
    const { adAccountId, clientId, accessToken, unassign } = body;

    if (!adAccountId && !clientId) {
      return NextResponse.json({ error: 'חסר מזהה חשבון מודעות או מזהה לקוח' }, { status: 400 });
    }

    // Unassign: clear meta fields from a SPECIFIC client (account may serve others).
    if (unassign || !clientId) {
      if (clientId) {
        // Targeted unassign — clear only this client.
        const { error } = await supabase
          .from('clients')
          .update({ meta_ad_account_id: null, meta_access_token: null, meta_connection_status: 'not_connected', updated_at: new Date().toISOString() })
          .eq('id', clientId);
        if (error) return NextResponse.json({ error: `שגיאה בביטול שיוך: ${error.message}` }, { status: 500 });
        return NextResponse.json({ success: true, action: 'unassigned', clientId });
      }
      // No client id → clear all clients on this account (full reset).
      const { data: existingClients } = await supabase.from('clients').select('id').eq('meta_ad_account_id', adAccountId);
      for (const c of existingClients || []) {
        await supabase.from('clients').update({ meta_ad_account_id: null, meta_access_token: null, meta_connection_status: 'not_connected', updated_at: new Date().toISOString() }).eq('id', c.id);
      }
      return NextResponse.json({ success: true, action: 'unassigned_all', adAccountId });
    }

    // Assign: get access token (from body or system token)
    let token = accessToken;
    if (!token) {
      token = await getSystemToken();
    }

    if (!token) {
      return NextResponse.json({ error: 'חסר אסימון גישה — יש לחבר את Meta Business Manager תחילה' }, { status: 400 });
    }

    // NOTE: one ad account may serve MULTIPLE clients — we no longer clear other
    // clients that share this account. Each client keeps its own assignment.

    // Assign the ad account to the target client.
    // NOTE: we intentionally do NOT store a copy of the token on the client.
    // Operations resolve the token centrally (resolveMetaToken), so updating the
    // token in one place (Settings) propagates everywhere — no re-assigning needed.
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        meta_ad_account_id: adAccountId,
        meta_access_token: null,
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
