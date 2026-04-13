/**
 * GET    /api/hooks/:projectId  — retrieve stored hooks
 * POST   /api/hooks/:projectId  — generate & store hooks
 * DELETE /api/hooks/:projectId  — remove stored hooks
 *
 * POST body (JSON):
 * {
 *   analysis:   TranscriptAnalysis   // required
 *   highlights?: HighlightResult     // optional — improves signal quality
 *   preset?:    string               // "pixel-premium" | "pixel-performance" | "pixel-social"
 *   forceStyles?: [HookStyle, HookStyle, HookStyle]
 *   maxChars?:  number               // default 110
 * }
 */

import { NextRequest, NextResponse }  from "next/server";
import { generateHooks }              from "@/lib/hooks/generate";
import { storeHooks, getHooks,
         deleteHooks }                from "@/lib/hooks/storage";
import type { GenerateHooksOptions }  from "@/lib/hooks/types";
import type { TranscriptAnalysis }    from "@/lib/transcript/types";
import type { HighlightResult }       from "@/lib/transcript/highlights/types";

type Params = { params: Promise<{ projectId: string }> };

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const result = getHooks(projectId);

  if (!result) {
    return NextResponse.json(
      { error: `No hooks found for project "${projectId}"` },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { analysis, highlights, preset, forceStyles, maxChars } = body as {
    analysis?:    unknown;
    highlights?:  unknown;
    preset?:      string;
    forceStyles?: unknown;
    maxChars?:    number;
  };

  // Validate analysis
  if (!analysis || typeof analysis !== "object") {
    return NextResponse.json(
      { error: "analysis is required and must be a TranscriptAnalysis object" },
      { status: 400 }
    );
  }

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

  // Validate forceStyles if provided
  const VALID_STYLES = ["question", "bold-statement", "curiosity", "benefit-driven"];
  if (forceStyles !== undefined) {
    if (
      !Array.isArray(forceStyles) ||
      forceStyles.length !== 3    ||
      forceStyles.some(s => !VALID_STYLES.includes(s as string))
    ) {
      return NextResponse.json(
        {
          error:
            `forceStyles must be an array of exactly 3 styles from: ${VALID_STYLES.join(", ")}`,
        },
        { status: 400 }
      );
    }
  }

  const options: GenerateHooksOptions = {};
  if (preset)           options.preset       = preset;
  if (forceStyles)      options.forceStyles  = forceStyles as GenerateHooksOptions["forceStyles"];
  if (typeof maxChars === "number") options.maxChars = maxChars;

  try {
    const result = generateHooks(
      analysis as TranscriptAnalysis,
      highlights as HighlightResult | undefined,
      options
    );
    const stored = storeHooks(projectId, result);
    return NextResponse.json(stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hook generation failed";
    console.error("[/api/hooks/:projectId POST]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const deleted = deleteHooks(projectId);

  if (!deleted) {
    return NextResponse.json(
      { error: `No hooks found for project "${projectId}"` },
      { status: 404 }
    );
  }

  return NextResponse.json({ deleted: true, projectId });
}
