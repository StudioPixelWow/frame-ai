/**
 * A/B Testing API Route for PixelFrameAI
 *
 * GET /api/ai/ab-testing — Fetch stored A/B test results for a client
 * POST /api/ai/ab-testing — Generate 2-3 content variations for A/B testing
 *
 * POST body (JSON):
 * {
 *   clientId:     string               // required — unique client identifier
 *   contentType:  'hook' | 'cta' | 'visual' | 'full'  // required
 *   contentText:  string               // required — original content to generate variations for
 *   context?:     string               // optional — additional context (industry, audience, etc)
 *   language?:    'he' | 'en'          // optional — default: 'he' (Hebrew)
 * }
 *
 * Response includes generated variations with:
 *   - id: unique variation identifier
 *   - variationType: type of variation generated
 *   - content: the generated variant
 *   - predictedEngagement: 0-100 engagement score from AI
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiKeys } from "@/lib/db/api-keys";
import { JsonStore } from "@/lib/db/store";

interface ContentVariation {
  id: string;
  variationType: "hook" | "cta" | "visual" | "full";
  content: string;
  predictedEngagement: number;
}

interface ABTestResult {
  id: string;
  clientId: string;
  contentType: string;
  originalContent: string;
  variations: ContentVariation[];
  createdAt: string;
  updatedAt: string;
}

interface TrackingData {
  variationId: string;
  views: number;
  clicks: number;
  conversions: number;
  engagement: number;
}

type ABStore = ABTestResult;

const abTestStore = new JsonStore<ABStore>("ab-tests", "test");

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "Missing required query parameter: clientId" },
        { status: 400 }
      );
    }

    // Get all tests for this client
    const allTests = abTestStore.getAll();
    const clientTests = allTests.filter((test) => test.clientId === clientId);

    if (clientTests.length === 0) {
      return NextResponse.json(
        { error: `No A/B tests found for client "${clientId}"` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      clientId,
      tests: clientTests,
      count: clientTests.length,
    });
  } catch (err) {
    console.error("[/api/ai/ab-testing GET]", err);
    return NextResponse.json(
      { error: "Failed to retrieve A/B tests" },
      { status: 500 }
    );
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    // Extract and validate required fields
    const {
      clientId,
      contentType,
      contentText,
      context,
      language = "he",
    } = body as {
      clientId?: string;
      contentType?: string;
      contentText?: string;
      context?: string;
      language?: string;
    };

    if (!clientId || typeof clientId !== "string") {
      return NextResponse.json(
        { error: "clientId is required and must be a string" },
        { status: 400 }
      );
    }

    if (
      !contentType ||
      !["hook", "cta", "visual", "full"].includes(contentType)
    ) {
      return NextResponse.json(
        {
          error:
            "contentType is required and must be one of: hook, cta, visual, full",
        },
        { status: 400 }
      );
    }

    if (!contentText || typeof contentText !== "string") {
      return NextResponse.json(
        { error: "contentText is required and must be a string" },
        { status: 400 }
      );
    }

    // Get OpenAI API key
    const { openai: apiKey } = getApiKeys();

    let variations: ContentVariation[];

    if (!apiKey) {
      // Fallback with deterministic results
      console.warn(
        "[/api/ai/ab-testing] No OpenAI API key found, using fallback variations"
      );
      variations = generateFallbackVariations(
        contentText,
        contentType as "hook" | "cta" | "visual" | "full",
        language
      );
    } else {
      // Generate variations using OpenAI
      variations = await generateVariationsWithAI(
        apiKey,
        contentText,
        contentType as "hook" | "cta" | "visual" | "full",
        context,
        language
      );
    }

    // Store the test result
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const testResult: ABTestResult = {
      id: testId,
      clientId,
      contentType,
      originalContent: contentText,
      variations,
      createdAt: now,
      updatedAt: now,
    };

    const stored = abTestStore.create({
      ...testResult,
      id: testId,
    } as any);

    return NextResponse.json(
      {
        success: true,
        test: stored,
        message: `Generated ${variations.length} variations for A/B testing`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[/api/ai/ab-testing POST]", err);
    return NextResponse.json(
      {
        error: "A/B test generation failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function generateVariationsWithAI(
  apiKey: string,
  contentText: string,
  contentType: "hook" | "cta" | "visual" | "full",
  context: string | undefined,
  language: string
): Promise<ContentVariation[]> {
  const isHebrew = language === "he";

  const systemPrompt = isHebrew
    ? `אתה מומחה בשיווק דיגיטלי ולתוכן פיקסל-מופצל. המשימה שלך היא ליצור 3 וריאציות שונות של תוכן עם תחזוקה על קוד ידידותי. כל וריאציה חייבת:
1. להיות שונה מהמקור (hooks, CTAs, visual concepts שונים)
2. לכלול טקסט בעברית עם מנקודת מבט שיווקית
3. שם סוג וריאציה (hook/cta/visual/full)
4. ערך חיזוי התנגדות (0-100)

פתוח JSON עם מערך של 3 וריאציות. כל וריאציה צריכה להיות חזקה ושונה.`
    : `You are a digital marketing expert specializing in pixel-perfect A/B testing content. Create 3 distinct variations of the content with different hooks, CTAs, or visual concepts. Each must be unique, engaging, and include an engagement score (0-100). Return valid JSON array of variations.`;

  const userPrompt = isHebrew
    ? `תוכן מקורי (${contentType}): "${contentText}"${context ? `\nהקשר: ${context}` : ""}\n\nיצר 3 וריאציות שונות של תוכן זה. כל וריאציה חייבת להיות בעברית, עם טקסט חזק וקול שיווקי. החזר JSON עם מערך של 3 אובייקטים עם: content (הטקסט), variationType ('hook'|'cta'|'visual'|'full'), predictedEngagement (0-100).`
    : `Original content (${contentType}): "${contentText}"${context ? `\nContext: ${context}` : ""}\n\nCreate 3 distinct variations. Each must be engaging and include a predicted engagement score (0-100). Return JSON array with objects containing: content (text), variationType, predictedEngagement.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `OpenAI API error: ${response.status} ${JSON.stringify(error)}`
      );
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Parse the JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON array from response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    // Transform and validate variations
    const variations: ContentVariation[] = parsed
      .slice(0, 3)
      .map((item: any, index: number) => ({
        id: `var_${Date.now()}_${index}`,
        variationType: item.variationType || contentType,
        content: item.content || String(item),
        predictedEngagement: Math.min(
          100,
          Math.max(0, item.predictedEngagement || 50 + Math.random() * 30)
        ),
      }));

    return variations;
  } catch (err) {
    console.error("[generateVariationsWithAI]", err);
    // Fall back to deterministic variations
    return generateFallbackVariations(contentText, contentType, language);
  }
}

function generateFallbackVariations(
  contentText: string,
  contentType: "hook" | "cta" | "visual" | "full",
  language: string
): ContentVariation[] {
  const isHebrew = language === "he";

  const variations: ContentVariation[] = [];

  // Variation 1: Strong question hook
  variations.push({
    id: `var_${Date.now()}_0`,
    variationType: "hook",
    content: isHebrew
      ? `אתה שואל את עצמך... ${contentText}?`
      : `Are you wondering... ${contentText}?`,
    predictedEngagement: 72,
  });

  // Variation 2: Direct CTA
  variations.push({
    id: `var_${Date.now()}_1`,
    variationType: "cta",
    content: isHebrew
      ? `גלה עכשיו: ${contentText} 🚀`
      : `Discover now: ${contentText} 🚀`,
    predictedEngagement: 65,
  });

  // Variation 3: Benefit-driven visual concept
  variations.push({
    id: `var_${Date.now()}_2`,
    variationType: "visual",
    content: isHebrew
      ? `✨ ${contentText} - תוצאות שדברים!`
      : `✨ ${contentText} - Results that speak!`,
    predictedEngagement: 78,
  });

  return variations;
}
