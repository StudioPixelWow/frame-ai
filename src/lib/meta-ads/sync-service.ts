/**
 * Meta Marketing API Sync Service
 *
 * Syncs campaigns, ad sets, ads, and performance insights from a client's
 * connected Meta Ad Account into our local database.
 *
 * Uses Meta Marketing API v18.0 (NOT Ads Library — this is the full management API).
 *
 * Required per client:
 *   - metaAdAccountId (e.g. "act_123456789")
 *   - metaAccessToken (long-lived user/system token with ads_read permission)
 *
 * NO mocks. NO fake data. If credentials are missing, returns clear error status.
 */

import { campaigns, adSets, ads } from '@/lib/db/collections';
import type { Campaign, AdSet, Ad, CampaignStatus, AdSetStatus, AdStatus, CampaignPlatform } from '@/lib/db/schema';

/* ── Types ── */

export type SyncStatus = 'success' | 'no_credentials' | 'token_expired' | 'missing_permissions' | 'api_error' | 'error';

export interface SyncResult {
  status: SyncStatus;
  message: string;
  campaigns: { synced: number; created: number; updated: number };
  adSets: { synced: number; created: number; updated: number };
  ads: { synced: number; created: number; updated: number };
  insightsUpdated: number;
  errors: string[];
  syncedAt: string;
}

interface MetaCampaign {
  id: string;
  name: string;
  objective?: string;
  status: string;
  buying_type?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time?: string;
  updated_time?: string;
}

interface MetaAdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  targeting?: {
    age_min?: number;
    age_max?: number;
    genders?: number[];
    geo_locations?: { countries?: string[]; cities?: { name: string }[]; regions?: { name: string }[] };
    interests?: { name: string }[];
    flexible_spec?: { interests?: { name: string }[] }[];
    publisher_platforms?: string[];
  };
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
  promoted_object?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
  created_time?: string;
  updated_time?: string;
}

interface MetaAd {
  id: string;
  adset_id: string;
  campaign_id: string;
  name: string;
  status: string;
  creative?: {
    id?: string;
    body?: string;
    title?: string;
    call_to_action_type?: string;
    link_url?: string;
    image_url?: string;
    video_id?: string;
    thumbnail_url?: string;
    object_story_spec?: {
      link_data?: { message?: string; name?: string; call_to_action?: { type?: string; value?: { link?: string } }; image_hash?: string; picture?: string };
      video_data?: { message?: string; title?: string; call_to_action?: { type?: string; value?: { link?: string } }; image_url?: string; video_id?: string };
    };
  };
  created_time?: string;
  updated_time?: string;
}

interface MetaInsight {
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  frequency?: string;
  date_start?: string;
  date_stop?: string;
}

/* ── Config ── */

const API_BASE = 'https://graph.facebook.com/v18.0';
const CAMPAIGN_FIELDS = 'id,name,objective,status,buying_type,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time';
const ADSET_FIELDS = 'id,campaign_id,name,status,targeting,daily_budget,lifetime_budget,optimization_goal,billing_event,promoted_object,start_time,end_time,created_time,updated_time';
const AD_FIELDS = 'id,adset_id,campaign_id,name,status,creative{id,body,title,call_to_action_type,link_url,image_url,video_id,thumbnail_url,object_story_spec},created_time,updated_time';
const INSIGHT_FIELDS = 'spend,impressions,reach,clicks,ctr,cpc,cpm,actions,cost_per_action_type,frequency';

/* ── Helpers ── */

