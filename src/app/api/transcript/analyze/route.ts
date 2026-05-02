/**
 * POST /api/transcript/analyze
 *
 * Analyzes a transcript and optionally persists the result.
 *
 * Request body (JSON):
 * {
 *   segments:   TranscriptSegment[]   // required
 *   projectId?: string                // if provided, result is stored
 *   provider?:  "anthropic"|"fallback"
 *   model?:     string                // Anthropic model override
 * }
 *
 * Response 200 — TranscriptAnalysis JSON
 * Response 400 — { error: string }
 * Response 500 — { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeTranscript }         from "@/lib/transcript";
import type { TranscriptSegment }    from "@/lib/transcript";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { segments, projectId, provider, model } = body as {
    segments?: unknown;
    projectId?: string;
    provider?: string;
    model?: string;
  };

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
      typeof s.id       !== "string" ||
      typeof s.startMs  !== "number" ||
      typeof s.endMs    !== "number" ||
      typeof s.speaker  !== "string" ||
      typeof s.text     !== "string"
    ) {
      return NextResponse.json(
        { error: `segments[${i}] is missing required fields (id, startMs, endMs, speaker, text)` },
        { status: 400 }
      );
    }
    validSegments.push(s as TranscriptSegment);
  }

  const forceProvider =
    provider === "anthropic" || provider === "fallback" ? provider : undefined;

  try {
    const analysis = await analyzeTranscript(validSegments, {
      projectId,
      forceProvider,
      model,
    });
    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[/api/transcript/analyze]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
