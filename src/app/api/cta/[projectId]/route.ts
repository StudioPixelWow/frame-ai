/**
 * GET    /api/cta/:projectId  — retrieve stored CTAs
 * POST   /api/cta/:projectId  — generate & store CTAs
 * DELETE /api/cta/:projectId  — remove stored CTAs
 *
 * POST body (JSON):
 * {
 *   goal:          CtaGoal            // required
 *   analysis?:     TranscriptAnalysis // optional — enriches topic/benefit signals
 *   businessType?: string             // "agency" | "saas" | "ecommerce" | ...
 *   preset?:       string             // "pixel-premium" | "pixel-performance" | "pixel-social"
 *   tone?:         string             // TranscriptTone
 *   topic?:        string             // override primary topic
 *   benefit?:      string             // override benefit phrase
 *   count?:        2 | 3             // default 3
 *   maxChars?:     number             // default 60
 * }
 */

import { NextRequest, NextResponse }  from "next/server";
import { generateCtas }               from "@/lib/cta/generate";
import { storeCtas, getCtas,
         deleteCtas }                 from "@/lib/cta/storage";
import type { GenerateCtaOptions,
              CtaGoal }               from "@/lib/cta/types";
import type { TranscriptAnalysis }    from "@/lib/transcript/types";

type Params = { { params }: { params: { id: string } }<{ projectId: string }> };

const VALID_GOALS: CtaGoal[] = [
  "lead-generation", "awareness", "inquiry", "booking", "contact",
];
const VALID_TONES = [
  "energetic", "persuasive", "educational", "inspirational", "professional", "casual",
];

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = params;
  const result = getCtas(projectId);

  if (!result) {
    return NextResponse.json(
      { error: `No CTAs found for project "${projectId}"` },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    goal,
    analysis,
    businessType,
    preset,
    tone,
    topic,
    benefit,
    count,
    maxChars,
  } = body as Record<string, unknown>;

  // Validate goal
  if (!goal || !VALID_GOALS.includes(goal as CtaGoal)) {
    return NextResponse.json(
      {
        error: `goal is required. Valid values: ${VALID_GOALS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Validate tone if provided
  if (tone !== undefined && !VALID_TONES.includes(tone as string)) {
    return NextResponse.json(
      { error: `Invalid tone. Valid values: ${VALID_TONES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate count if provided
  if (count !== undefined && count !== 2 && count !== 3) {
    return NextResponse.json(
      { error: "count must be 2 or 3" },
      { status: 400 }
    );
  }

  // Validate analysis shape if provided
  if (analysis !== undefined) {
    const a = analysis as Record<string, unknown>;
    if (
      typeof a.summary   !== "string" ||
      !Array.isArray(a.keyTopics)    ||
      !Array.isArray(a.keywords)     ||
      typeof a.tone      !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "analysis must include: summary (string), keyTopics (array), " +
            "keywords (array), tone (string)",
        },
        { status: 400 }
      );
    }
  }

  const options: GenerateCtaOptions = {};
  if (businessType && typeof businessType === "string") options.businessType = businessType;
  if (preset        && typeof preset === "string")       options.preset       = preset;
  if (tone          && typeof tone === "string")          options.tone         = tone as GenerateCtaOptions["tone"];
  if (topic         && typeof topic === "string")         options.topic        = topic;
  if (benefit       && typeof benefit === "string")       options.benefit      = benefit;
  if (count === 2 || count === 3)                         options.count        = count;
  if (typeof maxChars === "number")                       options.maxChars     = maxChars;

  try {
    const result = generateCtas(
      goal as CtaGoal,
      options,
      analysis as TranscriptAnalysis | undefined
    );
    const stored = storeCtas(projectId, result);
    return NextResponse.json(stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : "CTA generation failed";
    console.error("[/api/cta/:projectId POST]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { projectId } = params;
  const deleted = deleteCtas(projectId);

  if (!deleted) {
    return NextResponse.json(
      { error: `No CTAs found for project "${projectId}"` },
      { status: 404 }
    );
  }

  return NextResponse.json({ deleted: true, projectId });
}
