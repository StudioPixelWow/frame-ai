/**
 * FrameAI — Hook generation orchestrator.
 *
 * Pipeline:
 *  1. Extract signals from TranscriptAnalysis (+ optional HighlightResult)
 *  2. Resolve 3 hook styles using preset bias → tone bias → rotation fallback
 *  3. For each style, select the best-fit template (deterministically)
 *  4. Fill template slots with extracted signals
 *  5. Trim to maxChars, stamp metadata, return HookResult
 *
 * Fully deterministic — no Math.random(), no Date.now() in scoring.
 */

import { TEMPLATE_BANK }                  from "./templates";
import type {
  ExtractedSignals,
  GenerateHooksOptions,
  Hook,
  HookResult,
  HookStyle,
  PresetName,
}                                          from "./types";
import type { TranscriptAnalysis,
              TranscriptTone }             from "@/lib/transcript/types";
import type { HighlightResult }            from "@/lib/transcript/highlights/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_CHARS = 110;

// Preset → preferred style order (first = primary hook)
const PRESET_STYLE_ORDER: Record<string, HookStyle[]> = {
  "pixel-premium":     ["bold-statement", "question",       "curiosity"],
  "pixel-performance": ["benefit-driven", "bold-statement", "question"],
  "pixel-social":      ["question",       "curiosity",      "benefit-driven"],
};

// Tone → preferred style order
const TONE_STYLE_ORDER: Record<TranscriptTone["primary"], HookStyle[]> = {
  energetic:     ["bold-statement", "question",       "benefit-driven", "curiosity"],
  persuasive:    ["benefit-driven", "bold-statement", "question",       "curiosity"],
  educational:   ["curiosity",      "question",       "bold-statement", "benefit-driven"],
  inspirational: ["question",       "curiosity",      "bold-statement", "benefit-driven"],
  professional:  ["bold-statement", "curiosity",      "benefit-driven", "question"],
  casual:        ["question",       "curiosity",      "benefit-driven", "bold-statement"],
  neutral:       ["bold-statement", "question",       "curiosity",      "benefit-driven"],
};

// All four styles in rotation order (fallback when nothing else is available)
const ALL_STYLES: HookStyle[] = [
  "bold-statement", "question", "benefit-driven", "curiosity",
];

// ─── Signal extraction ────────────────────────────────────────────────────────

/** Stop-words to strip from keyword phrases. */
const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","be","been","being","have","has","had","do",
  "does","did","will","would","could","should","may","might","shall",
  "that","this","these","those","it","its","i","we","you","they","he","she",
  "as","by","from","into","through","over","under","about","between","not",
]);

