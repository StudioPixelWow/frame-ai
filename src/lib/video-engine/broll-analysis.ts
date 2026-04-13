/**
 * PixelFrameAI — AI B-Roll Analysis Engine
 *
 * Analyzes transcript segments to generate intelligent B-roll suggestions.
 * Uses NLP-style heuristics to identify:
 *  - Topics & entities (people, products, locations, concepts)
 *  - Emotional moments (excitement, surprise, emphasis)
 *  - Visual opportunities (actions described, scene changes)
 *  - Pacing needs (long monologue sections that need visual variety)
 *
 * Produces a BrollPlan with scored, themed placements.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TranscriptSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  highlightWord?: string;
}

export interface BrollSuggestion {
  segmentId: string;
  /** AI-inferred theme/topic for this segment */
  theme: string;
  /** Keywords suitable for stock/AI image search */
  keywords: string[];
  /** Shot type recommendation */
  shotType: "close-up" | "wide" | "detail" | "abstract" | "action" | "overlay-text";
  /** Why this segment needs B-roll */
  reason: "topic-change" | "emotional-peak" | "visual-opportunity" | "pacing" | "emphasis" | "data-point";
  /** Confidence score 0-1 */
  relevance: number;
  /** Priority rank (lower = more important) */
  priority: number;
}

export interface BrollPlan {
  suggestions: BrollSuggestion[];
  /** Summary stats */
  stats: {
    totalSegments: number;
    suggestedCount: number;
    topThemes: string[];
    coveragePercent: number;
    avgRelevance: number;
  };
}

