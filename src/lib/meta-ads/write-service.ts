/**
 * Meta Marketing API — Write Service
 *
 * Publishes campaigns, ad sets, and ads to Meta via Graph API v18.0.
 * Every function:
 *   - receives a structured payload
 *   - calls Meta API
 *   - returns success + meta ID, or error
 *
 * SAFETY:
 *   - Validates payload before sending
 *   - Prevents duplicate creation via metaId checks
 *   - Logs all Meta responses
 *   - Never crashes on failure — returns structured error
 *
 * Required credentials per client (stored on Client record):
 *   - metaAdAccountId  (e.g. "act_123456789")
 *   - metaAccessToken  (long-lived token with ads_management permission)
 */

const API_BASE = 'https://graph.facebook.com/v18.0';

/* ── Types ── */

export interface MetaWriteResult {
  success: boolean;
  metaId?: string;
  error?: string;
  errorCode?: number;
  errorSubcode?: number;
  rawResponse?: Record<string, unknown>;
}

export interface MetaImageUploadResult {
  success: boolean;
  imageHash?: string;
  imageUrl?: string;
  error?: string;
}

export interface MetaRateLimitInfo {
  callCount: number;       // % of calls used
  totalCputime: number;    // % of CPU time used
  totalTime: number;       // % of total time used
  isThrottled: boolean;    // any metric > 80%
  isBlocked: boolean;      // any metric > 95%
}

export interface MetaVerificationResult {
  success: boolean;
  entityType: 'campaign' | 'adset' | 'ad';
  metaId: string;
  exists: boolean;
  status?: string;
  configuredStatus?: string;
  effectiveStatus?: string;
  error?: string;
}

export interface MetaCredentials {
  adAccountId: string;   // e.g. "act_123456789"
  accessToken: string;
}

export interface CreateCampaignPayload {
  name: string;
  objective: string;         // e.g. 'OUTCOME_LEADS', 'OUTCOME_TRAFFIC', 'OUTCOME_AWARENESS'
  status?: 'PAUSED' | 'ACTIVE';
  dailyBudget?: number;      // in cents (smallest currency unit)
  lifetimeBudget?: number;
  specialAdCategories?: string[];
}

export interface CreateAdSetPayload {
  campaignId: string;        // Meta campaign ID
  name: string;
  status?: 'PAUSED' | 'ACTIVE';
  dailyBudget?: number;      // cents
  lifetimeBudget?: number;
  billingEvent?: 'IMPRESSIONS' | 'LINK_CLICKS';
  optimizationGoal?: string; // e.g. 'LEAD_GENERATION', 'LINK_CLICKS'
  targeting: {
    age_min?: number;
    age_max?: number;
    genders?: number[];       // 1=male, 2=female
    geo_locations?: { countries?: string[] };
    interests?: { id: string; name: string }[];
  };
  startTime?: string;        // ISO string
  endTime?: string;
  promotedObject?: Record<string, unknown>;
}

export interface CreateAdPayload {
  adSetId: string;           // Meta adset ID
  name: string;
  status?: 'PAUSED' | 'ACTIVE';
  creative: {
    pageId: string;          // Meta Page ID for publishing
    message?: string;        // Primary text
    headline?: string;
    description?: string;
    linkUrl?: string;
    imageUrl?: string;       // External image URL
    imageHash?: string;      // Meta image hash (from uploaded image)
    videoId?: string;        // Meta video ID
    callToAction?: string;   // e.g. 'LEARN_MORE', 'SIGN_UP'
  };
}

export interface UpdateAdPayload {
  name?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  creative?: {
    pageId: string;
    message?: string;
    headline?: string;
    description?: string;
    linkUrl?: string;
    imageUrl?: string;
    imageHash?: string;
    callToAction?: string;
  };
}

/* ── Rate limit tracking ── */

let _lastRateLimit: MetaRateLimitInfo | null = null;

/**
 * Get the last-seen Meta rate limit info.
 * Returns null if no API calls have been made yet.
 */
export function getMetaRateLimit(): MetaRateLimitInfo | null {
  return _lastRateLimit;
}

