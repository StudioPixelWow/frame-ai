/**
 * GET /api/settings/api-keys/status — Quick status check (no masked keys)
 */

import { NextResponse } from "next/server";
import { getApiKeyStatus } from "@/lib/db/api-keys";

export async function GET() {
  try {
    const status = getApiKeyStatus();
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ assemblyai: false, openai: false });
  }
}
