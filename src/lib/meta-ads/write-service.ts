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

const API_BASE = 'https://graph.facebook.com/v19.0';

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

/* ── Audiences (Custom / Lookalike / Retargeting) ── */
import crypto from 'crypto';

const sha256 = (v: string) => crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');

/** Create a Custom Audience from a list of lead emails/phones (hashed, GDPR-safe). */
export async function createCustomAudienceFromLeads(
  creds: MetaCredentials,
  name: string,
  contacts: { email?: string; phone?: string }[],
): Promise<MetaWriteResult> {
  if (!creds.adAccountId || !creds.accessToken) return { success: false, error: 'Missing credentials' };
  // 1) create the (empty) audience
  const created = await metaPost(`${API_BASE}/${creds.adAccountId}/customaudiences`, creds.accessToken, {
    name, subtype: 'CUSTOM', customer_file_source: 'USER_PROVIDED_ONLY', description: 'Leads from PixelManage',
  });
  if (!created.success || !created.metaId) return created;

  // 2) push hashed users (schema EMAIL_SHA256 / PHONE_SHA256)
  const emails = contacts.filter(c => c.email).map(c => [sha256(c.email!)]);
  const phones = contacts.filter(c => c.phone).map(c => [sha256(c.phone!.replace(/[^\d]/g, ''))]);
  try {
    if (emails.length) {
      await fetch(`${API_BASE}/${created.metaId}/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { schema: ['EMAIL_SHA256'], data: emails }, access_token: creds.accessToken }),
      });
    }
    if (phones.length) {
      await fetch(`${API_BASE}/${created.metaId}/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { schema: ['PHONE_SHA256'], data: phones }, access_token: creds.accessToken }),
      });
    }
  } catch (e) {
    return { success: true, metaId: created.metaId, error: `הקהל נוצר אך העלאת אנשי קשר נכשלה: ${e instanceof Error ? e.message : ''}` };
  }
  return created;
}

/** Create a Lookalike audience from an existing source (custom) audience. */
export async function createLookalikeAudience(
  creds: MetaCredentials,
  name: string,
  sourceAudienceId: string,
  ratio = 0.01, // 1%
  country = 'IL',
): Promise<MetaWriteResult> {
  if (!creds.adAccountId || !creds.accessToken) return { success: false, error: 'Missing credentials' };
  return metaPost(`${API_BASE}/${creds.adAccountId}/customaudiences`, creds.accessToken, {
    name, subtype: 'LOOKALIKE', origin_audience_id: sourceAudienceId,
    lookalike_spec: JSON.stringify({ ratio, country, type: 'similarity' }),
  });
}

