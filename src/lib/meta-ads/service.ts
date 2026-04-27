/**
 * Meta Ads Library Integration Service
 *
 * Connects to the REAL Meta (Facebook) Ads Library API
 * to fetch competitor ad references for content inspiration.
 *
 * API: https://graph.facebook.com/v18.0/ads_archive
 * Docs: https://www.facebook.com/ads/library/api
 *
 * Required env vars:
 *   META_ACCESS_TOKEN     — long-lived user/system access token
 *
 * Optional env vars:
 *   META_ADS_LIBRARY_API  — override base URL (defaults to graph.facebook.com)
 */

export interface MetaAd {
  id: string;
  ad_creation_time: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_titles?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  page_id?: string;
  page_name?: string;
  publisher_platforms?: string[];
  impressions?: { lower_bound: string; upper_bound: string };
  spend?: { lower_bound: string; upper_bound: string };
  currency?: string;
  demographic_distribution?: Array<{
    age: string;
    gender: string;
    percentage: string;
  }>;
  // Image data from ad_creative_images field
  byline?: string;
}

export interface MetaAdsSearchParams {
  /** Search terms to find ads */
  searchTerms: string;
  /** Country code (ISO 2-letter), defaults to 'IL' for Israel */
  adReachedCountries?: string[];
  /** Filter by active/inactive/all */
  adActiveStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  /** Number of results to fetch (max 1000) */
  limit?: number;
  /** Fields to request from the API */
  fields?: string[];
  /** Filter by ad type */
  adType?: 'POLITICAL_AND_ISSUE_ADS' | 'ALL';
  /** Search by page ID */
  searchPageIds?: string[];
}

export interface MetaAdsConnectionStatus {
  connected: boolean;
  hasToken: boolean;
  tokenValid: boolean;
  error?: string;
  lastChecked: string;
}

/* ── Config ── */

const DEFAULT_API_BASE = 'https://graph.facebook.com/v18.0';
const DEFAULT_FIELDS = [
  'id',
  'ad_creation_time',
  'ad_creative_bodies',
  'ad_creative_link_captions',
  'ad_creative_link_descriptions',
  'ad_creative_link_titles',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'ad_snapshot_url',
  'page_id',
  'page_name',
  'publisher_platforms',
  'byline',
].join(',');

function getApiBase(): string {
  return process.env.META_ADS_LIBRARY_API || DEFAULT_API_BASE;
}

function getAccessToken(): string | null {
  return process.env.META_ACCESS_TOKEN || null;
}

/* ── Connection check ── */

let _lastStatus: MetaAdsConnectionStatus | null = null;

/**
 * Check if Meta Ads Library is connected and the token is valid.
 * Caches result for 5 minutes.
 */
