/**
 * POST /api/stock-search/test — Test connection to a specific stock provider
 *
 * Accepts:
 *   provider: "pexels" | "pixabay" | "shutterstock"
 *   apiKey: string
 *   apiSecret?: string (required for Shutterstock)
 *
 * Returns:
 *   connected: boolean
 *   error?: string
 *   provider: string
 */

import { NextRequest, NextResponse } from "next/server";
import { testProviderConnection } from "@/lib/stock-media/providers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, apiKey, apiSecret } = body as {
      provider: "pexels" | "pixabay" | "shutterstock";
      apiKey: string;
      apiSecret?: string;
    };

    // Validate input
    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "provider and apiKey are required" },
        { status: 400 }
      );
    }

    if (!["pexels", "pixabay", "shutterstock"].includes(provider)) {
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
    }

    if (provider === "shutterstock" && !apiSecret) {
      return NextResponse.json(
        { error: "apiSecret is required for Shutterstock" },
        { status: 400 }
      );
    }

    // Test the connection
    const result = await testProviderConnection(provider, apiKey, apiSecret);

    return NextResponse.json({
      provider,
      connected: result.connected,
      error: result.error,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[stock-search/test] Error:", errorMessage);
    return NextResponse.json(
      { error: "Test failed", details: errorMessage },
      { status: 500 }
    );
  }
}
