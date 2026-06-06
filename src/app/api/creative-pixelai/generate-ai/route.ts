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

// Supported gpt-image sizes chosen to MINIMIZE the cover-crop into each output:
//   square 1:1   → 1024x1024 (exact, no crop)
//   feed 4:5 0.8 → 1024x1024 (crops only narrow side bands, never top/bottom text)
//   story 9:16   → 1024x1536 (portrait; crops side bands)
const GEN_SIZE: Record<string, string> = {
  story: "1024x1536",
  feed_4_5: "1024x1024",
  square: "1024x1024",
};

const FORMAT_DESC: Record<string, string> = {
  story: "a vertical 9:16 Instagram Story (1080x1920)",
  feed_4_5: "a vertical 4:5 Instagram/Facebook feed post (1080x1350)",
  square: "a square 1:1 post (1080x1080)",
};

/** Transcribe ALL text in the ad — feeding exact text via the PROMPT renders far
 *  more accurately than asking the model to copy text from pixels. */
async function transcribeAdText(apiKey: string, imageDataUrl: string): Promise<string> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0,
        max_tokens: 500,
        messages: [
          { role: "system", content: "תמלל את כל הטקסטים שמופיעים במודעה, שורה-שורה, בדיוק תו-בתו (עברית RTL, מספרים, סימנים). החזר רק את הטקסטים, כל פריט בשורה משלו. אל תוסיף הסברים." },
          { role: "user", content: [{ type: "image_url", image_url: { url: imageDataUrl, detail: "high" } }] },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content || "").trim();
  } catch { return ""; }
}

