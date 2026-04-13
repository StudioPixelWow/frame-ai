/**
 * FrameAI — B-roll suggestion orchestrator.
 *
 * Takes transcript segments (and optional highlight data) and produces
 * structured B-roll suggestions per segment:
 *
 *   keywords  → categorised (visual / action / mood)
 *   searchTerms → ranked, composed, ready for stock API or manual lookup
 *
 * Fully deterministic — no randomness, no I/O.
 */

import {
  extractVisualKeywords,
  extractActionKeywords,
  extractMoodKeywords,
  extractWeightedSignals,
  TONE_MOOD_DEFAULTS,
}                                         from "./keywords";
import type {
  BrollKeywords,
  BrollResult,
  BrollSegmentSuggestion,
  BrollSearchTerm,
  GenerateBrollOptions,
  BrollGenerationMetadata,
}                                         from "./types";
import type { TranscriptSegment }         from "@/lib/transcript/types";
import type { HighlightResult }           from "@/lib/transcript/highlights/types";
import type { HighlightPriority }         from "@/lib/transcript/highlights/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_SEARCH_TERMS          = 5;
const DEFAULT_MAX_KEYWORDS_PER_CATEGORY = 6;
const PRIORITY_RANK: Record<HighlightPriority, number> = {
  high: 2, medium: 1, low: 0,
};

// ─── Search-term composition ──────────────────────────────────────────────────

/**
 * Compose ranked BrollSearchTerms from the weighted signal bundles.
 *
 * Strategy:
 *  1. Single-category terms (visual-only, action-only) — scored by weight
 *  2. Combined terms (visual + action) — scored by sum, capped at 1.0
 *  3. Mood-qualified terms (visual + mood) — for atmosphere shots
 *  4. Deduplicate by composed string
 *  5. Sort by score, return top-N
 */
function composeSearchTerms(
  weighted: ReturnType<typeof extractWeightedSignals>,
  maxTerms: number
): BrollSearchTerm[] {
  const candidates: BrollSearchTerm[] = [];
  const seen = new Set<string>();

  function add(
    composed: string,
    score: number,
    source: BrollSearchTerm["source"]
  ) {
    const key = composed.toLowerCase().trim();
    if (seen.has(key) || key.length < 3) return;
    seen.add(key);
    candidates.push({ composed: composed.trim(), score: Math.min(1, score), source });
  }

  const { visual, action, mood } = weighted;

  // 1. Top visual terms stand alone
  for (const v of visual.slice(0, 4)) {
    add(v.term, v.weight, "visual");
  }

  // 2. Top action terms stand alone
  for (const a of action.slice(0, 3)) {
    add(a.term, a.weight, "action");
  }

  // 3. Combined: top visual + top action (most filmable combination)
  for (const v of visual.slice(0, 2)) {
    for (const a of action.slice(0, 2)) {
      const score   = (v.weight + a.weight) / 2 + 0.1; // bonus for multi-signal
      const composed = `${a.term} ${v.term}`;
      add(composed, score, "combined");
    }
  }

  // 4. Mood-qualified visual (for atmosphere / cutaway shots)
  if (mood.length > 0 && visual.length > 0) {
    const topMood   = mood[0];
    const topVisual = visual[0];
    const score     = (topMood.weight + topVisual.weight) / 2;
    add(`${topMood.term} ${topVisual.term}`, score, "mood");
  }

  // 5. Sort by score descending, deduplicate overlapping phrases
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxTerms);
}

// ─── Per-segment processing ───────────────────────────────────────────────────

