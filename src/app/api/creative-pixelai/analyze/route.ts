/**
 * POST /api/creative-pixelai/analyze
 * Body: { imageUrl: string, width: number, height: number }
 *
 * OpenAI is used for ANALYSIS ONLY (vision → JSON decisions). It never generates
 * or redraws imagery — execution is pure canvas/image processing on the client.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCHEMA_HINT = `{
  "imageType": "real_estate_ad | social_post | event_ad | product_ad | general_design",
  "composition": "centered | top_heavy | bottom_heavy | split | full_bleed | minimal",
  "mainContentBox": { "x": 0, "y": 0, "width": 0, "height": 0 },
  "importantTextAreas": [ { "x": 0, "y": 0, "width": 0, "height": 0, "importance": "high | medium | low" } ],
  "logoAreas": [ { "x": 0, "y": 0, "width": 0, "height": 0 } ],
  "hasPhoneNumber": true,
  "hasPrice": true,
  "hasCTA": true,
  "recommendedPlacement": "top | center | bottom",
  "recommendedScaleMode": "fit | premium_center | fill_safe",
  "recommendedBackground": "blurred | dominant_color | dark_gradient | light_gradient",
  "recommendedPadding": 80,
  "dominantColors": ["#000000", "#ffffff"],
  "riskLevel": "low | medium | high",
  "warnings": ["..."]
}`;

function fallbackAnalysis(width: number, height: number) {
  return {
    imageType: "general_design",
    composition: "centered",
    mainContentBox: { x: 0, y: 0, width, height },
    importantTextAreas: [],
    logoAreas: [],
    hasPhoneNumber: false,
    hasPrice: false,
    hasCTA: false,
    recommendedPlacement: "center",
    recommendedScaleMode: "fit",
    recommendedBackground: "blurred",
    recommendedPadding: 80,
    dominantColors: [],
    riskLevel: "high", // unknown ⇒ act safe: full fit, no cropping
    warnings: ["הניתוח האוטומטי לא היה זמין — המערכת עברה למצב בטוח (Fit מלא, ללא חיתוך)"],
    _fallback: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, width, height } = (await req.json()) as { imageUrl?: string; width?: number; height?: number };
    if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ analysis: fallbackAnalysis(width || 0, height || 0), fallback: true });
    }

    const sys = `אתה מנתח קריאייטיבים פרסומיים. אתה מחזיר JSON בלבד, ללא markdown וללא הסברים.
אסור לך להציע שינוי בעיצוב, בטקסט או בלוגו — תפקידך רק ניתוח והמלצות מיקום/רקע/Padding.
כל הקואורדינטות בפיקסלים של התמונה המקורית (רוחב ${width || "?"}, גובה ${height || "?"}).
החזר JSON בדיוק לפי הסכמה:\n${SCHEMA_HINT}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: "נתח את הקריאייטיב הבא והחזר JSON לפי הסכמה. שים לב במיוחד לטקסטים, מחיר, טלפון, CTA ולוגו וקרבתם לשוליים." },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const t = await res.text();
      console.warn("[creative-pixelai/analyze] OpenAI error:", res.status, t.slice(0, 200));
      return NextResponse.json({ analysis: fallbackAnalysis(width || 0, height || 0), fallback: true });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    let analysis: any = null;
    try { analysis = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { analysis = JSON.parse(m[0]); } catch { /* noop */ } }
    }
    if (!analysis || typeof analysis !== "object") {
      return NextResponse.json({ analysis: fallbackAnalysis(width || 0, height || 0), fallback: true });
    }

    // Normalize critical fields so the client can rely on them.
    analysis.riskLevel = ["low", "medium", "high"].includes(analysis.riskLevel) ? analysis.riskLevel : "medium";
    analysis.recommendedScaleMode = ["fit", "premium_center", "fill_safe"].includes(analysis.recommendedScaleMode) ? analysis.recommendedScaleMode : "fit";
    analysis.recommendedBackground = ["blurred", "dominant_color", "dark_gradient", "light_gradient"].includes(analysis.recommendedBackground) ? analysis.recommendedBackground : "blurred";
    analysis.recommendedPadding = Number(analysis.recommendedPadding) || 80;
    analysis.warnings = Array.isArray(analysis.warnings) ? analysis.warnings : [];
    analysis.importantTextAreas = Array.isArray(analysis.importantTextAreas) ? analysis.importantTextAreas : [];
    analysis.logoAreas = Array.isArray(analysis.logoAreas) ? analysis.logoAreas : [];
    analysis.dominantColors = Array.isArray(analysis.dominantColors) ? analysis.dominantColors : [];

    // IRON RULE enforcement: high risk ⇒ never crop.
    if (analysis.riskLevel === "high") {
      analysis.recommendedScaleMode = "fit";
      analysis.recommendedPadding = Math.max(analysis.recommendedPadding, 100);
    }

    return NextResponse.json({ analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[creative-pixelai/analyze] threw:", msg);
    return NextResponse.json({ analysis: fallbackAnalysis(0, 0), fallback: true, error: msg });
  }
}
