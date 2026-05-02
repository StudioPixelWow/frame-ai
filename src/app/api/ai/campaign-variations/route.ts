/**
 * POST /api/ai/campaign-variations
 *
 * Generates 3–5 smart campaign variations based on the campaign's content.
 * Each variation shifts the ANGLE (not just wording):
 *   - emotional vs rational
 *   - different CTA
 *   - different hook
 *   - urgency vs value
 *   - pain vs benefit
 *
 * Request body:
 *   {
 *     campaignId: string,
 *     primaryText: string,
 *     headline: string,
 *     objective: string,         // campaign goal text
 *     campaignType: string,      // e.g. 'lead_gen'
 *     platform: string,          // e.g. 'facebook'
 *     clientName: string,
 *     clientId: string,
 *     audience?: string,         // target audience if known
 *   }
 *
 * Response:
 *   {
 *     variations: Array<{
 *       id: string,
 *       angle: string,           // e.g. "רגשי", "דחיפות", "כאב", "ערך", "סיפור"
 *       angleLabel: string,      // Hebrew display label
 *       primaryText: string,
 *       headline: string,
 *       cta: string,             // call to action
 *       explanation: string,     // "מה השתנה ולמה זה יכול לעבוד"
 *     }>
 *   }
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

interface VariationResult {
  id: string;
  angle: string;
  angleLabel: string;
  primaryText: string;
  headline: string;
  cta: string;
  explanation: string;
}

interface RequestBody {
  campaignId: string;
  primaryText: string;
  headline: string;
  objective: string;
  campaignType: string;
  platform: string;
  clientName: string;
  clientId: string;
  audience?: string;
}

export async function POST(req: NextRequest) {
  const tag = "[/api/ai/campaign-variations]";
  const t0 = Date.now();

  try {
    const body: RequestBody = await req.json();
    const {
      primaryText,
      headline,
      objective,
      campaignType,
      platform,
      clientName,
      clientId,
      audience,
    } = body;

    if (!clientId || !platform || !campaignType) {
      return NextResponse.json(
        { error: "Missing required fields: clientId, platform, campaignType" },
        { status: 400 }
      );
    }

    if (!primaryText?.trim() && !headline?.trim() && !objective?.trim()) {
      return NextResponse.json(
        { error: "At least primaryText, headline, or objective is required" },
        { status: 400 }
      );
    }

    // Load client knowledge
    let knowledgeCtx = "";
    try {
      knowledgeCtx = await getClientKnowledgeContext(clientId);
    } catch {
      console.warn(`${tag} Could not load client knowledge for ${clientId}`);
    }

    const platformName = PLATFORM_NAMES[platform] || platform;
    const goalName = GOAL_NAMES[campaignType] || campaignType;

    const systemPrompt = `אתה אסטרטג שיווקי בכיר ומומחה קריאייטיב לפרסום דיגיטלי בעברית.

תפקידך: ליצור וריאציות חכמות של קמפיין קיים. כל וריאציה חייבת לשנות את הזווית (ANGLE) — לא רק את הניסוח.

סוגי הזוויות שעליך לכסות:
1. **רגשי** (emotional) — פונה לרגש, חלום, שאיפה, תחושת שייכות
2. **דחיפות** (urgency) — יוצר תחושת מחסור, זמן מוגבל, FOMO
3. **כאב** (pain) — מדגיש את הבעיה שהלקוח חווה, מה יקרה אם לא יפעל
4. **ערך** (value) — מדגיש יתרונות מוחשיים, ROI, תועלות מדידות
5. **סיפור** (story) — פותח בסיפור קצר, מקרה, עדות, נרטיב

כללים:
- כתוב בעברית טבעית, חזקה, מקצועית
- התאם לפלטפורמה (${platformName}) ולמטרת הקמפיין (${goalName})
- טקסט ראשי: עד 500 תווים, פסקה אחת או שתיים
- כותרת: עד 80 תווים, חדה ומושכת
- CTA: משפט הנעה לפעולה אחד, קצר וברור
- הסבר: 1-2 משפטים על מה השתנה ולמה הזווית הזו יכולה לעבוד

${knowledgeCtx ? `מידע על הלקוח:\n${knowledgeCtx}` : ""}`;

    const userPrompt = `צור 4 וריאציות חכמות לקמפיין הבא:

**לקוח:** ${clientName}
**פלטפורמה:** ${platformName}
**מטרה:** ${goalName}
${objective ? `**מטרת הקמפיין:** ${objective}` : ""}
${primaryText ? `**טקסט ראשי נוכחי:**\n"${primaryText}"` : ""}
${headline ? `**כותרת נוכחית:**\n"${headline}"` : ""}
${audience ? `**קהל יעד:** ${audience}` : ""}

צור בדיוק 4 וריאציות, כל אחת מזווית שונה מתוך: רגשי, דחיפות, כאב, ערך, סיפור.
אל תחזור על אותה זווית פעמיים.

החזר JSON בפורמט:
{
  "variations": [
    {
      "angle": "emotional",
      "angleLabel": "רגשי",
      "primaryText": "...",
      "headline": "...",
      "cta": "...",
      "explanation": "מה השתנה ולמה זה יכול לעבוד"
    }
  ]
}`;

    console.log(
      `${tag} Generating variations for campaign (client: ${clientName}, platform: ${platformName})`
    );

    const aiResult = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.9,
      maxTokens: 3000,
    });

    if (!aiResult.success) {
      if (aiResult.errorType === "missing_api_key") {
        console.warn(`${tag} No API key — using fallback`);
        const fallback = generateFallbackVariations(body);
        return NextResponse.json({ variations: fallback, fallback: true });
      }
      console.error(`${tag} AI error: ${aiResult.error}`);
      return NextResponse.json(
        { error: aiResult.error || "AI generation failed" },
        { status: 502 }
      );
    }

    // Parse results
    let variations: VariationResult[] = [];
    const data = aiResult.data as Record<string, unknown> | string;

    if (
      typeof data === "object" &&
      data !== null &&
      Array.isArray((data as Record<string, unknown>).variations)
    ) {
      variations = ((data as Record<string, VariationResult[]>).variations).map(
        (v, i) => ({ ...v, id: `var-${i}` })
      );
    } else if (typeof data === "string") {
      try {
        const match = data.match(
          /\{[\s\S]*"variations"\s*:\s*\[[\s\S]*\]\s*\}/
        );
        if (match) {
          const parsed = JSON.parse(match[0]);
          variations = parsed.variations.map(
            (v: VariationResult, i: number) => ({
              ...v,
              id: `var-${i}`,
            })
          );
        }
      } catch {
        console.warn(`${tag} Could not parse AI response as JSON`);
      }
    }

    if (variations.length === 0) {
      console.warn(`${tag} No variations parsed — using fallback`);
      variations = generateFallbackVariations(body);
    }

    const latencyMs = Date.now() - t0;
    console.log(
      `${tag} ✅ Generated ${variations.length} variations (${latencyMs}ms)`
    );

    return NextResponse.json({ variations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ FAILED: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Deterministic fallback when no AI API key */
