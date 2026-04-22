/**
 * AI Re-edit Engine for PixelManageAI
 * Generates alternative edit versions of videos in different creative modes
 * Supports: viral, premium, emotional, and sales-focused edits
 */

export interface ReEditInput {
  segments: Array<{
    id: string;
    startSec: number;
    endSec: number;
    text: string;
    highlightWord: string;
    highlightStyle: string;
  }>;
  durationSec: number;
  format: string;
  currentPreset: string;
  currentTransitionStyle: string;
  brollPlacements: Array<{
    id: string;
    startSec: number;
    endSec: number;
    keyword: string;
    source: string;
  }>;
  musicEnabled: boolean;
  musicTrackId: string;
  musicVolume: number;
  premiumMode: boolean;
  premiumLevel: string;
  cleanupRemovedSegments: Array<{
    id: string;
    startSec: number;
    endSec: number;
    type: string;
    removed: boolean;
  }>;
  language: string;
}

export type ReEditMode = "premium" | "viral" | "emotional" | "sales";

export interface ReEditChange {
  category: string; // e.g. "pacing", "hook", "broll", "music", "transitions", "cta"
  descriptionHe: string;
  descriptionEn: string;
  impact: "high" | "medium" | "low";
}

export interface ReEditResult {
  mode: ReEditMode;
  changes: ReEditChange[];
  /** Modified wizard-compatible fields */
  patch: {
    preset?: string;
    transitionStyle?: string;
    premiumLevel?: string;
    musicVolume?: number;
    musicTrackId?: string;
    brollPlacements?: Array<{
      id: string;
      startSec: number;
      endSec: number;
      keyword: string;
      source: string;
    }>;
    segments?: Array<{
      id: string;
      startSec: number;
      endSec: number;
      text: string;
      highlightWord: string;
      highlightStyle: string;
    }>;
    cleanupIntensity?: string;
    subtitleAnimation?: string;
    subtitleFontSize?: number;
    subtitleFontWeight?: number;
  };
  /** Summary of what changed (Hebrew) */
  summaryHe: string;
}

export interface ReEditModeConfig {
  id: ReEditMode;
  icon: string;
  labelHe: string;
  descHe: string;
}

/**
 * Generates an alternative edit version of the video in the specified mode
 */
export function generateReEdit(input: ReEditInput, mode: ReEditMode): ReEditResult {
  switch (mode) {
    case "viral":
      return generateViralEdit(input);
    case "premium":
      return generatePremiumEdit(input);
    case "emotional":
      return generateEmotionalEdit(input);
    case "sales":
      return generateSalesEdit(input);
    default:
      throw new Error(`Unknown re-edit mode: ${mode}`);
  }
}

/**
 * Viral mode: high-energy, fast-paced, maximum engagement
 */
