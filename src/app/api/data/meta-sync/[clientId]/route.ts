/**
 * POST /api/data/meta-sync/[clientId] — trigger Meta Ad Account sync for a client
 * GET  /api/data/meta-sync/[clientId] — get sync status for a client
 *
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-guard';
import { syncClientMetaAccount } from '@/lib/meta-ads/sync-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export async function POST(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  const { clientId } = await context.params;

  try {
    // Get client's Meta connection details
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, meta_ad_account_id, meta_access_token, meta_connection_status')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    if (!client.meta_ad_account_id || !client.meta_access_token) {
      return NextResponse.json({
        error: 'חסרים פרטי חיבור Meta — הגדר חשבון מודעות וטוקן בהגדרות החיבורים',
        status: 'no_credentials',
      }, { status: 400 });
    }

    // Update status to syncing
    await supabase
      .from('clients')
      .update({
        meta_connection_status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    // Run sync
    const result = await syncClientMetaAccount(
      clientId,
      client.name,
      client.meta_ad_account_id,
      client.meta_access_token,
    );

    // Update client with sync result
    const updateData: Record<string, unknown> = {
      meta_last_synced_at: result.syncedAt,
      updated_at: new Date().toISOString(),
    };

    if (result.status === 'success') {
      updateData.meta_connection_status = 'connected';
      updateData.meta_last_sync_error = '';
    } else if (result.status === 'token_expired') {
      updateData.meta_connection_status = 'token_expired';
      updateData.meta_last_sync_error = result.message;
    } else if (result.status === 'missing_permissions') {
      updateData.meta_connection_status = 'missing_permissions';
      updateData.meta_last_sync_error = result.message;
    } else {
      updateData.meta_connection_status = 'sync_error';
      updateData.meta_last_sync_error = result.message;
    }

    await supabase.from('clients').update(updateData).eq('id', clientId);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[meta-sync] Error syncing client ${clientId}:`, msg);

    // Update client with error
    await supabase.from('clients').update({
      meta_connection_status: 'sync_error',
      meta_last_sync_error: msg,
      updated_at: new Date().toISOString(),
    }).eq('id', clientId);

    return NextResponse.json({ error: `שגיאת סנכרון: ${msg}` }, { status: 500 });
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  const { clientId } = await context.params;

  try {
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, meta_business_id, meta_ad_account_id, meta_page_id, meta_instagram_account_id, meta_pixel_id, meta_connection_status, meta_last_synced_at, meta_last_sync_error')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    return NextResponse.json({
      clientId: client.id,
      clientName: client.name,
      metaBusinessId: client.meta_business_id || '',
      metaAdAccountId: client.meta_ad_account_id || '',
      metaPageId: client.meta_page_id || '',
      metaInstagramAccountId: client.meta_instagram_account_id || '',
      metaPixelId: client.meta_pixel_id || '',
      connectionStatus: client.meta_connection_status || 'not_connected',
      lastSyncedAt: client.meta_last_synced_at || null,
      lastSyncError: client.meta_last_sync_error || '',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