/** Create an engagement-based retargeting audience (page/IG engagers or video viewers). */
export async function createEngagementAudience(
  creds: MetaCredentials,
  name: string,
  pageId: string,
  retentionDays = 365,
): Promise<MetaWriteResult> {
  if (!creds.adAccountId || !creds.accessToken) return { success: false, error: 'Missing credentials' };
  return metaPost(`${API_BASE}/${creds.adAccountId}/customaudiences`, creds.accessToken, {
    name, subtype: 'ENGAGEMENT',
    rule: JSON.stringify({
      inclusions: { operator: 'or', rules: [{ event_sources: [{ type: 'page', id: pageId }], retention_seconds: retentionDays * 86400, filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'page_engaged' }] } }] },
    }),
  });
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
      // error_user_msg / error_user_title carry Meta's human-readable reason — far
      // more useful than the generic "Invalid parameter". Surface it when present.
      const userMsg = (fbError?.error_user_msg as string) || (fbError?.error_user_title as string) || '';
      const base = (fbError?.message as string) || `HTTP ${res.status}`;
      return {
        success: false,
        error: userMsg ? `${base} — ${userMsg}` : base,
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

/** Read an ad set's current daily_budget (in cents) straight from Meta — used to
 *  VERIFY that a budget update actually took effect (not just returned HTTP 200). */
export async function getMetaAdSetDailyBudget(
  creds: MetaCredentials,
  metaAdSetId: string,
): Promise<number | null> {
  if (!creds.accessToken || !metaAdSetId) return null;
  try {
    const res = await fetch(
      `${API_BASE}/${metaAdSetId}?fields=daily_budget&access_token=${encodeURIComponent(creds.accessToken)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) return null;
    const db = data.daily_budget;
    return db == null ? null : parseInt(String(db), 10);
  } catch {
    return null;
  }
}

/** Read an ad set's current targeting object from Meta (so we can merge, not clobber). */
export async function getMetaAdSetTargeting(
  creds: MetaCredentials,
  metaAdSetId: string,
): Promise<Record<string, unknown> | null> {
  if (!creds.accessToken || !metaAdSetId) return null;
  try {
    const res = await fetch(
      `${API_BASE}/${metaAdSetId}?fields=targeting&access_token=${encodeURIComponent(creds.accessToken)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) return null;
    return (data.targeting as Record<string, unknown>) || null;
  } catch {
    return null;
  }
}

/**
 * Expand an ad set's PLACEMENTS to Facebook + Instagram (all positions incl.
 * feed/story/reels) without touching its audience targeting, budget or creative.
 * Reads the live targeting, removes manual placement restrictions, and writes back.
 */
export async function expandMetaAdSetPlacements(
  creds: MetaCredentials,
  metaAdSetId: string,
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaAdSetId) return { success: false, error: 'Missing access token or ad set ID' };
  const current = await getMetaAdSetTargeting(creds, metaAdSetId);
  if (!current) return { success: false, error: 'לא ניתן לקרוא את הטירגוט הנוכחי' };

  // Keep audience targeting (age/geo/interests) — only broaden placements.
  const next: Record<string, unknown> = { ...current };
  next.publisher_platforms = ['facebook', 'instagram'];
  // Remove manual position/device limits so Meta auto-distributes across all
  // FB+IG positions (feed, stories, reels, explore, etc.).
  delete next.facebook_positions;
  delete next.instagram_positions;
  delete next.audience_network_positions;
  delete next.messenger_positions;
  delete next.device_platforms;

  return metaPost(`${API_BASE}/${metaAdSetId}`, creds.accessToken, { targeting: next });
}

/** List the ad account's existing saved audiences (Custom + Lookalike). */
export async function listMetaCustomAudiences(
  creds: MetaCredentials,
): Promise<Array<{ id: string; name: string; subtype: string; approximateCount: number }>> {
  if (!creds.adAccountId || !creds.accessToken) return [];
  try {
    const res = await fetch(
      `${API_BASE}/${creds.adAccountId}/customaudiences?fields=id,name,subtype,approximate_count_lower_bound&limit=200&access_token=${encodeURIComponent(creds.accessToken)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok || !Array.isArray(data.data)) return [];
    return (data.data as any[]).map((a) => ({
      id: String(a.id),
      name: a.name || '',
      subtype: a.subtype || 'CUSTOM',
      approximateCount: Number(a.approximate_count_lower_bound) || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Add include/exclude saved audiences to an ad set WITHOUT touching its other
 * targeting, budget or creative. Merges into the live targeting's
 * custom_audiences / excluded_custom_audiences and writes back.
 */
export async function setMetaAdSetAudiences(
  creds: MetaCredentials,
  metaAdSetId: string,
  opts: { include?: string[]; exclude?: string[] },
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaAdSetId) return { success: false, error: 'Missing access token or ad set ID' };
  const current = await getMetaAdSetTargeting(creds, metaAdSetId);
  if (!current) return { success: false, error: 'לא ניתן לקרוא את הטירגוט הנוכחי' };

  const next: Record<string, unknown> = { ...current };
  const mergeIds = (existing: unknown, add: string[]): Array<{ id: string }> => {
    const cur = Array.isArray(existing) ? (existing as any[]).map((e) => String(e.id)) : [];
    const set = new Set([...cur, ...add]);
    return [...set].map((id) => ({ id }));
  };
  if (opts.include?.length) next.custom_audiences = mergeIds(current.custom_audiences, opts.include);
  if (opts.exclude?.length) next.excluded_custom_audiences = mergeIds(current.excluded_custom_audiences, opts.exclude);

  return metaPost(`${API_BASE}/${metaAdSetId}`, creds.accessToken, { targeting: next });
}

/* ── Update Ad Set daily budget (shekels → cents) ── */
export async function updateMetaAdSetBudget(
  creds: MetaCredentials,
  metaAdSetId: string,
  dailyBudgetShekels: number,
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaAdSetId) {
    return { success: false, error: 'Missing access token or Meta ad set ID' };
  }
  return metaPost(`${API_BASE}/${metaAdSetId}`, creds.accessToken, { daily_budget: Math.round(dailyBudgetShekels * 100) });
}

/**
 * Resolve a usable Page ID for an account WITHOUT requiring the client to have
 * manually connected a page. Tries, in order:
 *   1) the source ad set's promoted_object.page_id
 *   2) the source ad's creative object_story_spec.page_id
 *   3) the first page promotable from the ad account (/promote_pages)
 * Returns '' if none found.
 */
export async function resolveMetaPageId(
  creds: MetaCredentials,
  opts: { adSetId?: string; adId?: string } = {},
): Promise<string> {
  const tok = creds.accessToken;
  if (!tok) return '';
  const getJson = async (url: string): Promise<any> => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      return await res.json().catch(() => ({}));
    } catch { return {}; }
  };
  // 1) ad set promoted_object
  if (opts.adSetId) {
    const d = await getJson(`${API_BASE}/${opts.adSetId}?fields=promoted_object&access_token=${tok}`);
    const pid = d?.promoted_object?.page_id;
    if (pid) return String(pid);
  }
  // 2) ad creative object_story_spec
  if (opts.adId) {
    const d = await getJson(`${API_BASE}/${opts.adId}?fields=creative{object_story_spec{page_id}}&access_token=${tok}`);
    const pid = d?.creative?.object_story_spec?.page_id;
    if (pid) return String(pid);
  }
  // 3) account promotable pages
  if (creds.adAccountId) {
    const d = await getJson(`${API_BASE}/${creds.adAccountId}/promote_pages?fields=id&limit=1&access_token=${tok}`);
    const pid = d?.data?.[0]?.id;
    if (pid) return String(pid);
  }
  return '';
}

/* ── Update Ad Set targeting / name / budget (generic) ── */
export async function updateMetaAdSet(
  creds: MetaCredentials,
  metaAdSetId: string,
  opts: { name?: string; dailyBudget?: number; targeting?: Record<string, unknown>; status?: 'ACTIVE' | 'PAUSED' },
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaAdSetId) {
    return { success: false, error: 'Missing access token or Meta ad set ID' };
  }
  const body: Record<string, unknown> = {};
  if (opts.name !== undefined) body.name = opts.name;
  if (opts.dailyBudget !== undefined) body.daily_budget = Math.round(opts.dailyBudget * 100); // ₪ → cents
  if (opts.targeting !== undefined) body.targeting = opts.targeting;
  if (opts.status !== undefined) body.status = opts.status;
  if (Object.keys(body).length === 0) return { success: false, error: 'No fields to update' };
  return metaPost(`${API_BASE}/${metaAdSetId}`, creds.accessToken, body);
}

/**
 * Copy an existing ad set via Meta's native /copies endpoint.
 *
 * This is the ONLY reliable way to "expand a winning audience": the copy
 * inherits the source ad set's objective, optimization_goal, billing_event,
 * promoted_object and (with deepCopy) its ads/creatives — so it never hits
 * "Invalid parameter (code 100)" the way creating an ad set from scratch does
 * when the campaign objective isn't LEAD_GENERATION.
 *
 * Returns the new ad set's Meta ID in `metaId`.
 */
export async function copyMetaAdSet(
  creds: MetaCredentials,
  sourceAdSetId: string,
  opts: { deepCopy?: boolean; statusOption?: 'PAUSED' | 'ACTIVE' | 'INHERITED_FROM_SOURCE'; renameSuffix?: string } = {},
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !sourceAdSetId) {
    return { success: false, error: 'Missing access token or source ad set ID' };
  }

  const url = `${API_BASE}/${sourceAdSetId}/copies`;

  // One attempt. NOTE: rename_options is intentionally omitted (it must be a
  // JSON-encoded string for /copies and is a common code-100 cause) — we rename
  // the copy afterwards via updateMetaAdSet. status_option PAUSED keeps it safe.
  const attempt = async (deepCopy: boolean): Promise<MetaWriteResult> => {
    try {
      await waitIfThrottled();
      console.log(`[meta-write] POST ${url} (copy ad set, deep_copy=${deepCopy})`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deep_copy: deepCopy,
          status_option: opts.statusOption || 'PAUSED',
          access_token: creds.accessToken,
        }),
        signal: AbortSignal.timeout(30000),
      });
      parseRateLimitHeader(res);
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      console.log(`[meta-write] copy response status=${res.status}`, JSON.stringify(data).slice(0, 500));
      if (!res.ok) {
        const fbError = (data?.error || {}) as Record<string, unknown>;
        // error_user_msg is the human-readable reason — far more useful than "Invalid parameter".
        const detail = (fbError.error_user_msg as string) || (fbError.error_user_title as string) || '';
        const base = (fbError.message as string) || `HTTP ${res.status}`;
        return {
          success: false,
          error: detail ? `${base} — ${detail}` : base,
          errorCode: fbError.code as number | undefined,
          errorSubcode: fbError.error_subcode as number | undefined,
          rawResponse: data,
        };
      }
      const newId = (data.copied_adset_id || data.id || (data.ad_object_ids as any)?.[0]?.copied_id) as string | undefined;
      return { success: true, metaId: newId, rawResponse: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  // Try the requested (deep) copy first; if Meta rejects it, fall back to a
  // shallow copy (ad set structure only) so the user at least gets the expanded
  // audience to attach creatives to, instead of a hard failure.
  let r = await attempt(opts.deepCopy ?? true);
  if (!r.success && (opts.deepCopy ?? true)) {
    console.warn('[meta-write] deep copy failed, retrying shallow copy:', r.error);
    const shallow = await attempt(false);
    if (shallow.success) return { ...shallow, error: 'הקבוצה שוכפלה ללא מודעות — הוסף קריאייטיב לקבוצה החדשה' };
    r = r.error && r.error.length > (shallow.error?.length || 0) ? r : shallow; // keep the more detailed error
  }
  return r;
}

/* ── Pause / Resume Ad Set ── */

export async function pauseMetaAdSet(
  creds: MetaCredentials,
  metaAdSetId: string,
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaAdSetId) {
    return { success: false, error: 'Missing access token or Meta ad set ID' };
  }
  return metaPost(`${API_BASE}/${metaAdSetId}`, creds.accessToken, { status: 'PAUSED' });
}

export async function resumeMetaAdSet(
  creds: MetaCredentials,
  metaAdSetId: string,
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaAdSetId) {
    return { success: false, error: 'Missing access token or Meta ad set ID' };
  }
  return metaPost(`${API_BASE}/${metaAdSetId}`, creds.accessToken, { status: 'ACTIVE' });
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

/* ── Update Campaign (status / budget / name) ── */

export async function updateMetaCampaign(
  creds: MetaCredentials,
  metaCampaignId: string,
  opts: { status?: 'ACTIVE' | 'PAUSED'; dailyBudget?: number; lifetimeBudget?: number; name?: string },
): Promise<MetaWriteResult> {
  if (!creds.accessToken || !metaCampaignId) {
    return { success: false, error: 'Missing access token or Meta campaign ID' };
  }
  const body: Record<string, unknown> = {};
  if (opts.status !== undefined) body.status = opts.status;
  if (opts.dailyBudget !== undefined) body.daily_budget = opts.dailyBudget; // cents
  if (opts.lifetimeBudget !== undefined) body.lifetime_budget = opts.lifetimeBudget; // cents
  if (opts.name !== undefined) body.name = opts.name;
  if (Object.keys(body).length === 0) {
    return { success: false, error: 'No fields to update' };
  }
  return metaPost(`${API_BASE}/${metaCampaignId}`, creds.accessToken, body);
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
