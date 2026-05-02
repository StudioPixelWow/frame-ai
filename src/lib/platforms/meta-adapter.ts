/**
 * Meta Platform Adapter
 *
 * Wraps the existing meta-ads/sync-service into the unified PlatformService interface.
 * No duplicate logic — delegates to existing Meta code.
 */

import type { PlatformService, PlatformSyncResult } from './types';
import { syncClientMetaAccount, testMetaConnection } from '@/lib/meta-ads/sync-service';

export class MetaPlatformService implements PlatformService {
  platform = 'meta' as const;

  async testConnection(accountId: string, accessToken: string) {
    return testMetaConnection(accountId, accessToken);
  }

  async syncAccount(
    clientId: string,
    clientName: string,
    accountId: string,
    accessToken: string,
  ): Promise<PlatformSyncResult> {
    const result = await syncClientMetaAccount(clientId, clientName, accountId, accessToken);

    return {
      platform: 'meta',
      status: result.status as any,
      message: result.message,
      campaigns: result.campaigns,
      adGroups: result.adSets, // Map adSets → adGroups (unified term)
      ads: result.ads,
      insightsUpdated: result.insightsUpdated,
      errors: result.errors,
      syncedAt: result.syncedAt,
    };
  }
}