async function metaFetch<T>(url: string, token: string): Promise<{ data: T[]; error?: string }> {
  try {
    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}access_token=${encodeURIComponent(token)}`;
    const res = await fetch(fullUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const fbError = (body as any)?.error;
      if (fbError?.code === 190 || fbError?.error_subcode === 463) {
        return { data: [], error: 'TOKEN_EXPIRED' };
      }
      if (fbError?.code === 10 || fbError?.code === 200) {
        return { data: [], error: 'MISSING_PERMISSIONS' };
      }
      return { data: [], error: fbError?.message || `HTTP ${res.status}` };
    }

    const body = await res.json();

    // Handle pagination — collect all pages
    let allData: T[] = body.data || [];
    let nextUrl = body.paging?.next;
    let pageCount = 0;

    while (nextUrl && pageCount < 20) { // cap at 20 pages (safety)
      pageCount++;
      const nextRes = await fetch(nextUrl, { signal: AbortSignal.timeout(30000) });
      if (!nextRes.ok) break;
      const nextBody = await nextRes.json();
      allData = [...allData, ...(nextBody.data || [])];
      nextUrl = nextBody.paging?.next;
    }

    return { data: allData };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { data: [], error: msg };
  }
}

function mapMetaStatus(metaStatus: string): CampaignStatus {
  switch (metaStatus.toUpperCase()) {
    case 'ACTIVE': return 'active';
    case 'PAUSED': return 'draft';
    case 'ARCHIVED': return 'completed';
    case 'DELETED': return 'completed';
    case 'IN_PROCESS': return 'in_progress';
    case 'WITH_ISSUES': return 'active';
    default: return 'draft';
  }
}

function mapMetaAdSetStatus(metaStatus: string): AdSetStatus {
  switch (metaStatus.toUpperCase()) {
    case 'ACTIVE': return 'active';
    case 'PAUSED': return 'paused';
    case 'ARCHIVED': return 'archived';
    case 'DELETED': return 'archived';
    default: return 'draft';
  }
}

function mapMetaAdStatus(metaStatus: string): AdStatus {
  switch (metaStatus.toUpperCase()) {
    case 'ACTIVE': return 'active';
    case 'PAUSED': return 'paused';
    case 'ARCHIVED': return 'archived';
    case 'DELETED': return 'archived';
    case 'DISAPPROVED': return 'rejected';
    case 'WITH_ISSUES': return 'active';
    default: return 'draft';
  }
}

function extractLeadsFromInsight(insight: MetaInsight): number {
  if (!insight.actions) return 0;
  const leadAction = insight.actions.find(
    a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
  );
  return leadAction ? parseInt(leadAction.value, 10) || 0 : 0;
}

function extractCostPerLead(insight: MetaInsight): number {
  if (!insight.cost_per_action_type) return 0;
  const cplAction = insight.cost_per_action_type.find(
    a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
  );
  return cplAction ? parseFloat(cplAction.value) || 0 : 0;
}

function extractGeoLocations(targeting?: MetaAdSet['targeting']): string[] {
  if (!targeting?.geo_locations) return [];
  const locs: string[] = [];
  if (targeting.geo_locations.countries) locs.push(...targeting.geo_locations.countries);
  if (targeting.geo_locations.cities) locs.push(...targeting.geo_locations.cities.map(c => c.name));
  if (targeting.geo_locations.regions) locs.push(...targeting.geo_locations.regions.map(r => r.name));
  return locs;
}

function extractInterests(targeting?: MetaAdSet['targeting']): string[] {
  if (!targeting) return [];
  const interests: string[] = [];
  if (targeting.interests) interests.push(...targeting.interests.map(i => i.name));
  if (targeting.flexible_spec) {
    for (const spec of targeting.flexible_spec) {
      if (spec.interests) interests.push(...spec.interests.map(i => i.name));
    }
  }
  return interests;
}

function extractPlacements(targeting?: MetaAdSet['targeting']): string[] {
  if (!targeting?.publisher_platforms) return ['feed'];
  return targeting.publisher_platforms;
}

/* ── Test connection ── */

export async function testMetaConnection(adAccountId: string, accessToken: string): Promise<{
  valid: boolean;
  accountName?: string;
  error?: string;
  errorType?: SyncStatus;
}> {
  if (!adAccountId || !accessToken) {
    return { valid: false, error: 'חסר מזהה חשבון או אסימון גישה', errorType: 'no_credentials' };
  }

  // Normalize ad account ID
  const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  try {
    const url = `${API_BASE}/${actId}?fields=name,account_status&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const fbError = (body as any)?.error;
      if (fbError?.code === 190 || fbError?.error_subcode === 463) {
        return { valid: false, error: 'אסימון הגישה פג תוקף — יש לחדש', errorType: 'token_expired' };
      }
      if (fbError?.code === 10 || fbError?.code === 200 || fbError?.code === 100) {
        return { valid: false, error: 'אין הרשאות מספקות — נדרשת הרשאת ads_read', errorType: 'missing_permissions' };
      }
      return { valid: false, error: fbError?.message || `שגיאת API: HTTP ${res.status}`, errorType: 'api_error' };
    }

    const body = await res.json();
    return { valid: true, accountName: body.name || actId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, error: `שגיאת חיבור: ${msg}`, errorType: 'error' };
  }
}

/* ── Main Sync ── */