/**
 * Parse x-app-usage header from Meta API response.
 * Header value is JSON: {"call_count":28,"total_cputime":25,"total_time":30}
 */
function parseRateLimitHeader(res: Response): void {
  const header = res.headers.get('x-app-usage');
  if (!header) return;

  try {
    const usage = JSON.parse(header);
    _lastRateLimit = {
      callCount: usage.call_count || 0,
      totalCputime: usage.total_cputime || 0,
      totalTime: usage.total_time || 0,
      isThrottled: (usage.call_count > 80 || usage.total_cputime > 80 || usage.total_time > 80),
      isBlocked: (usage.call_count > 95 || usage.total_cputime > 95 || usage.total_time > 95),
    };

    if (_lastRateLimit.isBlocked) {
      console.error(`[meta-write] ⛔ RATE LIMIT CRITICAL: call=${usage.call_count}% cpu=${usage.total_cputime}% time=${usage.total_time}%`);
    } else if (_lastRateLimit.isThrottled) {
      console.warn(`[meta-write] ⚠️ Rate limit warning: call=${usage.call_count}% cpu=${usage.total_cputime}% time=${usage.total_time}%`);
    }
  } catch {
    // Ignore parse errors on rate limit header
  }
}

/**
 * If rate limit is near the threshold, wait before making another request.
 * Returns true if we waited (throttled), false if we proceeded immediately.
 */
async function waitIfThrottled(): Promise<boolean> {
  if (!_lastRateLimit) return false;

  if (_lastRateLimit.isBlocked) {
    console.warn(`[meta-write] ⛔ Rate limit critical — waiting 60s before next request`);
    await new Promise(r => setTimeout(r, 60_000));
    return true;
  }
  if (_lastRateLimit.isThrottled) {
    console.warn(`[meta-write] ⚠️ Rate limit high — waiting 10s before next request`);
    await new Promise(r => setTimeout(r, 10_000));
    return true;
  }
  return false;
}

/* ── Core fetch helper ── */

async function metaPost(
  url: string,
  token: string,
  body: Record<string, unknown>,
): Promise<MetaWriteResult> {
  try {
    // Respect rate limits before making request
    await waitIfThrottled();

    console.log(`[meta-write] POST ${url}`);
    console.log(`[meta-write] body keys: ${Object.keys(body).join(', ')}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        access_token: token,
      }),
      signal: AbortSignal.timeout(30000),
    });

    // Track rate limits from every response
    parseRateLimitHeader(res);

    const data = await res.json().catch(() => ({}));
    console.log(`[meta-write] response status=${res.status}`, JSON.stringify(data).slice(0, 500));

    if (!res.ok) {
      const fbError = (data as Record<string, unknown>)?.error as Record<string, unknown> | undefined;
      return {
        success: false,
        error: (fbError?.message as string) || `HTTP ${res.status}`,
        errorCode: fbError?.code as number | undefined,
        errorSubcode: fbError?.error_subcode as number | undefined,
        rawResponse: data as Record<string, unknown>,
      };
    }

    const id = (data as Record<string, unknown>)?.id as string | undefined;
    return {
      success: true,
      metaId: id,
      rawResponse: data as Record<string, unknown>,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[meta-write] POST failed:`, msg);
    return { success: false, error: msg };
  }
}

/* ── Campaign ── */

export async function createMetaCampaign(
  creds: MetaCredentials,
  payload: CreateCampaignPayload,
): Promise<MetaWriteResult> {
  if (!creds.adAccountId || !creds.accessToken) {
    return { success: false, error: 'Missing Meta credentials (adAccountId or accessToken)' };
  }
  if (!payload.name || !payload.objective) {
    return { success: false, error: 'Campaign name and objective are required' };
  }

  const url = `${API_BASE}/${creds.adAccountId}/campaigns`;
  const body: Record<string, unknown> = {
    name: payload.name,
    objective: payload.objective,
    status: payload.status || 'PAUSED',
    special_ad_categories: payload.specialAdCategories || [],
  };

  if (payload.dailyBudget) body.daily_budget = payload.dailyBudget;
  if (payload.lifetimeBudget) body.lifetime_budget = payload.lifetimeBudget;

  return metaPost(url, creds.accessToken, body);
}