function toContentWords(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9 '-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Compress a phrase to ≤ N significant words for slot use. */
function shorten(phrase: string, maxWords = 4): string {
  const words = phrase.split(/\s+/).filter(Boolean);
  return words.length <= maxWords
    ? phrase
    : words.slice(0, maxWords).join(" ");
}

/**
 * Subject-strip heuristics: removes leading subject phrases so slot values
 * read as predicates / outcomes, not full sentences.
 *
 * "Our platform drives 3x revenue" → "3x revenue growth"
 * "FrameAI cuts editing time by 80%" → "80% time savings"
 */
function extractOutcomePhrase(text: string): string {
  // 1. Leading metric: "80% faster", "3x revenue"
  const leadingMetric = text.match(
    /^.*?(\d[\d,.]*\s*(?:x|%|times?))\s+([a-z]+(?:\s+[a-z]+)?)/i
  );
  if (leadingMetric) {
    return `${leadingMetric[1]} ${leadingMetric[2]}`.trim();
  }

  // 2. Trailing metric after "by N%" — grab 1 preceding noun + metric
  const trailingMetric = text.match(
    /\b([a-z]+)\s+by\s+(\d[\d,.]*\s*(?:x|%|times?))\s*$/i
  );
  if (trailingMetric) {
    return `${trailingMetric[2]} ${trailingMetric[1]} savings`.trim();
  }

  // 3. Any metric anywhere — take up to 2 words after it if they exist
  const anyMetric = text.match(
    /(\d[\d,.]*\s*(?:x|%|times?))\b((?:\s+[a-z]+){0,2})/i
  );
  if (anyMetric) {
    return `${anyMetric[1]}${anyMetric[2]}`.trim();
  }

  // 4. Strip leading subject-verb patterns like "Our X does Y" → keep Y
  const subjectVerbs =
    /^(?:our|this|the|we|it|they)\s+\w+\s+(?:drives?|delivers?|provides?|enables?|helps?|allows?|gives?|makes?|creates?|generates?|achieves?)\s+/i;
  const stripped = text.replace(subjectVerbs, "");
  if (stripped !== text) return shorten(stripped, 5);

  // 5. Strip "I/We/You + verb"
  const iVerb = /^(?:i|we|you)\s+\w+\s+/i;
  const strippedIVerb = text.replace(iVerb, "");
  if (strippedIVerb !== text) return shorten(strippedIVerb, 4);

  // 6. Final fallback: first 4 words
  return shorten(text, 4);
}

/**
 * Extract structured signals from the analysis.
 * Falls back gracefully when fields are sparse.
 */
export function extractSignals(
  analysis: TranscriptAnalysis,
  highlights?: HighlightResult
): ExtractedSignals {
  const { summary, keyTopics, keywords, tone, importantMoments } = analysis;

  // primaryTopic — first key topic, or first keyword
  const primaryTopic =
    shorten(keyTopics[0] ?? keywords[0] ?? "this topic", 4);

  // topKeyword / secondKeyword — top two content keywords
  const topKeyword    = keywords[0] ?? primaryTopic;
  const secondKeyword = keywords[1] ?? keywords[0] ?? "results";

  // topBenefit — from benefit-driven highlights first, then key-claim, then summary
  // Apply outcome-phrase extraction so slot values are concise outcomes, not
  // subject-verb sentences.
  const benefitHighlight = highlights?.highlights.find(
    h => h.dominantType === "benefit-driven" && h.priority !== "low"
  );
  const rawBenefit =
    benefitHighlight?.text ??
    importantMoments.find(m => m.type === "key-claim")?.text ??
    summary;
  const topBenefit = extractOutcomePhrase(rawBenefit);

  // topPain — look for tension / emotional-peak highlights
  const painHighlight = highlights?.highlights.find(
    h => h.dominantType === "emotional-peak"
  );
  const topPain = painHighlight
    ? shorten(painHighlight.text, 5)
    : buildPainPhrase(keywords, tone);

  // curiosityHook — from hook-type important moments or a curiosity phrase
  const hookMoment = importantMoments.find(m => m.type === "hook");
  const curiosityHook = hookMoment
    ? shorten(hookMoment.text, 6)
    : buildCuriosityPhrase(primaryTopic, keywords);

  // proofPoint — from proof-point moments or numeric extraction from summary
  const proofMoment = importantMoments.find(m => m.type === "proof-point");
  const proofPoint  = proofMoment
    ? extractOutcomePhrase(proofMoment.text)
    : buildProofPhrase(keywords, summary);

  return {
    primaryTopic,
    topBenefit,
    topPain,
    curiosityHook,
    proofPoint,
    topKeyword,
    secondKeyword,
  };
}

// ─── Fallback signal builders ─────────────────────────────────────────────────

function buildPainPhrase(keywords: string[], tone: TranscriptTone): string {
  const PAIN_TONE_MAP: Partial<Record<TranscriptTone, string>> = {
    energetic:     "slow progress",
    persuasive:    "missed opportunities",
    educational:   "confusion and guesswork",
    inspirational: "self-doubt",
    professional:  "inefficiency",
    casual:        "doing it the hard way",
  };
  return PAIN_TONE_MAP[tone] ?? `${keywords[0] ?? "this"} challenges`;
}

function buildCuriosityPhrase(topic: string, keywords: string[]): string {
  const kw = keywords[1] ?? keywords[0] ?? "strategy";
  return `${capitalise(topic)} isn't about ${kw}`;
}

function buildProofPhrase(keywords: string[], summary: string): string {
  // Look for numeric patterns in summary (percentages, multiples, timeframes)
  const numericMatch = summary.match(
    /\b(\d[\d,]*\s*%|\d+x|\d+\s*times|in\s+\d+\s+(?:days?|weeks?|months?|minutes?))\b/i
  );
  if (numericMatch) return numericMatch[0];
  return `${capitalise(keywords[0] ?? "this approach")} works`;
}

// ─── Style resolution ─────────────────────────────────────────────────────────

/**
 * Resolve which 3 styles to use, in order.
 * Priority: forceStyles > preset bias > tone bias > ALL_STYLES rotation.
 * Ensures no style repeats.
 */
export function resolveStyles(
  tone: TranscriptTone,
  preset?: PresetName,
  forceStyles?: [HookStyle, HookStyle, HookStyle]
): [HookStyle, HookStyle, HookStyle] {
  if (forceStyles) return forceStyles;

  // Build priority list: preset order first, then fill from tone order
  const presetOrder = preset ? (PRESET_STYLE_ORDER[preset] ?? []) : [];
  const tonePrimary = typeof tone === 'string' ? tone : tone.primary;
  const toneOrder   = TONE_STYLE_ORDER[tonePrimary] ?? ALL_STYLES;
  const combined    = [...presetOrder];

  for (const s of toneOrder) {
    if (!combined.includes(s)) combined.push(s);
  }
  // Fill any gaps with ALL_STYLES
  for (const s of ALL_STYLES) {
    if (!combined.includes(s)) combined.push(s);
  }

  return [combined[0], combined[1], combined[2]] as [HookStyle, HookStyle, HookStyle];
}

// ─── Template selection ───────────────────────────────────────────────────────

/**
 * Deterministically select a template from the bank.
 *
 * Selection heuristic (pure arithmetic):
 *  - Score each template by how many of its slot tokens overlap with
 *    non-trivial signals (i.e. signals that aren't the fallback placeholder).
 *  - Among equal scores, prefer the template whose index is derived from a
 *    hash of the primaryTopic string (prevents always picking index 0).
 */
function scoreTemplate(templateText: string, signals: ExtractedSignals): number {
  const slots: Array<keyof ExtractedSignals> = [
    "primaryTopic", "topBenefit", "topPain",
    "curiosityHook", "proofPoint", "topKeyword", "secondKeyword",
  ];
  let score = 0;
  for (const slot of slots) {
    const token = `{{${slotToken(slot)}}}`;
    if (templateText.includes(token)) {
      // Reward if the signal value is non-trivial (length > 5, has content words)
      const val = signals[slot];
      if (val.length > 5 && toContentWords(val).length > 0) score++;
    }
  }
  return score;
}

function slotToken(key: keyof ExtractedSignals): string {
  const MAP: Record<keyof ExtractedSignals, string> = {
    primaryTopic:   "topic",
    topBenefit:     "benefit",
    topPain:        "pain",
    curiosityHook:  "curiosity",
    proofPoint:     "proof",
    topKeyword:     "keyword",
    secondKeyword:  "keyword2",
  };
  return MAP[key];
}

/** Simple djb2-style string hash → non-negative integer. */
function strHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0; // keep 32-bit unsigned
  }
  return h;
}

