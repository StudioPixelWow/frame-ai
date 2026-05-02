/**
 * Platform Registry
 *
 * Central registry that maps platform types to their service implementations.
 * All platform operations go through this registry.
 */

import type { AdPlatform, PlatformService, PlatformSyncResult, PlatformConnection, ClientPlatformConnections } from './types';
import type { Client } from '@/lib/db/schema';
import { MetaPlatformService } from './meta-adapter';
import { TikTokPlatformService } from './tiktok-service';
import { GooglePlatformService } from './google-service';

// ── Service instances ──

const services: Record<AdPlatform, PlatformService> = {
  meta: new MetaPlatformService(),
  tiktok: new TikTokPlatformService(),
  google: new GooglePlatformService(),
};

// ── Registry API ──

export function getPlatformService(platform: AdPlatform): PlatformService {
  return services[platform];
}

export async function testPlatformConnection(
  platform: AdPlatform,
  accountId: string,
  accessToken: string,
): Promise<{ valid: boolean; accountName?: string; error?: string }> {
  const service = services[platform];
  return service.testConnection(accountId, accessToken);
}

export async function syncPlatformAccount(
  platform: AdPlatform,
  clientId: string,
  clientName: string,
  accountId: string,
  accessToken: string,
): Promise<PlatformSyncResult> {
  const service = services[platform];
  return service.syncAccount(clientId, clientName, accountId, accessToken);
}

/**
 * Extract platform connections from a client record.
 */
export function getClientConnections(client: Client): ClientPlatformConnections {
  return {
    meta: (client.metaAdAccountId && client.metaAccessToken) ? {
      platform: 'meta',
      status: (client.metaConnectionStatus as any) || 'not_connected',
      accountId: client.metaAdAccountId || '',
      accountName: '',
      accessToken: client.metaAccessToken || '',
      extras: {
        businessId: client.metaBusinessId || '',
        pageId: client.metaPageId || '',
        instagramAccountId: client.metaInstagramAccountId || '',
        pixelId: client.metaPixelId || '',
      },
      lastSyncedAt: client.metaLastSyncedAt || null,
      lastSyncError: client.metaLastSyncError || '',
    } : null,

    tiktok: ((client as any).tiktokAdvertiserId && (client as any).tiktokAccessToken) ? {
      platform: 'tiktok',
      status: (client as any).tiktokConnectionStatus || 'not_connected',
      accountId: (client as any).tiktokAdvertiserId || '',
      accountName: '',
      accessToken: (client as any).tiktokAccessToken || '',
      extras: {},
      lastSyncedAt: (client as any).tiktokLastSyncedAt || null,
      lastSyncError: (client as any).tiktokLastSyncError || '',
    } : null,

    google: ((client as any).googleCustomerId && (client as any).googleRefreshToken) ? {
      platform: 'google',
      status: (client as any).googleConnectionStatus || 'not_connected',
      accountId: (client as any).googleCustomerId || '',
      accountName: '',
      accessToken: (client as any).googleRefreshToken || '',
      extras: {
        developerToken: (client as any).googleDeveloperToken || '',
        managerId: (client as any).googleManagerId || '',
      },
      lastSyncedAt: (client as any).googleLastSyncedAt || null,
      lastSyncError: (client as any).googleLastSyncError || '',
    } : null,
  };
}

/**
 * Get all connected platforms for a client.
 */
export function getConnectedPlatforms(client: Client): AdPlatform[] {
  const connections = getClientConnections(client);
  const result: AdPlatform[] = [];
  if (connections.meta) result.push('meta');
  if (connections.tiktok) result.push('tiktok');
  if (connections.google) result.push('google');
  return result;
}