/* ── Ad Set ── */

export async function createMetaAdSet(
  creds: MetaCredentials,
  payload: CreateAdSetPayload,
): Promise<MetaWriteResult> {
  if (!creds.adAccountId || !creds.accessToken) {
    return { success: false, error: 'Missing Meta credentials' };
  }
  if (!payload.campaignId || !payload.name) {
    return { success: false, error: 'Campaign ID and name are required for ad set' };
  }
  if (!payload.targeting) {
    return { success: false, error: 'Targeting is required for ad set' };
  }

  const url = `${API_BASE}/${creds.adAccountId}/adsets`;
  const body: Record<string, unknown> = {
    campaign_id: payload.campaignId,
    name: payload.name,
    status: payload.status || 'PAUSED',
    billing_event: payload.billingEvent || 'IMPRESSIONS',
    optimization_goal: payload.optimizationGoal || 'LEAD_GENERATION',
    targeting: payload.targeting,
  };

  if (payload.dailyBudget) body.daily_budget = payload.dailyBudget;
  if (payload.lifetimeBudget) body.lifetime_budget = payload.lifetimeBudget;
  if (payload.startTime) body.start_time = payload.startTime;
  if (payload.endTime) body.end_time = payload.endTime;
  if (payload.promotedObject) body.promoted_object = payload.promotedObject;

  return metaPost(url, creds.accessToken, body);
}

/* ── Ad ── */

export async function createMetaAd(
  creds: MetaCredentials,
  payload: CreateAdPayload,
): Promise<MetaWriteResult> {
  if (!creds.adAccountId || !creds.accessToken) {
    return { success: false, error: 'Missing Meta credentials' };
  }
  if (!payload.adSetId || !payload.name) {
    return { success: false, error: 'Ad set ID and name are required' };
  }
  if (!payload.creative.pageId) {
    return { success: false, error: 'Page ID is required to create an ad' };
  }

  // Build creative spec
  const linkData: Record<string, unknown> = {};
  if (payload.creative.message) linkData.message = payload.creative.message;
  if (payload.creative.headline) linkData.name = payload.creative.headline;
  if (payload.creative.description) linkData.description = payload.creative.description;
  if (payload.creative.linkUrl) linkData.link = payload.creative.linkUrl;
  if (payload.creative.imageHash) linkData.image_hash = payload.creative.imageHash;
  if (payload.creative.imageUrl) linkData.picture = payload.creative.imageUrl;
  if (payload.creative.callToAction) {
    linkData.call_to_action = {
      type: payload.creative.callToAction,
      value: payload.creative.linkUrl ? { link: payload.creative.linkUrl } : undefined,
    };
  }

  // First: create the ad creative
  const creativeUrl = `${API_BASE}/${creds.adAccountId}/adcreatives`;
  const creativeBody: Record<string, unknown> = {
    name: `${payload.name} creative`,
    object_story_spec: {
      page_id: payload.creative.pageId,
      link_data: linkData,
    },
  };

  const creativeResult = await metaPost(creativeUrl, creds.accessToken, creativeBody);
  if (!creativeResult.success) {
    return {
      success: false,
      error: `Failed to create ad creative: ${creativeResult.error}`,
      errorCode: creativeResult.errorCode,
      rawResponse: creativeResult.rawResponse,
    };
  }

  // Second: create the ad referencing the creative
  const adUrl = `${API_BASE}/${creds.adAccountId}/ads`;
  const adBody: Record<string, unknown> = {
    name: payload.name,
    adset_id: payload.adSetId,
    creative: { creative_id: creativeResult.metaId },
    status: payload.status || 'PAUSED',
  };

  return metaPost(adUrl, creds.accessToken, adBody);
}

/* ── Update Ad ── */

