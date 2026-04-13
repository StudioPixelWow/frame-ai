/**
 * FrameAI — Highlight classifiers.
 *
 * Each classifier is a pure function:
 *   (text: string) => ClassifierScore
 *
 * Design rules:
 *  - All arithmetic, no randomness, no I/O.
 *  - Weights are normalised so the maximum achievable raw score equals the
 *    normFactor; the returned score is always in [0, 1].
 *  - Matching is case-insensitive, whole-word (word-boundary aware).
 */

import type { ClassifierScore, HighlightType } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns every signal phrase that appears in `text`.
 * Phrases are matched case-insensitively; multi-word phrases are matched
 * as substrings (no word-boundary requirement) while single words require
 * word boundaries.
 */
function matchSignals(
  text: string,
  signals: Record<string, number>
): { matched: string[]; rawScore: number } {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  let rawScore = 0;

  for (const [signal, weight] of Object.entries(signals)) {
    // Use word boundaries for single-word signals; substring for phrases
    const isPhrase = signal.includes(" ");
    const pattern = isPhrase
      ? signal.toLowerCase()
      : `\\b${signal.toLowerCase()}\\b`;

    const regex = isPhrase
      ? new RegExp(pattern, "g")
      : new RegExp(pattern, "g");

    if (regex.test(lower)) {
      matched.push(signal);
      rawScore += weight;
    }
  }

  return { matched, rawScore };
}

/** Clamps a value to [0, 1]. */
function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ─── Signal dictionaries ──────────────────────────────────────────────────────

/**
 * Strong statement signals: superlatives, certainty language, numeric
 * precision, absolute claims.
 * normFactor: 1.5  (so even if all high-weight signals fire, score ≤ 1.0)
 */
const STRONG_STATEMENT_SIGNALS: Record<string, number> = {
  // Superlatives
  "best":          0.25,
  "worst":         0.20,
  "fastest":       0.25,
  "largest":       0.20,
  "biggest":       0.20,
  "greatest":      0.25,
  "most":          0.15,
  "highest":       0.20,
  "lowest":        0.20,
  "only":          0.30,
  "unique":        0.25,
  "first":         0.20,
  "number one":    0.35,
  "#1":            0.35,
  "top":           0.15,

  // Certainty / absolutism
  "always":        0.20,
  "never":         0.20,
  "every":         0.15,
  "guaranteed":    0.40,
  "guarantee":     0.40,
  "proven":        0.35,
  "proof":         0.30,
  "fact":          0.20,
  "definitely":    0.20,
  "absolutely":    0.20,
  "without doubt": 0.35,
  "certain":       0.20,
  "100%":          0.35,

  // Numeric precision (signals credibility)
  "% more":        0.25,
  "% less":        0.25,
  "% faster":      0.25,
  "times faster":  0.30,
  "times more":    0.30,
  "x faster":      0.25,
  "million":       0.20,
  "billion":       0.25,
  "thousand":      0.15,
};
const STRONG_STATEMENT_NORM = 1.5;

/**
 * Emotional peak signals: high-affect words, tension, personal story markers,
 * vulnerability language.
 * normFactor: 1.4
 */
const EMOTIONAL_PEAK_SIGNALS: Record<string, number> = {
  // High positive affect
  "love":          0.25,
  "amazing":       0.25,
  "incredible":    0.30,
  "extraordinary": 0.35,
  "remarkable":    0.30,
  "beautiful":     0.20,
  "passionate":    0.30,
  "excited":       0.20,
  "thrilled":      0.25,
  "proud":         0.25,
  "inspired":      0.25,
  "grateful":      0.25,
  "thankful":      0.20,
  "joy":           0.25,
  "happiness":     0.25,

  // High negative affect / tension
  "struggle":      0.30,
  "struggled":     0.30,
  "difficult":     0.20,
  "challenge":     0.20,
  "fear":          0.25,
  "scared":        0.25,
  "worried":       0.20,
  "frustrated":    0.25,
  "desperate":     0.30,
  "crisis":        0.35,
  "pain":          0.25,
  "hurt":          0.20,
  "lost":          0.15,
  "failed":        0.25,
  "failure":       0.25,

  // Personal story / vulnerability
  "i remember":    0.35,
  "i realized":    0.30,
  "i discovered":  0.25,
  "when i was":    0.25,
  "it changed":    0.30,
  "changed my life": 0.40,
  "turning point": 0.40,
  "moment i":      0.25,
  "personally":    0.20,
  "honest":        0.20,
  "truth is":      0.30,
  "admit":         0.25,
};
const EMOTIONAL_PEAK_NORM = 1.4;

