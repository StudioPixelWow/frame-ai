/**
 * FrameAI — CTA generation orchestrator.
 *
 * Pipeline:
 *  1. Resolve signals (topic, benefit, qualifier, urgency, action verb)
 *     from options + optional TranscriptAnalysis
 *  2. Select 2 or 3 templates from the goal's bank — deterministically,
 *     no randomness — via a slot-coverage score + hash tiebreaker
 *  3. Fill slots, trim to maxChars, stamp metadata
 *
 * Fully deterministic: same inputs always produce the same CTAs.
 */

import { CTA_TEMPLATE_BANK }           from "./templates";
import type { CtaTemplate }            from "./templates";
import type {
  BusinessType,
  Cta,
  CtaGoal,
  CtaGenerationMetadata,
  CtaResult,
  CtaSignals,
  GenerateCtaOptions,
}                                      from "./types";
import type { TranscriptAnalysis }     from "@/lib/transcript/types";
import type { PresetName }             from "@/lib/hooks/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_CHARS = 60;
const DEFAULT_COUNT     = 3;

// ─── Preset → qualifier + urgency ────────────────────────────────────────────

/**
 * Pixel Premium:     refined, no-pressure language
 * Pixel Performance: conversion-optimised, light urgency
 * Pixel Social:      casual, friendly, present-tense
 */
const PRESET_QUALIFIER: Record<string, string> = {
  "pixel-premium":     "complimentary",
  "pixel-performance": "free",
  "pixel-social":      "quick",
};

const PRESET_URGENCY: Record<string, string> = {
  "pixel-premium":     "",          // premium brands never rush the viewer
  "pixel-performance": "today",
  "pixel-social":      "now",
};

// ─── Business type → primary action verb ─────────────────────────────────────

const BUSINESS_VERB: Record<string, string> = {
  agency:      "Book",
  saas:        "Start",
  ecommerce:   "Get",
  consultant:  "Schedule",
  creator:     "Join",
  brand:       "Explore",
  startup:     "Try",
  enterprise:  "Request",
};
const DEFAULT_VERB = "Book";

// ─── Tone → qualifier override when no preset ────────────────────────────────

import type { TranscriptTone } from "@/lib/transcript/types";

const TONE_QUALIFIER: Record<TranscriptTone, string> = {
  energetic:     "free",
  persuasive:    "complimentary",
  educational:   "free",
  inspirational: "complimentary",
  professional:  "complimentary",
  casual:        "quick",
};

const TONE_URGENCY: Record<TranscriptTone, string> = {
  energetic:     "now",
  persuasive:    "today",
  educational:   "",
  inspirational: "",
  professional:  "",
  casual:        "now",
};

// ─── Signal resolution ────────────────────────────────────────────────────────

function cleanPhrase(s: string, maxWords = 3): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

/**
 * Build the CtaSignals bundle from all available context.
 * Explicit options always win over derived values.
 */
export function resolveSignals(
  goal: CtaGoal,
  options: GenerateCtaOptions,
  analysis?: TranscriptAnalysis
): CtaSignals {
  const preset       = options.preset      ?? null;
  const tone         = options.tone        ?? analysis?.tone ?? null;
  const businessType = options.businessType ?? null;

  // Qualifier: preset > tone > default "free"
  const qualifier = preset
    ? (PRESET_QUALIFIER[preset] ?? "complimentary")
    : tone
      ? TONE_QUALIFIER[tone]
      : "complimentary";

  // Urgency: preset > tone > ""
  // Premium preset always suppresses urgency regardless of tone
  const urgency = preset === "pixel-premium"
    ? ""
    : preset
      ? (PRESET_URGENCY[preset] ?? "")
      : tone
        ? TONE_URGENCY[tone]
        : "";

  // Action verb: business type (goal-compat checked) > goal default
  const actionVerb = resolveActionVerb(businessType, goal);

  // Topic: explicit > analysis keyTopics > analysis keywords > "our work"
  const topic = options.topic
    ?? cleanPhrase(
        analysis?.keyTopics?.[0] ??
        analysis?.keywords?.[0]  ??
        "our work",
        3
      );

  // Keyword: analysis keywords[0] > topic
  const keyword = cleanPhrase(
    analysis?.keywords?.[0] ?? topic,
    2
  );

  // Benefit: explicit > analysis key-claim > analysis summary first 4 words
  const rawBenefit =
    options.benefit ??
    analysis?.importantMoments?.find(m => m.type === "key-claim")?.text ??
    analysis?.summary ??
    topic;

  const benefit = cleanPhrase(rawBenefit, 4);

  return { topic, keyword, benefit, qualifier, urgency, actionVerb };
}

function goalDefaultVerb(goal: CtaGoal): string {
  const MAP: Record<CtaGoal, string> = {
    "lead-generation": "Get",
    "awareness":       "Explore",
    "inquiry":         "Ask",
    "booking":         "Book",
    "contact":         "Contact",
  };
  return MAP[goal] ?? DEFAULT_VERB;
}

/**
 * Verbs that are semantically incompatible with high-commitment goals
 * (booking, contact).  When a business type maps to one of these verbs
 * and the goal is commitment-heavy, we fall back to the goal's own verb.
 */
const AWARENESS_ONLY_VERBS = new Set(["Explore", "Follow", "Watch", "Discover"]);

/**
 * Resolve the action verb, applying a goal-compatibility guard.
 * Soft commitment goals (lead-generation, awareness, inquiry) allow any verb.
 * Hard commitment goals (booking, contact) reject awareness-only verbs.
 */
