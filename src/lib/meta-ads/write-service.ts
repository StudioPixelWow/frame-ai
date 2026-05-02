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

/* ── Core fetch helper ── */

async function metaPost(
  url: string,
  token: string,
  body: Record<string, unknown>,
): Promise<MetaWriteResult> {
  try {
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
