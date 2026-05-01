/**
 * POST /api/data/meta-sync/save-connection
 *
 * Saves Meta connection fields for a client.
 * Body: { clientId, metaBusinessId?, metaAdAccountId, metaAccessToken, metaPageId?, metaInstagramAccountId?, metaPixelId? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-guard';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const { clientId, metaBusinessId, metaAdAccountId, metaAccessToken, metaPageId, metaInstagramAccountId, metaPixelId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (metaBusinessId !== undefined) updateData.meta_business_id = metaBusinessId;
    if (metaAdAccountId !== undefined) updateData.meta_ad_account_id = metaAdAccountId;
    if (metaAccessToken !== undefined) updateData.meta_access_token = metaAccessToken;
    if (metaPageId !== undefined) updateData.meta_page_id = metaPageId;
    if (metaInstagramAccountId !== undefined) updateData.meta_instagram_account_id = metaInstagramAccountId;
    if (metaPixelId !== undefined) updateData.meta_pixel_id = metaPixelId;

    // If we have both required fields, mark as connected
    if (metaAdAccountId && metaAccessToken) {
      updateData.meta_connection_status = 'connected';
    } else if (!metaAdAccountId || !metaAccessToken) {
      updateData.meta_connection_status = 'not_connected';
    }

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId);

    if (error) {
      console.error('[meta-sync/save-connection] Supabase error:', error);
      return NextResponse.json({ error: `שגיאת שמירה: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