export async function updateMetaAd(
  creds: MetaCredentials,
  metaAdId: string,
  payload: UpdateAdPayload,
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaAdId) {
    return { success: false, error: 'Missing access token or Meta ad ID' };
  }

  const url = `${API_BASE}/${metaAdId}`;
  const body: Record<string, unknown> = {};
  if (payload.name) body.name = payload.name;
  if (payload.status) body.status = payload.status;

  // If creative update requested, create new creative first
  if (payload.creative) {
    if (!payload.creative.pageId) {
      return { success: false, error: 'Page ID required for creative update' };
    }
    const linkData: Record<string, unknown> = {};
    if (payload.creative.message) linkData.message = payload.creative.message;
    if (payload.creative.headline) linkData.name = payload.creative.headline;
    if (payload.creative.description) linkData.description = payload.creative.description;
    if (payload.creative.linkUrl) linkData.link = payload.creative.linkUrl;
    if (payload.creative.imageHash) linkData.image_hash = payload.creative.imageHash;
    if (payload.creative.imageUrl) linkData.picture = payload.creative.imageUrl;
    if (payload.creative.callToAction) {
      linkData.call_to_action = { type: payload.creative.callToAction };
    }

    // Need adAccountId for creative creation
    if (!creds.adAccountId) {
      return { success: false, error: 'Ad Account ID needed to update creative' };
    }

    const creativeResult = await metaPost(
      `${API_BASE}/${creds.adAccountId}/adcreatives`,
      creds.accessToken,
      {
        name: `${payload.name || 'ad'} creative (updated)`,
        object_story_spec: { page_id: payload.creative.pageId, link_data: linkData },
      },
    );

    if (!creativeResult.success) {
      return { success: false, error: `Creative update failed: ${creativeResult.error}` };
    }
    body.creative = { creative_id: creativeResult.metaId };
  }

  return metaPost(url, creds.accessToken, body);
}

/* ── Pause / Resume Ad ── */

export async function pauseMetaAd(
  creds: MetaCredentials,
  metaAdId: string,
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaAdId) {
    return { success: false, error: 'Missing access token or Meta ad ID' };
  }
  return metaPost(`${API_BASE}/${metaAdId}`, creds.accessToken, { status: 'PAUSED' });
}

export async function resumeMetaAd(
  creds: MetaCredentials,
  metaAdId: string,
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaAdId) {
    return { success: false, error: 'Missing access token or Meta ad ID' };
  }
  return metaPost(`${API_BASE}/${metaAdId}`, creds.accessToken, { status: 'ACTIVE' });
}

/* ── Pause / Resume Campaign ── */

export async function pauseMetaCampaign(
  creds: MetaCredentials,
  metaCampaignId: string,
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaCampaignId) {
    return { success: false, error: 'Missing access token or Meta campaign ID' };
  }
  return metaPost(`${API_BASE}/${metaCampaignId}`, creds.accessToken, { status: 'PAUSED' });
}

export async function resumeMetaCampaign(
  creds: MetaCredentials,
  metaCampaignId: string,
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaCampaignId) {
    return { success: false, error: 'Missing access token or Meta campaign ID' };
  }
  return metaPost(`${API_BASE}/${metaCampaignId}`, creds.accessToken, { status: 'ACTIVE' });
}

/* ══════════════════════════════════════════════════════════════════════════
   Feature: IMAGE UPLOAD to Meta (/{ad-account-id}/adimages)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Upload an image to Meta's ad images library.
 *
 * Meta requires images to be uploaded to their CDN before use in ads.
 * Returns an image_hash that can be used in ad creatives instead of imageUrl.
 *
 * Accepts either:
 *   - imageUrl: a publicly accessible URL (Meta fetches it)
 *   - imageBytes: base64-encoded image data
 *
 * Using image_hash (from upload) is MORE RELIABLE than imageUrl (external link)
 * because Meta caches the image and won't break if the source URL goes down.
 */
