/**
 * PixelManageAI — AI Video Analysis Engine
 * Scoring, hook generation, re-edit suggestions, performance prediction, highlight detection.
 */

import type {
  SubtitleSegment, SubtitleStyle, VideoScore, VideoScoreBreakdown,
  GeneratedHook, ReEditSuggestion, ReEditChange, PerformancePrediction,
  PredictionFactor, DetectedHighlight, SmartPresetId,
} from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   Video Scoring
   ═══════════════════════════════════════════════════════════════════════════ */

export function scoreVideo(params: {
  segments: SubtitleSegment[];
  durationSec: number;
  format: string;
  hasMusic: boolean;
  hasBroll: boolean;
  preset: string;
  subtitleStyle: SubtitleStyle;
}): VideoScore {
  const { segments, durationSec, format, hasMusic, hasBroll, preset } = params;
  const filledSegs = segments.filter(s => s.text.trim().length > 0);
  const editedSegs = segments.filter(s => s.edited);

  // Hook strength — first segment text quality
  const firstSeg = segments[0];
  const hookText = firstSeg?.text || "";
  const hookWords = hookText.split(/\s+/).length;
  const hookStrength = Math.min(100, Math.max(20,
    (hookWords >= 3 && hookWords <= 8 ? 40 : 20) +
    (hookText.includes("?") ? 15 : 0) +
    (hookText.match(/\d/) ? 10 : 0) +
    (filledSegs.length > 0 ? 20 : 0) +
    (firstSeg?.highlightWord ? 15 : 0)
  ));

  // Clarity — based on segment coverage and editing
  const coverage = filledSegs.length / Math.max(1, segments.length);
  const editRatio = editedSegs.length / Math.max(1, segments.length);
  const clarity = Math.min(100, Math.round(coverage * 50 + editRatio * 30 + (filledSegs.length > 3 ? 20 : 10)));

  // Engagement — based on highlights, variety, music
  const highlights = filledSegs.filter(s => s.highlightWord).length;
  const engagement = Math.min(100, Math.max(25,
    30 + (highlights * 8) + (hasMusic ? 15 : 0) + (hasBroll ? 15 : 0) +
    (format === "9:16" ? 10 : 5)
  ));

  // Pacing — ideal is 2-4 sec per segment, penalize too long or too short
  const avgSegDur = segments.length > 0 ? durationSec / segments.length : 0;
  const pacingScore = avgSegDur >= 2 && avgSegDur <= 4 ? 90 :
    avgSegDur >= 1.5 && avgSegDur <= 5 ? 70 :
    avgSegDur >= 1 && avgSegDur <= 7 ? 50 : 30;

  // CTA strength — last segment quality
  const lastSeg = segments[segments.length - 1];
  const ctaText = lastSeg?.text || "";
  const ctaStrength = Math.min(100, Math.max(15,
    (ctaText.length > 5 ? 30 : 10) +
    (ctaText.includes("\!") ? 15 : 0) +
    (ctaText.match(/לינק|קישור|הירשמ|לחצ|link|subscribe|click/i) ? 25 : 0) +
    (lastSeg?.edited ? 15 : 0) +
    (lastSeg?.highlightWord ? 15 : 0)
  ));

  const overall = Math.round(
    hookStrength * 0.25 + clarity * 0.2 + engagement * 0.25 +
    pacingScore * 0.15 + ctaStrength * 0.15
  );

  const breakdown: VideoScoreBreakdown[] = [
    { category: "hook", score: hookStrength, feedback: hookStrength > 70 ? "Strong opening" : "Consider a more compelling hook", feedbackHe: hookStrength > 70 ? "פתיחה חזקה" : "שקול פתיחה משכנעת יותר" },
    { category: "clarity", score: clarity, feedback: clarity > 70 ? "Clear messaging" : "Some segments need text", feedbackHe: clarity > 70 ? "מסרים ברורים" : "חלק מהסגמנטים חסרי טקסט" },
    { category: "engagement", score: engagement, feedback: engagement > 70 ? "High engagement potential" : "Add highlights and B-Roll", feedbackHe: engagement > 70 ? "פוטנציאל מעורבות גבוה" : "הוסף הדגשות ו-B-Roll" },
    { category: "pacing", score: pacingScore, feedback: pacingScore > 70 ? "Good pacing" : "Adjust segment timing", feedbackHe: pacingScore > 70 ? "קצב טוב" : "התאם תזמון סגמנטים" },
    { category: "cta", score: ctaStrength, feedback: ctaStrength > 60 ? "Clear call to action" : "Strengthen your CTA", feedbackHe: ctaStrength > 60 ? "קריאה לפעולה ברורה" : "חזק את הקריאה לפעולה" },
  ];

  return { overall, hookStrength, clarity, engagementPotential: engagement, pacing: pacingScore, ctaStrength, breakdown };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hook Generator
   ═══════════════════════════════════════════════════════════════════════════ */

export function generateHooks(params: {
  segments: SubtitleSegment[];
  clientTone: string;
  topic: string;
  language: string;
}): GeneratedHook[] {
  const { segments, clientTone, topic, language } = params;
  const isHe = language === "he" || language === "auto";
  const keyWords = segments.slice(0, 5).map(s => s.text).join(" ").split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  const topicWord = topic || keyWords[0] || (isHe ? "הנושא" : "this topic");

  const hooks: GeneratedHook[] = [
    {
      id: "hook_q", style: "question",
      text: isHe ? `מה אם הייתי אומר לך שאפשר ${topicWord} בחצי מהזמן?` : `What if I told you ${topicWord} in half the time?`,
      estimatedStrength: 78,
      reasoning: isHe ? "שאלות פותחות מעוררות סקרנות" : "Questions spark curiosity",
    },
    {
      id: "hook_stat", style: "statistic",
      text: isHe ? `90% מהאנשים לא יודעים את זה על ${topicWord}` : `90% of people don't know this about ${topicWord}`,
      estimatedStrength: 82,
      reasoning: isHe ? "סטטיסטיקות בולטות עוצרות גלילה" : "Striking statistics stop scrolling",
    },
    {
      id: "hook_bold", style: "bold_claim",
      text: isHe ? `זה ישנה לך את הדרך שבה אתה חושב על ${topicWord}` : `This will change how you think about ${topicWord}`,
      estimatedStrength: 72,
      reasoning: isHe ? "טענות נועזות מושכות תשומת לב" : "Bold claims demand attention",
    },
    {
      id: "hook_pain", style: "pain_point",
      text: isHe ? `נמאס לך מ${topicWord} שלא עובד? הנה הפתרון` : `Tired of ${topicWord} that doesn't work? Here's the fix`,
      estimatedStrength: 85,
      reasoning: isHe ? "כאב → פתרון הוא הנוסחה החזקה ביותר" : "Pain → solution is the strongest formula",
    },
    {
      id: "hook_curiosity", style: "curiosity",
      text: isHe ? `הטעות הכי גדולה שאתה עושה ב${topicWord} (ואיך לתקן)` : `The biggest mistake you're making with ${topicWord} (and how to fix it)`,
      estimatedStrength: 80,
      reasoning: isHe ? "פער סקרנות — הצופה חייב לראות עד הסוף" : "Curiosity gap keeps viewers watching",
    },
  ];

  return hooks.sort((a, b) => b.estimatedStrength - a.estimatedStrength);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Re-Edit Suggestions
   ═══════════════════════════════════════════════════════════════════════════ */

export function generateReEditSuggestions(params: {
  durationSec: number;
  segments: SubtitleSegment[];
  preset: string;
  format: string;
}): ReEditSuggestion[] {
  const { durationSec, segments } = params;

  const suggestions: ReEditSuggestion[] = [
    {
      id: "re_shorter", type: "shorter",
      title: "Shorter Version", titleHe: "גרסה קצרה",
      description: "Cut to 15 seconds, keep only strongest segments",
      descriptionHe: "קיצור ל-15 שניות, שמירה על הסגמנטים החזקים בלבד",
      changes: [
        { field: "duration", from: `${Math.round(durationSec)}s`, to: "15s" },
        { field: "segments", from: `${segments.length}`, to: `${Math.min(5, segments.length)}` },
        { field: "pacing", from: "current", to: "fast" },
      ],
      estimatedImpact: 75,
    },
    {
      id: "re_aggressive", type: "aggressive_pacing",
      title: "Aggressive Pacing", titleHe: "קצב אגרסיבי",
      description: "Remove all pauses, tighten cuts, maximum energy",
      descriptionHe: "הסרת כל ההפסקות, חיתוכים צמודים, אנרגיה מקסימלית",
      changes: [
        { field: "jumpCuts", from: "off", to: "aggressive" },
        { field: "silenceRemoval", from: "off", to: "aggressive" },
        { field: "motionIntensity", from: "50", to: "90" },
      ],
      estimatedImpact: 70,
    },
    {
      id: "re_emotional", type: "emotional",
      title: "Emotional Version", titleHe: "גרסה רגשית",
      description: "Slower pacing, cinematic music, warm color grading",
      descriptionHe: "קצב איטי יותר, מוזיקה קולנועית, צבעים חמים",
      changes: [
        { field: "preset", from: "current", to: "storytelling" },
        { field: "colorGrading", from: "current", to: "cinematic-warm" },
        { field: "musicMood", from: "current", to: "emotional" },
      ],
      estimatedImpact: 65,
    },
    {
      id: "re_tiktok", type: "tiktok_optimized",
      title: "TikTok Optimized", titleHe: "מותאם טיקטוק",
      description: "9:16, fast cuts, bold subtitles, trending style",
      descriptionHe: "9:16, חיתוכים מהירים, כתוביות בולטות, סגנון טרנדי",
      changes: [
        { field: "format", from: "current", to: "9:16" },
        { field: "preset", from: "current", to: "viral" },
        { field: "subtitleAnimation", from: "current", to: "kineticTypography" },
        { field: "subtitleFontSize", from: "current", to: "42px" },
      ],
      estimatedImpact: 80,
    },
  ];

  return suggestions;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Performance Prediction
   ═══════════════════════════════════════════════════════════════════════════ */

export function predictPerformance(params: {
  score: VideoScore;
  format: string;
  durationSec: number;
  hasMusic: boolean;
  hasBroll: boolean;
  preset: string;
}): PerformancePrediction {
  const { score, format, durationSec, hasMusic, hasBroll } = params;

  const factors: PredictionFactor[] = [];

  // Format factor
  if (format === "9:16") {
    factors.push({ name: "Format", nameHe: "פורמט", impact: "positive", weight: 15, detail: "Vertical format optimized for mobile" });
  } else {
    factors.push({ name: "Format", nameHe: "פורמט", impact: "neutral", weight: 5, detail: "Non-vertical may reduce mobile reach" });
  }

  // Duration factor
  if (durationSec <= 30) {
    factors.push({ name: "Duration", nameHe: "אורך", impact: "positive", weight: 15, detail: "Short form — high completion rate" });
  } else if (durationSec <= 60) {
    factors.push({ name: "Duration", nameHe: "אורך", impact: "neutral", weight: 8, detail: "Medium length — moderate retention" });
  } else {
    factors.push({ name: "Duration", nameHe: "אורך", impact: "negative", weight: -5, detail: "Long form — may lose viewers" });
  }

  // Hook factor
  if (score.hookStrength > 75) {
    factors.push({ name: "Hook", nameHe: "פתיחה", impact: "positive", weight: 20, detail: "Strong hook captures attention" });
  } else {
    factors.push({ name: "Hook", nameHe: "פתיחה", impact: "negative", weight: -10, detail: "Weak hook — viewers may scroll past" });
  }

  // Music
  factors.push(hasMusic
    ? { name: "Music", nameHe: "מוזיקה", impact: "positive", weight: 10, detail: "Background music increases watch time" }
    : { name: "Music", nameHe: "מוזיקה", impact: "negative", weight: -5, detail: "No music — lower emotional impact" }
  );

  // B-Roll
  factors.push(hasBroll
    ? { name: "B-Roll", nameHe: "B-Roll", impact: "positive", weight: 10, detail: "Visual variety improves engagement" }
    : { name: "B-Roll", nameHe: "B-Roll", impact: "neutral", weight: 0, detail: "No B-Roll — talking head style" }
  );

  const baseEngagement = score.overall;
  const factorBoost = factors.reduce((sum, f) => sum + f.weight, 0);

  const engagementPotential = Math.min(100, Math.max(10, baseEngagement + factorBoost * 0.3));
  const scrollStoppingStrength = Math.min(100, Math.max(10, score.hookStrength * 0.7 + (format === "9:16" ? 20 : 10)));
  const viralityLikelihood = Math.min(100, Math.max(5,
    engagementPotential * 0.4 + scrollStoppingStrength * 0.3 + (durationSec <= 30 ? 20 : 10) + (hasBroll ? 10 : 0)
  ));
  const watchThroughRate = Math.min(100, Math.max(15,
    score.pacing * 0.4 + score.clarity * 0.3 + (durationSec <= 15 ? 25 : durationSec <= 30 ? 15 : 5)
  ));

  return { engagementPotential, scrollStoppingStrength, viralityLikelihood, watchThroughRate, factors };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Highlight Detection
   ═══════════════════════════════════════════════════════════════════════════ */

export function detectHighlights(segments: SubtitleSegment[]): DetectedHighlight[] {
  const highlights: DetectedHighlight[] = [];
  const strongPhrasePatterns = /חשוב|מדהים|סוד|טיפ|must|secret|amazing|important|key|powerful|game.?changer/i;
  const emotionalPatterns = /אהבה|שמחה|כאב|פחד|love|joy|pain|fear|hope|dream|believe/i;
  const ctaPatterns = /לינק|הירשמ|לחצ|עכשיו|link|subscribe|click|now|join|get|start/i;

  segments.forEach((seg) => {
    if (!seg.text.trim()) return;

    if (strongPhrasePatterns.test(seg.text)) {
      highlights.push({
        id: `hl_strong_${seg.id}`, segmentId: seg.id,
        startSec: seg.startSec, endSec: seg.endSec, text: seg.text,
        type: "strong_phrase", strength: 75 + Math.random() * 20,
      });
    }

    if (emotionalPatterns.test(seg.text)) {
      highlights.push({
        id: `hl_emotion_${seg.id}`, segmentId: seg.id,
        startSec: seg.startSec, endSec: seg.endSec, text: seg.text,
        type: "emotional_peak", strength: 70 + Math.random() * 25,
      });
    }

    if (ctaPatterns.test(seg.text)) {
      highlights.push({
        id: `hl_cta_${seg.id}`, segmentId: seg.id,
        startSec: seg.startSec, endSec: seg.endSec, text: seg.text,
        type: "cta", strength: 80 + Math.random() * 15,
      });
    }

    // First segment is the hook
    if (seg === segments[0] && seg.text.trim().length > 5) {
      highlights.push({
        id: `hl_hook_${seg.id}`, segmentId: seg.id,
        startSec: seg.startSec, endSec: seg.endSec, text: seg.text,
        type: "hook", strength: 65 + Math.random() * 30,
      });
    }
  });

  return highlights.sort((a, b) => b.strength - a.strength);
}
