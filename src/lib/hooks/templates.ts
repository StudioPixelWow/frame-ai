/**
 * FrameAI — Hook template banks.
 *
 * Each style has a bank of template strings with named slots.
 * Slots are filled by the signal extractor in generate.ts.
 *
 * Slot tokens:
 *   {{topic}}     — primary topic phrase
 *   {{benefit}}   — top benefit / outcome phrase
 *   {{pain}}      — top pain / tension phrase
 *   {{curiosity}} — counter-intuitive or surprising claim fragment
 *   {{proof}}     — stat / result / timeframe
 *   {{keyword}}   — dominant keyword
 *   {{keyword2}}  — second keyword
 *
 * Template selection is deterministic: given the same signals, the same
 * template index is always chosen (see selectTemplate() in generate.ts).
 *
 * Design rules:
 *  - All hooks ≤ ~110 characters when slots are short phrases
 *  - No filler words ("just", "simply", "really")
 *  - Active voice, present or future tense
 *  - End punctuation varies by style (? for question, . for statement)
 */

import type { HookStyle } from "./types";

export interface HookTemplate {
  text: string;
  rationale: string;
  editHint: string;
}

// ─── Question ────────────────────────────────────────────────────────────────
// Engages through direct curiosity or challenge. Works best as an opener that
// makes the viewer answer in their head.

export const QUESTION_TEMPLATES: HookTemplate[] = [
  {
    text:      "What if {{benefit}} — without the {{pain}}?",
    rationale: "Reframes the core value proposition as an irresistible what-if",
    editHint:  "overlay on opening shot, fade in at 0.5s",
  },
  {
    text:      "Are you still struggling with {{pain}}?",
    rationale: "Targets the pain point directly, triggering immediate recognition",
    editHint:  "display over b-roll that mirrors the pain scenario",
  },
  {
    text:      "What would change if you mastered {{topic}}?",
    rationale: "Aspirational question that seeds desire before the answer is revealed",
    editHint:  "place in first 3 seconds before any spoken content",
  },
  {
    text:      "Why do most people get {{topic}} wrong?",
    rationale: "Curiosity-question hybrid — implies insider knowledge",
    editHint:  "pair with a questioning facial expression or zoom-in",
  },
  {
    text:      "Ready to {{benefit}} — faster than you think?",
    rationale: "Short, energetic, presupposes commitment from the viewer",
    editHint:  "overlay at the top of the hook segment",
  },
  {
    text:      "What's the real reason {{pain}} keeps happening?",
    rationale: "Diagnostic framing — viewer wants to know the answer",
    editHint:  "display before the speaker addresses the root cause",
  },
  {
    text:      "Have you tried every {{keyword}} strategy — and still failed?",
    rationale: "Empathy-first question that validates the viewer's frustration",
    editHint:  "use as pre-roll text before cut to speaker",
  },
  {
    text:      "What if {{keyword}} was the only thing standing between you and {{benefit}}?",
    rationale: "Isolates the key lever, making the solution feel singular and achievable",
    editHint:  "hold for full 3 seconds to allow viewer to process",
  },
];

// ─── Bold Statement ───────────────────────────────────────────────────────────
// High-confidence, declarative. Breaks patterns. Best for authority-driven
// creators and premium brands.

export const BOLD_STATEMENT_TEMPLATES: HookTemplate[] = [
  {
    text:      "{{proof}}. That's the power of {{topic}}.",
    rationale: "Leads with a credibility signal before naming the subject",
    editHint:  "display proof stat as large on-screen text first",
  },
  {
    text:      "{{topic}} changed everything. Here's how.",
    rationale: "Presupposes transformation — creates forward momentum",
    editHint:  "cut to this immediately after the opening b-roll",
  },
  {
    text:      "Stop tolerating {{pain}}. There's a better way.",
    rationale: "Direct call-out that positions the content as the solution",
    editHint:  "use over a frustrated-expression close-up if available",
  },
  {
    text:      "Most {{keyword}} advice is wrong. This is what actually works.",
    rationale: "Contrarian hook that signals unique perspective",
    editHint:  "bold white text on dark background for maximum contrast",
  },
  {
    text:      "The {{topic}} game has changed. Are you keeping up?",
    rationale: "Urgency through industry shift — triggers FOMO",
    editHint:  "overlay on fast-cut b-roll montage",
  },
  {
    text:      "I used to {{pain}}. Not anymore.",
    rationale: "Personal transformation in six words — shows before/after in one line",
    editHint:  "speaker on-camera for authenticity",
  },
  {
    text:      "This is the {{benefit}} framework nobody talks about.",
    rationale: "Secret-knowledge framing builds authority and exclusivity",
    editHint:  "pair with a graphic reveal or whiteboard moment",
  },
  {
    text:      "{{keyword}} isn't the problem. {{keyword2}} is.",
    rationale: "Pattern-interrupt reframe — viewer expects one answer and gets another",
    editHint:  "display each keyword on its own line with a half-second delay",
  },
];

