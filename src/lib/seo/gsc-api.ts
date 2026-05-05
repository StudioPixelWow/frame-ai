/**
 * Google Search Console API Integration Service
 * Provides seamless access to GSC data for PIXEL SEO/GEO system
 * Uses native fetch (no external dependencies) with proper error handling
 */

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';
const GSC_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GSC_SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Query options for GSC API requests
 */
export interface GSCQueryOptions {
  /** Start date for data range in YYYY-MM-DD format (default: 28 days ago) */
  startDate?: string;
  /** End date for data range in YYYY-MM-DD format (default: yesterday) */
  endDate?: string;
  /** Dimensions to group results by */
  dimensions?: ('query' | 'page' | 'country' | 'device')[];
  /** Maximum number of rows to return (1-25000, default: 1000) */
  rowLimit?: number;
  /** Starting row for pagination (default: 0) */
  startRow?: number;
}

/**
 * GSC data for a specific search query
 */
export interface GSCQueryData {
  /** The search query string */
  query: string;
  /** Number of clicks */
  clicks: number;
  /** Number of impressions */
  impressions: number;
  /** Click-through rate (0-1 decimal) */
  ctr: number;
  /** Average search result position */
  position: number;
}

/**
 * GSC data for a specific page
 */
export interface GSCPageData {
  /** Full URL of the page */
  page: string;
  /** Number of clicks */
  clicks: number;
  /** Number of impressions */
  impressions: number;
  /** Click-through rate (0-1 decimal) */
  ctr: number;
  /** Average search result position */
  position: number;
}

/**
 * Aggregated GSC data response
 */
export interface GSCData {
  /** The site URL queried */
  siteUrl: string;
  /** Date range of the data */
  dateRange: { start: string; end: string };
  /** Total clicks across all queries */
  totalClicks: number;
  /** Total impressions across all queries */
  totalImpressions: number;
  /** Average click-through rate */
  averageCtr: number;
  /** Average search result position */
  averagePosition: number;
  /** Top queries */
  queries: GSCQueryData[];
  /** Top pages */
  pages: GSCPageData[];
  /** ISO timestamp when data was fetched */
  fetchedAt: string;
}

/**
 * JWT header structure for service account authentication
 */
interface JWTHeader {
  alg: 'RS256';
  typ: 'JWT';
}

/**
 * JWT payload structure for service account authentication
 */
interface JWTPayload {
  iss: string;
  scope: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Service account key structure
 */
interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
}

/**
 * Google OAuth2 token response
 */
interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * GSC API response for searchanalytics query
 */
interface GSCAPIResponse {
  kind: string;
  rows?: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  responseAggregationType: string;
}

/**
 * Check if GSC credentials are available in environment
 * @returns true if either service account JSON or access token is configured
 */
export function isGSCAvailable(): boolean {
  const hasServiceAccount = !!process.env.GSC_SERVICE_ACCOUNT_JSON;
  const hasAccessToken = !!process.env.GSC_ACCESS_TOKEN;
  return hasServiceAccount || hasAccessToken;
}

/**
 * Format a domain string into GSC site URL format
 * Supports both domain-only and full URL formats
 * @param domain - Domain string (e.g., "example.com" or "https://example.com/")
 * @returns GSC site URL in appropriate format
 */
export function getGSCSiteUrl(domain: string): string {
  // Remove protocol if present
  let cleaned = domain.replace(/^https?:\/\//, '');
  // Remove trailing slash
  cleaned = cleaned.replace(/\/$/, '');

  // If it looks like a URL path structure, use https format
  if (cleaned.includes('/')) {
    return `https://${cleaned}/`;
  }

  // For domain-only, use sc-domain format
  return `sc-domain:${cleaned}`;
}

/**
 * Decode base64 encoded service account JSON
 * @param encoded - Base64 encoded JSON string
 * @returns Parsed service account object
 * @throws Error if decoding fails
 */
function decodeServiceAccountKey(encoded: string): ServiceAccountKey {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error('אימות GSC נכשל: לא ניתן לפענח את מפתח חשבון השירות');
  }
}

/**
 * Create a base64-URL-safe string encoding
 * Used for JWT signing
 * @param str - String to encode
 * @returns Base64-URL-safe encoded string
 */
