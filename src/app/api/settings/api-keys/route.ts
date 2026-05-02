/**
 * GET /api/settings/api-keys — Returns masked keys and connection status
 * POST /api/settings/api-keys — Save API keys
 * PUT /api/settings/api-keys — Test connection for a specific provider
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiKeys, saveApiKeys, maskKey, getApiKeyStatus } from "@/lib/db/api-keys";

export async function GET() {
  try {
    const keys = getApiKeys();
    const status = getApiKeyStatus();
    return NextResponse.json({
      assemblyai: { masked: maskKey(keys.assemblyai), connected: status.assemblyai },
      openai: { masked: maskKey(keys.openai), connected: status.openai },
      updatedAt: keys.updatedAt,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { assemblyai, openai } = body as { assemblyai?: string; openai?: string };

    const updated = saveApiKeys({
      ...(assemblyai !== undefined ? { assemblyai } : {}),
      ...(openai !== undefined ? { openai } : {}),
    });

    const status = getApiKeyStatus();
    return NextResponse.json({
      assemblyai: { masked: maskKey(updated.assemblyai), connected: status.assemblyai },
      openai: { masked: maskKey(updated.openai), connected: status.openai },
      updatedAt: updated.updatedAt,
      success: true,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save API keys" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider } = body as { provider: "assemblyai" | "openai" };

    const keys = getApiKeys();
    const key = provider === "assemblyai" ? keys.assemblyai : keys.openai;

    if (!key) {
      return NextResponse.json({
        provider, valid: false, error: "מפתח API לא הוגדר"
      });
    }

    // Test AssemblyAI
    if (provider === "assemblyai") {
      try {
        const res = await fetch("https://api.assemblyai.com/v2/transcript", {
          method: "POST",
          headers: {
            "Authorization": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ audio_url: "https://storage.googleapis.com/aai-web-samples/5_common_sports_702.mp3" }),
        });
        // If we get 401, key is invalid. Any other response means the key works.
        if (res.status === 401) {
          return NextResponse.json({ provider, valid: false, error: "מפתח לא תקין" });
        }
        // Cancel the test transcript immediately
        const data = await res.json();
        if (data.id) {
          await fetch(`https://api.assemblyai.com/v2/transcript/${data.id}`, {
            method: "DELETE",
            headers: { "Authorization": key },
          }).catch(() => {});
        }
        return NextResponse.json({ provider, valid: true, message: "חיבור תקין" });
      } catch (e) {
        return NextResponse.json({ provider, valid: false, error: "שגיאת רשת — לא ניתן להתחבר ל-AssemblyAI" });
      }
    }

    // Test OpenAI
    if (provider === "openai") {
      try {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { "Authorization": `Bearer ${key}` },
        });
        if (res.status === 401) {
          return NextResponse.json({ provider, valid: false, error: "מפתח לא תקין" });
        }
        return NextResponse.json({ provider, valid: true, message: "חיבור תקין" });
      } catch (e) {
        return NextResponse.json({ provider, valid: false, error: "שגיאת רשת — לא ניתן להתחבר ל-OpenAI" });
      }
    }

    return NextResponse.json({ provider, valid: false, error: "ספק לא מוכר" });
  } catch (err) {
    return NextResponse.json({ error: "Test connection failed" }, { status: 500 });
  }
}
