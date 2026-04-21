/**
 * POST /api/ai/campaign-interests
 *
 * Generates AI-powered interest/targeting suggestions based on client context.
 * Uses the existing OpenAI integration + client knowledge context.
 *
 * Request body:
 *   {
 *     clientId: string,
 *     clientName: string,
 *     businessField?: string,
 *     campaignType: string,
 *     platform: string,
 *     existingInterests?: string[],
 *   }
 *
 * Response:
 *   { interests: string[] }
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
  clientId: string;
  clientName: string;
  businessField?: string;
  campaignType: string;
  platform: string;
  existingInterests?: string[];
}

export async function POST(req: NextRequest) {
  const tag = "[/api/ai/campaign-interests]";
  const t0 = Date.now();

  try {
    const body: RequestBody = await req.json();
    const { clientId, clientName, businessField, campaignType, platform, existingInterests } = body;

    if (!clientId || !platform || !campaignType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build client knowledge context
    let knowledgeCtx = "";
    try {
      knowledgeCtx = await getClientKnowledgeContext(clientId);
    } catch {
      console.warn(`${tag} Could not load client knowledge for ${clientId}`);
    }

    const platformName = PLATFORM_NAMES[platform] || platform;
    const goalName = GOAL_NAMES[campaignType] || campaignType;

    const systemPrompt = `אתה מומחה לפרסום דיגיטלי ברשתות חברתיות. אתה מכיר את מערכות הטרגוט של Facebook Ads Manager, Instagram, ו-TikTok Ads.

המשימה שלך: להציע תחומי עניין (interests) רלוונטיים לטרגוט קמפיין פרסום.

כללים:
- הצע תחומי עניין שקיימים בפועל במערכות הפרסום (Facebook/Meta Ads interests)
- התאם לתחום העסקי של הלקוח
- התאם למטרת הקמפיין (${goalName})
- התאם לפלטפורמה (${platformName})
- הצע 8-12 תחומי עניין
- כתוב בעברית
- כלול גם תחומים רחבים וגם ספציפיים
- אל תחזור על תחומי עניין שכבר נבחרו

${knowledgeCtx ? `מידע על הלקוח:\n${knowledgeCtx}` : ""}`;

    const existingStr = existingInterests && existingInterests.length > 0
      ? `\nתחומי עניין שכבר נבחרו (אל תחזור עליהם): ${existingInterests.join(", ")}`
      : "";

    const userPrompt = `הצע תחומי עניין לטרגוט קמפיין ${goalName} ב-${platformName} עבור "${clientName}"${businessField ? ` (תחום: ${businessField})` : ""}.${existingStr}

החזר JSON בפורמט: { "interests": ["תחום 1", "תחום 2", "תחום 3", ...] }`;

    console.log(`${tag} Generating interest suggestions (client: ${clientName}, platform: ${platformName})`);

    const aiResult = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.75,
      maxTokens: 800,
    });

    if (!aiResult.success) {
      // Fallback — generate template-based interests when no API key
      if (aiResult.errorType === "missing_api_key") {
        console.warn(`${tag} No API key — using template fallback`);
        const fallback = generateFallback(businessField, campaignType);
        return NextResponse.json({ interests: fallback, fallback: true });
      }
      console.error(`${tag} AI error: ${aiResult.error}`);
      return NextResponse.json(
        { error: aiResult.error || "AI generation failed" },
        { status: 502 }
      );
    }

    // Parse results
    let interests: string[] = [];
    const data2 = aiResult.data as Record<string, unknown> | string;

    if (typeof data2 === "object" && data2 !== null && Array.isArray((data2 as Record<string, unknown>).interests)) {
      interests = (data2 as Record<string, string[]>).interests;
    } else if (typeof data2 === "string") {
      try {
        const match = data2.match(/\{[\s\S]*"interests"\s*:\s*\[[\s\S]*\]\s*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          interests = parsed.interests;
        }
      } catch {
        // Could not parse
      }
    }

    // Filter out existing
    if (existingInterests && existingInterests.length > 0) {
      interests = interests.filter((i) => !existingInterests.includes(i));
    }

    if (interests.length === 0) {
      interests = generateFallback(businessField, campaignType);
    }

    const latencyMs = Date.now() - t0;
    console.log(`${tag} ✅ Generated ${interests.length} interest suggestions (${latencyMs}ms)`);

    return NextResponse.json({ interests });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ FAILED: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Template fallback when no AI API key is configured */
function generateFallback(businessField?: string, campaignType?: string): string[] {
  const base = [
    "שיווק דיגיטלי",
    "עסקים קטנים",
    "יזמות",
    "טכנולוגיה",
    "חדשנות",
    "מדיה חברתית",
    "קניות אונליין",
    "סטארטאפים",
  ];

  if (businessField) {
    // Add field-specific interests
    const fieldMap: Record<string, string[]> = {
      "כושר": ["כושר גופני", "אימון כוח", "ריצה", "יוגה", "תזונה בריאה", "CrossFit"],
      "מזון": ["בישול", "מסעדות", "תזונה", "אוכל בריא", "שף ביתי", "מתכונים"],
      "אופנה": ["אופנה", "סטייל", "קניות", "מותגי יוקרה", "עיצוב אישי", "טרנדים"],
      "נדלן": ["נדל״ן", "השקעות", "דירות", "משכנתא", "בנייה", "עיצוב פנים"],
      "חינוך": ["חינוך", "לימודים", "הורות", "ילדים", "פיתוח אישי", "קורסים"],
      "בריאות": ["בריאות", "רפואה", "wellness", "מדיטציה", "אורח חיים בריא"],
    };
    for (const [key, values] of Object.entries(fieldMap)) {
      if (businessField.includes(key)) {
        return values;
      }
    }
  }

  if (campaignType === "lead_gen") {
    return ["יעוץ עסקי", "שירותים מקצועיים", "עסקים קטנים", "יזמות", "ניהול", "פיתוח עסקי", "שיווק", "מכירות"];
  }

  return base;
}