function base64urlEncode(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Sign a JWT using RS256 algorithm
 * @param payload - JWT payload object
 * @param privateKey - Private key in PEM format
 * @returns Signed JWT token
 * @throws Error if signing fails
 */
function signJWT(payload: JWTPayload, privateKey: string): string {
  const { createSign } = require('crypto');

  const header: JWTHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));

  const signature = createSign('RSA-SHA256')
    .update(`${headerEncoded}.${payloadEncoded}`)
    .sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * Obtain access token from Google OAuth2 endpoint using service account
 * @param serviceAccountKey - Decoded service account JSON object
 * @returns Access token string
 * @throws Error if authentication fails
 */
async function getAccessTokenFromServiceAccount(
  serviceAccountKey: ServiceAccountKey
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour expiration

  const payload: JWTPayload = {
    iss: serviceAccountKey.client_email,
    scope: GSC_SCOPES,
    aud: GSC_TOKEN_ENDPOINT,
    exp,
    iat: now,
  };

  try {
    const jwt = signJWT(payload, serviceAccountKey.private_key);

    const response = await fetchWithTimeout(GSC_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as GoogleTokenResponse;
    return data.access_token;
  } catch (error) {
    throw new Error('אימות GSC נכשל: לא ניתן להשיג access token מ-Google');
  }
}

/**
 * Get access token from environment (either direct token or service account)
 * @returns Access token string, or null if credentials unavailable
 */
async function getAccessToken(): Promise<string | null> {
  try {
    // Try direct access token first (simpler setup)
    if (process.env.GSC_ACCESS_TOKEN) {
      return process.env.GSC_ACCESS_TOKEN;
    }

    // Fall back to service account JSON
    if (process.env.GSC_SERVICE_ACCOUNT_JSON) {
      const serviceAccountKey = decodeServiceAccountKey(
        process.env.GSC_SERVICE_ACCOUNT_JSON
      );
      return await getAccessTokenFromServiceAccount(serviceAccountKey);
    }

    return null;
  } catch (error) {
    console.error('[GSC] Token acquisition failed:', error);
    return null;
  }
}

/**
 * Fetch with timeout enforcement
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Fetch response promise
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Calculate date strings for default date range
 * Default: 28 days ago to yesterday
 * @returns Object with start and end dates in YYYY-MM-DD format
 */
function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date();
  end.setDate(end.getDate() - 1); // Yesterday

  const start = new Date(end);
  start.setDate(start.getDate() - 28); // 28 days before end date

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

/**
 * Query Google Search Console API
 * @param siteUrl - Site URL to query (GSC format)
 * @param options - Query options (dimensions, date range, etc.)
 * @param accessToken - Access token for authentication
 * @returns Aggregated GSC data or null on error
 */
async function queryGSCAPI(
  siteUrl: string,
  options: GSCQueryOptions = {},
  accessToken: string
): Promise<GSCData | null> {
  const dateRange = getDefaultDateRange();
  const startDate = options.startDate || dateRange.start;
  const endDate = options.endDate || dateRange.end;
  const dimensions = options.dimensions || ['query', 'page'];
  const rowLimit = Math.min(options.rowLimit || 1000, 25000);
  const startRow = options.startRow || 0;

  try {
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const url = `${GSC_API_BASE}/sites/${encodedSiteUrl}/searchanalytics/query`;

    const requestBody = {
      startDate,
      endDate,
      dimensions,
      rowLimit,
      startRow,
    };

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`[GSC] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as GSCAPIResponse;

    if (!data.rows || data.rows.length === 0) {
      return {
        siteUrl,
        dateRange: { start: startDate, end: endDate },
        totalClicks: 0,
        totalImpressions: 0,
        averageCtr: 0,
        averagePosition: 0,
        queries: [],
        pages: [],
        fetchedAt: new Date().toISOString(),
      };
    }

    // Process rows and aggregate by query and page
    const queriesMap = new Map<string, GSCQueryData>();
    const pagesMap = new Map<string, GSCPageData>();

    let totalClicks = 0;
    let totalImpressions = 0;
    let totalCtr = 0;
    let totalPosition = 0;
    let rowCount = 0;

    for (const row of data.rows) {
      const clicks = row.clicks;
      const impressions = row.impressions;
      const ctr = row.ctr;
      const position = row.position;

      totalClicks += clicks;
      totalImpressions += impressions;
      totalCtr += ctr;
      totalPosition += position;
      rowCount++;

      // Aggregate by query dimension
      if (row.keys[0]) {
        const query = row.keys[0];
        const existing = queriesMap.get(query);
        if (existing) {
          existing.clicks += clicks;
          existing.impressions += impressions;
          existing.ctr = clicks / impressions || 0;
          existing.position =
            (existing.position * (existing.clicks - clicks) + position * clicks) /
            existing.clicks;
        } else {
          queriesMap.set(query, {
            query,
            clicks,
            impressions,
            ctr,
            position,
          });
        }
      }

      // Aggregate by page dimension
      if (row.keys[1]) {
        const page = row.keys[1];
        const existing = pagesMap.get(page);
        if (existing) {
          existing.clicks += clicks;
          existing.impressions += impressions;
          existing.ctr = clicks / impressions || 0;
          existing.position =
            (existing.position * (existing.clicks - clicks) + position * clicks) /
            existing.clicks;
        } else {
          pagesMap.set(page, {
            page,
            clicks,
            impressions,
            ctr,
            position,
          });
        }
      }
    }

    const averageCtr = rowCount > 0 ? totalCtr / rowCount : 0;
    const averagePosition = rowCount > 0 ? totalPosition / rowCount : 0;

    // Sort by clicks descending and limit results
    const queries = Array.from(queriesMap.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 100); // Top 100 queries

    const pages = Array.from(pagesMap.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 100); // Top 100 pages

    return {
      siteUrl,
      dateRange: { start: startDate, end: endDate },
      totalClicks,
      totalImpressions,
      averageCtr: Math.round(averageCtr * 10000) / 10000,
      averagePosition: Math.round(averagePosition * 100) / 100,
      queries,
      pages,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[GSC] Query execution failed:', error);
    return null;
  }
}

/**
 * Fetch aggregated GSC data for a site
 * @param siteUrl - Site URL or domain string
 * @param options - Query options (optional)
 * @returns Aggregated GSC data or null if unavailable/errored
 *
 * @example
 * ```typescript
 * const data = await fetchGSCData('example.com', {
 *   startDate: '2026-04-01',
 *   endDate: '2026-05-05'
 * });
 * if (data) {
 *   console.log(`Total clicks: ${data.totalClicks}`);
 * }
 * ```
 */
export async function fetchGSCData(
  siteUrl: string,
  options?: GSCQueryOptions
): Promise<GSCData | null> {
  if (!isGSCAvailable()) {
    console.warn('[GSC] Credentials not configured - returning null');
    return null;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('[GSC] Failed to obtain access token');
    return null;
  }

  const gscSiteUrl = getGSCSiteUrl(siteUrl);
  return await queryGSCAPI(gscSiteUrl, options, accessToken);
}

/**
 * Fetch per-page GSC data for a site
 * @param siteUrl - Site URL or domain string
 * @param options - Query options (optional)
 * @returns Array of page data or null if unavailable/errored
 *
 * @example
 * ```typescript
 * const pages = await fetchGSCPages('example.com', {
 *   rowLimit: 50
 * });
 * if (pages) {
 *   pages.forEach(page => {
 *     console.log(`${page.page}: ${page.clicks} clicks`);
 *   });
 * }
 * ```
 */
export async function fetchGSCPages(
  siteUrl: string,
  options?: GSCQueryOptions
): Promise<GSCPageData[] | null> {
  const data = await fetchGSCData(siteUrl, {
    ...options,
    dimensions: ['page'],
  });
  return data ? data.pages : null;
}

/**
 * Fetch per-query GSC data for a site
 * @param siteUrl - Site URL or domain string
 * @param options - Query options (optional)
 * @returns Array of query data or null if unavailable/errored
 *
 * @example
 * ```typescript
 * const queries = await fetchGSCQueries('example.com');
 * if (queries) {
 *   const topQuery = queries[0];
 *   console.log(`Top query: ${topQuery.query} (${topQuery.clicks} clicks)`);
 * }
 * ```
 */
export async function fetchGSCQueries(
  siteUrl: string,
  options?: GSCQueryOptions
): Promise<GSCQueryData[] | null> {
  const data = await fetchGSCData(siteUrl, {
    ...options,
    dimensions: ['query'],
  });
  return data ? data.queries : null;
}
