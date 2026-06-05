/**
 * POST /api/creative-pixelai/generate-ai
 * Body: { imagePng: base64 (the original placed on a transparent canvas at the
 *         generation size), format: "story"|"feed_4_5"|"square", prompt?: string }
 *
 * AI background generation (gpt-image-1 outpainting): the model fills ONLY the
 * transparent surroundings, continuing the scene to the full ad size. The client
 * then composites the ORIGINAL creative back on top pixel-perfect — so text,
 * prices, phone numbers and logos are guaranteed untouched.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// gpt-image-1 supported sizes
const GEN_SIZE: Record<string, string> = {
  story: "1024x1536",
  feed_4_5: "1024x1536",
  square: "1024x1024",
};

export async function POST(req: NextRequest) {
  try {
    const { imagePng, format, prompt } = (await req.json()) as { imagePng?: string; format?: string; prompt?: string };
    if (!imagePng || !format || !GEN_SIZE[format]) {
      return NextResponse.json({ error: "imagePng + valid format required" }, { status: 400 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OpenAI לא מוגדר" }, { status: 503 });

    const b64 = imagePng.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(b64, "base64");
    if (buf.length > 20 * 1024 * 1024) return NextResponse.json({ error: "תמונה גדולה מדי" }, { status: 400 });

    const genPrompt = (prompt && prompt.trim()) ||
      "Extend the advertisement's background to fill the entire transparent area naturally and seamlessly. " +
      "Continue the existing scenery, lighting, colors and atmosphere of the artwork (sky, buildings, environment, textures). " +
      "Premium, clean, modern advertising look. " +
      "STRICT: do NOT add any text, letters, numbers, logos, watermarks, people or new graphic elements. " +
      "Do NOT modify the existing artwork pixels — only fill the empty transparent areas around it.";

    const fd = new FormData();
    fd.append("model", "gpt-image-1");
    fd.append("image", new Blob([new Uint8Array(buf)], { type: "image/png" }), "input.png");
    fd.append("prompt", genPrompt);
    fd.append("size", GEN_SIZE[format]);
    fd.append("quality", "high");
    fd.append("n", "1");

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
      signal: AbortSignal.timeout(110000),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("[generate-ai] OpenAI error:", res.status, t.slice(0, 300));
      let friendly = `OpenAI ${res.status}`;
      if (t.includes("must be verified") || t.includes("organization")) {
        friendly = "הארגון ב-OpenAI לא מאומת ליצירת תמונות — היכנס ל-platform.openai.com → Settings → Organization → Verify";
      } else if (res.status === 400) {
        friendly = "OpenAI דחה את הבקשה: " + t.slice(0, 160);
      }
      return NextResponse.json({ error: friendly }, { status: 502 });
    }

    const data = await res.json();
    const outB64 = data?.data?.[0]?.b64_json;
    if (!outB64) return NextResponse.json({ error: "לא התקבלה תמונה מ-OpenAI" }, { status: 502 });

    return NextResponse.json({ image: `data:image/png;base64,${outB64}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
