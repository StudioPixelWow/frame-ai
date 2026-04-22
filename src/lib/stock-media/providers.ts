/**
 * PixelManageAI — Stock Media Provider Service
 *
 * Searches Pexels and Pixabay for stock videos.
 * Architecture prepared for Shutterstock (future).
 */

// ============================================================================
// Environment
// ============================================================================

/**
 * Read the Pexels API key from the server-side environment variable.
 * Never expose this via NEXT_PUBLIC — it must stay server-only.
 */
export function getPexelsApiKey(): string {
  const key = process.env.PEXELS_API_KEY ?? "";
  if (!key) {
    console.warn(
      "[stock-media] ⚠️ PEXELS_API_KEY is not set. " +
      "Add it to your .env.local (server-side, no NEXT_PUBLIC_ prefix)."
    );
  }
  return key;
}

// ============================================================================
// Types
// ============================================================================

export interface StockVideoResult {
  id: string;
  provider: "pexels" | "pixabay" | "shutterstock";
  title: string;
  thumbnailUrl: string;
  previewUrl: string; // low-res preview video URL
  downloadUrl: string; // full-res download URL
  duration: number; // seconds
  width: number;
  height: number;
  searchKeyword: string; // the keyword that found this
  relevanceScore: number; // 0-1, how well it matches
}

export interface StockSearchOptions {
  query: string;
  orientation?: "landscape" | "portrait" | "square";
  minDuration?: number;
  maxDuration?: number;
  perPage?: number;
  locale?: string;
}

export interface StockProviderConfig {
  pexels?: { apiKey: string; enabled: boolean };
  pixabay?: { apiKey: string; enabled: boolean };
  shutterstock?: { apiKey: string; apiSecret: string; enabled: boolean };
}

export interface StockSearchResponse {
  results: StockVideoResult[];
  provider: string;
  totalFound: number;
  query: string;
}

export interface ProviderConnectionTest {
  connected: boolean;
  error?: string;
}

// ============================================================================
// Pexels Implementation
// ============================================================================

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  video_files: Array<{
    id: number;
    quality: string;
    type: string;
    width: number;
    height: number;
    link: string;
  }>;
  preview?: string;
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
  total_results: number;
  page: number;
  per_page: number;
  next_page?: string;
}

async function searchPexels(
  query: string,
  apiKey: string,
  options: StockSearchOptions
): Promise<StockSearchResponse> {
  const params = new URLSearchParams();
  params.append("query", query);
  params.append("per_page", String(options.perPage || 15));

  if (options.orientation) {
    params.append("orientation", options.orientation);
  }

  const url = `https://api.pexels.com/videos/search?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Pexels API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as PexelsSearchResponse;

    const results: StockVideoResult[] = data.videos.map((video, index) => {
      // Find HD and preview video files
      const hdFile = video.video_files.find(
        (f) => f.quality === "hd" || f.quality === "sd"
      ) || video.video_files[0];
      const previewFile = video.video_files.find(
        (f) => f.quality === "preview"
      ) || video.video_files[0];

      // Relevance score: position in results descending (first result = 1.0)
      const relevanceScore = Math.max(0, 1 - index / Math.max(data.videos.length - 1, 1));

      return {
        id: `pexels_${video.id}`,
        provider: "pexels",
        title: query,
        thumbnailUrl: video.image,
        previewUrl: previewFile.link,
        downloadUrl: hdFile.link,
        duration: video.duration,
        width: video.width,
        height: video.height,
        searchKeyword: query,
        relevanceScore,
      };
    });

    return {
      results,
      provider: "pexels",
      totalFound: data.total_results,
      query,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(`Pexels search error: ${errorMessage}`);
    return {
      results: [],
      provider: "pexels",
      totalFound: 0,
      query,
    };
  }
}

// ============================================================================
// Pixabay Implementation
// ============================================================================

interface PixabayVideoFile {
  url: string;
  width: number;
  height: number;
}

interface PixabayVideo {
  id: number;
  pageURL: string;
  videos: {
    large: PixabayVideoFile;
    medium: PixabayVideoFile;
    small: PixabayVideoFile;
    tiny: PixabayVideoFile;
  };
  duration: number;
  picture_id: string;
  user_id: number;
  user: string;
  userImageURL: string;
}

interface PixabaySearchResponse {
  total: number;
  totalHits: number;
  hits: PixabayVideo[];
}

async function searchPixabay(
  query: string,
  apiKey: string,
  options: StockSearchOptions
): Promise<StockSearchResponse> {
  const params = new URLSearchParams();
  params.append("key", apiKey);
  params.append("q", query);
  params.append("per_page", String(options.perPage || 15));
  params.append("video", "true");

  if (options.orientation) {
    const pixabayOrientation =
      options.orientation === "portrait" ? "vertical" : "horizontal";
    params.append("orientation", pixabayOrientation);
  }

  const url = `https://pixabay.com/api/videos/?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Pixabay API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as PixabaySearchResponse;

    const results: StockVideoResult[] = data.hits.map((hit, index) => {
      // Relevance score: position in results descending
      const relevanceScore = Math.max(0, 1 - index / Math.max(data.hits.length - 1, 1));

      return {
        id: `pixabay_${hit.id}`,
        provider: "pixabay",
        title: query,
        thumbnailUrl: `https://i.pixabay.com/video/${hit.picture_id}-${hit.id}_medium.jpg`,
        previewUrl: hit.videos.medium.url,
        downloadUrl: hit.videos.large.url,
        duration: hit.duration,
        width: hit.videos.large.width,
        height: hit.videos.large.height,
        searchKeyword: query,
        relevanceScore,
      };
    });

    return {
      results,
      provider: "pixabay",
      totalFound: data.totalHits,
      query,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(`Pixabay search error: ${errorMessage}`);
    return {
      results: [],
      provider: "pixabay",
      totalFound: 0,
      query,
    };
  }
}

