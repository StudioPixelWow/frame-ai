/**
 * A/B Testing Results Tracking API Route
 *
 * GET /api/ai/ab-testing/results — Get aggregated results for a test
 * POST /api/ai/ab-testing/results — Record performance data for a variation
 * PATCH /api/ai/ab-testing/results — Analyze results and pick winner
 *
 * POST body (JSON):
 * {
 *   testId:       string      // required — test ID from A/B test creation
 *   variationId:  string      // required — variation ID
 *   action:       'view' | 'click' | 'conversion'  // required
 * }
 *
 * PATCH body (JSON):
 * {
 *   testId:   string  // required — test ID to analyze
 *   clientId: string  // required — client ID for learnings feedback
 * }
 *
 * GET query params:
 *   testId: string (required) — test ID to get results for
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiKeys } from "@/lib/db/api-keys";
import { JsonStore } from "@/lib/db/store";

interface VariationMetrics {
  variationId: string;
  views: number;
  clicks: number;
  conversions: number;
  clickRate: number;
  conversionRate: number;
}

interface TestResultData {
  id: string;
  testId: string;
  clientId?: string;
  metrics: Map<string, VariationMetrics>;
  winner?: {
    variationId: string;
    reason: string;
    recommendedNextSteps: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Simple in-memory tracking for this session
// In production, this would be in a persistent store
const trackingData: Map<string, TestResultData> = new Map();

type ResultStore = {
  id: string;
  testId: string;
  clientId?: string;
  metricsData: Array<{
    variationId: string;
    views: number;
    clicks: number;
    conversions: number;
  }>;
  winner?: {
    variationId: string;
    reason: string;
    recommendedNextSteps: string;
  };
  createdAt: string;
  updatedAt: string;
};

const resultStore = new JsonStore<ResultStore>("ab-test-results", "result");

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const testId = searchParams.get("testId");

    if (!testId) {
      return NextResponse.json(
        { error: "Missing required query parameter: testId" },
        { status: 400 }
      );
    }

    // Try to find in persistent store first
    const allResults = resultStore.getAll();
    const result = allResults.find((r) => r.testId === testId);

    if (!result) {
      return NextResponse.json(
        { error: `No results found for test "${testId}"` },
        { status: 404 }
      );
    }

    // Transform metrics back to proper format
    const metrics = result.metricsData.map((m) => ({
      ...m,
      clickRate: m.views > 0 ? (m.clicks / m.views) * 100 : 0,
      conversionRate: m.clicks > 0 ? (m.conversions / m.clicks) * 100 : 0,
    }));

    return NextResponse.json({
      testId,
      metrics,
      winner: result.winner,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  } catch (err) {
    console.error("[/api/ai/ab-testing/results GET]", err);
    return NextResponse.json(
      { error: "Failed to retrieve results" },
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

    const { testId, variationId, action } = body as {
      testId?: string;
      variationId?: string;
      action?: string;
    };

    // Validate required fields
    if (!testId || typeof testId !== "string") {
      return NextResponse.json(
        { error: "testId is required and must be a string" },
        { status: 400 }
      );
    }

    if (!variationId || typeof variationId !== "string") {
      return NextResponse.json(
        { error: "variationId is required and must be a string" },
        { status: 400 }
      );
    }

    if (!action || !["view", "click", "conversion"].includes(action)) {
      return NextResponse.json(
        {
          error: "action is required and must be one of: view, click, conversion",
        },
        { status: 400 }
      );
    }

    // Get or create result tracking for this test
    let result = resultStore.getAll().find((r) => r.testId === testId);

    if (!result) {
      // Create new result entry
      const newResult: ResultStore = {
        id: `result_${testId}`,
        testId,
        metricsData: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      result = resultStore.create(newResult as any);
    }

    // Find or create metrics for this variation
    let metric = result.metricsData.find((m) => m.variationId === variationId);
    if (!metric) {
      metric = {
        variationId,
        views: 0,
        clicks: 0,
        conversions: 0,
      };
      result.metricsData.push(metric);
    }

    // Update metrics based on action
    if (action === "view") {
      metric.views += 1;
    } else if (action === "click") {
      metric.clicks += 1;
    } else if (action === "conversion") {
      metric.conversions += 1;
    }

    // Save updated result
    resultStore.update(result.id, {
      ...result,
      updatedAt: new Date().toISOString(),
    });

    // Calculate rates
    const clickRate = metric.views > 0 ? (metric.clicks / metric.views) * 100 : 0;
    const conversionRate =
      metric.clicks > 0 ? (metric.conversions / metric.clicks) * 100 : 0;

    return NextResponse.json({
      success: true,
      testId,
      variationId,
      action,
      metrics: {
        views: metric.views,
        clicks: metric.clicks,
        conversions: metric.conversions,
        clickRate: clickRate.toFixed(2),
        conversionRate: conversionRate.toFixed(2),
      },
    });
  } catch (err) {
    console.error("[/api/ai/ab-testing/results POST]", err);
    return NextResponse.json(
      {
        error: "Failed to record result",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
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

    const { testId, clientId } = body as {
      testId?: string;
      clientId?: string;
    };

    if (!testId || typeof testId !== "string") {
      return NextResponse.json(
        { error: "testId is required and must be a string" },
        { status: 400 }
      );
    }

    // Get result data
    const result = resultStore.getAll().find((r) => r.testId === testId);
    if (!result) {
      return NextResponse.json(
        { error: `No results found for test "${testId}"` },
        { status: 404 }
      );
    }

    // Analyze results and determine winner
    const metricsWithRates = result.metricsData.map((m) => ({
      ...m,
      clickRate: m.views > 0 ? (m.clicks / m.views) * 100 : 0,
      conversionRate:
        m.clicks > 0 ? (m.conversions / m.clicks) * 100 : 0,
    }));

    // Find winner based on conversion rate, fallback to click rate
    let winner = metricsWithRates[0];
    for (const metric of metricsWithRates) {
      if (metric.conversionRate > winner.conversionRate) {
        winner = metric;
      } else if (
        metric.conversionRate === winner.conversionRate &&
        metric.clickRate > winner.clickRate
      ) {
        winner = metric;
      }
    }

    const winnerData = {
      variationId: winner.variationId,
      reason:
        winner.conversionRate > 0
          ? `${winner.conversionRate.toFixed(1)}% conversion rate (${winner.conversions} conversions from ${winner.clicks} clicks)`
          : `${winner.clickRate.toFixed(1)}% click rate (${winner.clicks} clicks from ${winner.views} views)`,
      recommendedNextSteps: `Scale variation ${winner.variationId}. Continue testing other variations against this winner. Track performance over 2-4 weeks.`,
    };

    // Use AI to enhance insights if available
    const { openai: apiKey } = getApiKeys();
    if (apiKey) {
      const aiInsights = await generateWinnerInsights(
        apiKey,
        testId,
        winner,
        metricsWithRates,
        clientId
      );
      if (aiInsights) {
        Object.assign(winnerData, aiInsights);
      }
    }

    // Update result with winner information
    const updatedResult = resultStore.update(result.id, {
      ...result,
      clientId: clientId || result.clientId,
      winner: winnerData,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      testId,
      winner: updatedResult?.winner,
      allMetrics: metricsWithRates,
      message: "Winner determined and learnings recorded",
    });
  } catch (err) {
    console.error("[/api/ai/ab-testing/results PATCH]", err);
    return NextResponse.json(
      {
        error: "Failed to analyze results",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function generateWinnerInsights(
  apiKey: string,
  testId: string,
  winner: any,
  allMetrics: any[],
  clientId: string | undefined
): Promise<{ recommendedNextSteps: string } | null> {
  try {
    const systemPrompt = `You are an expert A/B testing analyst for Hebrew RTL marketing. Analyze the A/B test results and provide concise, actionable next steps. Be direct and strategic.`;

    const userPrompt = `
A/B Test Results Summary:
- Test ID: ${testId}
- Winner: Variation ${winner.variationId}
- Conversion Rate: ${winner.conversionRate.toFixed(2)}%
- Click Rate: ${winner.clickRate.toFixed(2)}%
- Total Conversions: ${winner.conversions}
- Total Clicks: ${winner.clicks}

Other Variations Performance:
${allMetrics.map((m) => `- Variation ${m.variationId}: ${m.conversionRate.toFixed(2)}% conversion, ${m.clickRate.toFixed(2)}% click rate`).join("\n")}

Provide 2-3 specific, actionable next steps to scale this winner and improve future tests. Be brief and tactical.
    `;

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
        temperature: 0.6,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      return {
        recommendedNextSteps: content.trim(),
      };
    }

    return null;
  } catch (err) {
    console.error("[generateWinnerInsights]", err);
    return null;
  }
}
