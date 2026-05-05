/**
 * SERP API Adapter for PIXEL SEO/GEO System
 *
 * Unified interface for SERP data from multiple providers:
 * - DataForSEO (primary provider)
 * - SerpAPI (fallback provider)
 *
 * Supports search result fetching, bulk queries, and domain ranking checks.
 * Never generates fake data — returns null on API failures.
 */

/**
 * SERP query options for controlling search behavior
 */
export interface SerpOptions {
  /** Location for localized results (e.g., "Israel", "Tel Aviv, Israel") */
  location?: string;
  /** Language code (e.g., "he" for Hebrew, "en" for English) */
  language?: string;
  /** Device type for results */
  device?: 'desktop' | 'mobile';
  /** Number of results to fetch (default: 100) */
  numResults?: number;
}

/**
 * Individual SERP result item (organic search result)
 */
export interface SerpResultItem {
  /** Position in search results (1-based) */
  position: number;
  /** Full URL of the result */
  url: string;
  /** Page title */
  title: string;
  /** Result snippet/description */
  snippet: string;
  /** Domain extracted from URL */
  domain: string;
}

/**
 * Complete SERP result set for a single query
 */
export interface SerpResult {
  /** The original search query */
  query: string;
  /** Total estimated number of results for this query */
  totalResults: number;
  /** Array of organic search results */
  items: SerpResultItem[];
  /** Featured snippet if available */
  featuredSnippet?: { text: string; url: string } | null;
  /** People Also Ask suggestions */
  peopleAlsoAsk?: string[];
  /** Related searches */
  relatedSearches?: string[];
  /** Which provider returned this result */
  provider: 'dataforseo' | 'serpapi';
  /** ISO timestamp when results were fetched */
  fetchedAt: string;
}

/**
 * Domain ranking result for a specific query
 */
export interface DomainRankingResult {
  /** The search query */
  query: string;
  /** Position of the domain in results (null = not in top N) */
  position: number | null;
  /** URL of the ranking result (null if not ranked) */
  url: string | null;
  /** Title of the ranking page (null if not ranked) */
  title: string | null;
  /** Total search results for this query */
  totalResults: number;
  /** Top competitors for this query */
  topCompetitors: { domain: string; position: number; url: string }[];
}

// ============================================================================
// Provider Detection & Configuration
// ============================================================================

/**
 * Check if a SERP provider is configured via environment variables
 *
 * @returns true if DataForSEO or SerpAPI credentials are available
 */
export function isSerpAvailable(): boolean {
  const hasDataForSEO =
    process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD;
  const hasSerpAPI = process.env.SERPAPI_KEY;
  return !!(hasDataForSEO || hasSerpAPI);
}

/**
 * Get the active SERP provider based on configured credentials
 *
 * Priority: DataForSEO > SerpAPI
 *
 * @returns 'dataforseo' | 'serpapi' | null (null if no provider configured)
 */
export function getSerpProvider(): 'dataforseo' | 'serpapi' | null {
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    return 'dataforseo';
  }
  if (process.env.SERPAPI_KEY) {
    return 'serpapi';
  }
  return null;
}

// ============================================================================
// DataForSEO Implementation
// ============================================================================

interface DataForSEORequest {
  language_code?: string;
  location_code?: number;
  device?: string;
  depth?: number;
}

interface DataForSEOItem {
  rank_group: number;
  rank_absolute: number;
  position?: number;
  url: string;
  title: string;
  description: string;
  domain: string;
}

interface DataForSEOResponse {
  tasks?: Array<{
    result?: Array<{
      item_count: number;
      items: DataForSEOItem[];
      answer_box?: {
        text?: string;
        title?: string;
        type?: string;
      };
      people_also_ask?: Array<{ title: string }>;
      related_searches?: Array<{ title: string }>;
    }>;
  }>;
}

/**
 * Get location code for DataForSEO API
 * Maps common location names to numeric codes
 */
function getLocationCodeForDataForSEO(location?: string): number | undefined {
  if (!location) return undefined;

  const locationMap: Record<string, number> = {
    israel: 2016,
    'tel aviv': 20316,
    'tel aviv, israel': 20316,
    jerusalem: 20315,
    'jerusalem, israel': 20315,
    united_states: 2840,
    us: 2840,
    united_kingdom: 2826,
    uk: 2826,
    france: 2250,
    germany: 2276,
    canada: 2124,
  };

  const normalizedLocation = location.toLowerCase().replace(/\s+/g, '_');
  return locationMap[normalizedLocation];
}

/**
 * Fetch SERP results using DataForSEO API
 */