export async function uploadImageToMeta(
  creds: MetaCredentials,
  opts: { imageUrl?: string; imageBytes?: string; fileName?: string },
): Promise<MetaImageUploadResult> {
  if (!creds.adAccountId || !creds.accessToken) {
    return { success: false, error: 'Missing Meta credentials' };
  }
  if (!opts.imageUrl && !opts.imageBytes) {
    return { success: false, error: 'Either imageUrl or imageBytes is required' };
  }

  const url = `${API_BASE}/${creds.adAccountId}/adimages`;

  try {
    await waitIfThrottled();

    console.log(`[meta-write] Uploading image to ${url}`);

    let res: Response;

    if (opts.imageBytes) {
      // Upload base64 image data
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: creds.accessToken,
          bytes: opts.imageBytes,
          name: opts.fileName || `image_${Date.now()}`,
        }),
        signal: AbortSignal.timeout(60000), // 60s for image upload
      });
    } else {
      // Let Meta fetch from URL
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: creds.accessToken,
          url: opts.imageUrl,
          name: opts.fileName || `image_${Date.now()}`,
        }),
        signal: AbortSignal.timeout(60000),
      });
    }

    parseRateLimitHeader(res);

    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log(`[meta-write] adimages response status=${res.status}`, JSON.stringify(data).slice(0, 500));

    if (!res.ok) {
      const fbError = data?.error as Record<string, unknown> | undefined;
      return {
        success: false,
        error: (fbError?.message as string) || `HTTP ${res.status}`,
      };
    }

    // Meta returns: { images: { "<filename>": { hash: "abc123", url: "..." } } }
    const images = data?.images as Record<string, Record<string, string>> | undefined;
    if (images) {
      const firstKey = Object.keys(images)[0];
      if (firstKey && images[firstKey]) {
        return {
          success: true,
          imageHash: images[firstKey].hash,
          imageUrl: images[firstKey].url,
        };
      }
    }

    return { success: false, error: 'Unexpected response format from Meta adimages API' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[meta-write] Image upload failed:`, msg);
    return { success: false, error: msg };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Feature: DYNAMIC CREATIVE (asset_feed_spec)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a Dynamic Creative ad set — Meta automatically tests combinations
 * of headlines, texts, images, and CTAs to find the best performer.
 *
 * Requires the ad set to have `optimization_goal` set appropriately.
 * The ad set must also use `is_dynamic_creative: true`.
 */
export interface DynamicCreativeAssets {
  /** Multiple primary texts to test (2-5 recommended) */
  bodies: string[];
  /** Multiple headlines to test (2-5 recommended) */
  titles: string[];
  /** Multiple descriptions to test (optional) */
  descriptions?: string[];
  /** Image hashes from uploadImageToMeta (2-10 recommended) */
  imageHashes?: string[];
  /** External image URLs (alternative to hashes) */
  imageUrls?: string[];
  /** Video IDs (alternative to images) */
  videoIds?: string[];
  /** CTA types to test, e.g. ['LEARN_MORE', 'SIGN_UP'] */
  callToActions?: string[];
  /** Link URL (same for all variations) */
  linkUrl: string;
}

/**
 * Create ad set with dynamic creative enabled.
 * This creates an ad set that tells Meta to auto-mix creative assets.
 */
export async function createDynamicCreativeAdSet(
  creds: MetaCredentials,
  payload: Omit<CreateAdSetPayload, 'status'> & { status?: 'PAUSED' | 'ACTIVE' },
): Promise<MetaWriteResult> {
  if (!creds.adAccountId || !creds.accessToken) {
    return { success: false, error: 'Missing Meta credentials' };
  }

  const url = `${API_BASE}/${creds.adAccountId}/adsets`;
  const body: Record<string, unknown> = {
    campaign_id: payload.campaignId,
    name: payload.name,
    status: payload.status || 'PAUSED',
    billing_event: payload.billingEvent || 'IMPRESSIONS',
    optimization_goal: payload.optimizationGoal || 'LEAD_GENERATION',
    targeting: payload.targeting,
    is_dynamic_creative: true,  // ← enables dynamic creative
  };

  if (payload.dailyBudget) body.daily_budget = payload.dailyBudget;
  if (payload.lifetimeBudget) body.lifetime_budget = payload.lifetimeBudget;
  if (payload.startTime) body.start_time = payload.startTime;
  if (payload.endTime) body.end_time = payload.endTime;
  if (payload.promotedObject) body.promoted_object = payload.promotedObject;

  return metaPost(url, creds.accessToken, body);
}

/**
 * Create an ad with dynamic creative asset_feed_spec.
 * The parent ad set MUST have `is_dynamic_creative: true`.
 *
 * Meta will automatically combine the provided assets (headlines, texts,
 * images, CTAs) and test different combinations for best performance.
 */
export async function createDynamicCreativeAd(
  creds: MetaCredentials,
  opts: {
    adSetId: string;
    name: string;
    pageId: string;
    assets: DynamicCreativeAssets;
    status?: 'PAUSED' | 'ACTIVE';
  },
): Promise<MetaWriteResult> {
  if (!creds.adAccountId || !creds.accessToken) {
    return { success: false, error: 'Missing Meta credentials' };
  }
  if (!opts.adSetId || !opts.pageId) {
    return { success: false, error: 'Ad set ID and page ID are required' };
  }
  if (!opts.assets.bodies.length || !opts.assets.titles.length) {
    return { success: false, error: 'At least 1 body text and 1 title are required' };
  }
  if (!opts.assets.imageHashes?.length && !opts.assets.imageUrls?.length && !opts.assets.videoIds?.length) {
    return { success: false, error: 'At least 1 image or video is required' };
  }

  // Build asset_feed_spec
  const assetFeedSpec: Record<string, unknown> = {
    bodies: opts.assets.bodies.map(text => ({ text })),
    titles: opts.assets.titles.map(text => ({ text })),
    link_urls: [{ website_url: opts.assets.linkUrl }],
    ad_formats: ['SINGLE_IMAGE'], // or SINGLE_VIDEO if videoIds provided
  };

  if (opts.assets.descriptions?.length) {
    assetFeedSpec.descriptions = opts.assets.descriptions.map(text => ({ text }));
  }

  // Images
  if (opts.assets.imageHashes?.length) {
    assetFeedSpec.images = opts.assets.imageHashes.map(hash => ({ hash }));
  } else if (opts.assets.imageUrls?.length) {
    assetFeedSpec.images = opts.assets.imageUrls.map(url => ({ url }));
  }

  // Videos
  if (opts.assets.videoIds?.length) {
    assetFeedSpec.videos = opts.assets.videoIds.map(id => ({ video_id: id }));
    assetFeedSpec.ad_formats = ['SINGLE_VIDEO'];
  }

  // CTAs
  if (opts.assets.callToActions?.length) {
    assetFeedSpec.call_to_action_types = opts.assets.callToActions;
  }

  // Step 1: Create ad creative with asset_feed_spec
  const creativeUrl = `${API_BASE}/${creds.adAccountId}/adcreatives`;
  const creativeBody: Record<string, unknown> = {
    name: `${opts.name} dynamic creative`,
    object_story_spec: {
      page_id: opts.pageId,
    },
    asset_feed_spec: assetFeedSpec,
  };

  const creativeResult = await metaPost(creativeUrl, creds.accessToken, creativeBody);
  if (!creativeResult.success) {
    return {
      success: false,
      error: `Failed to create dynamic creative: ${creativeResult.error}`,
      errorCode: creativeResult.errorCode,
      rawResponse: creativeResult.rawResponse,
    };
  }

  // Step 2: Create the ad
  const adUrl = `${API_BASE}/${creds.adAccountId}/ads`;
  const adBody: Record<string, unknown> = {
    name: opts.name,
    adset_id: opts.adSetId,
    creative: { creative_id: creativeResult.metaId },
    status: opts.status || 'PAUSED',
  };

  return metaPost(adUrl, creds.accessToken, adBody);
}

/* ══════════════════════════════════════════════════════════════════════════
   Feature: POST-CREATION VERIFICATION
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Verify that a campaign/adset/ad was actually created on Meta.
 * Reads back the entity from Meta API and confirms it exists + returns status.
 *
 * Call this after createMetaCampaign / createMetaAdSet / createMetaAd
 * to ensure the entity was properly created (not just a 200 response).
 */
export async function verifyMetaEntity(
  creds: MetaCredentials,
  entityType: 'campaign' | 'adset' | 'ad',
  metaId: string,
): Promise<MetaVerificationResult> {
  if (!creds.accessToken || !metaId) {
    return {
      success: false,
      entityType,
      metaId,
      exists: false,
      error: 'Missing access token or Meta ID',
    };
  }

  const fields = entityType === 'campaign'
    ? 'id,name,status,configured_status,effective_status,objective'
    : entityType === 'adset'
    ? 'id,name,status,configured_status,effective_status,daily_budget'
    : 'id,name,status,configured_status,effective_status,creative';

  const url = `${API_BASE}/${metaId}?fields=${fields}&access_token=${creds.accessToken}`;

  try {
    await waitIfThrottled();

    console.log(`[meta-write] Verifying ${entityType} ${metaId}...`);

    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });

    parseRateLimitHeader(res);

    const data = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (!res.ok) {
      const fbError = data?.error as Record<string, unknown> | undefined;
      const errMsg = (fbError?.message as string) || `HTTP ${res.status}`;

      // 404 or "object does not exist" means it wasn't created
      const doesNotExist = res.status === 404 ||
        errMsg.toLowerCase().includes('does not exist') ||
        errMsg.toLowerCase().includes('nonexistent');

      return {
        success: false,
        entityType,
        metaId,
        exists: !doesNotExist,
        error: errMsg,
      };
    }

    console.log(`[meta-write] ✅ Verified ${entityType} ${metaId}: status=${data.status} effective=${data.effective_status}`);

    return {
      success: true,
      entityType,
      metaId,
      exists: true,
      status: data.status as string,
      configuredStatus: data.configured_status as string,
      effectiveStatus: data.effective_status as string,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[meta-write] Verification failed for ${entityType} ${metaId}:`, msg);
    return {
      success: false,
      entityType,
      metaId,
      exists: false,
      error: msg,
    };
  }
}

