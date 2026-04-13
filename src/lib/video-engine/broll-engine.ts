/**
 * PixelFrameAI — Advanced B-Roll Engine
 *
 * Extends broll-analysis.ts with category-aware, intensity-based B-roll planning.
 * Builds intelligent placements using content category detection and advanced
 * prioritization strategies optimized for social media and professional formats.
 */

import { TranscriptSegment, analyzeBroll, BrollPlan } from "./broll-analysis";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface BrollCategory {
  id: string;
  label: string;
  labelHe: string;
  keywords: string[];
  shotTypes: string[];
  priority: number;
}

export interface AdvancedBrollPlacement {
  id: string;
  segmentId: string;
  startSec: number;
  endSec: number;
  keyword: string;
  theme: string;
  shotType: string;
  reason: string;
  relevance: number;
  priority: number;
  source: "stock" | "ai" | "library" | "placeholder";
  mediaUrl: string; // empty if placeholder
  category: string;
  duration: number;
}

export interface AdvancedBrollPlan {
  placements: AdvancedBrollPlacement[];
  category: BrollCategory;
  intensity: "light" | "medium" | "aggressive";
  stats: {
    totalDuration: number;
    coveragePercent: number;
    placementCount: number;
    topThemes: string[];
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Content Categories
   ═══════════════════════════════════════════════════════════════════════════ */

export const BROLL_CATEGORIES: BrollCategory[] = [
  {
    id: "real-estate",
    label: "Real Estate",
    labelHe: "נדל\"ן",
    keywords: [
      "בית",
      "דירה",
      "חדר",
      "שכונה",
      "exterior",
      "interior",
      "neighborhood",
      "lifestyle",
      "property",
      "apartment",
      "house",
    ],
    shotTypes: ["wide", "detail", "drone", "walkthrough"],
    priority: 1,
  },
  {
    id: "food",
    label: "Food & Dining",
    labelHe: "אוכל",
    keywords: [
      "מנה",
      "מתכון",
      "מרכיבים",
      "בישול",
      "ingredients",
      "cooking",
      "plating",
      "serving",
      "restaurant",
    ],
    shotTypes: ["close-up", "detail", "action", "overhead"],
    priority: 1,
  },
  {
    id: "legal",
    label: "Legal",
    labelHe: "משפטי",
    keywords: [
      "חוק",
      "עורך דין",
      "משרד",
      "ייעוץ",
      "office",
      "consultation",
      "documents",
      "authority",
      "law",
      "court",
    ],
    shotTypes: ["wide", "detail", "abstract"],
    priority: 2,
  },
  {
    id: "finance",
    label: "Finance",
    labelHe: "פיננסי",
    keywords: [
      "כסף",
      "השקעה",
      "תשואה",
      "charts",
      "meetings",
      "papers",
      "office",
      "graphs",
      "money",
      "investment",
    ],
    shotTypes: ["detail", "abstract", "wide"],
    priority: 2,
  },
  {
    id: "retail",
    label: "Retail & Product",
    labelHe: "מוצרים",
    keywords: [
      "מוצר",
      "חנות",
      "product",
      "unboxing",
      "usage",
      "shelves",
      "packaging",
      "demo",
    ],
    shotTypes: ["close-up", "detail", "action"],
    priority: 1,
  },
  {
    id: "tech",
    label: "Technology",
    labelHe: "טכנולוגיה",
    keywords: [
      "אפליקציה",
      "תוכנה",
      "app",
      "software",
      "screen",
      "code",
      "device",
      "interface",
    ],
    shotTypes: ["detail", "abstract", "close-up"],
    priority: 2,
  },
  {
    id: "fitness",
    label: "Fitness & Health",
    labelHe: "כושר ובריאות",
    keywords: [
      "אימון",
      "תרגיל",
      "exercise",
      "workout",
      "gym",
      "health",
      "body",
    ],
    shotTypes: ["action", "wide", "close-up"],
    priority: 1,
  },
  {
    id: "general",
    label: "General",
    labelHe: "כללי",
    keywords: [],
    shotTypes: ["wide", "detail", "abstract", "action"],
    priority: 3,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Content Category Detection
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Analyze all segment text and detect the primary content category.
 * Counts keyword matches per category and returns the best match.
 * Falls back to "general" if no strong category match is found.
 */
export function detectContentCategory(
  segments: TranscriptSegment[]
): BrollCategory {
  if (segments.length === 0) {
    return BROLL_CATEGORIES.find((c) => c.id === "general") || BROLL_CATEGORIES[0];
  }

  const allText = segments.map((s) => s.text).join(" ").toLowerCase();

  // Count keyword matches per category
  const categoryScores: Record<string, number> = {};

  for (const category of BROLL_CATEGORIES) {
    let score = 0;
    for (const keyword of category.keywords) {
      const keywordLower = keyword.toLowerCase();
      // Count occurrences of each keyword
      const matches = (allText.match(new RegExp(keywordLower, "g")) || []).length;
      score += matches;
    }
    categoryScores[category.id] = score;
  }

  // Find category with highest score (exclude general unless it's the only option)
  let bestCategoryId = "general";
  let bestScore = 0;

  for (const [categoryId, score] of Object.entries(categoryScores)) {
    if (categoryId !== "general" && score > bestScore) {
      bestScore = score;
      bestCategoryId = categoryId;
    }
  }

  // Fallback to general if no strong matches
  const threshold = Math.max(2, segments.length * 0.1);
  if (bestScore < threshold) {
    bestCategoryId = "general";
  }

  const category = BROLL_CATEGORIES.find((c) => c.id === bestCategoryId);
  return category || BROLL_CATEGORIES[BROLL_CATEGORIES.length - 1];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Advanced B-Roll Planning
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Generate an advanced B-roll plan with category awareness and intensity control.
 * Applies intensity settings to determine coverage percentage and relevance thresholds:
 *  - "light": max 20% coverage, only high-relevance moments (>0.7)
 *  - "medium": max 35% coverage, medium+ relevance (>0.5)
 *  - "aggressive": max 50% coverage, most segments get B-roll (>0.3)
 *
 * Creates short, punchy placements (2-4 seconds) optimized for social media.
 * Prioritizes topic changes, emotional peaks, and data points.
 * Avoids placing B-roll during strong on-camera moments.
 */
export function generateAdvancedBrollPlan(
  segments: TranscriptSegment[],
  options: {
    category?: string;
    intensity: "light" | "medium" | "aggressive";
    language: "he" | "en" | "auto";
    targetCoverage?: number;
  }
): AdvancedBrollPlan {
  const {
    category: categoryId,
    intensity,
    language,
    targetCoverage: customTargetCoverage,
  } = options;

  if (segments.length === 0) {
    const generalCategory = BROLL_CATEGORIES.find((c) => c.id === "general")!;
    return {
      placements: [],
      category: generalCategory,
      intensity,
      stats: {
        totalDuration: 0,
        coveragePercent: 0,
        placementCount: 0,
        topThemes: [],
      },
    };
  }

  // 1. Detect category if not specified
  let category: BrollCategory;
  if (categoryId) {
    category =
      BROLL_CATEGORIES.find((c) => c.id === categoryId) ||
      BROLL_CATEGORIES.find((c) => c.id === "general")!;
  } else {
    category = detectContentCategory(segments);
  }

  // 2. Determine coverage limits based on intensity
  let coverageTarget: number;
  let minRelevanceThreshold: number;

  switch (intensity) {
    case "light":
      coverageTarget = 0.2;
      minRelevanceThreshold = 0.7;
      break;
    case "medium":
      coverageTarget = 0.35;
      minRelevanceThreshold = 0.5;
      break;
    case "aggressive":
      coverageTarget = 0.5;
      minRelevanceThreshold = 0.3;
      break;
  }

  // Override with custom target if provided
  if (customTargetCoverage !== undefined) {
    coverageTarget = Math.min(
      coverageTarget,
      customTargetCoverage
    );
  }

  // 3. Use base analysis engine
  const basePlan = analyzeBroll(segments, {
    language,
    targetCoverage: coverageTarget,
    minRelevance: minRelevanceThreshold,
    maxSuggestions: Math.ceil(segments.length * coverageTarget),
  });

  // 4. Convert suggestions to advanced placements with category awareness
  const placements: AdvancedBrollPlacement[] = [];

  for (const suggestion of basePlan.suggestions) {
    const segment = segments.find((s) => s.id === suggestion.segmentId);
    if (!segment) continue;

    // Determine shot type from category preferences
    let shotType = suggestion.shotType;
    if (
      category.shotTypes.length > 0 &&
      !category.shotTypes.includes(shotType)
    ) {
      // Pick a category-compatible shot type
      shotType = category.shotTypes[0] as typeof shotType;
    }

    // Calculate optimal duration (2-4 seconds for social)
    const segmentDuration = segment.endSec - segment.startSec;
    const optimalDuration = Math.min(4, Math.max(2, segmentDuration * 0.6));

    // Adjust start/end to create punch-in effect
    const startOffset = Math.min(0.5, segmentDuration * 0.1);
    const adjustedStart = Math.max(segment.startSec, segment.startSec + startOffset);
    const adjustedEnd = Math.min(
      segment.endSec,
      adjustedStart + optimalDuration
    );

    // Prefer category keywords, fall back to suggestion keywords
    let keyword = suggestion.keywords[0] || "contextual";
    for (const catKeyword of category.keywords) {
      if (
        suggestion.keywords.some((k) =>
          k.toLowerCase().includes(catKeyword.toLowerCase())
        ) ||
        segment.text.toLowerCase().includes(catKeyword.toLowerCase())
      ) {
        keyword = catKeyword;
        break;
      }
    }

    placements.push({
      id: `adv-broll-${suggestion.segmentId}-${Date.now()}`,
      segmentId: suggestion.segmentId,
      startSec: adjustedStart,
      endSec: adjustedEnd,
      keyword,
      theme: suggestion.theme,
      shotType,
      reason: suggestion.reason,
      relevance: suggestion.relevance,
      priority: suggestion.priority,
      source: "placeholder",
      mediaUrl: "",
      category: category.id,
      duration: adjustedEnd - adjustedStart,
    });
  }

  // 5. Sort placements by priority (preserve order by segment + priority)
  placements.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.startSec - b.startSec;
  });

  // 6. Compute stats
  const totalDuration =
    placements.length > 0
      ? placements.reduce((sum, p) => sum + p.duration, 0)
      : 0;

  const themeSet = new Set(placements.map((p) => p.theme));
  const topThemes = Array.from(themeSet).slice(0, 5);

  const stats = {
    totalDuration: Math.round(totalDuration * 10) / 10,
    coveragePercent: Math.round((placements.length / segments.length) * 100),
    placementCount: placements.length,
    topThemes,
  };

  return {
    placements,
    category,
    intensity,
    stats,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get category by ID
 */
export function getCategoryById(id: string): BrollCategory | undefined {
  return BROLL_CATEGORIES.find((c) => c.id === id);
}

/**
 * Get all available categories
 */
export function listAllCategories(): BrollCategory[] {
  return [...BROLL_CATEGORIES];
}

/**
 * Filter placements by theme
 */
export function filterPlacementsByTheme(
  placements: AdvancedBrollPlacement[],
  theme: string
): AdvancedBrollPlacement[] {
  return placements.filter((p) => p.theme === theme);
}

/**
 * Filter placements by shot type
 */
export function filterPlacementsByShotType(
  placements: AdvancedBrollPlacement[],
  shotType: string
): AdvancedBrollPlacement[] {
  return placements.filter((p) => p.shotType === shotType);
}

/**
 * Calculate total B-roll duration needed
 */
export function calculateTotalBrollDuration(
  placements: AdvancedBrollPlacement[]
): number {
  return placements.reduce((sum, p) => sum + p.duration, 0);
}

/**
 * Get placement distribution by theme (for UI charts/analytics)
 */
export function getThemeDistribution(
  placements: AdvancedBrollPlacement[]
): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const placement of placements) {
    distribution[placement.theme] = (distribution[placement.theme] || 0) + 1;
  }
  return distribution;
}

/**
 * Get placement distribution by shot type (for UI charts/analytics)
 */
export function getShotTypeDistribution(
  placements: AdvancedBrollPlacement[]
): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const placement of placements) {
    distribution[placement.shotType] = (distribution[placement.shotType] || 0) + 1;
  }
  return distribution;
}

/**
 * Estimate resource cost/effort based on placement sources
 * Useful for workflow planning
 */
export function estimateResourceRequirements(
  placements: AdvancedBrollPlacement[]
): {
  stock: number;
  ai: number;
  library: number;
  placeholder: number;
} {
  const counts = {
    stock: 0,
    ai: 0,
    library: 0,
    placeholder: 0,
  };

  for (const placement of placements) {
    counts[placement.source]++;
  }

  return counts;
}