export async function POST(req: NextRequest) {
  try {
    const { imagePng, format, prompt, mode, quality } = (await req.json()) as { imagePng?: string; format?: string; prompt?: string; mode?: string; quality?: string };
    if (!imagePng || !format || !GEN_SIZE[format]) {
      return NextResponse.json({ error: "imagePng + valid format required" }, { status: 400 });
    }
    if (mode === "edit" && !(prompt || "").trim()) {
      return NextResponse.json({ error: "כתוב מה לתקן" }, { status: 400 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OpenAI לא מוגדר" }, { status: 503 });

    const b64 = imagePng.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(b64, "base64");
    if (buf.length > 20 * 1024 * 1024) return NextResponse.json({ error: "תמונה גדולה מדי" }, { status: 400 });

    const styleExtra = prompt && prompt.trim() ? ` Style guidance: ${prompt.trim()}.` : "";

    // For redesign: transcribe the exact ad texts first and feed them in the prompt —
    // dramatically improves Hebrew text fidelity in the generated result.
    const adTexts = mode === "redesign" ? await transcribeAdText(apiKey, imagePng) : "";

    // The generation is cover-cropped into the exact output ratio. Tell the model
    // to keep big EMPTY background margins on the axis that gets cropped, so no
    // text/logo is ever lost. 4:5 crops the sides → demand 20% side margins.
    const safeMargin =
      format === "feed_4_5"
        ? " קריטי ביותר: השאר רצועת רקע ריקה (בלי טקסט, בלי לוגו) ברוחב 20% בצד ימין וברוחב 20% בצד שמאל של המסגרת. כל הטקסטים, המחירים והלוגואים חייבים להיות אך ורק ב-60% המרכזיים. הצדדים ייחתכו — אסור ששום טקסט יהיה שם."
        : format === "story"
        ? " קריטי: השאר שוליי רקע ריקים של 12% בצד ימין ובצד שמאל; כל הטקסטים והלוגואים במרכז בלבד. הצדדים ייחתכו מעט."
        : "";

    const genPrompt = mode === "edit"
      // TARGETED EDIT of an existing generated version — ChatGPT-style iteration.
      // The user's note arrives in `prompt`; everything else must stay identical.
      ? `בצע את התיקון הבא על העיצוב: "${(prompt || "").trim()}". ` +
        `שמור על כל שאר העיצוב בדיוק כפי שהוא — אותם טקסטים אות-באות, אותם מספרים ומחירים, אותם לוגואים, אותם צבעים ואותה פריסה. ` +
        `שנה אך ורק את מה שהתבקש בתיקון.`
      : mode === "redesign"
      ? `תתאים את המודעה הזאת בדיוק לפורמט ${format === "story" ? "סטורי אנכי 9:16" : format === "feed_4_5" ? "פיד אנכי 4:5" : "ריבועי 1:1"}. ` +
        `זו אותה מודעה — שמור אחד-לאחד על כל הטקסטים, המספרים, המחירים, הלוגואים, הצבעים והפונטים בדיוק כפי שהם. ` +
        `הרחב את הצילום ופרוס את האלמנטים מחדש כך שימלאו את כל הפורמט בצורה מקצועית ויפה. אל תוסיף טקסט או אלמנט חדש.` +
        (adTexts ? `\n\nאלו הטקסטים המדויקים במודעה — העתק אותם אות-באות, בדיוק כך:\n${adTexts}` : "") +
        safeMargin + styleExtra
      // OUTPAINT (1:1) — the original spans the full width; fill ONLY the missing
      // strips above/below so the result reads as one native full-bleed design.
      : "Seamlessly extend this advertisement vertically to fill the transparent strips above and below it. " +
        "Above: continue the photograph naturally (sky, architecture, lighting — exactly matching perspective and tones). " +
        "Below: continue the design panel exactly — same solid colors, same gradient, as if the panel simply continues. " +
        "The result must look like ONE single full-bleed design with invisible seams. " +
        "STRICT: do NOT add any text, letters, numbers, logos, watermarks, people or new graphic elements. " +
        "Do NOT modify the existing artwork pixels — only fill the empty transparent areas." +
        (prompt && prompt.trim() ? ` Style guidance: ${prompt.trim()}.` : "");

    const buildForm = (model: string, withFidelity: boolean) => {
      const fd = new FormData();
      fd.append("model", model);
      fd.append("image", new Blob([new Uint8Array(buf)], { type: "image/png" }), "input.png");
      fd.append("prompt", genPrompt);
      fd.append("size", GEN_SIZE[format]);
      // "medium" is 2-3x faster than "high" — default keeps us inside the
      // serverless time budget; "high" available via the UI toggle.
      fd.append("quality", quality === "high" ? "high" : "medium");
      fd.append("n", "1");
      if (withFidelity) fd.append("input_fidelity", "high");
      return fd;
    };

    const callEdits = (form: FormData) => fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(110000),
    });

    // Try GPT Image 2 (ChatGPT Images 2.0 model) first; on ANY failure, fall back
    // to gpt-image-1 (+input_fidelity, then without it). Robust to accounts that
    // don't have image-2 access yet.
    let res = await callEdits(buildForm("gpt-image-2", false));
    if (!res.ok) {
      const firstErr = await res.clone().text();
      console.warn("[generate-ai] gpt-image-2 failed:", res.status, firstErr.slice(0, 200), "— trying gpt-image-1");
      res = await callEdits(buildForm("gpt-image-1", true));
      if (res.status === 400) {
        const t2 = await res.clone().text();
        if (t2.includes("input_fidelity")) res = await callEdits(buildForm("gpt-image-1", false));
      }
    }

    if (!res.ok) {
      const t = await res.text();
      console.error("[generate-ai] OpenAI error:", res.status, t.slice(0, 300));
      let friendly = `שגיאת OpenAI (${res.status})`;
      if (/must be verified|verify your organization|organization/i.test(t)) {
        friendly = "הארגון ב-OpenAI לא מאומת ליצירת תמונות — היכנס ל-platform.openai.com → Settings → Organization → Verify, ונסה שוב.";
      } else if (/content_policy|safety|rejected/i.test(t)) {
        friendly = "OpenAI דחה את התמונה מסיבות מדיניות תוכן. נסה תמונה אחרת או נסח את ההערה אחרת.";
      } else if (t.length) {
        friendly = "OpenAI: " + t.slice(0, 160);
      }
      return NextResponse.json({ error: friendly }, { status: 502 });
    }

    const data = await res.json().catch(() => null);
    const outB64 = data?.data?.[0]?.b64_json;
    if (!outB64) return NextResponse.json({ error: "לא התקבלה תמונה מ-OpenAI — נסה שוב" }, { status: 502 });

    const resultImage = `data:image/png;base64,${outB64}`;

    // ── Text-fidelity verification (redesign): read the generated text and compare
    // to the original. Flags invented / changed / missing text so nothing wrong
    // reaches publication unnoticed. (outpaint mode is pixel-perfect — no check.) ──
    let textCheck: { ok: boolean; missing: string[]; original: string; generated: string } | null = null;
    if (mode === "redesign" && adTexts) {
      const generated = await transcribeAdText(apiKey, resultImage);
      if (generated) {
        const norm = (s: string) => s.replace(/[\s‏‎.,'"׳״!?|/\\\-–—()]/g, "").toLowerCase();
        const genNorm = norm(generated);
        const missing = adTexts
          .split("\n").map((l) => l.trim()).filter((l) => norm(l).length >= 3)
          .filter((line) => !genNorm.includes(norm(line)));
        textCheck = { ok: missing.length === 0, missing: missing.slice(0, 12), original: adTexts, generated };
      }
    }

    return NextResponse.json({ image: resultImage, textCheck });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (/abort|timeout/i.test(msg)) {
      return NextResponse.json({
        error: "היצירה ארכה יותר מדי וההמתנה נקטעה. נסה שוב (לרוב מהיר יותר). אם זה חוזר — ב-Vercel: Settings → Functions → הפעל Fluid Compute / הגדל Max Duration.",
      }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