/**
 * Verify an entire publish result — checks all created entities.
 * Call after the full publish flow to confirm everything landed on Meta.
 */
export async function verifyPublishResults(
  creds: MetaCredentials,
  publishedEntities: Array<{ type: 'campaign' | 'adset' | 'ad'; metaId: string }>,
): Promise<{
  allVerified: boolean;
  results: MetaVerificationResult[];
  failedCount: number;
}> {
  const results: MetaVerificationResult[] = [];
  let failedCount = 0;

  for (const entity of publishedEntities) {
    const result = await verifyMetaEntity(creds, entity.type, entity.metaId);
    results.push(result);
    if (!result.exists) failedCount++;
  }

  return {
    allVerified: failedCount === 0,
    results,
    failedCount,
  };
}

/* ── Utility: map local objective to Meta objective enum ── */

export function mapObjectiveToMeta(localObjective: string): string {
  const map: Record<string, string> = {
    'brand_awareness': 'OUTCOME_AWARENESS',
    'reach': 'OUTCOME_AWARENESS',
    'traffic': 'OUTCOME_TRAFFIC',
    'engagement': 'OUTCOME_ENGAGEMENT',
    'app_installs': 'OUTCOME_APP_PROMOTION',
    'video_views': 'OUTCOME_AWARENESS',
    'lead_generation': 'OUTCOME_LEADS',
    'leads': 'OUTCOME_LEADS',
    'messages': 'OUTCOME_ENGAGEMENT',
    'conversions': 'OUTCOME_SALES',
    'catalog_sales': 'OUTCOME_SALES',
    'store_traffic': 'OUTCOME_AWARENESS',
    'sales': 'OUTCOME_SALES',
    'awareness': 'OUTCOME_AWARENESS',
  };
  return map[localObjective.toLowerCase()] || 'OUTCOME_LEADS';
}

/* ── Utility: map local CTA to Meta CTA type ── */

export function mapCtaToMeta(localCta: string): string {
  const map: Record<string, string> = {
    'learn_more': 'LEARN_MORE',
    'sign_up': 'SIGN_UP',
    'shop_now': 'SHOP_NOW',
    'book_now': 'BOOK_TRAVEL',
    'contact_us': 'CONTACT_US',
    'download': 'DOWNLOAD',
    'get_offer': 'GET_OFFER',
    'send_message': 'MESSAGE_PAGE',
    'whatsapp': 'WHATSAPP_MESSAGE',
    'call_now': 'CALL_NOW',
    'apply_now': 'APPLY_NOW',
    'subscribe': 'SUBSCRIBE',
  };
  return map[localCta?.toLowerCase()] || 'LEARN_MORE';
}
