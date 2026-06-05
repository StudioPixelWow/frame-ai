/**
 * POST /api/creative-pixelai/refine
 * Body: { note: string, currentSettings: {...}, analysis?: {...} }
 *
 * Iterative refinement: the user writes feedback in Hebrew about the CURRENT
 * result ("התמונה גדולה מדי", "רקע בהיר יותר", "תוריד את זה למטה"...). The AI
 * translates the note into PARAMETER changes only — it never touches the
 * original creative (iron rule). The client applies the returned settings and
 * re-renders instantly on canvas.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export async function POST(req: NextRequest) {
  try {
    const { note, currentSettings, analysis } = (await req.json()) as {
      note?: string; currentSettings?: Record<string, unknown>; analysis?: Record<string, unknown>;
    };
    if (!note || !note.trim()) return NextResponse.json({ error: "note required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OpenAI לא מוגדר" }, { status: 503 });

    const sys = `אתה עוזר כוונון להתאמת קריאייטיב פרסומי. המשתמש נותן הערה על התוצאה הנוכחית,
ואתה מתרגם אותה לשינויי פרמטרים בלבד. חוקים:
- אסור להציע שינוי בתמונה המקורית, בטקסטים, בלוגו או בעיצוב — רק פרמטרים של ההתאמה.
- החזר JSON בלבד, רק שדות שצריך לשנות:
{
  "scaleMode": "fit | premium_center | fill_safe | top_focus | bottom_focus | manual",
  "background": "blurred | dominant_color | dark_gradient | light_gradient | brand_color",
  "padding": 0-200,
  "blurAmount": 10-80,
  "brightness": 0.4-1.2,
  "verticalOffset": -1 עד 1 (שלילי=למעלה, חיובי=למטה),
  "manualScale": 0.5-1.5 (רק יחד עם scaleMode=manual),
  "shadow": true/false,
  "roundedCorners": true/false,
  "explanation": "משפט קצר בעברית — מה שיניתי ולמה"
}
- "גדול/קטן יותר" ⇒ scaleMode=manual + manualScale יחסי לערך הנוכחי.
- "למעלה/למטה" ⇒ verticalOffset (או top_focus/bottom_focus אם ההערה חזקה).
- "בהיר/כהה" על הרקע ⇒ brightness או החלפת רקע.
- אם ניתוח הסיכון (riskLevel) הוא high — אל תציע fill_safe ואל תקטין padding מתחת ל-80.`;

    const user = `ההגדרות הנוכחיות: ${JSON.stringify(currentSettings || {})}
ניתוח הקריאייטיב: ${JSON.stringify({ riskLevel: (analysis as any)?.riskLevel, warnings: (analysis as any)?.warnings, recommendedPlacement: (analysis as any)?.recommendedPlacement })}
ההערה של המשתמש: "${note.trim()}"`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `OpenAI ${res.status}: ${t.slice(0, 120)}` }, { status: 502 });
    }

    const data = await res.json();
    let out: any = {};
    try { out = JSON.parse(data?.choices?.[0]?.message?.content || "{}"); } catch { out = {}; }

    // Server-side clamping — the AI can only move sliders within safe bounds.
    const settings: Record<string, unknown> = {};
    if (["fit", "premium_center", "fill_safe", "top_focus", "bottom_focus", "manual"].includes(out.scaleMode)) settings.scaleMode = out.scaleMode;
    if (["blurred", "dominant_color", "dark_gradient", "light_gradient", "brand_color"].includes(out.background)) settings.background = out.background;
    if (typeof out.padding === "number") settings.padding = Math.round(clamp(out.padding, 0, 200));
    if (typeof out.blurAmount === "number") settings.blurAmount = Math.round(clamp(out.blurAmount, 10, 80));
    if (typeof out.brightness === "number") settings.brightness = clamp(out.brightness, 0.4, 1.2);
    if (typeof out.verticalOffset === "number") settings.verticalOffset = clamp(out.verticalOffset, -1, 1);
    if (typeof out.manualScale === "number") settings.manualScale = clamp(out.manualScale, 0.5, 1.5);
    if (typeof out.shadow === "boolean") settings.shadow = out.shadow;
    if (typeof out.roundedCorners === "boolean") settings.roundedCorners = out.roundedCorners;

    // Iron rule: high-risk creatives never downgrade to crop-prone settings.
    if ((analysis as any)?.riskLevel === "high") {
      if (settings.scaleMode === "fill_safe") settings.scaleMode = "fit";
      if (typeof settings.padding === "number" && (settings.padding as number) < 80) settings.padding = 80;
    }

    return NextResponse.json({
      settings,
      explanation: typeof out.explanation === "string" ? out.explanation : "עודכן לפי ההערה",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
