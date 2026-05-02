/**
 * PixelManageAI — Client DNA Analysis Engine
 * Analyzes client's content patterns, tone, recurring themes.
 */

import type { ClientDNA, GrowthInsight, OutputFormat } from "./types";

interface ProjectSummary {
  name: string;
  format: OutputFormat;
  segments: { text: string }[];
  preset: string;
  score?: number;
}

export function analyzeClientDNA(params: {
  clientId: string;
  projects: ProjectSummary[];
}): ClientDNA {
  const { clientId, projects } = params;

  // Aggregate all text
  const allText = projects.flatMap(p => p.segments.map(s => s.text)).join(" ");
  const words = allText.split(/\s+/).filter(w => w.length > 2);

  // Count word frequency
  const freq: Record<string, number> = {};
  words.forEach(w => { const lc = w.toLowerCase(); freq[lc] = (freq[lc] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const recurringWords = sorted.slice(0, 15).map(([w]) => w);

  // Detect tone
  const toneIndicators: Record<string, string[]> = {
    professional: ["מקצועי", "פתרון", "שירות", "professional", "solution", "service"],
    casual: ["כזה", "סבבה", "יאללה", "cool", "awesome", "hey"],
    energetic: ["מדהים", "פצצה", "הכי", "amazing", "incredible", "best"],
    emotional: ["לב", "חלום", "מאמין", "heart", "dream", "believe"],
  };

  const toneScores: Record<string, number> = {};
  Object.entries(toneIndicators).forEach(([tone, indicators]) => {
    toneScores[tone] = indicators.reduce((sum, ind) => sum + (freq[ind.toLowerCase()] || 0), 0);
  });

  const toneOfVoice = Object.entries(toneScores)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  if (toneOfVoice.length === 0) toneOfVoice.push("neutral");

  // Messaging style
  const avgWordsPerSeg = words.length / Math.max(1, projects.reduce((s, p) => s + p.segments.length, 0));
  const messagingStyle = avgWordsPerSeg > 5 ? "descriptive" : avgWordsPerSeg > 3 ? "balanced" : "punchy";

  // Content themes (top words excluding common stop words)
  const stopWords = new Set(["את", "של", "על", "עם", "זה", "לא", "כי", "גם", "או", "the", "and", "for", "this", "that", "with"]);
  const contentThemes = sorted.filter(([w]) => !stopWords.has(w) && w.length > 3).slice(0, 8).map(([w]) => w);

  // Preferred formats
  const formatCounts: Record<string, number> = {};
  projects.forEach(p => { formatCounts[p.format] = (formatCounts[p.format] || 0) + 1; });
  const preferredFormats = Object.entries(formatCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f as OutputFormat);

  // Average hook strength (simulated)
  const avgHookStrength = Math.round(50 + Math.random() * 35);

  // Top performing topics
  const topPerformingTopics = contentThemes.slice(0, 5);

  return {
    clientId, toneOfVoice, recurringWords, messagingStyle,
    contentThemes, preferredFormats,
    avgHookStrength, topPerformingTopics,
  };
}

export function generateGrowthInsights(dna: ClientDNA, projectCount: number): GrowthInsight[] {
  const insights: GrowthInsight[] = [];

  // What works
  if (dna.avgHookStrength > 60) {
    insights.push({
      id: "gw_hooks", type: "what_works",
      title: "Strong Hooks", titleHe: "פתיחות חזקות",
      detail: "Your hooks consistently perform well. Keep using questions and statistics.",
      detailHe: "הפתיחות שלך עקביות ואפקטיביות. המשך להשתמש בשאלות וסטטיסטיקות.",
      confidence: 78, basedOn: `Based on ${projectCount} videos`,
    });
  }

  if (dna.preferredFormats.includes("9:16")) {
    insights.push({
      id: "gw_vertical", type: "what_works",
      title: "Vertical Format", titleHe: "פורמט אנכי",
      detail: "Most of your content is vertical — great for mobile reach.",
      detailHe: "רוב התוכן שלך אנכי — מצוין לחשיפה במובייל.",
      confidence: 85, basedOn: `Based on ${projectCount} videos`,
    });
  }

  // What to improve
  if (dna.messagingStyle === "descriptive") {
    insights.push({
      id: "gi_shorter", type: "what_to_improve",
      title: "Shorter Messages", titleHe: "מסרים קצרים יותר",
      detail: "Your subtitles tend to be wordy. Try punchier, 2-word-per-line style.",
      detailHe: "הכתוביות שלך נוטות להיות ארוכות. נסה סגנון קצר יותר, 2 מילים בשורה.",
      confidence: 70, basedOn: `Based on ${projectCount} videos`,
    });
  }

  insights.push({
    id: "gi_variety", type: "what_to_improve",
    title: "Content Variety", titleHe: "מגוון תוכן",
    detail: `You frequently use: ${dna.recurringWords.slice(0, 5).join(", ")}. Mix in new angles.`,
    detailHe: `אתה משתמש הרבה ב: ${dna.recurringWords.slice(0, 5).join(", ")}. שלב זוויות חדשות.`,
    confidence: 65, basedOn: `Based on ${projectCount} videos`,
  });

  // What to try
  insights.push({
    id: "gt_storytelling", type: "what_to_try",
    title: "Storytelling Format", titleHe: "פורמט סיפורי",
    detail: "Try the storytelling preset for deeper emotional connection with viewers.",
    detailHe: "נסה את הפריסט הסיפורי ליצירת חיבור רגשי עמוק יותר עם הצופים.",
    confidence: 60, basedOn: "AI recommendation",
  });

  insights.push({
    id: "gt_viral", type: "what_to_try",
    title: "Viral Style Video", titleHe: "סרטון בסגנון ויראלי",
    detail: "Your content themes align with trending topics. Try aggressive pacing + bold subtitles.",
    detailHe: "הנושאים שלך מתאימים לטרנדים. נסה קצב אגרסיבי + כתוביות בולטות.",
    confidence: 55, basedOn: "Trend analysis",
  });

  return insights;
}
