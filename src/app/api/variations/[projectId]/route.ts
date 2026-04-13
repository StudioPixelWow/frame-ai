/**
 * GET    /api/variations/:projectId  — retrieve stored variation result
 * POST   /api/variations/:projectId  — generate & store variations
 * DELETE /api/variations/:projectId  — remove stored variations
 *
 * POST body (JSON) — all fields optional except segments:
 * {
 *   segments:    TranscriptSegment[]   // required — source transcript
 *   highlights?: HighlightResult       // optional — enriches metadata flag
 *   hookResult?: HookResult            // optional — hook pool to select from
 *   ctaResult?:  CtaResult             // optional — CTA pool to select from
 *   trimResult?: TrimResult            // optional — trim plans to build segments from
 *   strategies?: VariationStrategy[]   // optional — subset of strategies to run
 * }
 *
 * Without hookResult / ctaResult / trimResult the module degrades gracefully:
 *   - selectedHook / selectedCta → null
 *   - segments → [] (no trim data to draw from)
 * This allows incremental adoption as each upstream module is activated.
 */

import { NextRequest, NextResponse }          from "next/server";
import { generateVariations }                 from "@/lib/variations/generate";
import {
  storeVariations,
  getVariations,
  deleteVariations,
}                                             from "@/lib/variations/storage";
import { ALL_STRATEGIES }                     from "@/lib/variations/strategies";
import type { VariationStrategy }             from "@/lib/variations/types";
import type { TranscriptSegment }             from "@/lib/transcript/types";
import type { HighlightResult }               from "@/lib/transcript/highlights/types";
import type { HookResult }                    from "@/lib/hooks/types";
import type { CtaResult }                     from "@/lib/cta/types";
import type { TrimResult }                    from "@/lib/trimmer/types";

type Params = { params: Promise<{ projectId: string }> };

const VALID_STRATEGIES = new Set<string>(ALL_STRATEGIES);

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const result = getVariations(projectId);

  if (!result) {
    return NextResponse.json(
      { error: `No variations found for project "${projectId}"` },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  // ── Validate: segments required ──────────────────────────────────────────────
  const { segments, highlights, hookResult, ctaResult, trimResult, strategies } = body;

  if (!Array.isArray(segments) || segments.length === 0) {
    return NextResponse.json(
      { error: "`segments` must be a non-empty array of TranscriptSegment objects." },
      { status: 400 }
    );
  }

  // ── Validate: strategies (if provided) ───────────────────────────────────────
  let resolvedStrategies: VariationStrategy[] | undefined;
  if (strategies !== undefined) {
    if (!Array.isArray(strategies) || strategies.length === 0) {
      return NextResponse.json(
        { error: "`strategies` must be a non-empty array of strategy names." },
        { status: 400 }
      );
    }
    const invalid = (strategies as string[]).filter(s => !VALID_STRATEGIES.has(s));
    if (invalid.length) {
      return NextResponse.json(
        {
          error: `Invalid strategy name(s): ${invalid.join(", ")}.`,
          valid:  ALL_STRATEGIES,
        },
        { status: 400 }
      );
    }
    resolvedStrategies = strategies as VariationStrategy[];
  }

  // ── Generate ─────────────────────────────────────────────────────────────────
  try {
    const result = generateVariations(
      segments       as TranscriptSegment[],
      highlights     as HighlightResult    | undefined,
      hookResult     as HookResult         | undefined,
      ctaResult      as CtaResult          | undefined,
      trimResult     as TrimResult         | undefined,
      resolvedStrategies ? { strategies: resolvedStrategies } : {}
    );

    const stored = storeVariations(projectId, result);
    return NextResponse.json(stored, { status: 201 });

  } catch (err) {
    console.error("[variations/POST]", err);
    return NextResponse.json(
      { error: "Variation generation failed.", detail: String(err) },
      { status: 500 }
    );
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const deleted = deleteVariations(projectId);

  if (!deleted) {
    return NextResponse.json(
      { error: `No variations found for project "${projectId}"` },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, projectId });
}
