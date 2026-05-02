/**
 * TikTok Ads Platform Service
 *
 * Implements the unified PlatformService interface for TikTok Marketing API.
 * Uses TikTok Marketing API v1.3.
 *
 * Required per client:
 *   - tiktokAdvertiserId (e.g. "7123456789")
 *   - tiktokAccessToken (long-lived access token)
 *
 * NO mocks. NO fake data. Returns clear error when credentials missing.
 */

import type { PlatformService, PlatformSyncResult, NormalizedMetrics } from './types';
import { normalizeMetrics } from './types';
import { campaigns, adSets, ads } from '@/lib/db/collections';
import type { CampaignStatus, AdSetStatus, AdStatus } from '@/lib/db/schema';

const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

// ── Status mappers ──

function mapTikTokCampaignStatus(status: string): CampaignStatus {
  const map: Record<string, CampaignStatus> = {
    CAMPAIGN_STATUS_ENABLE: 'active',
    CAMPAIGN_STATUS_DISABLE: 'paused',
    CAMPAIGN_STATUS_DELETE: 'archived',
    CAMPAIGN_STATUS_NOT_DELETE: 'active',
  };
  return map[status] || 'draft';
}

function mapTikTokAdGroupStatus(status: string): AdSetStatus {
  const map: Record<string, AdSetStatus> = {
    ADGROUP_STATUS_DELIVERY_OK: 'active',
    ADGROUP_STATUS_DISABLE: 'paused',
    ADGROUP_STATUS_DELETE: 'archived',
  };
  return map[status] || 'draft';
}

function mapTikTokAdStatus(status: string): AdStatus {
  const map: Record<string, AdStatus> = {
    AD_STATUS_DELIVERY_OK: 'active',
    AD_STATUS_DISABLE: 'paused',
    AD_STATUS_DELETE: 'archived',
    AD_STATUS_NOT_APPROVED: 'rejected',
  };
  return map[status] || 'draft';
}

// ── Service ──

export class TikTokPlatformService implements PlatformService {
  platform = 'tiktok' as const;