/**
 * Benefit-driven signals: outcome words, ROI language, comparative value,
 * ease/simplicity markers.
 * normFactor: 1.5
 */
const BENEFIT_DRIVEN_SIGNALS: Record<string, number> = {
  // Outcome / result language
  "result":        0.20,
  "results":       0.20,
  "outcome":       0.20,
  "achieve":       0.20,
  "achieved":      0.20,
  "success":       0.20,
  "succeed":       0.20,
  "grow":          0.15,
  "growth":        0.20,
  "increase":      0.20,
  "improved":      0.20,
  "improvement":   0.20,
  "boost":         0.20,
  "gain":          0.15,
  "save":          0.20,
  "saving":        0.20,
  "revenue":       0.25,
  "profit":        0.25,
  "roi":           0.30,
  "return on":     0.30,

  // Comparative value
  "better than":   0.30,
  "more than":     0.15,
  "instead of":    0.15,
  "compared to":   0.20,
  "unlike":        0.20,
  "outperform":    0.35,
  "advantage":     0.25,
  "benefit":       0.25,
  "value":         0.15,

  // Ease / simplicity
  "easy":          0.20,
  "simple":        0.20,
  "effortless":    0.30,
  "in minutes":    0.30,
  "instantly":     0.25,
  "automatically": 0.25,
  "without":       0.10,
  "no need to":    0.25,
  "no more":       0.25,
  "eliminate":     0.25,
  "solve":         0.20,
  "solution":      0.20,
};
const BENEFIT_DRIVEN_NORM = 1.5;

/**
 * Action-driving signals: imperatives, CTA language, urgency, scarcity.
 * normFactor: 1.4
 */
const ACTION_DRIVING_SIGNALS: Record<string, number> = {
  // Direct imperatives
  "start":         0.20,
  "begin":         0.20,
  "try":           0.20,
  "get started":   0.35,
  "sign up":       0.40,
  "sign up now":   0.50,
  "join":          0.25,
  "join now":      0.45,
  "download":      0.30,
  "click":         0.30,
  "go to":         0.20,
  "visit":         0.20,
  "call":          0.20,
  "book":          0.25,
  "book now":      0.40,
  "schedule":      0.25,
  "register":      0.30,
  "subscribe":     0.30,
  "buy":           0.25,
  "purchase":      0.25,
  "order":         0.20,
  "claim":         0.30,

  // CTA language
  "don't miss":    0.35,
  "don't wait":    0.35,
  "act now":       0.45,
  "limited time":  0.40,
  "limited offer": 0.40,
  "today only":    0.45,
  "expires":       0.35,
  "last chance":   0.40,
  "deadline":      0.35,

  // Urgency / scarcity
  "now":           0.10,
  "today":         0.10,
  "immediately":   0.25,
  "hurry":         0.30,
  "quickly":       0.15,
  "running out":   0.35,
  "while supplies": 0.35,
  "spots left":    0.35,
  "few remaining": 0.40,
  "only available": 0.35,
  "exclusive":     0.25,
};
const ACTION_DRIVING_NORM = 1.4;

// ─── Classifier functions ─────────────────────────────────────────────────────

export function classifyStrongStatement(text: string): ClassifierScore {
  const { matched, rawScore } = matchSignals(text, STRONG_STATEMENT_SIGNALS);
  return {
    type: "strong-statement",
    score: clamp(rawScore / STRONG_STATEMENT_NORM),
    matched,
  };
}

export function classifyEmotionalPeak(text: string): ClassifierScore {
  const { matched, rawScore } = matchSignals(text, EMOTIONAL_PEAK_SIGNALS);
  return {
    type: "emotional-peak",
    score: clamp(rawScore / EMOTIONAL_PEAK_NORM),
    matched,
  };
}

export function classifyBenefitDriven(text: string): ClassifierScore {
  const { matched, rawScore } = matchSignals(text, BENEFIT_DRIVEN_SIGNALS);
  return {
    type: "benefit-driven",
    score: clamp(rawScore / BENEFIT_DRIVEN_NORM),
    matched,
  };
}

export function classifyActionDriving(text: string): ClassifierScore {
  const { matched, rawScore } = matchSignals(text, ACTION_DRIVING_SIGNALS);
  return {
    type: "action-driving",
    score: clamp(rawScore / ACTION_DRIVING_NORM),
    matched,
  };
}

/** Run all four classifiers and return their scores. */
export function runAllClassifiers(text: string): ClassifierScore[] {
  return [
    classifyStrongStatement(text),
    classifyEmotionalPeak(text),
    classifyBenefitDriven(text),
    classifyActionDriving(text),
  ];
}
