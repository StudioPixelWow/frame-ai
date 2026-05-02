/**
 * Google Ads Platform Service
 *
 * Implements the unified PlatformService interface for Google Ads API v16.
 *
 * Required per client:
 *   - googleCustomerId (e.g. "123-456-7890")
 *   - googleRefreshToken (OAuth2 refresh token)
 *
 * Also uses env vars:
 *   - GOOGLE_ADS_CLIENT_ID
 *   - GOOGLE_ADS_CLIENT_SECRET
 *   - GOOGLE_ADS_DEVELOPER_TOKEN
 *
 * NO mocks. NO fake data. Returns clear error when credentials missing.
 */

import type { PlatformService, PlatformSyncResult, NormalizedMetrics } from './types';
import { normalizeMetrics } from './types';
import { campaigns, adSets, ads } from '@/lib/db/collections';
import type { CampaignStatus, AdSetStatus, AdStatus } from '@/lib/db/schema';

const GOOGLE_API_BASE = 'https://googleads.googleapis.com/v16';

// ── Status mappers ──

function mapGoogleCampaignStatus(status: string | number): CampaignStatus {
  const map: Record<string, CampaignStatus> = {
    ENABLED: 'active',
    PAUSED: 'paused',
    REMOVED: 'archived',
    '2': 'active',   // numeric enum
    '3': 'paused',
    '4': 'archived',
  };
  return map[String(status)] || 'draft';
}

function mapGoogleAdGroupStatus(status: string | number): AdSetStatus {
  const map: Record<string, AdSetStatus> = {
    ENABLED: 'active',
    PAUSED: 'paused',
    REMOVED: 'archived',
    '2': 'active',
    '3': 'paused',
    '4': 'archived',
  };
  return map[String(status)] || 'draft';
}

function mapGoogleAdStatus(status: string | number): AdStatus {
  const map: Record<string, AdStatus> = {
    ENABLED: 'active',
    PAUSED: 'paused',
    REMOVED: 'archived',
    DISAPPROVED: 'rejected',
    '2': 'active',
    '3': 'paused',
    '4': 'archived',
  };
  return map[String(status)] || 'draft';
}

// ── Service ──

export class GooglePlatformService implements PlatformService {
  platform = 'google' as const;