export interface BrollPlacement {
  id: string;
  startSec: number;
  endSec: number;
  keyword: string;
  source: "stock" | "ai" | "pexels" | "pixabay" | "shutterstock" | "client" | "upload";
  theme?: string;
  shotType?: string;
  reason?: string;
  // Stock metadata
  stockProvider?: "pexels" | "pixabay" | "shutterstock";
  stockClipId?: string;
  stockPreviewUrl?: string;
  stockDownloadUrl?: string;
  stockThumbnailUrl?: string;
  stockTitle?: string;
  stockDuration?: number;
  searchKeyword?: string;
  relevanceScore?: number;
  mediaStatus?: "searching" | "found" | "not_found" | "error";
  mediaError?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Keyword & Theme Dictionaries
   ═══════════════════════════════════════════════════════════════════════════ */

/** Hebrew topic detection — maps trigger words to themes + stock keywords */
const TOPIC_MAP_HE: Record<string, { theme: string; keywords: string[]; shotType: BrollSuggestion["shotType"] }> = {
  // Business & Marketing
  "עסק|חברה|סטארטאפ|ארגון": { theme: "עסקים", keywords: ["business", "office", "team meeting"], shotType: "wide" },
  "שיווק|פרסום|קמפיין|מותג": { theme: "שיווק", keywords: ["marketing", "social media", "digital advertising"], shotType: "detail" },
  "מכירות|לקוחות|המרה|לידים": { theme: "מכירות", keywords: ["sales team", "handshake", "customer service"], shotType: "action" },
  "כסף|תקציב|השקעה|רווח|הכנסה": { theme: "פיננסים", keywords: ["finance", "growth chart", "money"], shotType: "detail" },
  "מוצר|אפליקציה|פלטפורמה|כלי": { theme: "מוצר", keywords: ["product demo", "app interface", "technology"], shotType: "close-up" },

  // Tech
  "טכנולוגיה|AI|בינה מלאכותית|אלגוריתם": { theme: "טכנולוגיה", keywords: ["artificial intelligence", "futuristic tech", "neural network"], shotType: "abstract" },
  "נתונים|דאטה|אנליטיקס|סטטיסטיקה": { theme: "נתונים", keywords: ["data analytics", "dashboard", "statistics graph"], shotType: "overlay-text" },
  "אתר|אינטרנט|דיגיטל|אונליין": { theme: "דיגיטל", keywords: ["website", "digital", "internet"], shotType: "detail" },

  // People & Emotion
  "אנשים|צוות|עובדים|קהילה": { theme: "אנשים", keywords: ["diverse team", "people working", "community"], shotType: "wide" },
  "הצלחה|השגה|ניצחון|שיא": { theme: "הצלחה", keywords: ["success celebration", "achievement", "trophy"], shotType: "action" },
  "בעיה|אתגר|קושי|כאב": { theme: "אתגר", keywords: ["problem solving", "challenge", "thinking"], shotType: "close-up" },
  "פתרון|תשובה|מענה|עזרה": { theme: "פתרון", keywords: ["solution", "breakthrough", "lightbulb moment"], shotType: "abstract" },

  // Education & Content
  "למד|הסבר|טיפ|מדריך": { theme: "חינוך", keywords: ["learning", "education", "presentation"], shotType: "detail" },
  "סיפור|חוויה|מסע|דרך": { theme: "סיפור", keywords: ["journey", "path", "story"], shotType: "wide" },

  // Lifestyle
  "בריאות|כושר|ספורט|אימון": { theme: "בריאות", keywords: ["fitness", "healthy lifestyle", "workout"], shotType: "action" },
  "אוכל|מזון|מסעדה|בישול": { theme: "אוכל", keywords: ["food", "cooking", "restaurant"], shotType: "close-up" },
  "נסיעה|טיול|מקום|עיר": { theme: "נסיעות", keywords: ["travel", "destination", "landscape"], shotType: "wide" },
};

/** English topic detection */
const TOPIC_MAP_EN: Record<string, { theme: string; keywords: string[]; shotType: BrollSuggestion["shotType"] }> = {
  "business|company|startup|organization": { theme: "business", keywords: ["business office", "team meeting", "corporate"], shotType: "wide" },
  "marketing|advertising|campaign|brand": { theme: "marketing", keywords: ["marketing", "social media", "advertising"], shotType: "detail" },
  "sales|customers|conversion|leads": { theme: "sales", keywords: ["sales meeting", "handshake", "customer"], shotType: "action" },
  "money|budget|investment|profit|revenue": { theme: "finance", keywords: ["finance", "growth chart", "investment"], shotType: "detail" },
  "product|app|platform|tool|software": { theme: "product", keywords: ["product demo", "app interface", "technology"], shotType: "close-up" },
  "technology|AI|artificial intelligence|algorithm": { theme: "technology", keywords: ["AI", "futuristic", "neural network"], shotType: "abstract" },
  "data|analytics|statistics|metrics": { theme: "data", keywords: ["data dashboard", "analytics", "chart"], shotType: "overlay-text" },
  "people|team|employees|community": { theme: "people", keywords: ["diverse team", "collaboration", "community"], shotType: "wide" },
  "success|achievement|win|milestone": { theme: "success", keywords: ["celebration", "achievement", "victory"], shotType: "action" },
  "problem|challenge|struggle|pain": { theme: "challenge", keywords: ["problem solving", "frustration", "thinking"], shotType: "close-up" },
  "solution|answer|fix|help": { theme: "solution", keywords: ["breakthrough", "solution", "lightbulb"], shotType: "abstract" },
  "learn|explain|tip|guide|how to": { theme: "education", keywords: ["learning", "tutorial", "presentation"], shotType: "detail" },
  "story|experience|journey|path": { theme: "story", keywords: ["journey", "road", "story"], shotType: "wide" },
  "health|fitness|sport|workout": { theme: "health", keywords: ["fitness", "healthy", "workout"], shotType: "action" },
  "food|cooking|restaurant|recipe": { theme: "food", keywords: ["food", "cooking", "cuisine"], shotType: "close-up" },
  "travel|trip|destination|city": { theme: "travel", keywords: ["travel", "destination", "landscape"], shotType: "wide" },
};

/** Emotional intensity markers */
const EMPHASIS_MARKERS_HE = ["חייבים", "בדיוק", "הכי", "ממש", "מדהים", "מטורף", "פשוט", "בטירוף", "חד משמעית", "בלי ספק"];
const EMPHASIS_MARKERS_EN = ["must", "exactly", "most", "really", "amazing", "incredible", "absolutely", "definitely", "without doubt", "game-changer"];

/** Data/statistic patterns */
const DATA_PATTERNS = [
  /\d+\s*%/,         // percentages
  /\d+x/i,           // multipliers
  /\$[\d,.]+/,        // dollar amounts
  /₪[\d,.]+/,         // shekel amounts
  /\d+\s*(אלף|מיליון|מיליארד)/i, // Hebrew large numbers
  /\d+\s*(thousand|million|billion)/i, // English large numbers
  /x\d+/,            // multiplier prefix
];

/* ═══════════════════════════════════════════════════════════════════════════
   Analysis Functions
   ═══════════════════════════════════════════════════════════════════════════ */

function detectLanguage(segments: TranscriptSegment[]): "he" | "en" {
  const allText = segments.map(s => s.text).join(" ");
  const hebrewChars = (allText.match(/[\u0590-\u05FF]/g) || []).length;
  const latinChars = (allText.match(/[a-zA-Z]/g) || []).length;
  return hebrewChars > latinChars ? "he" : "en";
}

function matchTopics(text: string, topicMap: Record<string, { theme: string; keywords: string[]; shotType: BrollSuggestion["shotType"] }>): { theme: string; keywords: string[]; shotType: BrollSuggestion["shotType"]; matchCount: number }[] {
  const results: { theme: string; keywords: string[]; shotType: BrollSuggestion["shotType"]; matchCount: number }[] = [];
  const lowerText = text.toLowerCase();

  for (const [pattern, config] of Object.entries(topicMap)) {
    const words = pattern.split("|");
    const matchCount = words.filter(w => lowerText.includes(w)).length;
    if (matchCount > 0) {
      results.push({ ...config, matchCount });
    }
  }

  return results.sort((a, b) => b.matchCount - a.matchCount);
}

function detectEmotionalPeaks(text: string, lang: "he" | "en"): number {
  const markers = lang === "he" ? EMPHASIS_MARKERS_HE : EMPHASIS_MARKERS_EN;
  const lowerText = text.toLowerCase();
  let score = 0;

  // Emphasis word count
  for (const marker of markers) {
    if (lowerText.includes(marker)) score += 0.2;
  }

  // Exclamation marks
  score += (text.match(/!/g) || []).length * 0.15;

  // Question marks (engagement)
  score += (text.match(/\?/g) || []).length * 0.1;

  // ALL CAPS words (English)
  if (lang === "en") {
    score += (text.match(/\b[A-Z]{2,}\b/g) || []).length * 0.15;
  }

  return Math.min(1, score);
}

function detectDataPoints(text: string): boolean {
  return DATA_PATTERNS.some(pattern => pattern.test(text));
}

function detectTopicChange(prevText: string, currText: string, topicMap: Record<string, any>): boolean {
  const prevTopics = matchTopics(prevText, topicMap).map(t => t.theme);
  const currTopics = matchTopics(currText, topicMap).map(t => t.theme);

  if (prevTopics.length === 0 || currTopics.length === 0) return false;
  // Topic change if the primary topic differs
  return prevTopics[0] !== currTopics[0];
}

function computePacingNeed(segments: TranscriptSegment[], index: number): number {
  // If there have been many consecutive segments without B-roll opportunities,
  // the pacing score increases (viewer needs visual variety)
  let consecutiveMonologue = 0;
  for (let i = index; i >= Math.max(0, index - 5); i--) {
    consecutiveMonologue++;
  }
  // After 3+ segments of monologue, pacing need grows
  return Math.min(1, Math.max(0, (consecutiveMonologue - 2) * 0.25));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Analysis Entry Point
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Analyze transcript segments and generate an intelligent B-roll plan.
 *
 * @param segments — Transcript segments from the wizard
 * @param options — Configuration options
 * @returns BrollPlan with scored suggestions
 */
export function analyzeBroll(
  segments: TranscriptSegment[],
  options: {
    language?: "he" | "en" | "auto";
    maxSuggestions?: number;
    /** Target coverage: 0.3 = suggest B-roll for ~30% of segments */
    targetCoverage?: number;
    /** Minimum relevance threshold */
    minRelevance?: number;
    /** AI edit mode affects B-roll density */
    aiEditMode?: string;
  } = {}
): BrollPlan {
  const {
    language: langOption = "auto",
    maxSuggestions = 20,
    targetCoverage = 0.4,
    minRelevance = 0.3,
    aiEditMode = "",
  } = options;

  if (segments.length === 0) {
    return { suggestions: [], stats: { totalSegments: 0, suggestedCount: 0, topThemes: [], coveragePercent: 0, avgRelevance: 0 } };
  }

  const lang = langOption === "auto" ? detectLanguage(segments) : langOption;
  const topicMap = lang === "he" ? TOPIC_MAP_HE : TOPIC_MAP_EN;

  // Adjust density based on edit mode
  let densityMultiplier = 1;
  if (aiEditMode === "viral") densityMultiplier = 1.5;    // More B-roll for viral
  if (aiEditMode === "emotional") densityMultiplier = 1.2; // More for emotional
  if (aiEditMode === "premium") densityMultiplier = 0.8;   // Less for premium (clean)
  if (aiEditMode === "sales") densityMultiplier = 1.3;     // More for sales (visual proof)

  const effectiveCoverage = Math.min(0.7, targetCoverage * densityMultiplier);

  // Analyze each segment
  const rawSuggestions: BrollSuggestion[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = seg.text.trim();
    if (!text) continue;

    let relevance = 0;
    let reason: BrollSuggestion["reason"] = "pacing";
    let theme = "";
    let keywords: string[] = [];
    let shotType: BrollSuggestion["shotType"] = "wide";

    // 1. Topic detection
    const topics = matchTopics(text, topicMap);
    if (topics.length > 0) {
      const top = topics[0];
      theme = top.theme;
      keywords = [...top.keywords];
      shotType = top.shotType;
      relevance += 0.3 + (top.matchCount * 0.1);
      reason = "visual-opportunity";
    }

    // 2. Topic change detection
    if (i > 0) {
      const prevText = segments[i - 1].text;
      if (detectTopicChange(prevText, text, topicMap)) {
        relevance += 0.25;
        reason = "topic-change";
      }
    }

    // 3. Emotional peak detection
    const emotionalScore = detectEmotionalPeaks(text, lang);
    if (emotionalScore > 0.3) {
      relevance += emotionalScore * 0.3;
      if (emotionalScore > 0.5) reason = "emotional-peak";
    }

    // 4. Data point detection
    if (detectDataPoints(text)) {
      relevance += 0.35;
      reason = "data-point";
      shotType = "overlay-text";
      keywords.push("infographic", "chart", "statistics");
    }

    // 5. Emphasis/highlight word detection
    if (seg.highlightWord) {
      relevance += 0.15;
      reason = "emphasis";
      keywords.push(seg.highlightWord);
    }

    // 6. Pacing need
    const pacingNeed = computePacingNeed(segments, i);
    if (pacingNeed > 0.3) {
      relevance += pacingNeed * 0.2;
      if (reason === "pacing" && pacingNeed > 0.5) reason = "pacing";
    }

    // 7. Segment length bonus (longer segments benefit more from B-roll)
    const segDuration = seg.endSec - seg.startSec;
    if (segDuration > 4) relevance += 0.1;
    if (segDuration > 6) relevance += 0.1;

    // 8. Position bonus (first and last segments are important)
    if (i === 0) relevance += 0.15;  // Hook
    if (i === segments.length - 1) relevance += 0.1; // CTA/closing

    // Fallback keywords from text
    if (keywords.length === 0) {
      keywords = extractKeywordsFromText(text, lang);
    }
    if (!theme) {
      theme = keywords[0] || "general";
    }

    relevance = Math.min(1, relevance);

    if (relevance >= minRelevance) {
      rawSuggestions.push({
        segmentId: seg.id,
        theme,
        keywords: keywords.slice(0, 4),
        shotType,
        reason,
        relevance,
        priority: 0, // will be set after sorting
      });
    }
  }

  // Sort by relevance (highest first) and assign priority
  rawSuggestions.sort((a, b) => b.relevance - a.relevance);
  rawSuggestions.forEach((s, i) => { s.priority = i + 1; });

  // Limit to target coverage
  const targetCount = Math.min(
    maxSuggestions,
    Math.max(1, Math.ceil(segments.length * effectiveCoverage))
  );
  const suggestions = rawSuggestions.slice(0, targetCount);

  // Compute stats
  const themeCount: Record<string, number> = {};
  for (const s of suggestions) {
    themeCount[s.theme] = (themeCount[s.theme] || 0) + 1;
  }
  const topThemes = Object.entries(themeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme]) => theme);

