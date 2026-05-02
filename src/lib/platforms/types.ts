/**
 * Multi-Platform Ads Engine — Unified Type System
 *
 * Abstraction layer supporting Meta, TikTok, and Google Ads
 * in a single unified data model.
 *
 * All platform services implement these interfaces.
 */

// ── Platform enum ──

export type AdPlatform = 'meta' | 'tiktok' | 'google';

export const AD_PLATFORMS: AdPlatform[] = ['meta', 'tiktok', 'google'];

export const PLATFORM_META: Record<AdPlatform, {
  label: string;
  labelHe: string;
  icon: string;
  color: string;
  bgColor: string;
  apiVersion: string;
}> = {
  meta: {
    label: 'Meta',
    labelHe: 'מטא',
    icon: '📘',
    color: '#1877f2',
    bgColor: '#1877f215',
    apiVersion: 'v18.0',
  },
  tiktok: {
    label: 'TikTok',
    labelHe: 'טיקטוק',
    icon: '🎵',
    color: '#000000',
    bgColor: '#00000010',
    apiVersion: 'v1.3',
  },
  google: {
    label: 'Google Ads',
    labelHe: 'גוגל',
    icon: '🔍',
    color: '#4285f4',
    bgColor: '#4285f415',
    apiVersion: 'v16',
  },
};

// ── Connection types ──

export type PlatformConnectionStatus =
  | 'connected'
  | 'not_connected'
  | 'token_expired'
  | 'missing_permissions'
  | 'sync_error';

export interface PlatformConnection {
  platform: AdPlatform;
  status: PlatformConnectionStatus;
  accountId: string;
  accountName: string;
  accessToken: string;
  /** Platform-specific extra fields */
  extras: Record<string, string>;
  lastSyncedAt: string | null;
  lastSyncError: string;
}

// ── Sync types ──

export type SyncStatus = 'success' | 'no_credentials' | 'token_expired' | 'missing_permissions' | 'api_error' | 'error';

export interface PlatformSyncResult {
  platform: AdPlatform;
  status: SyncStatus;
  message: string;
  campaigns: { synced: number; created: number; updated: number };
  adGroups: { synced: number; created: number; updated: number };
  ads: { synced: number; created: number; updated: number };
  insightsUpdated: number;
  errors: string[];
  syncedAt: string;
}

// ── Normalized performance metrics ──

export interface NormalizedMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  conversions: number;
  ctr: number;           // clicks / impressions * 100
  cpl: number;           // spend / leads
  cpc: number;           // spend / clicks
  cpm: number;           // spend / impressions * 1000
  roas: number;          // revenue / spend
  reach: number;
  frequency: number;
}

export function normalizeMetrics(raw: Partial<NormalizedMetrics>): NormalizedMetrics {
  const impressions = raw.impressions || 0;
  const clicks = raw.clicks || 0;
  const spend = raw.spend || 0;
  const leads = raw.leads || 0;
  const conversions = raw.conversions || 0;

  return {
    impressions,
    clicks,
    spend,
    leads,
    conversions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpl: leads > 0 ? spend / leads : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    roas: raw.roas || 0,
    reach: raw.reach || 0,
    frequency: raw.frequency || 0,
  };
}

// ── Platform service interface ──

export interface PlatformService {
  platform: AdPlatform;

  /** Test connection credentials */
  testConnection(accountId: string, accessToken: string): Promise<{
    valid: boolean;
    accountName?: string;
    error?: string;
  }>;

  /** Sync all campaigns, ad groups, ads from platform */
  syncAccount(
    clientId: string,
    clientName: string,
    accountId: string,
    accessToken: string,
  ): Promise<PlatformSyncResult>;
}

// ── Client platform connection helpers ──

export interface ClientPlatformConnections {
  meta: PlatformConnection | null;
  tiktok: PlatformConnection | null;
  google: PlatformConnection | null;
}

/**
 * Get the external ID field name for a platform on Campaign/AdSet/Ad.
 * e.g. 'meta' → 'metaCampaignId', 'tiktok' → 'tiktokCampaignId'
 */
export function platformExternalIdField(platform: AdPlatform, entity: 'campaign' | 'adSet' | 'ad'): string {
  const entityMap = { campaign: 'CampaignId', adSet: 'AdSetId', ad: 'AdId' };
  return `${platform}${entityMap[entity]}`;
}
