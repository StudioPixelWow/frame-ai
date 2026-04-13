/**
 * GET  /api/transcript/:projectId/highlights  — retrieve stored highlights
 * POST /api/transcript/:projectId/highlights  — detect & store highlights
 * DELETE /api/transcript/:projectId/highlights — remove stored highlights
 *
 * POST body (JSON):
 * {
 *   segments: TranscriptSegment[]   // required
 *   minPriority?: "high"|"medium"|"low"
 *   thresholds?: { high?: number; medium?: number }
 * }
 */

import { NextRequest, NextResponse }    from "next/server";
import { detectHighlights }             from "@/lib/transcript/highlights/detect";
import {
  storeHighlights,
  getHighlights,
  deleteHighlights,
}                                       from "@/lib/transcript/highlights/storage";
import type { TranscriptSegment }       from "@/lib/transcript/types";
import type { DetectOptions }           from "@/lib/transcript/highlights/types";

type Params = { params: Promise<{ projectId: string }> };

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, context: Params) {
  const { projectId } = await context.params;
  const result = getHighlights(projectId);

  if (!result) {
    return NextResponse.json(
      { error: `No highlights found for project "${projectId}"` },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, context: Params) {
  const { projectId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { segments, minPriority, thresholds } = body as {
    segments?: unknown;
    minPriority?: string;
    thresholds?: { high?: number; medium?: number };
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
        {
          error: `segments[${i}] is missing required fields (id, startMs, endMs, speaker, text)`,
        },
        { status: 400 }
      );
    }
    validSegments.push(s as TranscriptSegment);
  }

  // Build options
  const options: DetectOptions = {};
  if (minPriority === "high" || minPriority === "medium" || minPriority === "low") {
    options.minPriority = minPriority;
  }
  if (thresholds) {
    options.thresholds = {};
    if (typeof thresholds.high === "number")   options.thresholds.high   = thresholds.high;
    if (typeof thresholds.medium === "number") options.thresholds.medium = thresholds.medium;
  }

  try {
    const result = detectHighlights(validSegments, options);
    const stored = storeHighlights(projectId, result);
    return NextResponse.json(stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Highlight detection failed";
    console.error("[/api/transcript/:projectId/highlights POST]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, context: Params) {
  const { projectId } = await context.params;
  const deleted = deleteHighlights(projectId);

  if (!deleted) {
    return NextResponse.json(
      { error: `No highlights found for project "${projectId}"` },
      { status: 404 }
    );
  }

  return NextResponse.json({ deleted: true, projectId });
}