function generateFallbackVariations(body: RequestBody): VariationResult[] {
  const name = body.clientName || "העסק";
  const goal = GOAL_NAMES[body.campaignType] || "קמפיין";
  const base = body.primaryText || body.objective || "";

  return [
    {
      id: "var-0",
      angle: "emotional",
      angleLabel: "רגשי",
      primaryText: `דמיינו עולם שבו ${goal === "לידים" ? "הלקוחות מגיעים אליכם" : "המותג שלכם מוכר לכולם"}. ${name} הופך את החלום למציאות. הצטרפו למשפחה שלנו.`,
      headline: `${name} — כי אתם ראויים ליותר`,
      cta: "הצטרפו עכשיו",
      explanation:
        "גישה רגשית שפונה לשאיפות ולחלום — יוצרת חיבור עמוק עם הקהל ומגבירה זיהוי עם המותג.",
    },
    {
      id: "var-1",
      angle: "urgency",
      angleLabel: "דחיפות",
      primaryText: `⏰ רק השבוע: ${name} ${goal === "לידים" ? "פותח הרשמה מוגבלת" : "מציע הטבה בלעדית"}. המקומות מוגבלים — מי שמהסס מפסיד.`,
      headline: `לא תהיה הזדמנות שנייה — ${name}`,
      cta: "תפסו מקום עכשיו",
      explanation:
        "דחיפות ומחסור (FOMO) — מניע לפעולה מהירה. עובד מצוין בקמפיינים ממומנים עם הצעה מוגבלת.",
    },
    {
      id: "var-2",
      angle: "pain",
      angleLabel: "כאב",
      primaryText: `עדיין ${goal === "לידים" ? "מחכים שלקוחות יגיעו לבד" : "לא מרגישים שהשיווק עובד"}? הגיע הזמן לעצור את הבזבוז. ${name} מציע דרך חדשה שעובדת.`,
      headline: `עצרו לבזבז — ${name} כאן`,
      cta: "גלו איך לשנות את זה",
      explanation:
        "פנייה לכאב ולתסכול — מדגישה את הבעיה לפני הפתרון. מתאימה לקהל שכבר מודע לבעיה שלו.",
    },
    {
      id: "var-3",
      angle: "value",
      angleLabel: "ערך",
      primaryText: `${name}: ${goal === "לידים" ? "כל ליד עולה לכם פחות ומתמיר יותר" : "תוצאות מדידות תוך 30 יום"}. גישה מקצועית, שקיפות מלאה, ותוצאות שמדברות בעד עצמן.`,
      headline: `תוצאות אמיתיות. מספרים אמיתיים.`,
      cta: "קבלו הצעה מותאמת",
      explanation:
        "פוקוס על ערך מוחשי ו-ROI — מושך קהל רציונלי שמחפש נתונים ותוצאות מוכחות.",
    },
  ];
}
