/**
 * GET /api/stock-search/settings — Read stock settings (with masked API keys)
 * POST /api/stock-search/settings — Save new stock settings
 *
 * GET Response:
 *   pexels: { apiKey: string (masked), enabled: boolean }
 *   pixabay: { apiKey: string (masked), enabled: boolean }
 *   shutterstock: { apiKey: string (masked), apiSecret: string (masked), enabled: boolean }
 *
 * POST Accepts:
 *   pexels?: { apiKey?: string, enabled?: boolean }
 *   pixabay?: { apiKey?: string, enabled?: boolean }
 *   shutterstock?: { apiKey?: string, apiSecret?: string, enabled?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { StockProviderConfig } from "@/lib/stock-media/providers";

const DATA_DIR = join(process.cwd(), ".frameai", "data");
const STOCK_SETTINGS_FILE = join(DATA_DIR, "stock-settings.json");

// Default stock settings structure
const DEFAULT_SETTINGS: StockProviderConfig = {
  pexels: { apiKey: "", enabled: false },
  pixabay: { apiKey: "", enabled: false },
  shutterstock: { apiKey: "", apiSecret: "", enabled: false },
};

/**
 * Ensure data directory exists
 */
function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Read stock media settings from file
 */
function readStockSettings(): StockProviderConfig {
  try {
    if (!existsSync(STOCK_SETTINGS_FILE)) {
      return DEFAULT_SETTINGS;
    }
    const raw = readFileSync(STOCK_SETTINGS_FILE, "utf8");
    const data = JSON.parse(raw) as Partial<StockProviderConfig>;
    return {
      pexels: data.pexels || DEFAULT_SETTINGS.pexels,
      pixabay: data.pixabay || DEFAULT_SETTINGS.pixabay,
      shutterstock: data.shutterstock || DEFAULT_SETTINGS.shutterstock,
    };
  } catch (error) {
    console.error("[stock-search/settings] Error reading settings:", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Write stock media settings to file
 */
function writeStockSettings(settings: StockProviderConfig): void {
  ensureDir();
  writeFileSync(STOCK_SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
}

/**
 * Mask API key for display (show first 4 and last 4 characters)
 */
function maskKey(key: string): string {
  if (!key || key.length < 8) {
    return key ? "••••" : "";
  }
  return (
    key.substring(0, 4) +
    "•".repeat(Math.min(key.length - 8, 20)) +
    key.substring(key.length - 4)
  );
}

/**
 * GET — Read stock settings (with masked API keys)
 */
export async function GET() {
  try {
    const settings = readStockSettings();

    return NextResponse.json({
      pexels: {
        apiKey: maskKey(settings.pexels?.apiKey || ""),
        enabled: settings.pexels?.enabled || false,
      },
      pixabay: {
        apiKey: maskKey(settings.pixabay?.apiKey || ""),
        enabled: settings.pixabay?.enabled || false,
      },
      shutterstock: {
        apiKey: maskKey(settings.shutterstock?.apiKey || ""),
        apiSecret: maskKey(settings.shutterstock?.apiSecret || ""),
        enabled: settings.shutterstock?.enabled || false,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[stock-search/settings] GET error:", errorMessage);
    return NextResponse.json(
      { error: "Failed to load settings", details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST — Save new stock settings
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pexels, pixabay, shutterstock } = body as {
      pexels?: { apiKey?: string; enabled?: boolean };
      pixabay?: { apiKey?: string; enabled?: boolean };
      shutterstock?: { apiKey?: string; apiSecret?: string; enabled?: boolean };
    };

    // Read current settings
    const current = readStockSettings();

    // Merge with updates (only update fields that are explicitly provided)
    const updated: StockProviderConfig = {
      pexels: pexels
        ? {
            apiKey:
              pexels.apiKey !== undefined
                ? pexels.apiKey
                : current.pexels?.apiKey || "",
            enabled:
              pexels.enabled !== undefined
                ? pexels.enabled
                : current.pexels?.enabled || false,
          }
        : current.pexels || DEFAULT_SETTINGS.pexels,
      pixabay: pixabay
        ? {
            apiKey:
              pixabay.apiKey !== undefined
                ? pixabay.apiKey
                : current.pixabay?.apiKey || "",
            enabled:
              pixabay.enabled !== undefined
                ? pixabay.enabled
                : current.pixabay?.enabled || false,
          }
        : current.pixabay || DEFAULT_SETTINGS.pixabay,
      shutterstock: shutterstock
        ? {
            apiKey:
              shutterstock.apiKey !== undefined
                ? shutterstock.apiKey
                : current.shutterstock?.apiKey || "",
            apiSecret:
              shutterstock.apiSecret !== undefined
                ? shutterstock.apiSecret
                : current.shutterstock?.apiSecret || "",
            enabled:
              shutterstock.enabled !== undefined
                ? shutterstock.enabled
                : current.shutterstock?.enabled || false,
          }
        : current.shutterstock || DEFAULT_SETTINGS.shutterstock,
    };

    // Write to file
    writeStockSettings(updated);

    // Return masked response
    return NextResponse.json({
      pexels: {
        apiKey: maskKey(updated.pexels?.apiKey || ""),
        enabled: updated.pexels?.enabled || false,
      },
      pixabay: {
        apiKey: maskKey(updated.pixabay?.apiKey || ""),
        enabled: updated.pixabay?.enabled || false,
      },
      shutterstock: {
        apiKey: maskKey(updated.shutterstock?.apiKey || ""),
        apiSecret: maskKey(updated.shutterstock?.apiSecret || ""),
        enabled: updated.shutterstock?.enabled || false,
      },
      success: true,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[stock-search/settings] POST error:", errorMessage);
    return NextResponse.json(
      { error: "Failed to save settings", details: errorMessage },
      { status: 500 }
    );
  }
}
