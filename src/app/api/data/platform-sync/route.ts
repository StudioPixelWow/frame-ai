/**
 * POST /api/data/platform-sync — Unified platform sync endpoint
 *
 * Body: { clientId, platform?: 'meta' | 'tiktok' | 'google' }
 *   - If platform specified: sync only that platform
 *   - If omitted: sync ALL connected platforms for this client
 *
 * GET /api/data/platform-sync?clientId=X — Get all platform connection statuses
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-guard';
import { createClient } from '@supabase/supabase-js';
import type { AdPlatform } from '@/lib/platforms/types';
import { AD_PLATFORMS } from '@/lib/platforms/types';
import { syncPlatformAccount, getClientConnections } from '@/lib/platforms/registry';
import type { PlatformSyncResult } from '@/lib/platforms/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Column mapping per platform ──

const PLATFORM_DB_FIELDS: Record<AdPlatform, {
  accountIdCol: string;
  tokenCol: string;
  statusCol: string;
  lastSyncedCol: string;
  lastErrorCol: string;
}> = {
  meta: {
    accountIdCol: 'meta_ad_account_id',
    tokenCol: 'meta_access_token',
    statusCol: 'meta_connection_status',
    lastSyncedCol: 'meta_last_synced_at',
    lastErrorCol: 'meta_last_sync_error',
  },
  tiktok: {
    accountIdCol: 'tiktok_advertiser_id',
    tokenCol: 'tiktok_access_token',
    statusCol: 'tiktok_connection_status',
    lastSyncedCol: 'tiktok_last_synced_at',
    lastErrorCol: 'tiktok_last_sync_error',
  },
  google: {
    accountIdCol: 'google_customer_id',
    tokenCol: 'google_refresh_token',
    statusCol: 'google_connection_status',
    lastSyncedCol: 'google_last_synced_at',
    lastErrorCol: 'google_last_sync_error',
  },
};

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const { clientId, platform } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });
    }

    // Fetch client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    // Determine which platforms to sync
    const platformsToSync: AdPlatform[] = platform
      ? [platform as AdPlatform]
      : AD_PLATFORMS;

    const results: PlatformSyncResult[] = [];

    for (const p of platformsToSync) {
      const fields = PLATFORM_DB_FIELDS[p];
      const accountId = client[fields.accountIdCol];
      const token = client[fields.tokenCol];

      // Skip platforms without credentials
      if (!accountId || !token) {
        results.push({
          platform: p,
          status: 'no_credentials',
          message: `אין פרטי חיבור ל-${p}`,
          campaigns: { synced: 0, created: 0, updated: 0 },
          adGroups: { synced: 0, created: 0, updated: 0 },
          ads: { synced: 0, created: 0, updated: 0 },
          insightsUpdated: 0,
          errors: [],
          syncedAt: new Date().toISOString(),
        });
        continue;
      }

      try {
        // Run sync via registry
        const syncResult = await syncPlatformAccount(
          p,
          clientId,
          client.name,
          accountId,
          token,
        );

        // Update client with sync result
        const updateData: Record<string, unknown> = {
          [fields.lastSyncedCol]: syncResult.syncedAt,
          updated_at: new Date().toISOString(),
        };

        if (syncResult.status === 'success') {
          updateData[fields.statusCol] = 'connected';
          updateData[fields.lastErrorCol] = '';
        } else if (syncResult.status === 'token_expired') {
          updateData[fields.statusCol] = 'token_expired';
          updateData[fields.lastErrorCol] = syncResult.message;
        } else if (syncResult.status === 'missing_permissions') {
          updateData[fields.statusCol] = 'missing_permissions';
          updateData[fields.lastErrorCol] = syncResult.message;
        } else {
          updateData[fields.statusCol] = 'sync_error';
          updateData[fields.lastErrorCol] = syncResult.message;
        }

        await supabase.from('clients').update(updateData).eq('id', clientId);
        results.push(syncResult);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';

        await supabase.from('clients').update({
          [fields.statusCol]: 'sync_error',
          [fields.lastErrorCol]: msg,
          updated_at: new Date().toISOString(),
        }).eq('id', clientId);

        results.push({
          platform: p,
          status: 'error',
          message: msg,
          campaigns: { synced: 0, created: 0, updated: 0 },
          adGroups: { synced: 0, created: 0, updated: 0 },
          ads: { synced: 0, created: 0, updated: 0 },
          insightsUpdated: 0,
          errors: [msg],
          syncedAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        skipped: results.filter(r => r.status === 'no_credentials').length,
        failed: results.filter(r => !['success', 'no_credentials'].includes(r.status)).length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `שגיאת סנכרון: ${msg}` }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
  }

  try {
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    const platforms: Record<string, any> = {};
    for (const p of AD_PLATFORMS) {
      const f = PLATFORM_DB_FIELDS[p];
      platforms[p] = {
        platform: p,
        accountId: client[f.accountIdCol] || '',
        hasToken: !!client[f.tokenCol],
        status: client[f.statusCol] || 'not_connected',
        lastSyncedAt: client[f.lastSyncedCol] || null,
        lastSyncError: client[f.lastErrorCol] || '',
      };
    }

    return NextResponse.json({
      clientId: client.id,
      clientName: client.name,
      platforms,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
