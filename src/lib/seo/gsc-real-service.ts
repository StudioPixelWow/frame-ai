/**
 * Google Search Console — Real API Integration Service
 * Full OAuth2 client for GSC data retrieval and management
 * All user-facing text in Hebrew
 */

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';
const SEARCH_ANALYTICS_URL = 'https://searchconsole.googleapis.com/webmasters/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const INDEXING_API = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface GSCCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  siteUrl: string;
}

export interface GSCSearchRow {
  query?: string;
  page?: string;
  country?: string;
  device?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCAnalyticsResult {
  rows: GSCSearchRow[];
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  dateRange: { startDate: string; endDate: string };
  fetchedAt: string;
}

export interface GSCTopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCTopPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCIndexingStatus {
  siteUrl: string;
  permissionLevel: string;
  sitemaps: Array<{
    path: string;
    lastSubmitted: string;
    isPending: boolean;
    lastDownloaded: string;
    warnings: number;
    errors: number;
  }>;
  fetchedAt: string;
}

export interface GSCPositionChange {
  query: string;
  currentPosition: number;
  previousPosition: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
  clicks: number;
  impressions: number;
}

export type GSCConnectionStatus = 'connected' | 'not_connected' | 'token_expired' | 'error';

// ── Token Management ──────────────────────────────────────────────────────────

async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('חסרים GOOGLE_CLIENT_ID או GOOGLE_CLIENT_SECRET בהגדרות הסביבה');
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`שגיאה בחידוש הטוקן: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ── Core API Functions ────────────────────────────────────────────────────────

/**
 * Connect GSC — validate credentials and return connection status
 */
export async function connectGSC(refreshToken: string, siteUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken(refreshToken);

    // Verify access to the site
    const response = await fetch(`${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `אין גישה לאתר ${siteUrl}: ${errText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'שגיאה לא ידועה' };
  }
}

/**
 * Get search analytics data with flexible dimensions
 */
export async function getSearchAnalytics(
  refreshToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: ('query' | 'page' | 'country' | 'device')[] = ['query']
): Promise<GSCAnalyticsResult> {
  const accessToken = await getAccessToken(refreshToken);

  const body = {
    startDate,
    endDate,
    dimensions,
    rowLimit: 1000,
    startRow: 0,
  };

  const response = await fetch(
    `${SEARCH_ANALYTICS_URL}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`שגיאת GSC API: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const rows: GSCSearchRow[] = (data.rows || []).map((row: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => {
    const mapped: GSCSearchRow = {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    };
    dimensions.forEach((dim, idx) => {
      (mapped as Record<string, unknown>)[dim] = row.keys[idx];
    });
    return mapped;
  });

  const totalClicks = rows.reduce((sum, r) => sum + r.clicks, 0);
  const totalImpressions = rows.reduce((sum, r) => sum + r.impressions, 0);

  return {
    rows,
    totalClicks,
    totalImpressions,
    averageCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    averagePosition: rows.length > 0 ? rows.reduce((sum, r) => sum + r.position, 0) / rows.length : 0,
    dateRange: { startDate, endDate },
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Get top performing queries
 */
export async function getTopQueries(
  refreshToken: string,
  siteUrl: string,
  days: number = 28
): Promise<GSCTopQuery[]> {
  const endDate = formatDate(new Date(Date.now() - 86400000)); // yesterday
  const startDate = formatDate(new Date(Date.now() - days * 86400000));

  const result = await getSearchAnalytics(refreshToken, siteUrl, startDate, endDate, ['query']);

  return result.rows
    .filter((r) => r.query)
    .map((r) => ({
      query: r.query!,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

/**
 * Get top pages by clicks
 */
export async function getTopPages(
  refreshToken: string,
  siteUrl: string,
  days: number = 28
): Promise<GSCTopPage[]> {
  const endDate = formatDate(new Date(Date.now() - 86400000));
  const startDate = formatDate(new Date(Date.now() - days * 86400000));

  const result = await getSearchAnalytics(refreshToken, siteUrl, startDate, endDate, ['page']);

  return result.rows
    .filter((r) => r.page)
    .map((r) => ({
      page: r.page!,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

/**
 * Get indexing status — sitemaps info
 */
export async function getIndexingStatus(
  refreshToken: string,
  siteUrl: string
): Promise<GSCIndexingStatus> {
  const accessToken = await getAccessToken(refreshToken);

  // Get site info
  const siteResponse = await fetch(`${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!siteResponse.ok) {
    throw new Error(`שגיאה בקבלת מידע על האתר: ${siteResponse.status}`);
  }

  const siteData = await siteResponse.json();

  // Get sitemaps
  const smResponse = await fetch(
    `${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let sitemaps: GSCIndexingStatus['sitemaps'] = [];
  if (smResponse.ok) {
    const smData = await smResponse.json();
    sitemaps = (smData.sitemap || []).map((sm: Record<string, unknown>) => ({
      path: sm.path as string,
      lastSubmitted: sm.lastSubmitted as string,
      isPending: sm.isPending as boolean,
      lastDownloaded: sm.lastDownloaded as string || '',
      warnings: (sm.warnings as number) || 0,
      errors: (sm.errors as number) || 0,
    }));
  }

  return {
    siteUrl,
    permissionLevel: siteData.permissionLevel || 'unknown',
    sitemaps,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Submit a sitemap to Google
 */
export async function submitSitemap(
  refreshToken: string,
  siteUrl: string,
  sitemapUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken(refreshToken);

    const response = await fetch(
      `${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `שגיאה בשליחת סאייטמאפ: ${errText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'שגיאה לא ידועה' };
  }
}

/**
 * Request indexing for a URL via Indexing API
 */
export async function requestIndexing(
  refreshToken: string,
  pageUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken(refreshToken);

    const response = await fetch(INDEXING_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: pageUrl,
        type: 'URL_UPDATED',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `שגיאה בבקשת אינדוקס: ${errText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'שגיאה לא ידועה' };
  }
}

/**
 * Get position changes over time — compare current period to previous period
 */
export async function getPositionChanges(
  refreshToken: string,
  siteUrl: string,
  days: number = 28
): Promise<GSCPositionChange[]> {
  const now = Date.now();
  const dayMs = 86400000;

  // Current period
  const currentEnd = formatDate(new Date(now - dayMs));
  const currentStart = formatDate(new Date(now - days * dayMs));

  // Previous period (same length, immediately before)
  const prevEnd = formatDate(new Date(now - (days + 1) * dayMs));
  const prevStart = formatDate(new Date(now - 2 * days * dayMs));

  const [currentData, previousData] = await Promise.all([
    getSearchAnalytics(refreshToken, siteUrl, currentStart, currentEnd, ['query']),
    getSearchAnalytics(refreshToken, siteUrl, prevStart, prevEnd, ['query']),
  ]);

  // Build map of previous positions
  const prevMap = new Map<string, number>();
  for (const row of previousData.rows) {
    if (row.query) prevMap.set(row.query, row.position);
  }

  // Compare
  const changes: GSCPositionChange[] = [];
  for (const row of currentData.rows) {
    if (!row.query) continue;
    const prevPosition = prevMap.get(row.query);
    if (prevPosition === undefined) continue;

    const change = prevPosition - row.position; // positive = improved
    changes.push({
      query: row.query,
      currentPosition: row.position,
      previousPosition: prevPosition,
      change,
      direction: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable',
      clicks: row.clicks,
      impressions: row.impressions,
    });
  }

  return changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
