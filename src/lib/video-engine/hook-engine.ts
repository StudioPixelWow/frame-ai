/**
 * PixelFrameAI — Hook-First Editing Engine
 *
 * Optimizes the first 3-5 seconds of video to maximize viewer retention.
 * Analyzes opening content for hook strength, detects weak introductions,
 * and recommends enhancement strategies based on hook type and desired intensity.
 *
 * Features:
 *  - Automatic hook type detection (curiosity, problem, benefit, shock, story, question, statistic)
 *  - Hook scoring (0-100) based on word power and clarity
 *  - Weak intro detection (fillers, greetings, slow starts)
 *  - Smart skip-to recommendations for strong moment recovery
 *  - Multi-strength enhancement generation (subtle, balanced, aggressive)
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export type HookStrength = "subtle" | "balanced" | "aggressive";
export type HookType =
  | "curiosity"
  | "problem"
  | "benefit"
  | "shock"
  | "story"
  | "question"
  | "statistic";

export interface TranscriptSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  highlightWord?: string;
}

export interface HookAnalysis {
  hookType: HookType;
  hookSegments: string[];
  hookStartSec: number;
  hookEndSec: number;
  hookDurationSec: number;
  hookScore: number;
  hookText: string;
  isWeakIntro: boolean;
  skipToSec: number;
  recommendations: HookRecommendation[];
}

export interface HookRecommendation {
  type: "pacing" | "zoom" | "broll" | "subtitle" | "cut";
  description: string;
  descriptionHe: string;
  params: Record<string, any>;
}

export interface HookEnhancement {
  zoomBoost: number;
  pacingBoost: number;
  brollIntensity: number;
  subtitleBoost: { fontSizeMultiplier: number; highlightIntensity: number };
  skipIntroToSec: number;
  hookScore: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const CURIOSITY_KEYWORDS = [
  "האם",
  "מה אם",
  "did you know",
  "ever wonder",
  "think about",
  "realize",
];
const PROBLEM_KEYWORDS = [
  "בעיה",
  "קשה",
  "נמאס",
  "problem",
  "struggle",
  "challenge",
  "lost",
  "frustrated",
];
const BENEFIT_KEYWORDS = [
  "תוצאה",
  "הצלחה",
  "result",
  "success",
  "achieve",
  "get",
  "save",
  "earn",
];
const SHOCK_KEYWORDS = ["לא תאמינו", "unbelievable", "crazy", "shocking", "wait"];
const STORY_KEYWORDS = ["סיפור", "פעם", "once", "story", "happened", "this one time"];
const QUESTION_INDICATORS = ["האם", "מה", "למה", "how", "what", "why", "do you"];
const WEAK_INTROS = ["שלום", "היי", "hello", "hi", "hey", "welcome", "intro"];

const POWER_WORDS = [
  "never",
  "always",
  "absolutely",
  "guaranteed",
  "proven",
  "secret",
  "hidden",
  "revealed",
  "shocking",
  "exclusive",
  "must",
  "will",
];

/* ═══════════════════════════════════════════════════════════════════════════
   Core Functions
   ═══════════════════════════════════════════════════════════════════════════ */

export function analyzeHook(
  segments: TranscriptSegment[],
  options: { strength: HookStrength; language: "he" | "en" | "auto" }
): HookAnalysis {
  if (segments.length === 0) {
    return createEmptyHookAnalysis();
  }

  // Determine hook window (first 3-5 seconds)
  const hookWindowEnd = Math.min(5, segments[segments.length - 1].endSec);
  const hookSegmentIndices = segments.filter((seg) => seg.startSec < hookWindowEnd);
  const hookSegmentIds = hookSegmentIndices.map((seg) => seg.id);
  const hookText = hookSegmentIndices.map((seg) => seg.text).join(" ");

  // Detect hook type
  const hookType = detectHookType(hookText, options.language);

  // Score the hook
  const hookScore = scoreHook(hookText, hookType);

  // Detect weak intro
  const isWeakIntro = detectWeakIntro(hookSegmentIndices);

  // Find skip point if weak intro
  let skipToSec = 0;
  if (isWeakIntro) {
    const strongMoment = findFirstStrongSegment(segments, 0);
    if (strongMoment) {
      skipToSec = strongMoment.startSec;
    }
  }

  // Generate recommendations
  const recommendations = generateHookRecommendations(
    hookType,
    hookScore,
    isWeakIntro,
    options.language
  );

  return {
    hookType,
    hookSegments: hookSegmentIds,
    hookStartSec: hookSegmentIndices[0]?.startSec || 0,
    hookEndSec: hookSegmentIndices[hookSegmentIndices.length - 1]?.endSec || 5,
    hookDurationSec:
      (hookSegmentIndices[hookSegmentIndices.length - 1]?.endSec || 5) -
      (hookSegmentIndices[0]?.startSec || 0),
    hookScore,
    hookText,
    isWeakIntro,
    skipToSec,
    recommendations,
  };
}

