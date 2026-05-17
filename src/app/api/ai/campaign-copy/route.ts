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

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
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
    primaryText?: string; // caption text, used as context for headline generation
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

    // If generating a headline and we have primaryText, add context about it
    const primaryTextContext = field === "headline" && context.primaryText?.trim()
      ? `\n- הכותרת חייבת להתאים ולחזק את הטקסט הראשי של המודעה. חלץ את המסר המרכזי מהטקסט הראשי וצור כותרת שמשלימה אותו — לא חוזרת עליו מילה במילה.\n- הטקסט הראשי של המודעה:\n"${context.primaryText.trim()}"`
      : "";

    const systemPrompt = `אתה קופירייטר מומחה לפרסום דיגיטלי בעברית — מתמחה בשוק הישראלי ובפרסום ממומן (Meta, Google, TikTok, LinkedIn). אתה כותב טקסטים שיווקיים שממירים לקמפיינים ברשתות חברתיות.

כללים:
- כתוב בעברית טבעית, חזקה, ומקצועית
- התאם את הטון לפלטפורמה (${platformName})
- התאם למטרת הקמפיין (${goalName})

כללי RTL לפרסום ישראלי:
- כותרות RSA: עד 20-25 תווים בעברית (לא 30 — תווים עבריים רחבים יותר)
- תיאורים: עד 90 תווים
- מספרים מוצגים LTR בתוך טקסט RTL — בדוק שהמשפט קריא
- CTA בעברית: "למידע נוסף", "צרו קשר עכשיו", "לייעוץ חינם", "השאירו פרטים"
- אימוג'י: בצד ימין של הטקסט (תחילת השורה ב-RTL)

טון לפי פלטפורמה ואזור:
- Meta/Instagram: חם, ישיר, שיחתי. Hooks שעוצרים סקרול.
- Google Ads: מדויק, מקצועי, keyword-rich. USP + CTA ברורה.
- TikTok: צעיר, אותנטי, מדבר בגובה העיניים. Hook ב-3 שניות ראשונות.
- LinkedIn: מקצועי, B2B, סמכותי. עברית לתעשיות מסורתיות, אנגלית לטק.

תבניות ישראליות מומלצות:
- Lead Gen: "מחפשים [שירות]? ✅ [יתרון 1] ✅ [יתרון 2] — השאירו פרטים ונחזור תוך שעה"
- Retargeting: "עוד לא החלטתם? הנה למה [BRAND] — ייעוץ חינם ללא התחייבות"
- FOMO: "רק [X] מקומות נשארו | [הצעה] עד [תאריך]"
- Social Proof: "[X]+ לקוחות מרוצים | [שנים] שנות ניסיון"
- ${field === "caption" ? `טקסט ראשי — מבנה מחייב לפי סטנדרט ישראלי:
  שורה 1: Hook — משפט פתיחה חד שעומד לבד (שאלה/הצהרה נועזת/מספר/ניגוד). חייב לעצור סקרול.
  שורות 2-4: גוף — הקשר, סיפור, ערך או תובנה שאנשים ירצו לקרוא.
  שורה 5: CTA — קריאה לפעולה ברורה עם ← (קישור בביו / שלחו הודעה / תייגו חבר).
  שורה אחרונה: 5-10 האשטגים — מיקס עברית+אנגלית (#שיווק_דיגיטלי #marketing + ניש ספציפי).
  עד 500 תווים סה"כ.` : "כותרת — עד 80 תווים, קצרה, חדה, מושכת תשומת לב"}
- אל תוסיף אימוג'ים אלא אם זה מתאים לפלטפורמה
- השתמש בידע על הלקוח אם זמין${primaryTextContext}

סגנונות hook מומלצים: שאלה ("האם אתם עושים את הטעות הזו?"), הצהרה ("99% מהעסקים לא יודעים"), מספר ("5 סיבות למה..."), ניגוד ("כולם אומרים X אבל...").

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
