/**
 * FrameAI — Transcript analysis orchestrator.
 *
 * Single public entry point. Selects provider, runs analysis, stamps metadata,
 * and optionally persists the result. Falls back to rule-based analysis on any
 * AI provider failure.
 *
 * Usage:
 *   import { analyzeTranscript } from "@/lib/transcript";
 *   const result = await analyzeTranscript(segments, { projectId: "p1" });
 */

import type { TranscriptSegment, TranscriptAnalysis, AnalyzeOptions } from "./types";
import { analyzeWithAnthropic } from "./providers/anthropic";
import { analyzeWithFallback   } from "./providers/fallback";
import { storeAnalysis          } from "./storage";

// ── Provider selection ────────────────────────────────────────────────────────

function isAnthropicAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

// ── Metadata stamp ────────────────────────────────────────────────────────────

function stampMetadata(
  analysis: TranscriptAnalysis,
  segments: TranscriptSegment[],
  provider: "anthropic" | "fallback"
): TranscriptAnalysis {
  const allText    = segments.map((s) => s.text).join(" ");
  const wordCount  = allText.trim() ? allText.trim().split(/\s+/).length : 0;
  const speakers   = new Set(segments.map((s) => s.speaker)).size;
  const durationMs = segments.length > 0
    ? segments[segments.length - 1].endMs - segments[0].startMs
    : 0;

  return {
    ...analysis,
    metadata: {
      analyzedAt:    new Date().toISOString(),
      provider,
      wordCount,
      speakerCount:  speakers,
      durationMs,
      schemaVersion: "1.0",
    },
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function analyzeTranscript(
  segments: TranscriptSegment[],
  options: AnalyzeOptions = {}
): Promise<TranscriptAnalysis> {
  const { projectId, forceProvider, model } = options;

  let analysis: TranscriptAnalysis;
  let provider: "anthropic" | "fallback";

  if (forceProvider === "fallback") {
    // Explicit override — skip AI entirely
    analysis  = analyzeWithFallback(segments);
    provider  = "fallback";
  } else if (forceProvider === "anthropic" || isAnthropicAvailable()) {
    // Try Anthropic; fall back transparently on any failure
    try {
      analysis = await analyzeWithAnthropic(segments, model);
      provider = "anthropic";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[PixelManageAI] Anthropic analysis failed — using fallback. Reason: ${message}`
      );
      analysis = analyzeWithFallback(segments);
      provider = "fallback";
    }
  } else {
    // No API key configured
    analysis = analyzeWithFallback(segments);
    provider = "fallback";
  }

  // Stamp metadata (overrides any partial metadata the provider may have set)
  const stamped = stampMetadata(analysis, segments, provider);

  // Persist if a project ID was provided
  if (projectId) {
    try {
      await storeAnalysis(projectId, stamped);
    } catch (err) {
      // Storage failure must not break the caller
      console.warn(`[PixelManageAI] Failed to store analysis for project "${projectId}":`, err);
    }
  }

  return stamped;
}