// ============================================================================
// Shutterstock Implementation (Stub)
// ============================================================================

async function searchShutterstock(
  query: string,
  _apiKey: string,
  _apiSecret: string,
  _options: StockSearchOptions
): Promise<StockSearchResponse> {
  console.log("Shutterstock integration coming soon");
  return {
    results: [],
    provider: "shutterstock",
    totalFound: 0,
    query,
  };
}

// ============================================================================
// Multi-Provider Search
// ============================================================================

export async function searchAllProviders(
  query: string,
  config: StockProviderConfig,
  options: StockSearchOptions
): Promise<StockVideoResult[]> {
  const searchPromises: Promise<StockSearchResponse>[] = [];

  // Queue enabled providers
  if (config.pexels?.enabled && config.pexels.apiKey) {
    searchPromises.push(searchPexels(query, config.pexels.apiKey, options));
  }

  if (config.pixabay?.enabled && config.pixabay.apiKey) {
    searchPromises.push(searchPixabay(query, config.pixabay.apiKey, options));
  }

  if (config.shutterstock?.enabled && config.shutterstock.apiKey && config.shutterstock.apiSecret) {
    searchPromises.push(
      searchShutterstock(
        query,
        config.shutterstock.apiKey,
        config.shutterstock.apiSecret,
        options
      )
    );
  }

  // Execute in parallel
  const responses = await Promise.all(searchPromises);

  // Merge all results
  const allResults: StockVideoResult[] = responses.flatMap((r) => r.results);

  // Deduplicate by video ID (within provider scope)
  const seenIds = new Set<string>();
  const deduplicated: StockVideoResult[] = [];

  for (const result of allResults) {
    if (!seenIds.has(result.id)) {
      seenIds.add(result.id);
      deduplicated.push(result);
    }
  }

  // Sort by relevance score (descending)
  deduplicated.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return deduplicated;
}

// ============================================================================
// Connection Testing
// ============================================================================

export async function testProviderConnection(
  provider: "pexels" | "pixabay" | "shutterstock",
  apiKey: string,
  apiSecret?: string
): Promise<ProviderConnectionTest> {
  try {
    if (provider === "pexels") {
      const response = await fetch("https://api.pexels.com/videos/popular?per_page=1", {
        headers: {
          Authorization: apiKey,
        },
      });

      if (!response.ok) {
        return {
          connected: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { connected: true };
    }

    if (provider === "pixabay") {
      const params = new URLSearchParams();
      params.append("key", apiKey);
      params.append("per_page", "1");
      params.append("video", "true");

      const response = await fetch(
        `https://pixabay.com/api/videos/?${params.toString()}`
      );

      if (!response.ok) {
        return {
          connected: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { connected: true };
    }

    if (provider === "shutterstock") {
      // Stub for Shutterstock
      return {
        connected: false,
        error: "Shutterstock integration not yet implemented",
      };
    }

    return {
      connected: false,
      error: "Unknown provider",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      connected: false,
      error: errorMessage,
    };
  }
}