  private async getAccessToken(refreshToken: string): Promise<string | null> {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.access_token || null;
    } catch { return null; }
  }

  async testConnection(customerId: string, refreshToken: string) {
    if (!customerId || !refreshToken) {
      return { valid: false, error: 'חסר מזהה לקוח או טוקן גישה ל-Google Ads' };
    }

    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      return { valid: false, error: 'חסר GOOGLE_ADS_DEVELOPER_TOKEN בהגדרות השרת' };
    }

    const accessToken = await this.getAccessToken(refreshToken);
    if (!accessToken) {
      return { valid: false, error: 'לא ניתן לרענן את טוקן הגישה — בדקו הגדרות OAuth' };
    }

    try {
      const cleanId = customerId.replace(/-/g, '');
      const url = `${GOOGLE_API_BASE}/customers/${cleanId}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': developerToken,
        },
      });

      if (!res.ok) {
        return { valid: false, error: `Google Ads API error: ${res.status}` };
      }

      const data = await res.json();
      return {
        valid: true,
        accountName: data.descriptiveName || customerId,
      };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
  }

  async syncAccount(
    clientId: string,
    clientName: string,
    customerId: string,
    refreshToken: string,
  ): Promise<PlatformSyncResult> {
    const result: PlatformSyncResult = {
      platform: 'google',
      status: 'success',
      message: '',
      campaigns: { synced: 0, created: 0, updated: 0 },
      adGroups: { synced: 0, created: 0, updated: 0 },
      ads: { synced: 0, created: 0, updated: 0 },
      insightsUpdated: 0,
      errors: [],
      syncedAt: new Date().toISOString(),
    };

    if (!customerId || !refreshToken) {
      result.status = 'no_credentials';
      result.message = 'חסר מזהה לקוח או טוקן גישה ל-Google Ads';
      return result;
    }

    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      result.status = 'error';
      result.message = 'חסר GOOGLE_ADS_DEVELOPER_TOKEN';
      return result;
    }

    const accessToken = await this.getAccessToken(refreshToken);
    if (!accessToken) {
      result.status = 'token_expired';
      result.message = 'לא ניתן לרענן טוקן — בדקו הגדרות OAuth';
      return result;
    }

    const cleanId = customerId.replace(/-/g, '');

    try {
      // ── 1. Fetch campaigns via GAQL ──
      const gcCampaigns = await this.gaqlQuery(cleanId, accessToken, developerToken,
        `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
                campaign_budget.amount_micros
         FROM campaign
         WHERE campaign.status != 'REMOVED'
         LIMIT 100`
      );

      for (const row of gcCampaigns) {
        try {
          const gc = row.campaign || {};
          const gcId = String(gc.id);
          const existing = await this.findByExternalId('campaigns', 'googleCampaignId', gcId);
          const budget = row.campaignBudget?.amountMicros
            ? Number(row.campaignBudget.amountMicros) / 1000000 : 0;

          const campaignData = {
            clientId,
            clientName,
            campaignName: gc.name || 'Google Campaign',
            campaignType: 'lead_generation' as const,
            objective: gc.advertisingChannelType || '',
            platform: 'multi_platform' as const,
            status: mapGoogleCampaignStatus(gc.status),
            budget,
            googleCampaignId: gcId,
            metaSyncSource: 'meta_sync' as const,
            lastSyncedAt: new Date().toISOString(),
          };

          if (existing) {
            await campaigns.updateAsync(existing.id, campaignData as any);
            result.campaigns.updated++;
          } else {
            await campaigns.createAsync(campaignData as any);
            result.campaigns.created++;
          }
          result.campaigns.synced++;
        } catch (e) {
          result.errors.push(`Campaign: ${e instanceof Error ? e.message : 'error'}`);
        }
      }

      // ── 2. Fetch ad groups ──
      const gcAdGroups = await this.gaqlQuery(cleanId, accessToken, developerToken,
        `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign
         FROM ad_group
         WHERE ad_group.status != 'REMOVED'
         LIMIT 200`
      );

      for (const row of gcAdGroups) {
        try {
          const ag = row.adGroup || {};
          const agId = String(ag.id);
          const campaignResourceName = ag.campaign || '';
          const gcCampaignId = campaignResourceName.split('/').pop() || '';
          const parentCampaign = await this.findByExternalId('campaigns', 'googleCampaignId', gcCampaignId);
          if (!parentCampaign) continue;

          const existing = await this.findByExternalId('adSets', 'googleAdGroupId', agId);
          const adGroupData = {
            campaignId: parentCampaign.id,
            name: ag.name || 'Google Ad Group',
            status: mapGoogleAdGroupStatus(ag.status),
            googleAdGroupId: agId,
            lastSyncedAt: new Date().toISOString(),
          };

          if (existing) {
            await adSets.updateAsync(existing.id, adGroupData as any);
            result.adGroups.updated++;
          } else {
            await adSets.createAsync(adGroupData as any);
            result.adGroups.created++;
          }
          result.adGroups.synced++;
        } catch (e) {
          result.errors.push(`AdGroup: ${e instanceof Error ? e.message : 'error'}`);
        }
      }

      // ── 3. Fetch ads ──
      const gcAds = await this.gaqlQuery(cleanId, accessToken, developerToken,
        `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status,
                ad_group_ad.ad.responsive_search_ad.headlines,
                ad_group_ad.ad.responsive_search_ad.descriptions,
                ad_group_ad.ad_group
         FROM ad_group_ad
         WHERE ad_group_ad.status != 'REMOVED'
         LIMIT 300`
      );

      for (const row of gcAds) {
        try {
          const aga = row.adGroupAd || {};
          const ad = aga.ad || {};
          const adId = String(ad.id);
          const agResourceName = aga.adGroup || '';
          const gcAdGroupId = agResourceName.split('/').pop() || '';
          const parentAdGroup = await this.findByExternalId('adSets', 'googleAdGroupId', gcAdGroupId);
          if (!parentAdGroup) continue;

          const existing = await this.findByExternalId('ads', 'googleAdId', adId);
          const rsa = ad.responsiveSearchAd || {};
          const headline = (rsa.headlines || []).map((h: any) => h.text).join(' | ');
          const description = (rsa.descriptions || []).map((d: any) => d.text).join(' ');

          const adData = {
            adSetId: parentAdGroup.id,
            campaignId: parentAdGroup.campaignId || '',
            name: ad.name || `Google Ad ${adId}`,
            status: mapGoogleAdStatus(aga.status),
            headline: headline.slice(0, 100),
            primaryText: description,
            description: description.slice(0, 90),
            creativeType: 'image' as const,
            googleAdId: adId,
            lastSyncedAt: new Date().toISOString(),
          };

          if (existing) {
            await ads.updateAsync(existing.id, adData as any);
            result.ads.updated++;
          } else {
            await ads.createAsync(adData as any);
            result.ads.created++;
          }
          result.ads.synced++;
        } catch (e) {
          result.errors.push(`Ad: ${e instanceof Error ? e.message : 'error'}`);
        }
      }

      // ── 4. Fetch performance metrics ──
      const metricsRows = await this.gaqlQuery(cleanId, accessToken, developerToken,
        `SELECT ad_group_ad.ad.id, metrics.impressions, metrics.clicks, metrics.cost_micros,
                metrics.conversions, metrics.ctr, metrics.average_cpc
         FROM ad_group_ad
         WHERE segments.date DURING LAST_7_DAYS
         LIMIT 300`
      );

      for (const row of metricsRows) {
        const adId = String(row.adGroupAd?.ad?.id || '');
        if (!adId) continue;
        const existing = await this.findByExternalId('ads', 'googleAdId', adId);
        if (!existing) continue;

        const m = row.metrics || {};
        const normalized = normalizeMetrics({
          impressions: Number(m.impressions) || 0,
          clicks: Number(m.clicks) || 0,
          spend: m.costMicros ? Number(m.costMicros) / 1000000 : 0,
          conversions: Number(m.conversions) || 0,
        });

        await ads.updateAsync(existing.id, {
          impressions: normalized.impressions,
          clicks: normalized.clicks,
          spend: normalized.spend,
          conversions: normalized.conversions,
          ctr: normalized.ctr,
          cpc: normalized.cpc,
          cpm: normalized.cpm,
        } as any);
        result.insightsUpdated++;
      }

      result.message = `סנכרון Google Ads הושלם: ${result.campaigns.synced} קמפיינים, ${result.adGroups.synced} קבוצות, ${result.ads.synced} מודעות`;
    } catch (err) {
      result.status = 'api_error';
      result.message = err instanceof Error ? err.message : 'Google Ads API error';
    }

    return result;
  }

  // ── Private helpers ──

  private async gaqlQuery(customerId: string, accessToken: string, developerToken: string, query: string): Promise<any[]> {
    try {
      const url = `${GOOGLE_API_BASE}/customers/${customerId}/googleAds:searchStream`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      // searchStream returns array of batches
      const results: any[] = [];
      for (const batch of (Array.isArray(data) ? data : [data])) {
        if (batch.results) results.push(...batch.results);
      }
      return results;
    } catch { return []; }
  }

  private async findByExternalId(collection: string, field: string, value: string): Promise<any | null> {
    try {
      const colMap: Record<string, any> = { campaigns, adSets, ads };
      const col = colMap[collection];
      if (!col) return null;
      const all = await col.getAllAsync();
      return (all || []).find((item: any) => item[field] === value) || null;
    } catch { return null; }
  }
}