export async function syncClientMetaAccount(
  clientId: string,
  clientName: string,
  adAccountId: string,
  accessToken: string,
): Promise<SyncResult> {
  const now = new Date().toISOString();
  const errors: string[] = [];
  const result: SyncResult = {
    status: 'success',
    message: '',
    campaigns: { synced: 0, created: 0, updated: 0 },
    adSets: { synced: 0, created: 0, updated: 0 },
    ads: { synced: 0, created: 0, updated: 0 },
    insightsUpdated: 0,
    errors: [],
    syncedAt: now,
  };

  if (!adAccountId || !accessToken) {
    return { ...result, status: 'no_credentials', message: 'חסר מזהה חשבון מטא או אסימון גישה' };
  }

  const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  console.log(`[meta-sync] Starting sync for client ${clientId} (${actId})`);

  // ── 1. Fetch campaigns ──
  const campaignsRes = await metaFetch<MetaCampaign>(
    `${API_BASE}/${actId}/campaigns?fields=${CAMPAIGN_FIELDS}&limit=100`,
    accessToken,
  );

  if (campaignsRes.error) {
    const errType = campaignsRes.error === 'TOKEN_EXPIRED' ? 'token_expired'
      : campaignsRes.error === 'MISSING_PERMISSIONS' ? 'missing_permissions' : 'api_error';
    return { ...result, status: errType as SyncStatus, message: `שגיאת Meta API: ${campaignsRes.error}`, errors: [campaignsRes.error] };
  }

  console.log(`[meta-sync] Fetched ${campaignsRes.data.length} campaigns from Meta`);

  // Get existing campaigns for this client to enable upsert
  const existingCampaigns = await campaigns.getAllAsync();
  const localByMetaId = new Map(
    existingCampaigns
      .filter((c: any) => c.clientId === clientId && c.metaCampaignId)
      .map((c: any) => [c.metaCampaignId, c])
  );

  // Map of meta campaign ID → local campaign ID (for ad set linking)
  const metaCampaignToLocal = new Map<string, string>();

  for (const mc of campaignsRes.data) {
    try {
      const existing = localByMetaId.get(mc.id) as Campaign | undefined;
      const campaignData: Partial<Campaign> = {
        clientId,
        clientName,
        campaignName: mc.name,
        campaignType: mapObjective(mc.objective || ''),
        objective: mc.objective || '',
        platform: 'facebook' as CampaignPlatform,
        status: mapMetaStatus(mc.status),
        startDate: mc.start_time || null,
        endDate: mc.stop_time || null,
        budget: parseBudget(mc.daily_budget, mc.lifetime_budget),
        metaCampaignId: mc.id,
        metaSyncSource: 'meta_sync' as const,
        lastSyncedAt: now,
      };

      if (existing) {
        await campaigns.updateAsync(existing.id, campaignData);
        metaCampaignToLocal.set(mc.id, existing.id);
        result.campaigns.updated++;
      } else {
        const created = await campaigns.createAsync({
          ...campaignData,
          caption: '',
          mediaType: 'image' as const,
          externalMediaUrl: '',
          notes: '',
          adAccountId: actId,
          leadFormIds: [],
          linkedVideoProjectId: null,
          linkedClientFileId: null,
        } as Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>);
        metaCampaignToLocal.set(mc.id, created.id);
        result.campaigns.created++;
      }
      result.campaigns.synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      errors.push(`Campaign ${mc.id} (${mc.name}): ${msg}`);
    }
  }

  // ── 2. Fetch ad sets ──
  const adSetsRes = await metaFetch<MetaAdSet>(
    `${API_BASE}/${actId}/adsets?fields=${ADSET_FIELDS}&limit=200`,
    accessToken,
  );

  if (adSetsRes.error) {
    errors.push(`AdSets fetch error: ${adSetsRes.error}`);
  } else {
    console.log(`[meta-sync] Fetched ${adSetsRes.data.length} ad sets from Meta`);

    const existingAdSets = await adSets.getAllAsync();
    const localAdSetByMetaId = new Map(
      existingAdSets
        .filter((as: any) => as.metaAdSetId)
        .map((as: any) => [as.metaAdSetId, as])
    );

    const metaAdSetToLocal = new Map<string, string>();

    for (const mas of adSetsRes.data) {
      try {
        const localCampaignId = metaCampaignToLocal.get(mas.campaign_id);
        if (!localCampaignId) continue; // skip ad sets for campaigns we didn't sync

        const existing = localAdSetByMetaId.get(mas.id) as AdSet | undefined;
        const adSetData: Partial<AdSet> = {
          campaignId: localCampaignId,
          name: mas.name,
          status: mapMetaAdSetStatus(mas.status),
          ageMin: mas.targeting?.age_min || null,
          ageMax: mas.targeting?.age_max || null,
          genders: mapGenders(mas.targeting?.genders),
          geoLocations: extractGeoLocations(mas.targeting),
          interests: extractInterests(mas.targeting),
          placements: extractPlacements(mas.targeting),
          dailyBudget: mas.daily_budget ? parseInt(mas.daily_budget, 10) / 100 : null,
          lifetimeBudget: mas.lifetime_budget ? parseInt(mas.lifetime_budget, 10) / 100 : null,
          startDate: mas.start_time || null,
          endDate: mas.end_time || null,
          metaAdSetId: mas.id,
          lastSyncedAt: now,
        };

        if (existing) {
          await adSets.updateAsync(existing.id, adSetData);
          metaAdSetToLocal.set(mas.id, existing.id);
          result.adSets.updated++;
        } else {
          const created = await adSets.createAsync({
            ...adSetData,
            customAudiences: [],
            excludedAudiences: [],
            bidStrategy: null,
            bidAmount: null,
            notes: '',
          } as Omit<AdSet, 'id' | 'createdAt' | 'updatedAt'>);
          metaAdSetToLocal.set(mas.id, created.id);
          result.adSets.created++;
        }
        result.adSets.synced++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        errors.push(`AdSet ${mas.id} (${mas.name}): ${msg}`);
      }
    }

    // ── 3. Fetch ads ──
    const adsRes = await metaFetch<MetaAd>(
      `${API_BASE}/${actId}/ads?fields=${AD_FIELDS}&limit=200`,
      accessToken,
    );

    if (adsRes.error) {
      errors.push(`Ads fetch error: ${adsRes.error}`);
    } else {
      console.log(`[meta-sync] Fetched ${adsRes.data.length} ads from Meta`);

      const existingAds = await ads.getAllAsync();
      const localAdByMetaId = new Map(
        existingAds
          .filter((a: any) => a.metaAdId)
          .map((a: any) => [a.metaAdId, a])
      );

      for (const mad of adsRes.data) {
        try {
          const localCampaignId = metaCampaignToLocal.get(mad.campaign_id);
          const localAdSetId = metaAdSetToLocal.get(mad.adset_id);
          if (!localCampaignId || !localAdSetId) continue;

          const existing = localAdByMetaId.get(mad.id) as Ad | undefined;
          const creative = extractCreative(mad);

          const adData: Partial<Ad> = {
            adSetId: localAdSetId,
            campaignId: localCampaignId,
            name: mad.name,
            status: mapMetaAdStatus(mad.status),
            creativeType: creative.type,
            mediaUrl: creative.mediaUrl,
            thumbnailUrl: creative.thumbnailUrl,
            primaryText: creative.primaryText,
            headline: creative.headline,
            ctaType: creative.ctaType,
            ctaLink: creative.ctaLink,
            metaAdId: mad.id,
            lastSyncedAt: now,
          };

          if (existing) {
            await ads.updateAsync(existing.id, adData);
            result.ads.updated++;
          } else {
            await ads.createAsync({
              ...adData,
              description: '',
              linkedVideoProjectId: null,
              linkedClientFileId: null,
              impressions: 0,
              clicks: 0,
              spend: 0,
              leads: 0,
              conversions: 0,
              ctr: 0,
              cpl: 0,
              cpc: 0,
              roas: 0,
              reach: 0,
              frequency: 0,
              cpm: 0,
              notes: '',
            } as Omit<Ad, 'id' | 'createdAt' | 'updatedAt'>);
            result.ads.created++;
          }
          result.ads.synced++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown';
          errors.push(`Ad ${mad.id} (${mad.name}): ${msg}`);
        }
      }
    }

    // ── 4. Fetch insights (performance data) ──
    try {
      const insightsRes = await metaFetch<MetaInsight>(
        `${API_BASE}/${actId}/insights?fields=${INSIGHT_FIELDS}&level=ad&date_preset=last_30d&limit=500`,
        accessToken,
      );

      if (!insightsRes.error && insightsRes.data.length > 0) {
        console.log(`[meta-sync] Fetched ${insightsRes.data.length} insight rows from Meta`);

        // Get fresh ads list to update
        const freshAds = await ads.getAllAsync();
        const adByMetaId = new Map(
          freshAds.filter((a: any) => a.metaAdId).map((a: any) => [a.metaAdId, a])
        );

        for (const insight of insightsRes.data) {
          if (!insight.ad_id) continue;
          const localAd = adByMetaId.get(insight.ad_id) as Ad | undefined;
          if (!localAd) continue;

          try {
            await ads.updateAsync(localAd.id, {
              impressions: parseInt(insight.impressions || '0', 10),
              clicks: parseInt(insight.clicks || '0', 10),
              spend: parseFloat(insight.spend || '0'),
              leads: extractLeadsFromInsight(insight),
              ctr: parseFloat(insight.ctr || '0'),
              cpc: parseFloat(insight.cpc || '0'),
              cpm: parseFloat(insight.cpm || '0'),
              cpl: extractCostPerLead(insight),
              reach: parseInt(insight.reach || '0', 10),
              frequency: parseFloat(insight.frequency || '0'),
              lastSyncedAt: now,
            });
            result.insightsUpdated++;
          } catch (err) {
            errors.push(`Insight update for ad ${insight.ad_id}: ${err instanceof Error ? err.message : 'Unknown'}`);
          }
        }
      }
    } catch (err) {
      errors.push(`Insights fetch error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  result.errors = errors;
  result.message = errors.length > 0
    ? `סנכרון הושלם עם ${errors.length} שגיאות`
    : `סנכרון הושלם — ${result.campaigns.synced} קמפיינים, ${result.adSets.synced} קבוצות, ${result.ads.synced} מודעות`;

  console.log(`[meta-sync] Complete: ${result.message}`);
  return result;
}

/* ── Mapping helpers ── */

function mapObjective(objective: string): Campaign['campaignType'] {
  const obj = objective.toUpperCase();
  if (obj.includes('LEAD')) return 'lead_gen';
  if (obj.includes('AWARENESS') || obj.includes('REACH') || obj.includes('BRAND')) return 'awareness';
  if (obj.includes('REMARKETING') || obj.includes('RETARGET')) return 'remarketing';
  return 'paid_social';
}

function parseBudget(daily?: string, lifetime?: string): number {
  // Meta API returns budget in cents
  if (lifetime) return parseInt(lifetime, 10) / 100;
  if (daily) return (parseInt(daily, 10) / 100) * 30; // estimate monthly
  return 0;
}

function mapGenders(genders?: number[]): ('male' | 'female' | 'all')[] {
  if (!genders || genders.length === 0) return ['all'];
  return genders.map(g => {
    if (g === 1) return 'male' as const;
    if (g === 2) return 'female' as const;
    return 'all' as const;
  });
}

function extractCreative(ad: MetaAd): {
  type: Ad['creativeType'];
  mediaUrl: string;
  thumbnailUrl: string | null;
  primaryText: string;
  headline: string;
  ctaType: string;
  ctaLink: string;
} {
  const creative = ad.creative;
  const result = {
    type: 'image' as Ad['creativeType'],
    mediaUrl: '',
    thumbnailUrl: null as string | null,
    primaryText: '',
    headline: '',
    ctaType: '',
    ctaLink: '',
  };

  if (!creative) return result;

  // Direct creative fields
  result.primaryText = creative.body || '';
  result.headline = creative.title || '';
  result.ctaType = creative.call_to_action_type || '';
  result.ctaLink = creative.link_url || '';
  result.mediaUrl = creative.image_url || '';
  result.thumbnailUrl = creative.thumbnail_url || null;

  if (creative.video_id) {
    result.type = 'video';
  }

  // Object story spec overrides
  const spec = creative.object_story_spec;
  if (spec?.link_data) {
    result.primaryText = result.primaryText || spec.link_data.message || '';
    result.headline = result.headline || spec.link_data.name || '';
    result.ctaType = result.ctaType || spec.link_data.call_to_action?.type || '';
    result.ctaLink = result.ctaLink || spec.link_data.call_to_action?.value?.link || '';
    result.mediaUrl = result.mediaUrl || spec.link_data.picture || '';
  }
  if (spec?.video_data) {
    result.type = 'video';
    result.primaryText = result.primaryText || spec.video_data.message || '';
    result.headline = result.headline || spec.video_data.title || '';
    result.ctaType = result.ctaType || spec.video_data.call_to_action?.type || '';
    result.ctaLink = result.ctaLink || spec.video_data.call_to_action?.value?.link || '';
    result.thumbnailUrl = result.thumbnailUrl || spec.video_data.image_url || null;
  }

  return result;
}