function processSegment(
  seg: TranscriptSegment,
  highlightPriority: HighlightPriority | null,
  options: GenerateBrollOptions
): BrollSegmentSuggestion {
  const maxKw    = options.maxKeywordsPerCategory ?? DEFAULT_MAX_KEYWORDS_PER_CATEGORY;
  const maxTerms = options.maxSearchTerms         ?? DEFAULT_MAX_SEARCH_TERMS;
  const tone     = options.tone;

  // High-priority segments get richer extraction (more keywords per pass)
  const kw_bonus = highlightPriority === "high" ? 2 : 0;

  const keywords: BrollKeywords = {
    visual: extractVisualKeywords(seg.text, maxKw + kw_bonus),
    action: extractActionKeywords(seg.text, Math.min(4 + kw_bonus, maxKw)),
    mood:   extractMoodKeywords(seg.text, tone, 3 + (kw_bonus > 0 ? 1 : 0)),
  };

  const weighted    = extractWeightedSignals(seg.text);
  // Re-inject tone-based mood defaults into weighted for composition
  if (weighted.mood.length === 0 && tone) {
    const defaults = TONE_MOOD_DEFAULTS[tone] ?? [];
    weighted.mood  = defaults.map(term => ({ term, weight: 0.6 }));
  }

  const searchTerms = composeSearchTerms(weighted, maxTerms);

  const durationMs  = Math.max(0, seg.endMs - seg.startMs);
  const durationNeededSec = Math.ceil(durationMs / 1000);

  return {
    segmentId:          seg.id,
    startMs:            seg.startMs,
    endMs:              seg.endMs,
    text:               seg.text,
    speaker:            seg.speaker,
    highlightPriority,
    keywords,
    searchTerms,
    durationNeededSec,
  };
}

// ─── Main entrypoint ──────────────────────────────────────────────────────────

/**
 * Generate B-roll suggestions for every transcript segment.
 *
 * @param segments   Transcript segments (from analyzeTranscript or raw input)
 * @param highlights Optional — enriches priority tagging per segment
 * @param options    maxSearchTerms, maxKeywordsPerCategory, tone, minPriority
 */
export function generateBroll(
  segments: TranscriptSegment[],
  highlights?: HighlightResult,
  options: GenerateBrollOptions = {}
): BrollResult {
  // Build a quick priority lookup from highlight data
  const priorityMap = new Map<string, HighlightPriority>();
  if (highlights) {
    for (const h of highlights.highlights) {
      priorityMap.set(h.segmentId, h.priority);
    }
  }

  const minRank = options.minPriority
    ? PRIORITY_RANK[options.minPriority]
    : -1;

  const suggestions: BrollSegmentSuggestion[] = [];

  for (const seg of segments) {
    const priority = priorityMap.get(seg.id) ?? null;

    // Filter by minPriority if requested
    if (options.minPriority && priority !== null) {
      if (PRIORITY_RANK[priority] < minRank) continue;
    }

    suggestions.push(processSegment(seg, priority, options));
  }

  const withTerms = suggestions.filter(s => s.searchTerms.length > 0);
  const totalTerms = suggestions.reduce(
    (sum, s) => sum + s.searchTerms.length,
    0
  );

  const metadata: BrollGenerationMetadata = {
    generatedAt:             new Date().toISOString(),
    schemaVersion:           "1.0",
    segmentsAnalyzed:        segments.length,
    segmentsWithSuggestions: withTerms.length,
    totalSearchTerms:        totalTerms,
    highlightsUsed:          !!highlights,
  };

  return { suggestions, metadata };
}

/**
 * Convenience: return only segments with at least one search term,
 * sorted by highlight priority (high first) then timeline order.
 */
export function getTopBrollSuggestions(
  segments: TranscriptSegment[],
  highlights?: HighlightResult,
  options: GenerateBrollOptions = {}
): BrollSegmentSuggestion[] {
  const result = generateBroll(segments, highlights, options);
  return result.suggestions
    .filter(s => s.searchTerms.length > 0)
    .sort((a, b) => {
      const rA = a.highlightPriority ? PRIORITY_RANK[a.highlightPriority] : -1;
      const rB = b.highlightPriority ? PRIORITY_RANK[b.highlightPriority] : -1;
      if (rB !== rA) return rB - rA;
      return a.startMs - b.startMs;
    });
}
