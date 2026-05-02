export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getApiKeys } from "@/lib/db/api-keys";
import OpenAI from "openai";

/**
 * Types for Hook Generator API
 */

interface ContentItem {
  id: string;
  title: string;
  mainMessage: string;
  platform: "facebook" | "instagram" | "tiktok";
  funnelStage: "awareness" | "engagement" | "conversion";
}

interface HookGeneratorRequest {
  items: ContentItem[];
  businessType: string;
  language: "he";
}

interface HookVariants {
  curiosity: string;
  fomo: string;
  authority: string;
  emotional: string;
  bold: string;
}

interface HookResult {
  itemId: string;
  hooks: HookVariants;
}

interface HookGeneratorResponse {
  results: HookResult[];
  debug: {
    latencyMs: number;
    itemCount: number;
  };
}

/**
 * Fallback hook generator (template-based)
 */
function generateFallbackHooks(
  item: ContentItem,
  businessType: string
): HookVariants {
  const { title, mainMessage, platform, funnelStage } = item;

  const templates = {
    curiosity: [
      `אתה לא תאמין מה קורה עם ${businessType}`,
      `כמעט שכחנו לחשוף את הסוד הזה`,
      `הדבר הזה שינה הכל בתעשיית ${businessType}`,
      `אתה משגה אם אתה חושב שזה עובד ככה`,
      `הצצה חטופה למה שבאמת עובד`,
    ],
    fomo: [
      `רק ${businessType} בחרו זאת השנה`,
      `הזמן נגמר בחצי שעה`,
      `חברים שלך כבר עושים זאת`,
      `זה מיוחד בלבד ל-48 שעות`,
      `התחרות שלך כבר בתוך`,
    ],
    authority: [
      `אחרי 10 שנים בתעשיה, פה התשובה`,
      `מה שאנחנו למדנו מ-1000+ לקוחות`,
      `מומחה של ${businessType} חוזה לך`,
      `טיפ מישהו שעשה את זה פעם אחת`,
      `בנוי על מה שעבד לגדולים`,
    ],
    emotional: [
      `זה הרגש שחיפשת כל הזמן`,
      `סוף לתסכול הזה פעם ולתמיד`,
      `עצמאות שחלמת עליה ממתינה`,
      `היום זה היום שהכל משתנה`,
      `הדבר היחיד שהיה חסר`,
    ],
    bold: [
      `אנחנו גורמים ל-${businessType} להפוך`,
      `כל מה שאתה יודע טועה`,
      `זה לא מה שאתה חושב`,
      `ניתוק שחקנים בתעשיה`,
      `חוקים חדשים בעולם ${businessType}`,
    ],
  };

  return {
    curiosity: templates.curiosity[Math.floor(Math.random() * templates.curiosity.length)],
    fomo: templates.fomo[Math.floor(Math.random() * templates.fomo.length)],
    authority: templates.authority[Math.floor(Math.random() * templates.authority.length)],
    emotional: templates.emotional[Math.floor(Math.random() * templates.emotional.length)],
    bold: templates.bold[Math.floor(Math.random() * templates.bold.length)],
  };
}

/**
 * Generate hooks using OpenAI API
 */
async function generateHooksWithOpenAI(
  items: ContentItem[],
  businessType: string,
  apiKey: string
): Promise<HookVariants[]> {
  const client = new OpenAI({ apiKey });

  // Build context string for all items
  const itemsContext = items
    .map(
      (item, idx) =>
        `[פריט ${idx + 1}] ${item.title}\nהודעה: ${item.mainMessage}\nפלטפורמה: ${item.platform}\nשלב: ${item.funnelStage}`
    )
    .join("\n\n");

  const systemPrompt = `אתה מומחה בכתיבת קאפיות (hooks) לתוכן מדיה חברתית בעברית.
המשימה שלך: ליצור 5 וריאציות של קאפיות לכל פריט תוכן.

הנחיות:
- סוגי קאפיות: Curiosity (סקרנות), FOMO (חוסר משמעות), Authority (סמכות), Emotional (רגשי), Bold (הצהרה אמיצה)
- כל קאפיה: בדיוק 5-10 מילים בעברית, עצור סקרול, מותאם לפלטפורמה
- אל תהיה גנרי - כל קאפיה חייבת להיות ספציפית לתוכן והעסק
- טון: חד, פרימיום, מודרני
- אל תשתמש בסמלים או אימוג'י

תוציא רק את הקאפיות, ללא הסברים או פורמט JSON.`;

  const userPrompt = `כאן הם פריטי התוכן שלך (עסק: ${businessType}):

${itemsContext}

עבור כל פריט, יצא 5 קאפיות בשורות נפרדות בפורמט:
[פריט X] Type: Hook Text

דוגמה:
[פריט 1] Curiosity: אתה לא יודע כמה אתה מפסיד
[פריט 1] FOMO: רק היום ברי הטוב
...`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  // Parse response
  const choice = response.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error("Empty response from OpenAI");
  }

  const hooksText = choice.message.content;
  const results: HookVariants[] = [];

  // Parse lines and group by item
  const lines = hooksText.split("\n").filter((line) => line.trim());
  const hooksMap = new Map<number, Partial<HookVariants>>();

  for (const line of lines) {
    // Match: [פריט X] Type: Hook Text
    const match = line.match(/\[פריט\s+(\d+)\]\s+(Curiosity|FOMO|Authority|Emotional|Bold):\s*(.+)/i);
    if (match) {
      const itemIdx = parseInt(match[1]) - 1;
      const type = match[2].toLowerCase();
      const hookText = match[3].trim();

      if (!hooksMap.has(itemIdx)) {
        hooksMap.set(itemIdx, {});
      }

      const hooks = hooksMap.get(itemIdx)!;
      if (type === "curiosity") hooks.curiosity = hookText;
      else if (type === "fomo") hooks.fomo = hookText;
      else if (type === "authority") hooks.authority = hookText;
      else if (type === "emotional") hooks.emotional = hookText;
      else if (type === "bold") hooks.bold = hookText;
    }
  }

  // Convert to array and fill missing with fallback
  for (let i = 0; i < items.length; i++) {
    const partial = hooksMap.get(i) || {};
    const fallback = generateFallbackHooks(items[i], businessType);

    results.push({
      curiosity: partial.curiosity || fallback.curiosity,
      fomo: partial.fomo || fallback.fomo,
      authority: partial.authority || fallback.authority,
      emotional: partial.emotional || fallback.emotional,
      bold: partial.bold || fallback.bold,
    });
  }

  return results;
}