export async function checkConnection(): Promise<MetaAdsConnectionStatus> {
  const token = getAccessToken();

  if (!token) {
    return {
      connected: false,
      hasToken: false,
      tokenValid: false,
      error: 'META_ACCESS_TOKEN not set',
      lastChecked: new Date().toISOString(),
    };
  }

  // Cache for 5 min
  if (_lastStatus && _lastStatus.tokenValid) {
    const age = Date.now() - new Date(_lastStatus.lastChecked).getTime();
    if (age < 5 * 60 * 1000) return _lastStatus;
  }

  // Test the token with a minimal request
  try {
    const url = new URL(`${getApiBase()}/ads_archive`);
    url.searchParams.set('access_token', token);
    url.searchParams.set('search_terms', 'test');
    url.searchParams.set('ad_reached_countries', "['IL']");
    url.searchParams.set('ad_type', 'ALL');
    url.searchParams.set('limit', '1');
    url.searchParams.set('fields', 'id');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'User-Agent': 'PixelManageAI/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      _lastStatus = {
        connected: true,
        hasToken: true,
        tokenValid: true,
        lastChecked: new Date().toISOString(),
      };
    } else {
      const body = await res.json().catch(() => ({}));
      const errorMsg = (body as any)?.error?.message || `HTTP ${res.status}`;
      _lastStatus = {
        connected: false,
        hasToken: true,
        tokenValid: false,
        error: errorMsg,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (err) {
    _lastStatus = {
      connected: false,
      hasToken: true,
      tokenValid: false,
      error: err instanceof Error ? err.message : 'Connection failed',
      lastChecked: new Date().toISOString(),
    };
  }

  return _lastStatus;
}

/* ── Search ads ── */

/**
 * Search the Meta Ads Library for real ad data.
 *
 * @throws Error if no token is configured
 * @returns Array of MetaAd objects from the API
 */
export async function searchAds(params: MetaAdsSearchParams): Promise<MetaAd[]> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('META_ACCESS_TOKEN not configured. Set it in .env.local to connect Meta Ads Library.');
  }

  const url = new URL(`${getApiBase()}/ads_archive`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('search_terms', params.searchTerms);
  url.searchParams.set(
    'ad_reached_countries',
    JSON.stringify(params.adReachedCountries || ['IL'])
  );
  url.searchParams.set('ad_active_status', params.adActiveStatus || 'ACTIVE');
  url.searchParams.set('ad_type', params.adType || 'ALL');
  url.searchParams.set('limit', String(params.limit || 25));
  url.searchParams.set('fields', (params.fields || []).length > 0
    ? params.fields!.join(',')
    : DEFAULT_FIELDS
  );

  if (params.searchPageIds && params.searchPageIds.length > 0) {
    url.searchParams.set('search_page_ids', JSON.stringify(params.searchPageIds));
  }

  console.log(`[meta-ads] Searching: "${params.searchTerms}" countries=${params.adReachedCountries || ['IL']} limit=${params.limit || 25}`);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'User-Agent': 'PixelManageAI/1.0' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errorMsg = (body as any)?.error?.message || `HTTP ${res.status}`;
    console.error(`[meta-ads] API error: ${errorMsg}`);
    throw new Error(`Meta Ads Library API error: ${errorMsg}`);
  }

  const json = await res.json();
  const ads: MetaAd[] = (json as any)?.data ?? [];

  console.log(`[meta-ads] Got ${ads.length} results for "${params.searchTerms}"`);
  return ads;
}

/**
 * Convert a MetaAd from the API into our internal ReferenceItem format.
 * This can be used to populate the app_ad_references table.
 */
export function metaAdToReference(ad: MetaAd): Record<string, unknown> {
  const body = ad.ad_creative_bodies?.[0] || '';
  const title = ad.ad_creative_link_titles?.[0] || '';
  const description = body || title || 'Meta Ad';
  const platforms = ad.publisher_platforms || [];

  // Determine primary platform
  let platform = 'facebook';
  if (platforms.includes('instagram')) platform = 'instagram';
  if (platforms.includes('audience_network')) platform = 'audience_network';

  return {
    imageUrl: '', // Meta API doesn't provide direct image URLs — use ad_snapshot_url
    description,
    source: 'meta_ads_library',
    sourceUrl: ad.ad_snapshot_url || '',
    advertiserName: ad.page_name || ad.byline || '',
    style: 'minimal',
    contentType: 'social_post',
    platform,
    industry: '',
    tags: [
      'meta_ads_library',
      ...(platforms.map(p => `platform:${p}`)),
      ad.page_name ? `page:${ad.page_name}` : '',
    ].filter(Boolean),
    engagementScore: 50,
    isActive: !ad.ad_delivery_stop_time,
    createdAt: ad.ad_creation_time || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Extra Meta-specific fields stored for reference
    metaAdId: ad.id,
    metaPageId: ad.page_id,
    metaSnapshotUrl: ad.ad_snapshot_url,
    metaPublisherPlatforms: platforms,
    metaDeliveryStart: ad.ad_delivery_start_time,
    metaDeliveryStop: ad.ad_delivery_stop_time,
  };
}