function generateViralEdit(input: ReEditInput): ReEditResult {
  const changes: ReEditChange[] = [];
  const patch: ReEditResult["patch"] = {};

  // 1. Increase pacing: shorten segments by 15-25%
  const shortenedSegments = input.segments.map((seg) => {
    const originalDuration = seg.endSec - seg.startSec;
    const reductionFactor = 0.8; // 20% reduction
    const newDuration = originalDuration * reductionFactor;
    return {
      ...seg,
      endSec: seg.startSec + newDuration,
    };
  });

  if (JSON.stringify(shortenedSegments) !== JSON.stringify(input.segments)) {
    changes.push({
      category: "pacing",
      descriptionHe: "קצוב מהיר - קטעים מקוצרים ב-20% להגברת אנרגיה",
      descriptionEn: "Fast pacing - segments shortened by 20% for higher energy",
      impact: "high",
    });
    patch.segments = shortenedSegments;
  }

  // 2. Stronger hook: add highlight to first segment's most impactful word
  if (input.segments.length > 0 && input.segments[0]) {
    const firstSegment = input.segments[0];
    const words = firstSegment.text.split(/\s+/);
    const mostImpactfulWord = words[0] || firstSegment.text;

    const updatedFirstSegment = {
      ...firstSegment,
      highlightWord: mostImpactfulWord,
      highlightStyle: "bold-glow",
    };

    if (!patch.segments) {
      patch.segments = [...input.segments];
    }
    patch.segments[0] = updatedFirstSegment;

    changes.push({
      category: "hook",
      descriptionHe: "וו חזק בתחילה - הדגשת המילה הראשונה בכל עוז",
      descriptionEn: "Strong hook - first impactful word highlighted with glow",
      impact: "high",
    });
  }

  // 3. More B-roll: add B-roll to segments without any (every 2-3 segments)
  const existingBrollSegments = new Set(input.brollPlacements.map((p) => p.id));
  const newBrollPlacements = [...input.brollPlacements];

  input.segments.forEach((segment, index) => {
    if (
      !existingBrollSegments.has(segment.id) &&
      index % 2 === 1 &&
      index < input.segments.length - 1
    ) {
      newBrollPlacements.push({
        id: `broll-${segment.id}`,
        startSec: segment.startSec + (segment.endSec - segment.startSec) * 0.2,
        endSec: segment.endSec - (segment.endSec - segment.startSec) * 0.1,
        keyword: extractKeyword(segment.text),
        source: "auto-viral",
      });
      existingBrollSegments.add(segment.id);
    }
  });

  if (newBrollPlacements.length > input.brollPlacements.length) {
    changes.push({
      category: "broll",
      descriptionHe: "B-roll נוסף על מקטעים בלי כיסוי חזותי",
      descriptionEn: "Added B-roll to segments without visual coverage",
      impact: "medium",
    });
    patch.brollPlacements = newBrollPlacements;
  }

  // 4. Faster transitions: set to punchyCut
  if (input.currentTransitionStyle !== "punchyCut") {
    patch.transitionStyle = "punchyCut";
    changes.push({
      category: "transitions",
      descriptionHe: "מעברים מהיר - עברו לסגנון 'Punchy Cut'",
      descriptionEn: "Fast transitions - switched to 'Punchy Cut' style",
      impact: "medium",
    });
  }

  // 5. Higher energy subtitle style
  patch.subtitleAnimation = "pop";
  patch.subtitleFontSize = 48;
  patch.subtitleFontWeight = 700;
  changes.push({
    category: "subtitles",
    descriptionHe: "תיתרים עם אנרגיה גבוהה - גדולים, בולדים ופופ",
    descriptionEn: "High-energy subtitles - larger, bold, pop animation",
    impact: "medium",
  });

  // 6. Higher music volume (50%)
  if (input.musicEnabled && input.musicVolume !== 50) {
    patch.musicVolume = 50;
    changes.push({
      category: "music",
      descriptionHe: "עלוי מוסיקה ל-50% לאנרגיה מקסימלית",
      descriptionEn: "Increased music volume to 50% for maximum energy",
      impact: "medium",
    });
  }

  // 7. Set preset to "viral"
  if (input.currentPreset !== "viral") {
    patch.preset = "viral";
  }

  // 8. Set premiumLevel to "premium"
  if (input.premiumLevel !== "premium") {
    patch.premiumLevel = "premium";
  }

  // 9. Aggressive cleanup
  patch.cleanupIntensity = "aggressive";
  changes.push({
    category: "cleanup",
    descriptionHe: "סילוק אגרסיבי של שתיקות והשהיות",
    descriptionEn: "Aggressive cleanup of silences and delays",
    impact: "low",
  });

  const summaryHe =
    "יצרנו גרסה ויראלית עם קצב מהיר, B-roll נוסף, תיתרים עם פופ ומוסיקה חזקה.";

  return {
    mode: "viral",
    changes,
    patch,
    summaryHe,
  };
}

/**
 * Premium mode: cinematic, sophisticated, high-quality
 */
function generatePremiumEdit(input: ReEditInput): ReEditResult {
  const changes: ReEditChange[] = [];
  const patch: ReEditResult["patch"] = {};

  // 1. Smoother pacing: keep segments natural length (no changes)
  // No pacing changes for premium mode

  // 2. Elegant transitions: cinematicDissolve
  if (input.currentTransitionStyle !== "cinematicDissolve") {
    patch.transitionStyle = "cinematicDissolve";
    changes.push({
      category: "transitions",
      descriptionHe: "מעברים אלגנטיים - 'Cinematic Dissolve' לחלקה ולרכות",
      descriptionEn: "Elegant transitions - 'Cinematic Dissolve' for smoothness",
      impact: "high",
    });
  }

  // 3. Minimal B-roll: keep only highest-relevance ones
  const filteredBrollPlacements = input.brollPlacements.filter(
    (placement, index) => index % 2 === 0
  );

  if (filteredBrollPlacements.length < input.brollPlacements.length) {
    changes.push({
      category: "broll",
      descriptionHe: "B-roll ממוקד - שמרנו רק על הפריטים הרלוונטיים ביותר",
      descriptionEn: "Focused B-roll - kept only the highest-relevance items",
      impact: "medium",
    });
    patch.brollPlacements = filteredBrollPlacements;
  }

  // 4. Lower music volume (25%)
  if (input.musicEnabled && input.musicVolume !== 25) {
    patch.musicVolume = 25;
    changes.push({
      category: "music",
      descriptionHe: "מוסיקה עדינה - הפחתנו לכ-25% לא להסיח דעת",
      descriptionEn: "Subtle music - reduced to 25% to not distract",
      impact: "medium",
    });
  }

  // 5. Subtle subtitle animation and styling
  patch.subtitleAnimation = "fade";
  patch.subtitleFontSize = 40;
  patch.subtitleFontWeight = 500;
  changes.push({
    category: "subtitles",
    descriptionHe: "תיתרים עדינים - בעלי משקל בינוני ופייד אלגנטי",
    descriptionEn: "Subtle subtitles - medium weight with elegant fade",
    impact: "medium",
  });

  // 6. Set preset to "authority"
  if (input.currentPreset !== "authority") {
    patch.preset = "authority";
  }

  // 7. Set premiumLevel to "cinematic"
  if (input.premiumLevel !== "cinematic") {
    patch.premiumLevel = "cinematic";
  }

  const summaryHe =
    "גרסה פרימיום עם מעברים קולנועיים, B-roll ממוקד ותיתרים עדינים וחכמים.";

  return {
    mode: "premium",
    changes,
    patch,
    summaryHe,
  };
}

