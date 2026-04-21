/**
 * POST /api/ai/campaign-copy
 *
 * Generates improved ad copy or creates variations for campaign text.
 * Uses the existing OpenAI integration + client knowledge context.
 *
 * Request body:
 *   {
 *     mode: 'improve' | 'variations',
 *     field: 'caption' | 'headline',
 *     currentText: string,
 *     context: {
 *       clientId: string,
 *       clientName: string,
 *       businessField?: string,
 *       campaignType: string,
 *       platform: string,
 *       mediaType?: string,
 *       adFormat?: string,
 *     }
 *   }
 *
 * Response:
 *   { results: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { generateWithAI, getClientKnowledgeContext } from "@/lib/ai/openai-client";

export const runtime = "nodejs";

const PLATFORM_NAMES: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  multi_platform: "מולטי-פלטפורמה",
};

const GOAL_NAMES: Record<string, string> = {
  lead_gen: "לידים",
  paid_social: "תנועה לאתר",
  awareness: "מודעות למותג",
  remarketing: "מכירות/רימרקטינג",
  organic_social: "תוכן אורגני",
  podcast_promo: "קידום פודקאסט",
  custom: "קמפיין מותאם",
};

interface RequestBody {
  mode: "improve" | "variations";
  field: "caption" | "headline";
  currentText: string;
  context: {
    clientId: string;
    clientName: string;
    businessField?: string;
    campaignType: string;
    platform: string;
    mediaType?: string;
    adFormat?: string;
  };
}

export async function POST(req: NextRequest) {
  const tag = "[/api/ai/campaign-copy]";
  const t0 = Date.now();

  try {
    const body: RequestBody = await req.json();
    const { mode, field, currentText, context } = body;

    if (!context?.clientId || !context?.platform || !context?.campaignType) {
      return NextResponse.json(
        { error: "Missing required context fields" },
        { status: 400 }
      );
    }

    // Build client knowledge context
    let knowledgeCtx = "";
    try {
      knowledgeCtx = await getClientKnowledgeContext(context.clientId);
    } catch {
      console.warn(`${tag} Could not load client knowledge for ${context.clientId}`);
    }

    const platformName = PLATFORM_NAMES[context.platform] || context.platform;
    const goalName = GOAL_NAMES[context.campaignType] || context.campaignType;
    const fieldHebrew = field === "caption" ? "טקסט ראשי (Primary Text)" : "כותרת (Headline)";
    const maxLen = field === "caption" ? 500 : 80;
    const count = mode === "variations" ? 3 : 1;

    const systemPrompt = `אתה קופירייטר מומחה לפרסום דיגיטלי בעברית. אתה כותב טקסטים שיווקיים שממירים לקמפיינים ברשתות חברתיות.

כללים:
- כתוב בעברית טבעית, חזקה, ומקצועית
- התאם את הטון לפלטפורמה (${platformName})
- התאם למטרת הקמפיין (${goalName})
- ${field === "caption" ? "טקסט ראשי — עד 500 תווים, פסקה אחת או שתיים, עם הנעה לפעולה" : "כותרת — עד 80 תווים, קצרה, חדה, מושכת תשומת לב"}
- אל תשתמש בהאשטגים בתוך הטקסט
- אל תוסיף אימוג'ים אלא אם זה מתאים לפלטפורמה
- השתמש בידע על הלקוח אם זמין

${knowledgeCtx ? `מידע על הלקוח:\n${knowledgeCtx}` : ""}`;

    let userPrompt: string;

    if (mode === "improve" && currentText.trim()) {
      userPrompt = `שפר את ה${fieldHebrew} הבא עבור קמפיין ${goalName} ב-${platformName} עבור "${context.clientName}"${context.businessField ? ` (תחום: ${context.businessField})` : ""}:

"${currentText}"

שמור על המסר המרכזי אבל הפוך אותו לחזק יותר, ברור יותר, וממיר יותר.
עד ${maxLen} תווים.

החזר JSON בפורמט: { "results": ["גרסה משופרת"] }`;
    } else if (mode === "variations") {
      const base = currentText.trim()
        ? `צור ${count} גרסאות שונות ל${fieldHebrew} הבא:\n\n"${currentText}"\n\nכל גרסה צריכה לשמור על המסר המרכזי אבל לגשת אליו מזווית אחרת.`
        : `צור ${count} גרסאות של ${fieldHebrew} עבור קמפיין ${goalName} ב-${platformName} עבור "${context.clientName}"${context.businessField ? ` (תחום: ${context.businessField})` : ""}.`;

      userPrompt = `${base}

כל גרסה עד ${maxLen} תווים.
${context.mediaType ? `סוג מדיה: ${context.mediaType}` : ""}
${context.adFormat ? `פורמט: ${context.adFormat}` : ""}

החזר JSON בפורמט: { "results": ["גרסה 1", "גרסה 2", "גרסה 3"] }`;
    } else {
      // Generate from scratch (no existing text, improve mode)
      userPrompt = `כתוב ${fieldHebrew} עבור קמפיין ${goalName} ב-${platformName} עבור "${context.clientName}"${context.businessField ? ` (תחום: ${context.businessField})` : ""}.

עד ${maxLen} תווים. ממיר, חזק, מקצועי.
${context.mediaType ? `סוג מדיה: ${context.mediaType}` : ""}

החזר JSON בפורמט: { "results": ["הטקסט"] }`;
    }

    console.log(`${tag} Generating ${mode} for ${field} (client: ${context.clientName}, platform: ${platformName})`);

    const aiResult = await generateWithAI(systemPrompt, userPrompt, {
      temperature: mode === "variations" ? 0.85 : 0.7,
      maxTokens: 1500,
    });

    if (!aiResult.success) {
      // Fallback — generate template-based copy when no API key
      if (aiResult.errorType === "missing_api_key") {
        console.warn(`${tag} No API key — using template fallback`);
        const fallback = generateFallback(mode, field, currentText, context);
        return NextResponse.json({ results: fallback, fallback: true });
      }
      console.error(`${tag} AI error: ${aiResult.error}`);
      return NextResponse.json(
        { error: aiResult.error || "AI generation failed" },
        { status: 502 }
      );
    }

    // Parse results
    let results: string[] = [];
    const data = aiResult.data as Record<string, unknown> | string;

    if (typeof data === "object" && data !== null && Array.isArray((data as Record<string, unknown>).results)) {
      results = (data as Record<string, string[]>).results;
    } else if (typeof data === "string") {
      // Try to extract JSON from response
      try {
        const match = data.match(/\{[\s\S]*"results"\s*:\s*\[[\s\S]*\]\s*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          results = parsed.results;
        } else {
          results = [data.trim()];
        }
      } catch {
        results = [String(data).trim()];
      }
    }

    if (results.length === 0) {
      results = ["לא הצלחנו ליצור טקסט. נסה שנית."];
    }

    const latencyMs = Date.now() - t0;
    console.log(`${tag} ✅ Generated ${results.length} results (${latencyMs}ms)`);

    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ FAILED: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Template fallback when no AI API key is configured */