function selectTemplate(
  style: HookStyle,
  signals: ExtractedSignals,
  styleIndex: number  // 0, 1, or 2 — prevents same template across all 3 hooks
): { text: string; rationale: string; editHint: string } {
  const bank   = TEMPLATE_BANK[style];
  const scores = bank.map((t, i) => ({ i, score: scoreTemplate(t.text, signals) }));

  // Sort by score desc; ties broken by a hash of primaryTopic + styleIndex
  const tiebreaker = strHash(signals.primaryTopic + styleIndex) % bank.length;
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Prefer index closest to tiebreaker (modular distance)
    const distA = Math.min(
      Math.abs(a.i - tiebreaker),
      bank.length - Math.abs(a.i - tiebreaker)
    );
    const distB = Math.min(
      Math.abs(b.i - tiebreaker),
      bank.length - Math.abs(b.i - tiebreaker)
    );
    return distA - distB;
  });

  const chosen = bank[scores[0].i];
  return { text: chosen.text, rationale: chosen.rationale, editHint: chosen.editHint };
}

// ─── Slot filling ─────────────────────────────────────────────────────────────

function fillSlots(template: string, signals: ExtractedSignals): string {
  return template
    .replace(/\{\{topic\}\}/g,     capitalise(signals.primaryTopic))
    .replace(/\{\{benefit\}\}/g,   signals.topBenefit)
    .replace(/\{\{pain\}\}/g,      signals.topPain)
    .replace(/\{\{curiosity\}\}/g, capitalise(signals.curiosityHook))
    .replace(/\{\{proof\}\}/g,     signals.proofPoint)
    .replace(/\{\{keyword\}\}/g,   signals.topKeyword)
    .replace(/\{\{keyword2\}\}/g,  signals.secondKeyword);
}

/** Trim to maxChars at word boundary, append "…" if truncated. */
function trimToMaxChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const trimmed = text.slice(0, maxChars).replace(/\s+\S*$/, "");
  return trimmed + "…";
}

// ─── Main entrypoint ──────────────────────────────────────────────────────────

/**
 * Generate exactly 3 hooks from a transcript analysis.
 *
 * @param analysis   Output of analyzeTranscript()
 * @param highlights Output of detectHighlights() — optional but improves quality
 * @param options    Preset name, forced styles, character limit
 */
export function generateHooks(
  analysis: TranscriptAnalysis,
  highlights?: HighlightResult,
  options: GenerateHooksOptions = {}
): HookResult {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const preset   = options.preset ?? null;
  const tone     = analysis.tone;

  const signals = extractSignals(analysis, highlights);
  const styles  = resolveStyles(tone, preset ?? undefined, options.forceStyles);

  const hooks: Hook[] = styles.map((style, idx) => {
    const tmpl   = selectTemplate(style, signals, idx);
    const filled = fillSlots(tmpl.text, signals);
    const text   = trimToMaxChars(filled, maxChars);

    return {
      id:        `${style}-${idx}`,
      text,
      style,
      rationale: tmpl.rationale,
      charCount: text.length,
      editHint:  tmpl.editHint,
    };
  });

  return {
    hooks:    hooks as [Hook, Hook, Hook],
    metadata: {
      generatedAt:      new Date().toISOString(),
      schemaVersion:    "1.0",
      preset,
      tone,
      stylesUsed:       styles,
      extractedSignals: signals,
    },
  };
}