export function generateHookEnhancement(
  analysis: HookAnalysis,
  strength: HookStrength
): HookEnhancement {
  let zoomBoost = 1.0;
  let pacingBoost = 1.0;
  let brollIntensity = 0;

  switch (strength) {
    case "subtle":
      zoomBoost = 1.1;
      pacingBoost = 1.1;
      brollIntensity = 0.2;
      break;

    case "balanced":
      zoomBoost = 1.3;
      pacingBoost = 1.2;
      brollIntensity = 0.5;
      break;

    case "aggressive":
      zoomBoost = 1.5;
      pacingBoost = 1.4;
      brollIntensity = 0.8;
      break;
  }

  // Adjust for weak intro
  const skipIntroToSec = analysis.isWeakIntro ? analysis.skipToSec : 0;

  // Boost hook score based on strength applied
  const hookScore = Math.min(100, analysis.hookScore + (strength === "aggressive" ? 20 : 10));

  return {
    zoomBoost,
    pacingBoost,
    brollIntensity,
    subtitleBoost: {
      fontSizeMultiplier: 1.0 + strength === "aggressive" ? 0.3 : 0.15,
      highlightIntensity: strength === "aggressive" ? 0.9 : 0.6,
    },
    skipIntroToSec,
    hookScore,
  };
}

export function getHookStrengths(): Array<{
  id: HookStrength;
  label: string;
  labelHe: string;
  description: string;
}> {
  return [
    {
      id: "subtle",
      label: "Subtle",
      labelHe: "עדין",
      description:
        "Gentle enhancements. 10% zoom boost, slight pacing tightening. Best for professional or serious content.",
    },
    {
      id: "balanced",
      label: "Balanced",
      labelHe: "מאוזן",
      description:
        "Moderate boost. 30% zoom, medium pacing, some B-roll. Recommended for most YouTube videos.",
    },
    {
      id: "aggressive",
      label: "Aggressive",
      labelHe: "תוקפני",
      description:
        "Maximum impact. 50% zoom, tight pacing, heavy B-roll, prominent subtitles. For viral/short-form content.",
    },
  ];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helper Functions
   ═══════════════════════════════════════════════════════════════════════════ */

function detectHookType(text: string, language: "he" | "en" | "auto"): HookType {
  const lowerText = text.toLowerCase();

  // Check for question (ends with ?)
  if (text.trim().endsWith("?")) {
    // Further classify the question type
    if (containsKeywords(lowerText, CURIOSITY_KEYWORDS)) return "curiosity";
    if (containsKeywords(lowerText, QUESTION_INDICATORS)) return "question";
  }

  // Check for statistics/numbers
  if (/\d+(%|K|M|B|million|billion|thousand)/.test(text)) {
    return "statistic";
  }

  // Check for specific keywords
  if (containsKeywords(lowerText, CURIOSITY_KEYWORDS)) return "curiosity";
  if (containsKeywords(lowerText, PROBLEM_KEYWORDS)) return "problem";
  if (containsKeywords(lowerText, BENEFIT_KEYWORDS)) return "benefit";
  if (containsKeywords(lowerText, SHOCK_KEYWORDS) || /[!]{2,}/.test(text))
    return "shock";
  if (containsKeywords(lowerText, STORY_KEYWORDS)) return "story";

  // Default
  return "curiosity";
}

function scoreHook(text: string, hookType: HookType): number {
  let score = 50; // Base score

  // Conciseness (short is good)
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 10) score += 15;
  else if (wordCount > 30) score -= 10;

  // Power words
  const lowerText = text.toLowerCase();
  const powerWordCount = POWER_WORDS.filter((word) =>
    lowerText.includes(word.toLowerCase())
  ).length;
  score += Math.min(15, powerWordCount * 5);

  // Hook-specific scoring
  switch (hookType) {
    case "shock":
    case "question":
      score += 10; // Strong engagement patterns
      break;
    case "curiosity":
      score += 8;
      break;
    case "story":
      score += 6;
      break;
  }

  // Punctuation (exclamation/question = more engaging)
  if (text.includes("!") || text.includes("?")) score += 5;

  // Clarity (no filler words)
  const fillerCount = (text.match(/um|uh|like|actually|basically|אממ|אהה/gi) || [])
    .length;
  score -= fillerCount * 3;

  return Math.max(0, Math.min(100, score));
}