function generateFallback(
  mode: string,
  field: string,
  currentText: string,
  context: RequestBody["context"]
): string[] {
  const name = context.clientName || "העסק";
  const goal = GOAL_NAMES[context.campaignType] || "קמפיין";

  if (field === "headline") {
    if (mode === "variations" || !currentText.trim()) {
      return [
        `${name} — הפתרון שחיכית לו`,
        `גלו את ${name} | ${goal}`,
        `למה ${name}? כי אתם ראויים ליותר`,
      ];
    }
    return [`${currentText} ✨`];
  }

  // caption
  if (mode === "variations" || !currentText.trim()) {
    return [
      `מחפשים ${goal === "לידים" ? "פתרון מקצועי" : "שינוי אמיתי"}? ${name} כאן בשבילכם. צרו קשר עוד היום ותגלו את ההבדל.`,
      `${name} מציגים: הדרך החכמה ל${goal === "מודעות למותג" ? "להכיר אותנו" : "להתקדם"}. הצטרפו לאלפי לקוחות מרוצים.`,
      `הגיע הזמן לקחת את ${goal === "מכירות/רימרקטינג" ? "ההזדמנות" : "הצעד הבא"}. ${name} — המומחים שלכם.`,
    ];
  }
  return [`${currentText} — ${name}`];
}