async function fetchDataForSEO(
  query: string,
  options?: SerpOptions
): Promise<SerpResult | null> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    console.error('DataForSEO credentials not configured');
    return null;
  }

  try {
    const credentials = Buffer.from(`${login}:${password}`).toString('base64');
    const locationCode = getLocationCodeForDataForSEO(options?.location);

    const requestBody: DataForSEORequest = {
      depth: options?.numResults || 100,
      device: options?.device || 'desktop',
    };

    if (options?.language) {
      requestBody.language_code = options.language;
    }

    if (locationCode) {
      requestBody.location_code = locationCode;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ keyword: query, ...requestBody }]),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `DataForSEO API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data: DataForSEOResponse = await response.json();

    if (!data.tasks?.[0]?.result?.[0]) {
      console.warn(`DataForSEO: No results for query "${query}"`);
      return null;
    }

    const result = data.tasks[0].result[0];
    const items: SerpResultItem[] = (result.items || [])
      .slice(0, options?.numResults || 100)
      .map((item: DataForSEOItem, idx: number) => ({
        position: item.rank_absolute || item.rank_group || idx + 1,
        url: item.url,
        title: item.title,
        snippet: item.description,
        domain: item.domain,
      }));

    const featuredSnippet =
      result.answer_box?.text && result.answer_box?.title
        ? {
            text: result.answer_box.text,
            url: '', // DataForSEO doesn't always provide URL for answer box
          }
        : null;

    const peopleAlsoAsk = (result.people_also_ask || []).map(
      (paa: any) => paa.title
    );

    const relatedSearches = (result.related_searches || []).map(
      (rs: any) => rs.title
    );

    return {
      query,
      totalResults: result.item_count || 0,
      items,
      featuredSnippet,
      peopleAlsoAsk,
      relatedSearches,
      provider: 'dataforseo',
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('DataForSEO fetch error:', error);
    return null;
  }
}

// ============================================================================
// SerpAPI Implementation
// ============================================================================

interface SerpAPIResult {
  position: number;
  title: string;
  link: string;
  domain: string;
  snippet: string;
}

interface SerpAPIResponse {
  search_metadata: {
    total_results: number;
  };
  organic_results?: SerpAPIResult[];
  answer_box?: {
    answer?: string;
    source?: string;
  };
  people_also_ask?: Array<{ title: string }>;
  related_searches?: Array<{ query: string }>;
}

/**
 * Get location parameter for SerpAPI
 */
function getLocationForSerpAPI(location?: string): string | undefined {
  if (!location) return undefined;

  const locationMap: Record<string, string> = {
    israel: 'Israel',
    'tel aviv': 'Tel Aviv',
    'tel aviv, israel': 'Tel Aviv',
    jerusalem: 'Jerusalem',
    'jerusalem, israel': 'Jerusalem',
  };

  const normalizedLocation = location.toLowerCase();
  return locationMap[normalizedLocation] || location;
}

/**
 * Get Google location code for SerpAPI (gl parameter)
 */
function getGLForSerpAPI(location?: string): string | undefined {
  if (!location) return undefined;

  const glMap: Record<string, string> = {
    israel: 'il',
    'tel aviv': 'il',
    'tel aviv, israel': 'il',
    jerusalem: 'il',
    'jerusalem, israel': 'il',
  };

  const normalizedLocation = location.toLowerCase();
  return glMap[normalizedLocation];
}

/**
 * Get language code for SerpAPI (hl parameter)
 */
function getHLForSerpAPI(language?: string): string | undefined {
  if (!language) return undefined;

  const hlMap: Record<string, string> = {
    he: 'he',
    hebrew: 'he',
    en: 'en',
    english: 'en',
    fr: 'fr',
    de: 'de',
    es: 'es',
  };

  return hlMap[language.toLowerCase()] || language;
}

/**
 * Fetch SERP results using SerpAPI
 */
async function fetchSerpAPI(
  query: string,
  options?: SerpOptions
): Promise<SerpResult | null> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    console.error('SerpAPI key not configured');
    return null;
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      q: query,
      num: String(options?.numResults || 100),
    });

    const gl = getGLForSerpAPI(options?.location);
    if (gl) params.append('gl', gl);

    const hl = getHLForSerpAPI(options?.language);
    if (hl) params.append('hl', hl);

    const location = getLocationForSerpAPI(options?.location);
    if (location) params.append('location', location);

    if (options?.device === 'mobile') {
      params.append('device', 'mobile');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `https://serpapi.com/search.json?${params.toString()}`,
      {
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`SerpAPI error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: SerpAPIResponse = await response.json();

    if (!data.organic_results || data.organic_results.length === 0) {
      console.warn(`SerpAPI: No results for query "${query}"`);
      return null;
    }

    const items: SerpResultItem[] = data.organic_results
      .slice(0, options?.numResults || 100)
      .map((result: SerpAPIResult) => ({
        position: result.position,
        url: result.link,
        title: result.title,
        snippet: result.snippet,
        domain: result.domain,
      }));

    const featuredSnippet =
      data.answer_box && data.answer_box.answer
        ? {
            text: data.answer_box.answer,
            url: data.answer_box.source || '',
          }
        : null;

    const peopleAlsoAsk = (data.people_also_ask || [])
      .slice(0, 8)
      .map((paa: any) => paa.title);

    const relatedSearches = (data.related_searches || [])
      .slice(0, 8)
      .map((rs: any) => rs.query);

    return {
      query,
      totalResults: data.search_metadata.total_results || 0,
      items,
      featuredSnippet,
      peopleAlsoAsk,
      relatedSearches,
      provider: 'serpapi',
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('SerpAPI fetch error:', error);
    return null;
  }
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Fetch SERP results for a single query
 *
 * Uses the configured provider (DataForSEO preferred, falls back to SerpAPI).
 * Returns null if no provider is configured or if the API request fails.
 *
 * @param query - The search query
 * @param options - Optional search parameters
 * @returns SerpResult or null if unavailable
 *
 * @example
 * const results = await fetchSerpResults('pixel frame AI', {
 *   location: 'Israel',
 *   language: 'he',
 *   numResults: 50,
 * });
 */
export async function fetchSerpResults(
  query: string,
  options?: SerpOptions
): Promise<SerpResult | null> {
  if (!query || query.trim().length === 0) {
    console.error('Query cannot be empty');
    return null;
  }

  const provider = getSerpProvider();

  if (provider === 'dataforseo') {
    return fetchDataForSEO(query, options);
  }

  if (provider === 'serpapi') {
    return fetchSerpAPI(query, options);
  }

  console.error('No SERP provider configured');
  return null;
}

/**
 * Fetch SERP results for multiple queries in batch
 *
 * Respects rate limiting with max 5 concurrent requests.
 * Returns a Map of query -> SerpResult. Failed queries are omitted from results.
 *
 * @param queries - Array of search queries
 * @param options - Optional search parameters (applied to all queries)
 * @returns Map of query -> SerpResult, or null if no provider configured
 *
 * @example
 * const results = await fetchBulkSerp([
 *   'AI frame technology',
 *   'pixel perfect design',
 *   'web rendering engine'
 * ], { location: 'Israel' });
 *
 * results?.forEach((result, query) => {
 *   console.log(`${query}: ${result.items.length} results`);
 * });
 */
export async function fetchBulkSerp(
  queries: string[],
  options?: SerpOptions
): Promise<Map<string, SerpResult> | null> {
  const provider = getSerpProvider();

  if (!provider) {
    console.error('No SERP provider configured');
    return null;
  }

  const results = new Map<string, SerpResult>();
  const MAX_CONCURRENT = 5;
  const queue = [...queries];
  const inProgress = new Set<Promise<void>>();

  const processNext = async () => {
    while (queue.length > 0) {
      const query = queue.shift();
      if (!query) break;

      const result = await fetchSerpResults(query, options);
      if (result) {
        results.set(query, result);
      }
    }
  };

  // Start concurrent workers
  for (let i = 0; i < Math.min(MAX_CONCURRENT, queries.length); i++) {
    const promise = processNext();
    inProgress.add(promise);
    promise.finally(() => inProgress.delete(promise));
  }

  await Promise.all(inProgress);

  return results.size > 0 ? results : null;
}

/**
 * Check where a domain ranks for multiple queries
 *
 * Returns ranking position, competing domains, and metadata for each query.
 *
 * @param domain - The domain to check (e.g., "example.com")
 * @param queries - Search queries to check rankings for
 * @param options - Optional search parameters
 * @returns Array of DomainRankingResult, or null if no provider configured
 *
 * @example
 * const rankings = await checkDomainRankings('pixelframe.ai', [
 *   'AI pixel rendering',
 *   'web animation engine',
 *   'real-time graphics'
 * ]);
 *
 * rankings?.forEach(result => {
 *   if (result.position) {
 *     console.log(`${result.query}: #${result.position}`);
 *   } else {
 *     console.log(`${result.query}: Not ranked`);
 *   }
 * });
 */
export async function checkDomainRankings(
  domain: string,
  queries: string[],
  options?: SerpOptions
): Promise<DomainRankingResult[]> {
  const normalizedDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  const results: DomainRankingResult[] = [];

  const bulkResults = await fetchBulkSerp(queries, options);

  if (!bulkResults) {
    console.error('Could not fetch SERP results for domain ranking check');
    return [];
  }

  for (const [query, serpResult] of Array.from(bulkResults.entries())) {
    const foundItem = serpResult.items.find(
      (item) =>
        item.domain === normalizedDomain || item.url.includes(normalizedDomain)
    );

    // Get top 3 competitors (excluding the domain being checked)
    const topCompetitors = serpResult.items
      .filter((item) => item.domain !== normalizedDomain)
      .slice(0, 3)
      .map((item) => ({
        domain: item.domain,
        position: item.position,
        url: item.url,
      }));

    results.push({
      query,
      position: foundItem?.position || null,
      url: foundItem?.url || null,
      title: foundItem?.title || null,
      totalResults: serpResult.totalResults,
      topCompetitors,
    });
  }

  return results;
}