/**
 * Validate request
 */
function validateRequest(body: unknown): {
  valid: boolean;
  error?: string;
  data?: HookGeneratorRequest;
} {
  if (typeof body !== "object" || !body) {
    return { valid: false, error: "Body must be a JSON object" };
  }

  const req = body as Record<string, unknown>;

  // Validate items
  if (!Array.isArray(req.items) || req.items.length === 0) {
    return { valid: false, error: "items must be a non-empty array" };
  }

  if (req.items.length > 20) {
    return { valid: false, error: "Maximum 20 items per request" };
  }

  for (let i = 0; i < req.items.length; i++) {
    const item = req.items[i];
    if (typeof item !== "object" || !item) {
      return { valid: false, error: `items[${i}] must be an object` };
    }

    const it = item as Record<string, unknown>;
    if (typeof it.id !== "string" || !it.id) {
      return { valid: false, error: `items[${i}].id must be a non-empty string` };
    }
    if (typeof it.title !== "string" || !it.title) {
      return { valid: false, error: `items[${i}].title must be a non-empty string` };
    }
    if (typeof it.mainMessage !== "string" || !it.mainMessage) {
      return { valid: false, error: `items[${i}].mainMessage must be a non-empty string` };
    }
    if (!["facebook", "instagram", "tiktok"].includes(it.platform as string)) {
      return { valid: false, error: `items[${i}].platform must be facebook|instagram|tiktok` };
    }
    if (!["awareness", "engagement", "conversion"].includes(it.funnelStage as string)) {
      return { valid: false, error: `items[${i}].funnelStage must be awareness|engagement|conversion` };
    }
  }

  // Validate businessType
  if (typeof req.businessType !== "string" || !req.businessType) {
    return { valid: false, error: "businessType must be a non-empty string" };
  }

  // Validate language
  if (req.language !== "he") {
    return { valid: false, error: "language must be 'he'" };
  }

  return {
    valid: true,
    data: req as HookGeneratorRequest,
  };
}

/**
 * POST /api/ai/hook-generator
 */
export async function POST(request: NextRequest): Promise<NextResponse<HookGeneratorResponse | { error: string }>> {
  const startTime = Date.now();
  console.log("[hook-generator] Request received");

  try {
    // Parse request body
    const body = await request.json();
    const validation = validateRequest(body);

    if (!validation.valid) {
      console.error(`[hook-generator] Validation error: ${validation.error}`);
      return NextResponse.json({ error: validation.error || "Invalid request" }, { status: 400 });
    }

    const { items, businessType } = validation.data!;
    console.log(`[hook-generator] Processing ${items.length} items for ${businessType}`);

    // Get API keys
    const keys = getApiKeys();
    let hooksResults: HookVariants[] = [];

    if (keys.openai) {
      try {
        console.log("[hook-generator] Using OpenAI API");
        hooksResults = await generateHooksWithOpenAI(items, businessType, keys.openai);
      } catch (error) {
        console.error("[hook-generator] OpenAI error:", error);
        console.log("[hook-generator] Falling back to template-based generation");
        hooksResults = items.map((item) => generateFallbackHooks(item, businessType));
      }
    } else {
      console.log("[hook-generator] No OpenAI key, using fallback");
      hooksResults = items.map((item) => generateFallbackHooks(item, businessType));
    }

    // Format response
    const results: HookResult[] = items.map((item, idx) => ({
      itemId: item.id,
      hooks: hooksResults[idx],
    }));

    const latencyMs = Date.now() - startTime;
    console.log(`[hook-generator] Success: ${items.length} items in ${latencyMs}ms`);

    return NextResponse.json({
      results,
      debug: {
        latencyMs,
        itemCount: items.length,
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[hook-generator] Error (${latencyMs}ms):`, error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