  const avgRelevance = suggestions.length > 0
    ? suggestions.reduce((sum, s) => sum + s.relevance, 0) / suggestions.length
    : 0;

  return {
    suggestions,
    stats: {
      totalSegments: segments.length,
      suggestedCount: suggestions.length,
      topThemes,
      coveragePercent: Math.round((suggestions.length / segments.length) * 100),
      avgRelevance: Math.round(avgRelevance * 100) / 100,
    },
  };
}

/**
 * Convert BrollPlan suggestions into BrollPlacements ready for the wizard.
 */
export function planToPlacements(
  plan: BrollPlan,
  segments: TranscriptSegment[],
  source: "stock" | "ai"
): BrollPlacement[] {
  return plan.suggestions.map((sug) => {
    const seg = segments.find(s => s.id === sug.segmentId);
    if (!seg) return null;
    return {
      id: `broll-ai-${sug.segmentId}-${Date.now()}`,
      startSec: seg.startSec,
      endSec: seg.endSec,
      keyword: sug.keywords[0] || "contextual",
      source,
      theme: sug.theme,
      shotType: sug.shotType,
      reason: sug.reason,
    };
  }).filter(Boolean) as BrollPlacement[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Text Keyword Extraction
   ═══════════════════════════════════════════════════════════════════════════ */

/** Hebrew stop words to exclude */
const STOP_WORDS_HE = new Set(["את", "של", "על", "עם", "זה", "הוא", "היא", "אני", "לא", "כן", "מה", "איך", "למה", "כי", "אם", "או", "גם", "רק", "יותר", "כבר", "עוד", "הם", "שלנו", "שלי", "אבל", "אז"]);
const STOP_WORDS_EN = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "shall", "should", "may", "might", "must", "can", "could", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "about", "like", "through", "after", "over", "between", "out", "against", "during", "without", "before", "under", "around", "among", "and", "but", "or", "nor", "not", "so", "yet", "it", "its", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "our", "their", "what", "which", "who", "when", "where", "why", "how", "all", "each", "every", "both", "few", "more", "most", "other", "some", "such", "no", "only", "same", "than", "too", "very", "just", "because", "also", "if", "then", "else", "while"]);

function extractKeywordsFromText(text: string, lang: "he" | "en"): string[] {
  const stopWords = lang === "he" ? STOP_WORDS_HE : STOP_WORDS_EN;
  const words = text
    .replace(/[^\w\s\u0590-\u05FF]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));

  // Deduplicate and take top 3
  const unique = [...new Set(words)];
  return unique.slice(0, 3);
}
