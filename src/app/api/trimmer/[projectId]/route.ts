/**
 * GET    /api/trimmer/:projectId  — retrieve stored trim plans
 * POST   /api/trimmer/:projectId  — generate & store trim plans
 * DELETE /api/trimmer/:projectId  — remove stored plans
 *
 * POST body (JSON):
 * {
 *   segments:     TranscriptSegment[]    // required
 *   highlights?:  HighlightResult        // optional
 *   analysis?:    TranscriptAnalysis     // optional
 *   targets?:     Array<{               // optional — default [15,30,45]
 *                   durationSec: number,
 *                   mode?: "strict"|"relaxed"
 *                 }>
 *   preserveHook?: boolean              // default true
 *   preserveCta?:  boolean              // default true
 *   minScore?:     number               // default 0.05
 * }
 */

import { NextRequest, NextResponse }   from "next/server";
import { generateTrimPlans }           from "@/lib/trimmer/generate";
import { storeTrimResult, getTrimResult,
         deleteTrimResult }            from "@/lib/trimmer/storage";
import type { GenerateTrimOptions,
              TrimTarget }             from "@/lib/trimmer/types";
import type { TranscriptSegment }      from "@/lib/transcript/types";
import type { TranscriptAnalysis }     from "@/lib/transcript/types";
import type { HighlightResult }        from "@/lib/transcript/highlights/types";

type Params = { { params }: { params: { id: string } }<{ projectId: string }> };

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = params;
  const result = getTrimResult(projectId);

  if (!result) {
    return NextResponse.json(
      { error: `No trim plans found for project "${projectId}"` },
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
    segments,
    highlights,
    analysis,
    targets,
    preserveHook,
    preserveCta,
    minScore,
  } = body as Record<string, unknown>;

  // Validate segments
  if (!Array.isArray(segments) || segments.length === 0) {
    return NextResponse.json(
      { error: "segments must be a non-empty array" },
      { status: 400 }
    );
  }

  const validSegments: TranscriptSegment[] = [];
  for (const [i, seg] of (segments as unknown[]).entries()) {
    const s = seg as Record<string, unknown>;
    if (
      typeof s.id      !== "string" ||
      typeof s.startMs !== "number" ||
      typeof s.endMs   !== "number" ||
      typeof s.speaker !== "string" ||
      typeof s.text    !== "string"
    ) {
      return NextResponse.json(
        { error: `segments[${i}] must have: id, startMs, endMs (number), speaker, text (string)` },
        { status: 400 }
      );
    }
    validSegments.push(s as TranscriptSegment);
  }

  // Validate targets if provided
  let validTargets: TrimTarget[] | undefined;
  if (targets !== undefined) {
    if (!Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { error: "targets must be a non-empty array of { durationSec, mode? }" },
        { status: 400 }
      );
    }
    validTargets = [];
    for (const [i, t] of (targets as unknown[]).entries()) {
      const tgt = t as Record<string, unknown>;
      if (typeof tgt.durationSec !== "number" || tgt.durationSec <= 0) {
        return NextResponse.json(
          { error: `targets[${i}].durationSec must be a positive number` },
          { status: 400 }
        );
      }
      if (tgt.mode !== undefined && tgt.mode !== "strict" && tgt.mode !== "relaxed") {
        return NextResponse.json(
          { error: `targets[${i}].mode must be "strict" or "relaxed"` },
          { status: 400 }
        );
      }
      validTargets.push({
        durationSec: tgt.durationSec as number,
        mode:        (tgt.mode as "strict" | "relaxed") ?? "relaxed",
      });
    }
  }

  const options: GenerateTrimOptions = {};
  if (validTargets)                          options.targets      = validTargets;
  if (typeof preserveHook === "boolean")     options.preserveHook = preserveHook;
  if (typeof preserveCta  === "boolean")     options.preserveCta  = preserveCta;
  if (typeof minScore     === "number")      options.minScore     = minScore;

  try {
    const result = generateTrimPlans(
      validSegments,
      highlights as HighlightResult  | undefined,
      analysis   as TranscriptAnalysis | undefined,
      options
    );
    const stored = storeTrimResult(projectId, result);
    return NextResponse.json(stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trim generation failed";
    console.error("[/api/trimmer/:projectId POST]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { projectId } = params;
  const deleted = deleteTrimResult(projectId);

  if (!deleted) {
    return NextResponse.json(
      { error: `No trim plans found for project "${projectId}"` },
      { status: 404 }
    );
  }

  return NextResponse.json({ deleted: true, projectId });
}
