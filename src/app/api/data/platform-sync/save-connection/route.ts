/**
 * POST /api/data/platform-sync/save-connection
 *
 * Saves platform connection fields for a client.
 * Body: {
 *   clientId: string,
 *   platform: 'meta' | 'tiktok' | 'google',
 *   // Meta fields:
 *   metaBusinessId?, metaAdAccountId?, metaAccessToken?, metaPageId?,
 *   metaInstagramAccountId?, metaPixelId?,
 *   // TikTok fields:
 *   tiktokAdvertiserId?, tiktokAccessToken?,
 *   // Google fields:
 *   googleCustomerId?, googleRefreshToken?, googleDeveloperToken?, googleManagerId?,
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-guard';
import { createClient } from '@supabase/supabase-js';
import type { AdPlatform } from '@/lib/platforms/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const { clientId, platform } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });
    }
    if (!platform) {
      return NextResponse.json({ error: 'חסר שם פלטפורמה' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (platform === 'meta') {
      const { metaBusinessId, metaAdAccountId, metaAccessToken, metaPageId, metaInstagramAccountId, metaPixelId } = body;
      if (metaBusinessId !== undefined) updateData.meta_business_id = metaBusinessId;
      if (metaAdAccountId !== undefined) updateData.meta_ad_account_id = metaAdAccountId;
      if (metaAccessToken !== undefined) updateData.meta_access_token = metaAccessToken;
      if (metaPageId !== undefined) updateData.meta_page_id = metaPageId;
      if (metaInstagramAccountId !== undefined) updateData.meta_instagram_account_id = metaInstagramAccountId;
      if (metaPixelId !== undefined) updateData.meta_pixel_id = metaPixelId;

      if (metaAdAccountId && metaAccessToken) {
        updateData.meta_connection_status = 'connected';
      } else if (metaAdAccountId === '' || metaAccessToken === '') {
        updateData.meta_connection_status = 'not_connected';
      }
    } else if (platform === 'tiktok') {
      const { tiktokAdvertiserId, tiktokAccessToken } = body;
      if (tiktokAdvertiserId !== undefined) updateData.tiktok_advertiser_id = tiktokAdvertiserId;
      if (tiktokAccessToken !== undefined) updateData.tiktok_access_token = tiktokAccessToken;

      if (tiktokAdvertiserId && tiktokAccessToken) {
        updateData.tiktok_connection_status = 'connected';
      } else if (tiktokAdvertiserId === '' || tiktokAccessToken === '') {
        updateData.tiktok_connection_status = 'not_connected';
      }
    } else if (platform === 'google') {
      const { googleCustomerId, googleRefreshToken, googleDeveloperToken, googleManagerId } = body;
      if (googleCustomerId !== undefined) updateData.google_customer_id = googleCustomerId;
      if (googleRefreshToken !== undefined) updateData.google_refresh_token = googleRefreshToken;
      if (googleDeveloperToken !== undefined) updateData.google_developer_token = googleDeveloperToken;
      if (googleManagerId !== undefined) updateData.google_manager_id = googleManagerId;

      if (googleCustomerId && googleRefreshToken) {
        updateData.google_connection_status = 'connected';
      } else if (googleCustomerId === '' || googleRefreshToken === '') {
        updateData.google_connection_status = 'not_connected';
      }
    } else {
      return NextResponse.json({ error: 'פלטפורמה לא נתמכת' }, { status: 400 });
    }

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId);

    if (error) {
      console.error('[platform-sync/save-connection] Supabase error:', error);
      return NextResponse.json({ error: `שגיאת שמירה: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