function resolveActionVerb(
  businessType: BusinessType | null,
  goal: CtaGoal
): string {
  const bizVerb = businessType
    ? (BUSINESS_VERB[businessType] ?? null)
    : null;

  const hardCommitGoals: CtaGoal[] = ["booking", "contact"];

  if (bizVerb && hardCommitGoals.includes(goal) && AWARENESS_ONLY_VERBS.has(bizVerb)) {
    // Fall back to the goal's own default verb
    return goalDefaultVerb(goal);
  }

  return bizVerb ?? goalDefaultVerb(goal);
}

// ─── Slot filling ─────────────────────────────────────────────────────────────

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Replace "a " with "an " when followed by a vowel sound.
 * Handles common edge cases: "a AI", "a hour", "a SaaS", etc.
 */
function fixArticles(text: string): string {
  // Matches "a " or "A " before a word starting with a vowel letter,
  // a silent-h word, or an initialism pronounced with a vowel (AI, SaaS, etc.)
  const VOWEL_INITIAL = /\b(a|A) ([AEIOUaeiou]|[Hh](?:our|onest|eir))/g;
  return text.replace(VOWEL_INITIAL, (_, article, rest) => {
    const result = (article === "A" ? "An " : "an ") + rest;
    return result;
  });
}

function fillSlots(template: string, signals: CtaSignals): string {
  let result = template
    .replace(/\{\{topic\}\}/g,     capitalise(signals.topic))
    .replace(/\{\{keyword\}\}/g,   capitalise(signals.keyword))
    .replace(/\{\{benefit\}\}/g,   capitalise(signals.benefit))
    .replace(/\{\{qualifier\}\}/g, signals.qualifier)
    .replace(/\{\{verb\}\}/g,      signals.actionVerb);

  // Urgency: if empty, strip the token and any surrounding whitespace/dash
  if (!signals.urgency) {
    result = result
      .replace(/\s*—\s*\{\{urgency\}\}/g, "")
      .replace(/\s+\{\{urgency\}\}/g,     "")
      .replace(/\{\{urgency\}\}/g,         "");
  } else {
    result = result.replace(/\{\{urgency\}\}/g, capitalise(signals.urgency));
  }

  // Collapse any double spaces left by empty tokens, then fix articles
  return fixArticles(result.replace(/\s{2,}/g, " ").trim());
}

function trimToMaxChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const trimmed = text.slice(0, maxChars).replace(/\s+\S*$/, "");
  return trimmed + "…";
}

// ─── Deterministic template selection ────────────────────────────────────────

/** djb2 hash → non-negative integer. */
function strHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

/**
 * Score a template by how many of its non-trivial slots are covered by
 * non-empty signals.  Also penalises {{qualifier}} when qualifier is empty.
 */
function scoreTemplate(templateText: string, signals: CtaSignals): number {
  const SLOTS: Array<[string, string]> = [
    ["{{topic}}",     signals.topic],
    ["{{keyword}}",   signals.keyword],
    ["{{benefit}}",   signals.benefit],
    ["{{qualifier}}", signals.qualifier],
    ["{{urgency}}",   signals.urgency],
    ["{{verb}}",      signals.actionVerb],
  ];
  let score = 0;
  for (const [token, value] of SLOTS) {
    if (templateText.includes(token)) {
      score += value.length > 2 ? 1 : -1;  // reward coverage, penalise empty
    }
  }
  return score;
}

/**
 * Select `count` templates from the bank for the given goal.
 * Templates are ranked by slot-coverage score, with a hash-based tiebreaker
 * seeded on `topic` so the same topic always picks the same templates.
 */
function selectTemplates(
  goal: CtaGoal,
  signals: CtaSignals,
  count: number
): CtaTemplate[] {
  const bank   = CTA_TEMPLATE_BANK[goal];
  const seed   = strHash(signals.topic + signals.qualifier + goal);
  const ranked = bank.map((tpl, i) => ({
    tpl,
    i,
    score: scoreTemplate(tpl.text, signals),
  }));

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreaker: rotate starting from seed index
    return ((a.i - seed) % bank.length + bank.length) % bank.length
         - ((b.i - seed) % bank.length + bank.length) % bank.length;
  });

  return ranked.slice(0, count).map(r => r.tpl);
}

// ─── Main entrypoint ──────────────────────────────────────────────────────────

/**
 * Generate 2 or 3 CTAs for a given project goal.
 *
 * @param goal      The business outcome the CTA should drive
 * @param options   businessType, preset, tone, topic override, count, maxChars
 * @param analysis  Optional transcript analysis — enriches topic, keyword, benefit
 */
export function generateCtas(
  goal: CtaGoal,
  options: GenerateCtaOptions = {},
  analysis?: TranscriptAnalysis
): CtaResult {
  const count    = options.count    ?? DEFAULT_COUNT;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const signals  = resolveSignals(goal, options, analysis);

  const templates = selectTemplates(goal, signals, count);

  const ctas: Cta[] = templates.map((tpl, idx) => {
    const raw  = fillSlots(tpl.text, signals);
    const text = trimToMaxChars(raw, maxChars);
    return {
      id:            `${goal}-${idx}`,
      text,
      goal,
      charCount:     text.length,
      rationale:     tpl.rationale,
      editHint:      tpl.editHint,
      qualifierUsed: signals.qualifier,
    };
  });

  const metadata: CtaGenerationMetadata = {
    generatedAt:  new Date().toISOString(),
    schemaVersion: "1.0",
    goal,
    businessType: options.businessType ?? null,
    preset:       options.preset       ?? null,
    tone:         options.tone         ?? analysis?.tone ?? null,
    count,
    signals,
  };

  return { ctas, metadata };
}