  async testConnection(advertiserId: string, accessToken: string) {
    if (!advertiserId || !accessToken) {
      return { valid: false, error: 'חסר מזהה מפרסם או טוקן גישה' };
    }

    try {
      const url = `${TIKTOK_API_BASE}/advertiser/info/?advertiser_ids=["${advertiserId}"]`;
      const res = await fetch(url, {
        headers: { 'Access-Token': accessToken },
      });

      if (!res.ok) {
        return { valid: false, error: `TikTok API error: ${res.status}` };
      }

      const data = await res.json();
      if (data.code !== 0) {
        return { valid: false, error: data.message || 'Authentication failed' };
      }

      const advInfo = data.data?.list?.[0];
      return {
        valid: true,
        accountName: advInfo?.advertiser_name || advertiserId,
      };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
  }

  async syncAccount(
    clientId: string,
    clientName: string,
    advertiserId: string,
    accessToken: string,
  ): Promise<PlatformSyncResult> {
    const result: PlatformSyncResult = {
      platform: 'tiktok',
      status: 'success',
      message: '',
      campaigns: { synced: 0, created: 0, updated: 0 },
      adGroups: { synced: 0, created: 0, updated: 0 },
      ads: { synced: 0, created: 0, updated: 0 },
      insightsUpdated: 0,
      errors: [],
      syncedAt: new Date().toISOString(),
    };

    if (!advertiserId || !accessToken) {
      result.status = 'no_credentials';
      result.message = 'חסר מזהה מפרסם או טוקן גישה ל-TikTok';
      return result;
    }

    try {
      // ── 1. Fetch campaigns ──
      const ttCampaigns = await this.fetchCampaigns(advertiserId, accessToken);
      for (const ttc of ttCampaigns) {
        try {
          const existing = await this.findByExternalId('campaigns', 'tiktokCampaignId', ttc.campaign_id);
          const campaignData = {
            clientId,
            clientName,
            campaignName: ttc.campaign_name || 'TikTok Campaign',
            campaignType: 'lead_generation' as const,
            objective: ttc.objective_type || '',
            platform: 'tiktok' as const,
            status: mapTikTokCampaignStatus(ttc.operation_status || ttc.status || ''),
            budget: Number(ttc.budget) || 0,
            tiktokCampaignId: ttc.campaign_id,
            metaSyncSource: 'meta_sync' as const, // reuse field: "synced from external"
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
          result.errors.push(`Campaign ${ttc.campaign_id}: ${e instanceof Error ? e.message : 'error'}`);
        }
      }

      // ── 2. Fetch ad groups ──
      const ttAdGroups = await this.fetchAdGroups(advertiserId, accessToken);
      for (const ttag of ttAdGroups) {
        try {
          const parentCampaign = await this.findByExternalId('campaigns', 'tiktokCampaignId', ttag.campaign_id);
          if (!parentCampaign) continue;

          const existing = await this.findByExternalId('adSets', 'tiktokAdGroupId', ttag.adgroup_id);
          const adGroupData = {
            campaignId: parentCampaign.id,
            name: ttag.adgroup_name || 'TikTok Ad Group',
            status: mapTikTokAdGroupStatus(ttag.operation_status || ttag.status || ''),
            dailyBudget: Number(ttag.budget) || null,
            ageMin: ttag.age_min ? Number(ttag.age_min) : null,
            ageMax: ttag.age_max ? Number(ttag.age_max) : null,
            geoLocations: ttag.location_ids || [],
            interests: (ttag.interest_category_ids || []).map(String),
            placements: ttag.placements || ['tiktok'],
            tiktokAdGroupId: ttag.adgroup_id,
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
          result.errors.push(`AdGroup ${ttag.adgroup_id}: ${e instanceof Error ? e.message : 'error'}`);
        }
      }

      // ── 3. Fetch ads ──
      const ttAds = await this.fetchAds(advertiserId, accessToken);
      for (const tta of ttAds) {
        try {
          const parentAdGroup = await this.findByExternalId('adSets', 'tiktokAdGroupId', tta.adgroup_id);
          if (!parentAdGroup) continue;

          const parentCampaign = await this.findByExternalId('campaigns', 'tiktokCampaignId', tta.campaign_id);
          const existing = await this.findByExternalId('ads', 'tiktokAdId', tta.ad_id);

          const adData = {
            adSetId: parentAdGroup.id,
            campaignId: parentCampaign?.id || '',
            name: tta.ad_name || 'TikTok Ad',
            status: mapTikTokAdStatus(tta.operation_status || tta.status || ''),
            primaryText: tta.ad_text || '',
            headline: tta.call_to_action || '',
            mediaUrl: tta.video_id || tta.image_ids?.[0] || '',
            creativeType: tta.video_id ? 'video' as const : 'image' as const,
            tiktokAdId: tta.ad_id,
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
          result.errors.push(`Ad ${tta.ad_id}: ${e instanceof Error ? e.message : 'error'}`);
        }
      }

      // ── 4. Fetch performance insights ──
      const insightsCount = await this.syncInsights(advertiserId, accessToken);
      result.insightsUpdated = insightsCount;

      result.message = `סנכרון TikTok הושלם: ${result.campaigns.synced} קמפיינים, ${result.adGroups.synced} קבוצות, ${result.ads.synced} מודעות`;
    } catch (err) {
      result.status = 'api_error';
      result.message = err instanceof Error ? err.message : 'TikTok API error';
    }

    return result;
  }

  // ── Private API helpers ──

  private async fetchCampaigns(advertiserId: string, accessToken: string): Promise<any[]> {
    try {
      const url = `${TIKTOK_API_BASE}/campaign/get/?advertiser_id=${advertiserId}&page_size=100`;
      const res = await fetch(url, { headers: { 'Access-Token': accessToken } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.data?.list || [];
    } catch { return []; }
  }

  private async fetchAdGroups(advertiserId: string, accessToken: string): Promise<any[]> {
    try {
      const url = `${TIKTOK_API_BASE}/adgroup/get/?advertiser_id=${advertiserId}&page_size=100`;
      const res = await fetch(url, { headers: { 'Access-Token': accessToken } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.data?.list || [];
    } catch { return []; }
  }

  private async fetchAds(advertiserId: string, accessToken: string): Promise<any[]> {
    try {
      const url = `${TIKTOK_API_BASE}/ad/get/?advertiser_id=${advertiserId}&page_size=100`;
      const res = await fetch(url, { headers: { 'Access-Token': accessToken } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.data?.list || [];
    } catch { return []; }
  }

  private async syncInsights(advertiserId: string, accessToken: string): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const url = `${TIKTOK_API_BASE}/report/integrated/get/?advertiser_id=${advertiserId}&report_type=BASIC&data_level=AUCTION_AD&dimensions=["ad_id"]&metrics=["spend","impressions","clicks","conversion","cpc","cpm","ctr"]&start_date=${weekAgo}&end_date=${today}&page_size=100`;
      const res = await fetch(url, { headers: { 'Access-Token': accessToken } });
      if (!res.ok) return 0;
      const data = await res.json();
      const rows = data.data?.list || [];

      let updated = 0;
      for (const row of rows) {
        const tiktokAdId = row.dimensions?.ad_id;
        if (!tiktokAdId) continue;
        const existing = await this.findByExternalId('ads', 'tiktokAdId', tiktokAdId);
        if (!existing) continue;

        const metrics = row.metrics || {};
        const normalized = normalizeMetrics({
          impressions: Number(metrics.impressions) || 0,
          clicks: Number(metrics.clicks) || 0,
          spend: Number(metrics.spend) || 0,
          conversions: Number(metrics.conversion) || 0,
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
        updated++;
      }
      return updated;
    } catch { return 0; }
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
