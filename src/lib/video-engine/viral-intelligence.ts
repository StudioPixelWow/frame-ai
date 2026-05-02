/**
 * PixelManageAI — Viral Intelligence Engine
 * Trending topics analysis, niche viral patterns, idea generation.
 */

import type { ViralTrend, ViralVideoIdea, ScriptStructure, SmartPresetId } from "./types";

const INDUSTRY_TRENDS: Record<string, ViralTrend[]> = {
  marketing: [
    { id: "vt1", topic: "AI Tools for Small Business", topicHe: "כלי AI לעסקים קטנים", industry: "marketing", trendScore: 92, whyViral: "Mass adoption anxiety — everyone wants to stay competitive", whyViralHe: "חרדת אימוץ — כולם רוצים להישאר תחרותיים" },
    { id: "vt2", topic: "UGC Content Strategy", topicHe: "אסטרטגיית תוכן UGC", industry: "marketing", trendScore: 87, whyViral: "Brands shifting budgets from polished to authentic", whyViralHe: "מותגים מעבירים תקציבים מתוכן מלוטש לאותנטי" },
    { id: "vt3", topic: "Short-Form Video ROI", topicHe: "ROI של סרטונים קצרים", industry: "marketing", trendScore: 85, whyViral: "Businesses need proof of value before investing in video", whyViralHe: "עסקים צריכים הוכחת ערך לפני השקעה בוידאו" },
  ],
  ecommerce: [
    { id: "vt4", topic: "Product Demo Hacks", topicHe: "טריקים לדמו מוצרים", industry: "ecommerce", trendScore: 88, whyViral: "Visual demos outperform static images 3x on social", whyViralHe: "דמו ויזואלי מניב פי 3 מתמונות סטטיות" },
    { id: "vt5", topic: "Behind the Scenes", topicHe: "מאחורי הקלעים", industry: "ecommerce", trendScore: 83, whyViral: "Authenticity drives trust and conversion", whyViralHe: "אותנטיות בונה אמון וממירה" },
  ],
  fitness: [
    { id: "vt6", topic: "5-Minute Morning Routines", topicHe: "שגרת בוקר ב-5 דקות", industry: "fitness", trendScore: 90, whyViral: "Time-efficient content addresses busy lifestyle pain point", whyViralHe: "תוכן חוסך זמן פותר כאב של אורח חיים עמוס" },
    { id: "vt7", topic: "Myth-Busting Fitness Tips", topicHe: "שבירת מיתוסים בכושר", industry: "fitness", trendScore: 86, whyViral: "Controversy + education = high engagement", whyViralHe: "מחלוקת + חינוך = מעורבות גבוהה" },
  ],
  realestate: [
    { id: "vt8", topic: "Property Tours with Storytelling", topicHe: "סיורי נכסים עם סיפור", industry: "realestate", trendScore: 84, whyViral: "Emotional connection to spaces increases inquiries", whyViralHe: "חיבור רגשי למרחב מגביר פניות" },
    { id: "vt9", topic: "Market Update in 30 Seconds", topicHe: "עדכון שוק ב-30 שניות", industry: "realestate", trendScore: 81, whyViral: "Quick authority positioning drives followers", whyViralHe: "מיצוב סמכות מהיר מושך עוקבים" },
  ],
  food: [
    { id: "vt10", topic: "Recipe in 60 Seconds", topicHe: "מתכון ב-60 שניות", industry: "food", trendScore: 91, whyViral: "Satisfying visual format with instant gratification", whyViralHe: "פורמט ויזואלי מספק עם סיפוק מיידי" },
  ],
  tech: [
    { id: "vt11", topic: "Tool Comparisons", topicHe: "השוואות כלים", industry: "tech", trendScore: 86, whyViral: "Decision fatigue — people crave curated recommendations", whyViralHe: "עייפות החלטות — אנשים מחפשים המלצות" },
  ],
  general: [
    { id: "vt12", topic: "Before/After Transformations", topicHe: "לפני/אחרי טרנספורמציות", industry: "general", trendScore: 93, whyViral: "Visual proof of value is universally compelling", whyViralHe: "הוכחה ויזואלית של ערך משכנעת תמיד" },
    { id: "vt13", topic: "3 Tips Format", topicHe: "פורמט 3 טיפים", industry: "general", trendScore: 88, whyViral: "Numbered lists set clear expectations and encourage saves", whyViralHe: "רשימות ממוספרות יוצרות ציפיות ברורות ומעודדות שמירה" },
  ],
};

export function getTrendingTopics(industry: string): ViralTrend[] {
  const specific = INDUSTRY_TRENDS[industry] || [];
  const general = INDUSTRY_TRENDS["general"] || [];
  return [...specific, ...general].sort((a, b) => b.trendScore - a.trendScore);
}

export function generateViralIdeas(params: {
  industry: string;
  clientTone: string[];
  language: string;
}): ViralVideoIdea[] {
  const { industry, language } = params;
  const isHe = language === "he" || language === "auto";
  const trends = getTrendingTopics(industry);

  return trends.slice(0, 8).map((trend, i): ViralVideoIdea => {
    const presets: SmartPresetId[] = ["viral", "sales", "bold", "storytelling", "authority"];
    const preset = presets[i % presets.length];

    const structures: ScriptStructure[] = [
      { hook: isHe ? "שאלה פותחת מושכת" : "Compelling opening question", problem: isHe ? "הצגת הכאב" : "Present the pain", solution: isHe ? "הפתרון שלך" : "Your solution", cta: isHe ? "קריאה לפעולה" : "Call to action" },
      { hook: isHe ? "סטטיסטיקה מפתיעה" : "Surprising statistic", problem: isHe ? "למה זה חשוב" : "Why it matters", solution: isHe ? "מה לעשות" : "What to do", cta: isHe ? "לינק בביו" : "Link in bio" },
      { hook: isHe ? "טענה נועזת" : "Bold claim", problem: isHe ? "ההוכחה" : "The proof", solution: isHe ? "השיטה" : "The method", cta: isHe ? "עקוב לעוד" : "Follow for more" },
    ];

    return {
      id: `vi_${i}`,
      title: trend.topic,
      titleHe: trend.topicHe,
      hook: isHe ? `${trend.topicHe} — הנה למה כולם מדברים על זה` : `${trend.topic} — here's why everyone is talking about it`,
      hookHe: `${trend.topicHe} — הנה למה כולם מדברים על זה`,
      structure: structures[i % structures.length],
      estimatedViralScore: trend.trendScore - 5 + Math.round(Math.random() * 10),
      suggestedPreset: preset,
    };
  });
}
