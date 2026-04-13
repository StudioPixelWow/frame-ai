/**
 * GET    /api/broll/:projectId  — retrieve stored B-roll suggestions
 * POST   /api/broll/:projectId  — generate & store B-roll suggestions
 * DELETE /api/broll/:projectId  — remove stored suggestions
 *
 * POST body (JSON):
 * {
 *   segments:     TranscriptSegment[]  // required
 *   highlights?:  HighlightResult      // optional
 *   tone?:        string               // TranscriptTone — biases mood keywords
 *   minPriority?: "high"|"medium"|"low"
 *   maxSearchTerms?:         number    // default 5
 *   maxKeywordsPerCategory?: number    // default 6
 * }
 */

import { NextRequest, NextResponse }    from "next/server";
import { generateBroll }                from "@/lib/broll/generate";
import { storeBroll, getBroll,
         deleteBroll }                  from "@/lib/broll/storage";
import type { GenerateBrollOptions }    from "@/lib/broll/types";
import type { TranscriptSegment }       from "@/lib/transcript/types";
import type { HighlightResult }         from "@/lib/transcript/highlights/types";

type Params = { { params }: { params: { id: string } }<{ projectId: string }> };

const VALID_TONES      = ["energetic","persuasive","educational","inspirational","professional","casual"];
const VALID_PRIORITIES = ["high","medium","low"];

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = params;
  const result = getBroll(projectId);

  if (!result) {
    return NextResponse.json(
      { error: `No B-roll suggestions found for project "${projectId}"` },
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
    tone,
    minPriority,
    maxSearchTerms,
    maxKeywordsPerCategory,
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
        { error: `segments[${i}] must have: id (string), startMs, endMs (number), speaker, text (string)` },
        { status: 400 }
      );
    }
    validSegments.push(s as TranscriptSegment);
  }

  // Validate optional fields
  if (tone !== undefined && !VALID_TONES.includes(tone as string)) {
    return NextResponse.json(
      { error: `Invalid tone. Valid values: ${VALID_TONES.join(", ")}` },
      { status: 400 }
    );
  }

  if (minPriority !== undefined && !VALID_PRIORITIES.includes(minPriority as string)) {
    return NextResponse.json(
      { error: `Invalid minPriority. Valid values: ${VALID_PRIORITIES.join(", ")}` },
      { status: 400 }
    );
  }

  const options: GenerateBrollOptions = {};
  if (tone)                             options.tone                    = tone as string;
  if (minPriority)                      options.minPriority             = minPriority as GenerateBrollOptions["minPriority"];
  if (typeof maxSearchTerms === "number")
                                        options.maxSearchTerms          = maxSearchTerms;
  if (typeof maxKeywordsPerCategory === "number")
                                        options.maxKeywordsPerCategory  = maxKeywordsPerCategory;

  try {
    const result = generateBroll(
      validSegments,
      highlights as HighlightResult | undefined,
      options
    );
    const stored = storeBroll(projectId, result);
    return NextResponse.json(stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : "B-roll generation failed";
    console.error("[/api/broll/:projectId POST]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { projectId } = params;
  const deleted = deleteBroll(projectId);

  if (!deleted) {
    return NextResponse.json(
      { error: `No B-roll suggestions found for project "${projectId}"` },
      { status: 404 }
    );
  }

  return NextResponse.json({ deleted: true, projectId });
}