/**
 * Emotional mode: slow, moving, connective
 */
function generateEmotionalEdit(input: ReEditInput): ReEditResult {
  const changes: ReEditChange[] = [];
  const patch: ReEditResult["patch"] = {};

  // 1. Slower pacing: extend some segments by 10%
  const extendedSegments = input.segments.map((seg) => {
    const originalDuration = seg.endSec - seg.startSec;
    const extensionFactor = 1.1; // 10% extension
    const newDuration = originalDuration * extensionFactor;
    return {
      ...seg,
      endSec: seg.startSec + newDuration,
    };
  });

  if (JSON.stringify(extendedSegments) !== JSON.stringify(input.segments)) {
    changes.push({
      category: "pacing",
      descriptionHe: "קצב איטי וממלא - הארכנו קטעים ב-10% לרגש עמוק",
      descriptionEn: "Slower pacing - extended segments by 10% for emotional depth",
      impact: "high",
    });
    patch.segments = extendedSegments;
  }

  // 2. Warm transitions: fade with longer duration
  if (input.currentTransitionStyle !== "fade") {
    patch.transitionStyle = "fade";
    changes.push({
      category: "transitions",
      descriptionHe: "מעברים חמים - 'Fade' עם משך ארוך יותר",
      descriptionEn: "Warm transitions - 'Fade' with longer duration",
      impact: "high",
    });
  }

  // 3. Atmospheric B-roll on emotional peaks
  // Detect via punctuation/emphasis (!, ?, strong verbs)
  const newBrollPlacements = [...input.brollPlacements];
  const existingBrollSegmentIds = new Set(
    input.brollPlacements.map((p) => p.id)
  );

  input.segments.forEach((segment) => {
    const hasEmotionalMarker =
      segment.text.includes("!") ||
      segment.text.includes("?") ||
      segment.text.toLowerCase().includes("love") ||
      segment.text.toLowerCase().includes("heart") ||
      segment.text.toLowerCase().includes("dream") ||
      segment.text.toLowerCase().includes("believe");

    if (hasEmotionalMarker && !existingBrollSegmentIds.has(segment.id)) {
      newBrollPlacements.push({
        id: `broll-emotional-${segment.id}`,
        startSec: segment.startSec,
        endSec: segment.endSec,
        keyword: extractKeyword(segment.text),
        source: "auto-emotional",
      });
      existingBrollSegmentIds.add(segment.id);
    }
  });

  if (newBrollPlacements.length > input.brollPlacements.length) {
    changes.push({
      category: "broll",
      descriptionHe: "B-roll אטמוספרי על רגעים רגישים",
      descriptionEn: "Atmospheric B-roll on emotional moments",
      impact: "medium",
    });
    patch.brollPlacements = newBrollPlacements;
  }

  // 4. Moderate music volume (35%)
  if (input.musicEnabled && input.musicVolume !== 35) {
    patch.musicVolume = 35;
    changes.push({
      category: "music",
      descriptionHe: "מוסיקה מפגינה - 35% לתמיכה רגשית",
      descriptionEn: "Supportive music - 35% for emotional backing",
      impact: "medium",
    });
  }

  // 5. Gentle subtitle animation and styling
  patch.subtitleAnimation = "fade";
  patch.subtitleFontSize = 38;
  patch.subtitleFontWeight = 400;
  changes.push({
    category: "subtitles",
    descriptionHe: "תיתרים עדינים - משקל רגיל ופייד עדין",
    descriptionEn: "Gentle subtitles - regular weight with soft fade",
    impact: "medium",
  });

  // 6. Set preset to "storytelling"
  if (input.currentPreset !== "storytelling") {
    patch.preset = "storytelling";
  }

  // 7. Set premiumLevel to "premium"
  if (input.premiumLevel !== "premium") {
    patch.premiumLevel = "premium";
  }

  const summaryHe =
    "גרסה רגשית עם קצב איטי, מעברים חמים וB-roll אטמוספרי על הרגעים הרגישים.";

  return {
    mode: "emotional",
    changes,
    patch,
    summaryHe,
  };
}