function detectWeakIntro(segments: TranscriptSegment[]): boolean {
  if (segments.length === 0) return false;

  const firstSegment = segments[0];
  const firstText = firstSegment.text.toLowerCase().trim();

  // Check if first segment is just a greeting
  for (const weakWord of WEAK_INTROS) {
    if (firstText === weakWord || firstText.startsWith(weakWord + " ")) {
      return true;
    }
  }

  // Check if it's a filler word segment
  const fillerIndicators = ["אממ", "אהה", "כאילו", "um", "uh", "like"];
  for (const filler of fillerIndicators) {
    if (firstText.includes(filler)) {
      return true;
    }
  }

  // Check for very short weak opening followed by longer content
  const firstDuration = firstSegment.endSec - firstSegment.startSec;
  if (firstDuration < 1 && segments.length > 1) {
    const secondDuration = segments[1].endSec - segments[1].startSec;
    if (secondDuration > firstDuration * 2) {
      return true;
    }
  }

  return false;
}

function findFirstStrongSegment(
  segments: TranscriptSegment[],
  startIdx: number
): TranscriptSegment | null {
  for (let i = startIdx; i < segments.length; i++) {
    const seg = segments[i];
    const text = seg.text.toLowerCase();

    // Strong segment: has power words, questions, or reasonable length
    const hasPowerWord = POWER_WORDS.some((word) => text.includes(word.toLowerCase()));
    const isQuestion = text.includes("?");
    const hasNumbers = /\d+/.test(text);
    const isReasonableLength = seg.endSec - seg.startSec > 0.5;

    if ((hasPowerWord || isQuestion || hasNumbers) && isReasonableLength) {
      return seg;
    }
  }

  return null;
}

function generateHookRecommendations(
  hookType: HookType,
  hookScore: number,
  isWeakIntro: boolean,
  language: "he" | "en" | "auto"
): HookRecommendation[] {
  const recommendations: HookRecommendation[] = [];

  // Always recommend pacing if score is low
  if (hookScore < 60) {
    recommendations.push({
      type: "pacing",
      description: "Tighten pacing in the hook to increase perceived speed",
      descriptionHe: "הדקו את הקצב בהוק לעלייה בחדות",
      params: { pacingMode: "punchy", segments: "hook-only" },
    });
  }

  // Type-specific recommendations
  switch (hookType) {
    case "shock":
    case "curiosity":
      recommendations.push({
        type: "zoom",
        description: "Use zoom-in effect on key moment for dramatic impact",
        descriptionHe: "השתמשו בזום-אין על הרגע המרכזי",
        params: { zoomLevel: 1.4, duration: 0.5 },
      });
      break;

    case "question":
    case "statistic":
      recommendations.push({
        type: "subtitle",
        description: "Display question or statistic as prominent subtitle",
        descriptionHe: "הציגו כתיתון בולט",
        params: { fontSize: "large", highlight: true },
      });
      break;

    case "story":
      recommendations.push({
        type: "broll",
        description: "Add visual context B-roll to establish setting",
        descriptionHe: "הוסיפו B-roll להקשר ויזואלי",
        params: { theme: "setting", intensity: 0.6 },
      });
      break;
  }

  // Weak intro handling
  if (isWeakIntro) {
    recommendations.push({
      type: "cut",
      description: "Remove weak introduction and jump to strong moment",
      descriptionHe: "הסירו את ההקדמה החלשה ובקפצו לרגע חזק",
      params: { action: "skip-to-strong" },
    });
  }

  return recommendations;
}

function containsKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function createEmptyHookAnalysis(): HookAnalysis {
  return {
    hookType: "curiosity",
    hookSegments: [],
    hookStartSec: 0,
    hookEndSec: 0,
    hookDurationSec: 0,
    hookScore: 0,
    hookText: "",
    isWeakIntro: false,
    skipToSec: 0,
    recommendations: [],
  };
}
