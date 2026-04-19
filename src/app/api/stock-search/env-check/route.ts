/**
 * GET /api/stock-search/env-check
 *
 * Lightweight diagnostic — checks whether the Pexels integration
 * is wired up correctly without making any external API calls.
 *
 * Returns:
 *   { pexels: { keyPresent: boolean, providerResolved: boolean } }
 */

import { NextResponse } from "next/server";
import { getPexelsApiKey } from "@/lib/stock-media/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = getPexelsApiKey();
  const keyPresent = key.length > 0;

  // "Provider resolved" means we have the key AND it looks like a real key
  // (Pexels keys are typically 40+ chars of alphanumeric)
  const providerResolved = keyPresent && key.length >= 20;

  return NextResponse.json({
    pexels: {
      keyPresent,
      providerResolved,
    },
  });
}