/**
 * Sales mode: conversion-focused, CTA-driven, persuasive
 */
function generateSalesEdit(input: ReEditInput): ReEditResult {
  const changes: ReEditChange[] = [];
  const patch: ReEditResult["patch"] = {};

  // 1. Moderate pacing: no changes (keep natural)

  // 2. CTA-focused: add highlight to last segment
  if (input.segments.length > 0) {
    const lastSegmentIndex = input.segments.length - 1;
    const lastSegment = input.segments[lastSegmentIndex];

    const words = lastSegment.text.split(/\s+/);
    const ctaWord = words[words.length - 1] || lastSegment.text;

    const updatedLastSegment = {
      ...lastSegment,
      highlightWord: ctaWord,
      highlightStyle: "bold-color",
    };

    if (!patch.segments) {
      patch.segments = [...input.segments];
    }
    patch.segments[lastSegmentIndex] = updatedLastSegment;

    changes.push({
      category: "cta",
      descriptionHe: "CTA חזק - הדגשת המילה האחרונה בהדגשה בולדת",
      descriptionEn: "Strong CTA - last word highlighted for conversion focus",
      impact: "high",
    });
  }

  // 3. Product-focused B-roll: keep relevant ones, filter out generic
  const productKeywords = ["product", "demo", "feature", "benefit", "solve"];
  const filteredBrollPlacements = input.brollPlacements.filter((placement) =>
    productKeywords.some((kw) =>
      placement.keyword.toLowerCase().includes(kw)
    )
  );

  // If no product-focused B-roll, add some
  if (filteredBrollPlacements.length === 0 && input.brollPlacements.length > 0) {
    patch.brollPlacements = input.brollPlacements.slice(0, 2);
  } else if (filteredBrollPlacements.length > 0) {
    patch.brollPlacements = filteredBrollPlacements;
    changes.push({
      category: "broll",
      descriptionHe: "B-roll ממוקד מוצר - בחרנו את המוצר וההטבות",
      descriptionEn: "Product-focused B-roll - selected product and benefits",
      impact: "medium",
    });
  }

  // 4. Higher music volume (40%)
  if (input.musicEnabled && input.musicVolume !== 40) {
    patch.musicVolume = 40;
    changes.push({
      category: "music",
      descriptionHe: "מוסיקה עוררת - 40% לשיאים במכירה",
      descriptionEn: "Energetic music - 40% to drive conversion moments",
      impact: "medium",
    });
  }

  // 5. Bold subtitle style: slideUp animation, heavier weight
  patch.subtitleAnimation = "slideUp";
  patch.subtitleFontSize = 44;
  patch.subtitleFontWeight = 600;
  changes.push({
    category: "subtitles",
    descriptionHe: "תיתרים בולדים - 'Slide Up' עם משקל כבד",
    descriptionEn: "Bold subtitles - 'Slide Up' animation with heavy weight",
    impact: "medium",
  });

  // 6. Set preset to "sales"
  if (input.currentPreset !== "sales") {
    patch.preset = "sales";
  }

  // 7. Set premiumLevel to "premium"
  if (input.premiumLevel !== "premium") {
    patch.premiumLevel = "premium";
  }

  const summaryHe =
    "גרסה מוקדשת למכירה עם CTA חזק בסוף, B-roll מוקדש מוצר ותיתרים בולדים.";

  return {
    mode: "sales",
    changes,
    patch,
    summaryHe,
  };
}

/**
 * Get available re-edit modes with UI metadata
 */
export function getReEditModes(): ReEditModeConfig[] {
  return [
    {
      id: "viral",
      icon: "🔥",
      labelHe: "ויראלי",
      descHe: "עריכה מהירה ואנרגטית לשיתוף חברתי מקסימלי",
    },
    {
      id: "premium",
      icon: "✨",
      labelHe: "פרימיום",
      descHe: "עריכה קולנועית וחכמה לשיוך מותג יוקרה",
    },
    {
      id: "emotional",
      icon: "❤️",
      labelHe: "רגשי",
      descHe: "עריכה איטית וממלאת לחיבור עמוק עם הצופה",
    },
    {
      id: "sales",
      icon: "💰",
      labelHe: "מכירות",
      descHe: "עריכה ממוקדת המרה עם CTA חזק",
    },
  ];
}

/**
 * Helper function to extract the most relevant keyword from text
 */
function extractKeyword(text: string): string {
  // Remove common words and get the longest/most significant word
  const commonWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "is",
    "was",
    "are",
    "be",
  ]);

  const words = text
    .split(/\s+/)
    .filter((w) => !commonWords.has(w.toLowerCase()) && w.length > 3);

  if (words.length === 0) {
    return text.split(/\s+/)[0] || "content";
  }

  // Return the first significant word
  return words[0];
}
