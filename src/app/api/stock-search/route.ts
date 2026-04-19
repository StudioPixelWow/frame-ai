/**
 * GET /api/stock-search — Returns current stock provider connection status
 * POST /api/stock-search — Search stock video providers (Pexels, Pixabay, Shutterstock)
 *
 * Accepts:
 *   query: string — single search query
 *   queries: string[] — optional multiple queries (batch search)
 *   orientation: "landscape" | "portrait" | "square"
 *   minDuration: number (seconds)
 *   maxDuration: number (seconds)
 *   perPage: number (results per provider)
 *
 * Returns:
 *   results: StockVideoResult[]
 *   totalFound: number
 *   providersSearched: string[]
 *   query: string
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  searchAllProviders,
  getPexelsApiKey,
  StockProviderConfig,
  StockSearchOptions,
  StockVideoResult,
} from "@/lib/stock-media/providers";

import { DATA_DIR } from "@/lib/db/paths";
const STOCK_SETTINGS_FILE = join(DATA_DIR, "stock-settings.json");

// Default stock settings structure
const DEFAULT_SETTINGS: StockProviderConfig = {
  pexels: { apiKey: "", enabled: false },
  pixabay: { apiKey: "", enabled: false },
  shutterstock: { apiKey: "", apiSecret: "", enabled: false },
};

/**
 * Read stock media settings from file, then overlay Pexels key from env.
 * The env variable PEXELS_API_KEY always takes precedence over the JSON file.
 */
function readStockSettings(): StockProviderConfig {
  let base: StockProviderConfig;
  try {
    if (!existsSync(STOCK_SETTINGS_FILE)) {
      base = DEFAULT_SETTINGS;
    } else {
      const raw = readFileSync(STOCK_SETTINGS_FILE, "utf8");
      const data = JSON.parse(raw) as Partial<StockProviderConfig>;
      base = {
        pexels: data.pexels || DEFAULT_SETTINGS.pexels,
        pixabay: data.pixabay || DEFAULT_SETTINGS.pixabay,
        shutterstock: data.shutterstock || DEFAULT_SETTINGS.shutterstock,
      };
    }
  } catch (error) {
    console.error("[stock-search] Error reading settings:", error);
    base = DEFAULT_SETTINGS;
  }

  // ── Pexels: env variable overrides file-based key ──
  const envKey = getPexelsApiKey();
  if (envKey) {
    base.pexels = { apiKey: envKey, enabled: true };
  }

  return base;
}

/**
 * GET — Returns provider connection status (which providers are configured and enabled)
 */
export async function GET() {
  try {
    const settings = readStockSettings();
    const envKey = getPexelsApiKey();
    const status = {
      pexels: {
        enabled: settings.pexels?.enabled || false,
        configured: !!(settings.pexels?.apiKey && settings.pexels.enabled),
        source: envKey ? "env" : "settings-file",
      },
      pixabay: {
        enabled: settings.pixabay?.enabled || false,
        configured: !!(settings.pixabay?.apiKey && settings.pixabay.enabled),
      },
      shutterstock: {
        enabled: settings.shutterstock?.enabled || false,
        configured: !!(
          settings.shutterstock?.apiKey &&
          settings.shutterstock?.apiSecret &&
          settings.shutterstock.enabled
        ),
      },
    };

    return NextResponse.json(status);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to load provider status", details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST — Search stock providers
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      query,
      queries,
      orientation,
      minDuration = 3,
      maxDuration = 15,
      perPage = 5,
    } = body as {
      query?: string;
      queries?: string[];
      orientation?: "landscape" | "portrait" | "square";
      minDuration?: number;
      maxDuration?: number;
      perPage?: number;
    };

    // Validate input
    const searchQueries = queries && queries.length > 0 ? queries : [query];
    if (!searchQueries || searchQueries.length === 0 || !searchQueries[0]) {
      return NextResponse.json(
        { error: "query or queries parameter required" },
        { status: 400 }
      );
    }

    // Load provider config
    const settings = readStockSettings();

    // Check if any providers are configured
    const hasEnabledProviders =
      (settings.pexels?.enabled && settings.pexels.apiKey) ||
      (settings.pixabay?.enabled && settings.pixabay.apiKey) ||
      (settings.shutterstock?.enabled &&
        settings.shutterstock.apiKey &&
        settings.shutterstock.apiSecret);

    if (!hasEnabledProviders) {
      return NextResponse.json({
        results: [],
        totalFound: 0,
        providersSearched: [],
        query: searchQueries[0],
        error: "no_providers_configured",
      });
    }

    // Build search options
    const searchOptions: StockSearchOptions = {
      query: "", // will be set per query
      orientation,
      minDuration,
      maxDuration,
      perPage,
    };

    // Search all queries and collect results
    const allResults: StockVideoResult[] = [];
    const providersSearched = new Set<string>();

    for (const q of searchQueries) {
      if (!q) continue;
      try {
        const results = await searchAllProviders(
          q,
          settings,
          searchOptions
        );

        // Track which providers were searched
        if (results.length > 0) {
          results.forEach((r) => providersSearched.add(r.provider));
        }

        // Add to all results (will deduplicate across queries)
        allResults.push(...results);
      } catch (error) {
        console.error(`[stock-search] Error searching query "${q}":`, error);
      }
    }

    // Deduplicate by provider+id across all queries
    const seenIds = new Set<string>();
    const deduplicatedResults: StockVideoResult[] = [];

    for (const result of allResults) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        deduplicatedResults.push(result);
      }
    }

    // Sort by relevance score descending
    deduplicatedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return NextResponse.json({
      results: deduplicatedResults,
      totalFound: deduplicatedResults.length,
      providersSearched: Array.from(providersSearched),
      query: searchQueries.join(", "),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[stock-search] POST error:", errorMessage);
    return NextResponse.json(
      { error: "Search failed", details: errorMessage },
      { status: 500 }
    );
  }
}
