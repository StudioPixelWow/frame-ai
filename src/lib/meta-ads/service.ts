/**
 * Meta Ads Library Integration Service
 *
 * REAL integration with Meta (Facebook) Ads Library API.
 * NO mocks. NO fake data. NO fallbacks.
 *
 * Endpoint: https://graph.facebook.com/v18.0/ads_archive
 *
 * Required env var:
 *   META_ACCESS_TOKEN — long-lived user/system access token
 */

import type { ReferenceItem, ReferenceStyle } from '@/lib/gantt/reference-engine';

/* ── Types ── */

export interface MetaAd {
  id: string;
  ad_creative_body?: string;
  ad_creative_bodies?: string[];
  ad_snapshot_url?: string;
  page_name?: string;
  page_id?: string;
  ad_creation_time?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  publisher_platforms?: string[];
  byline?: string;
}

export interface MetaAdsConnectionStatus {
  connected: boolean;
  hasToken: boolean;
  tokenValid: boolean;
  error?: string;
  lastChecked: string;
}

/* ── Config ── */

const API_BASE = 'https://graph.facebook.com/v18.0';
const FIELDS = 'ad_creative_body,ad_snapshot_url,page_name';

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

  try {
    const url = new URL(`${API_BASE}/ads_archive`);
    url.searchParams.set('access_token', token);
    url.searchParams.set('search_terms', 'test');
    url.searchParams.set('ad_reached_countries', "['IL']");
    url.searchParams.set('ad_type', 'ALL');
    url.searchParams.set('ad_active_status', 'ACTIVE');
    url.searchParams.set('limit', '1');
    url.searchParams.set('fields', 'id');

    const res = await fetch(url.toString(), {
      method: 'GET',
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

/* ── Core search ── */

/**
 * Search Meta Ads Library.
 *
 * @throws Error if no token or API fails
 */
export async function searchAds(searchTerms: string, limit = 6): Promise<MetaAd[]> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('NO_TOKEN');
  }

  const url = new URL(`${API_BASE}/ads_archive`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('search_terms', searchTerms);
  url.searchParams.set('ad_reached_countries', "['IL']");
  url.searchParams.set('ad_type', 'ALL');
  url.searchParams.set('ad_active_status', 'ACTIVE');
  url.searchParams.set('limit', String(Math.min(limit, 25)));
  url.searchParams.set('fields', FIELDS);

  console.log(`[meta-ads] Searching: "${searchTerms}" limit=${limit}`);

  const res = await fetch(url.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errorMsg = (body as any)?.error?.message || `HTTP ${res.status}`;
    console.error(`[meta-ads] API error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const json = await res.json();
  const ads: MetaAd[] = (json as any)?.data ?? [];

  console.log(`[meta-ads] Got ${ads.length} results for "${searchTerms}"`);
  return ads;
}

/* ── Map to ReferenceItem ── */

/**
 * Convert a single MetaAd → ReferenceItem for the reference engine.
 */
function mapAdToReference(ad: MetaAd, index: number): ReferenceItem {
  const body = ad.ad_creative_body || ad.ad_creative_bodies?.[0] || '';
  const snapshotUrl = ad.ad_snapshot_url || '';
  const pageName = ad.page_name || ad.byline || '';
  const platforms = ad.publisher_platforms || [];

  let platform = 'facebook';
  if (platforms.includes('instagram')) platform = 'instagram';

  return {
    id: `meta-${ad.id || index}`,
    imageUrl: snapshotUrl,        // ad_snapshot_url serves as preview
    description: body,
    source: 'meta_ads_library',
    sourceUrl: snapshotUrl,
    advertiserName: pageName,
    style: 'minimal' as ReferenceStyle,
    contentType: 'social_post',
    platform,
    industry: '',
    tags: ['meta_ads_library'],
    engagementScore: 50,
    isActive: true,
    createdAt: ad.ad_creation_time || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/* ── Public API for reference engine ── */

export interface MetaAdsResult {
  /** 'ok' = real data, 'no_token' = token missing, 'error' = API failed */
  status: 'ok' | 'no_token' | 'error';
  /** Hebrew error message for the UI */
  message: string;
  /** Real references (empty on error) */
  references: ReferenceItem[];
}

/**
 * Fetch real ad references from Meta Ads Library.
 *
 * Returns max 6 items.
 * Never returns fake data.
 *
 * On no token:  status='no_token', message='חבר Meta Ads Library'
 * On API error:  status='error', message='לא ניתן לטעון נתונים מספריית המודעות'
 * On success:    status='ok', references=[...up to 6 items]
 */
export async function fetchMetaAdsReferences(query: string): Promise<MetaAdsResult> {
  const token = getAccessToken();

  if (!token) {
    return {
      status: 'no_token',
      message: 'חבר Meta Ads Library',
      references: [],
    };
  }

  try {
    const ads = await searchAds(query, 6);
    const references = ads.slice(0, 6).map(mapAdToReference);

    return {
      status: 'ok',
      message: `${references.length} מודעות נמצאו`,
      references,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Unknown';
    console.error(`[meta-ads] fetchMetaAdsReferences error: ${raw}`);

    return {
      status: 'error',
      message: 'לא ניתן לטעון נתונים מספריית המודעות',
      references: [],
    };
  }
}