// ─── Curiosity ────────────────────────────────────────────────────────────────
// Teases hidden, counter-intuitive, or surprising information. Works across
// all tones but is especially potent for educational and professional content.

export const CURIOSITY_TEMPLATES: HookTemplate[] = [
  {
    text:      "Here's what nobody tells you about {{topic}}.",
    rationale: "Classic information-gap opener — implies insider knowledge",
    editHint:  "lean-in camera angle or speaker breaking fourth wall",
  },
  {
    text:      "The thing that actually drives {{benefit}}? It's not {{keyword}}.",
    rationale: "Subverts expectations — viewer wants to know the real answer",
    editHint:  "pause after the negative reveal for one beat before continuing",
  },
  {
    text:      "{{curiosity}}. Most people never figure this out.",
    rationale: "Positions the insight as rare and valuable — creates exclusivity",
    editHint:  "display as a text-only slate before the speaker appears",
  },
  {
    text:      "I spent years on {{pain}} — until I discovered {{topic}}.",
    rationale: "Mini story arc compressed into one sentence",
    editHint:  "speaker on-camera with genuine emotional recall",
  },
  {
    text:      "The secret to {{benefit}} has nothing to do with {{keyword}}.",
    rationale: "Contrarian curiosity — dismantles the obvious assumption",
    editHint:  "overlay text on black for dramatic effect",
  },
  {
    text:      "Why {{keyword}} alone will never give you {{benefit}}.",
    rationale: "Diagnostic headline format — creates urgency to learn the full picture",
    editHint:  "use as a chapter title card at the very start",
  },
  {
    text:      "What {{proof}} taught me about {{topic}}.",
    rationale: "Data-led curiosity — grounds the tease in a credible result",
    editHint:  "display statistic prominently before cutting to explanation",
  },
  {
    text:      "The real reason {{pain}} is harder than it looks — and how to fix it.",
    rationale: "Validates difficulty before promising resolution — builds trust",
    editHint:  "pair with empathy b-roll before the solution segment",
  },
];

// ─── Benefit-driven ───────────────────────────────────────────────────────────
// Leads with the viewer's gain. Especially effective for performance brands
// and conversion-focused content.

export const BENEFIT_DRIVEN_TEMPLATES: HookTemplate[] = [
  {
    text:      "{{proof}} — and you can do it too with {{topic}}.",
    rationale: "Concrete result first, then the method — classic direct-response opening",
    editHint:  "display the proof metric as an animated number before speaker",
  },
  {
    text:      "In the next few minutes, you'll have a complete {{topic}} strategy.",
    rationale: "Time-bound promise — sets clear expectation and reduces drop-off",
    editHint:  "overlay at 0s to anchor the viewer before content begins",
  },
  {
    text:      "The fastest way to {{benefit}} — without {{pain}}.",
    rationale: "Speed + absence-of-friction — two of the strongest purchase triggers",
    editHint:  "white text on brand-colour background, hold for 2.5s",
  },
  {
    text:      "{{benefit}} is closer than you think. Here's your roadmap.",
    rationale: "Reassurance hook — lowers the psychological barrier to entry",
    editHint:  "pair with a progress-bar animation or checklist graphic",
  },
  {
    text:      "How to go from {{pain}} to {{benefit}} — step by step.",
    rationale: "Transformation promise with implied structure — high retention signal",
    editHint:  "display over a before/after split-screen if available",
  },
  {
    text:      "Get {{benefit}} with {{topic}} — even if you're starting from scratch.",
    rationale: "Inclusive framing removes the 'not for me' objection upfront",
    editHint:  "use for beginner-focused segments or top-of-funnel placements",
  },
  {
    text:      "The proof is in the {{benefit}} — powered by {{keyword}}.",
    rationale: "Claim-plus-evidence structure — builds credibility in under 10 words",
    editHint:  "cut to case study or testimonial immediately after this hook",
  },
  {
    text:      "Stop spending hours on {{pain}}. {{topic}} does it for you.",
    rationale: "Time-savings hook with automation framing — high ROI implication",
    editHint:  "overlay on side-by-side time-lapse comparison if possible",
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const TEMPLATE_BANK: Record<HookStyle, HookTemplate[]> = {
  "question":       QUESTION_TEMPLATES,
  "bold-statement": BOLD_STATEMENT_TEMPLATES,
  "curiosity":      CURIOSITY_TEMPLATES,
  "benefit-driven": BENEFIT_DRIVEN_TEMPLATES,
};
