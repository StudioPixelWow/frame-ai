/**
 * POST /api/clients/[id]/generate-gantt - Generate monthly gantt content with REAL CREATIVE DIVERSITY
 * Enforces rotation through 10 content types, 6 hook styles, and 6 graphic text styles
 * Each item is guaranteed to be unique and varied
 */

import { NextRequest, NextResponse } from 'next/server';
import { clients, clientGanttItems } from '@/lib/db';
import { creativeDNA as creativeDNAStore, clientResearch } from '@/lib/db/collections';
import { ensureSeeded } from '@/lib/db/seed';
import { getRelevantHolidays, getHolidaysForMonth } from '@/lib/israeli-holidays';
import { generateWithAI, getClientKnowledgeContext } from '@/lib/ai/openai-client';
import type { ClientGanttItem, GanttItemType, ContentFormat, ClientResearch } from '@/lib/db';

interface GenerateGanttRequest {
  month: number; // 1-12
  year: number;
  weeklyPosts: number; // e.g. 3
  platforms: string[]; // ["facebook", "instagram"]
  formats: string[]; // ["image", "video", "reel"]
  campaigns?: string; // e.g. "קמפיין אביב, השקת מוצר חדש"
  customPrompt?: string; // e.g. "דגש על מכירות החודש"
  themes?: string; // e.g. "טכנולוגיה, חדשנות"
  ganttVersion?: number; // 1, 2, 3... for regeneration tracking
  isRegeneration?: boolean; // true = user clicked "צור גאנט חדש"
  // Selective regeneration: protect approved/in-work items
  protectedItemIds?: string[]; // IDs of items to keep (approved, in_progress, sent-to-task, etc.)
  deleteItemIds?: string[]; // IDs of unprotected items to remove before regenerating
  protectedDates?: string[]; // dates occupied by protected items — avoid scheduling on them
  excludeTitles?: string[]; // titles of protected + previously discarded items for anti-repeat
}

// CONTENT TYPE ROTATION - 10 mandatory types
const CONTENT_TYPES = [
  'pain_driven',      // Addresses audience pain points
  'authority',        // Establishes expertise
  'storytelling',     // Narrative-driven
  'offer_sales',      // Direct promotion
  'educational',      // Teaching value
  'social_proof',     // Testimonials, results
  'rtm_holiday',      // Real-time marketing, holidays
  'controversial',    // Bold opinion, debate
  'behind_scenes',    // BTS, process, team
  'comparison',       // Before/after, vs
] as const;

// HOOK STYLE ROTATION - 6 types
const HOOK_STYLES = [
  'question',      // "מה יקרה אם...?"
  'bold_statement', // "רוב העסקים עושים את זה לא נכון."
  'emotional',     // "הרגע שהבנתי שהכל השתנה..."
  'statistic',     // "73% מהלקוחות שלנו..."
  'contradiction', // "כולם אומרים X. אבל האמת היא Y."
  'story_opener',  // "לפני שנה קרה משהו שהפך הכל..."
] as const;

// GRAPHIC TEXT STYLE ROTATION - 6 types
const GRAPHIC_TEXT_STYLES = [
  'short_punch',   // 2-3 words max punch
  'question',      // Provocative question
  'bold_claim',    // Bold statement
  'emotional',     // Emotional sentence
  'statistic',     // Number/stat driven
  'contradiction', // Surprising contrast
] as const;

interface GeneratedItem {
  contentType: typeof CONTENT_TYPES[number];
  hookStyle: typeof HOOK_STYLES[number];
  graphicTextStyle: typeof GRAPHIC_TEXT_STYLES[number];
  title: string;
  hook: string;
  mainMessage: string;
  ideaSummary: string;
  graphicText: string;
  caption: string;
  cta: string;
  visualConcept: string;
  dayOfMonth: number;
  platform: string;
  format: string;
  researchSource?: 'weakness' | 'opportunity' | 'competitor' | 'audience' | 'campaign_concept' | 'content_angle' | 'action_plan' | 'manual_note';
  researchReason?: string;
}

// ============================================================
// RESEARCH INSIGHT EXTRACTION — builds structured brief for AI
// ============================================================
interface ResearchInsight {
  type: 'weakness' | 'opportunity' | 'competitor' | 'audience' | 'campaign_concept' | 'content_angle' | 'action_plan' | 'manual_note';
  label: string;   // Hebrew label for the type
  insight: string;  // The actual insight text
  priority: number; // 1=highest
}

function extractResearchInsights(r: ClientResearch): ResearchInsight[] {
  const insights: ResearchInsight[] = [];

  // 1. Weaknesses → corrective content (highest priority)
  if (r.weaknesses?.length > 0) {
    r.weaknesses.forEach((w, i) => {
      insights.push({
        type: 'weakness',
        label: 'חולשה',
        insight: `[${w.severity}] ${w.area}: ${w.description}. המלצה: ${w.recommendation}`,
        priority: w.severity === 'critical' ? 1 : w.severity === 'high' ? 2 : 3,
      });
    });
  }

  // 2. Opportunities → proactive content
  if (r.opportunities?.length > 0) {
    r.opportunities.forEach((o) => {
      insights.push({
        type: 'opportunity',
        label: 'הזדמנות',
        insight: `[${o.potentialImpact}] ${o.title}: ${o.description} (${o.category})`,
        priority: o.potentialImpact === 'high' ? 1 : o.potentialImpact === 'medium' ? 2 : 3,
      });
    });
  }

  // 3. Recommended content angles → direct ideas
  if (r.recommendedContentAngles?.length > 0) {
    r.recommendedContentAngles.forEach((angle) => {
      insights.push({
        type: 'content_angle',
        label: 'זווית תוכן מומלצת',
        insight: angle,
        priority: 2,
      });
    });
  }

  // 4. Campaign concepts → grouped themes
  if (r.recommendedCampaignConcepts?.length > 0) {
    r.recommendedCampaignConcepts.forEach((c) => {
      insights.push({
        type: 'campaign_concept',
        label: 'קונספט קמפיין',
        insight: `${c.name}: ${c.goal} (${c.platforms?.join(', ') || 'כל הפלטפורמות'}) [${c.format}]`,
        priority: 1,
      });
    });
  }

  // 5. Action plan items → execution
  if (r.actionPlan?.thingsToDo?.length > 0) {
    r.actionPlan.thingsToDo.forEach((t) => {
      insights.push({
        type: 'action_plan',
        label: 'תוכנית פעולה',
        insight: `[${t.priority}] ${t.action}`,
        priority: t.priority === 'urgent' ? 1 : t.priority === 'high' ? 2 : 3,
      });
    });
  }

  // 6. Competitor insights → differentiation posts
  if (r.competitors?.length > 0) {
    r.competitors.forEach((c) => {
      if (c.weakness) {
        insights.push({
          type: 'competitor',
          label: 'פער מול מתחרה',
          insight: `מתחרה ${c.name}: חולשה — ${c.weakness}. מה שעובד להם: ${c.whatWorks?.join(', ') || 'לא ידוע'}`,
          priority: 2,
        });
      }
    });
  }
  if (r.competitorSummary?.doMoreOf?.length > 0) {
    insights.push({
      type: 'competitor',
      label: 'בידול מול מתחרים',
      insight: `לעשות יותר: ${r.competitorSummary.doMoreOf.join(', ')}`,
      priority: 2,
    });
  }

  // 7. Audience pain points → targeted content
  if (r.audience?.painPoints?.length > 0) {
    r.audience.painPoints.forEach((pp) => {
      insights.push({
        type: 'audience',
        label: 'כאב קהל יעד',
        insight: pp,
        priority: 2,
      });
    });
  }

  // 8. Manual strategic notes → highest priority override
  if (r.strategicNotes?.trim()) {
    // Split notes into separate insights if they contain line breaks
    const noteLines = r.strategicNotes.split('\n').filter(l => l.trim().length > 5);
    if (noteLines.length > 1) {
      noteLines.forEach((note) => {
        insights.push({
          type: 'manual_note',
          label: 'הערה אסטרטגית',
          insight: note.trim(),
          priority: 1,
        });
      });
    } else {
      insights.push({
        type: 'manual_note',
        label: 'הערה אסטרטגית',
        insight: r.strategicNotes.trim(),
        priority: 1,
      });
    }
  }

  // Sort by priority (1 first)
  insights.sort((a, b) => a.priority - b.priority);
  return insights;
}

// Build per-item research assignments: map N items to research insights
// Uses month-based offset so different months get different insight rotation
function buildResearchAssignments(insights: ResearchInsight[], totalItems: number, monthOffset: number = 0): { assignedInsight: ResearchInsight; slotIndex: number }[] {
  const assignments: { assignedInsight: ResearchInsight; slotIndex: number }[] = [];

  if (insights.length === 0) return assignments;

  // Month-based offset: shift the starting insight so Jan ≠ Feb ≠ Mar
  const startIndex = (monthOffset * 3) % insights.length;

  for (let i = 0; i < totalItems; i++) {
    const insight = insights[(startIndex + i) % insights.length];
    assignments.push({ assignedInsight: insight, slotIndex: i });
  }

  return assignments;
}

// ============================================================
// PREVIOUS GANTT ANALYSIS — anti-repetition engine
// ============================================================
interface PreviousGanttFingerprint {
  month: number;
  year: number;
  itemCount: number;
  titles: string[];
  hooks: string[];
  contentTypes: string[];
  graphicTexts: string[];
  ctaPatterns: string[];
  visualConcepts: string[];
  researchSources: string[];
}

function loadPreviousGantts(clientId: string, currentMonth: number, currentYear: number): PreviousGanttFingerprint[] {
  try {
    const allItems = clientGanttItems.getAll();
    const clientItems = allItems.filter((item: ClientGanttItem) =>
      item.clientId === clientId &&
      item.ganttType === 'monthly' &&
      !(item.month === currentMonth && item.year === currentYear) // Exclude current month
    );

    // Group by month/year
    const byMonth = new Map<string, ClientGanttItem[]>();
    clientItems.forEach((item: ClientGanttItem) => {
      const key = `${item.year}-${item.month}`;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(item);
    });

    // Build fingerprints, sorted by recency (newest first)
    const fingerprints: PreviousGanttFingerprint[] = [];
    for (const [key, items] of byMonth) {
      const [year, month] = key.split('-').map(Number);
      fingerprints.push({
        month,
        year,
        itemCount: items.length,
        titles: items.map(i => i.title).filter(Boolean),
        hooks: items.map(i => (i.keyOpportunities || '').split('\n')[0]?.replace('Hook: ', '') || '').filter(Boolean),
        contentTypes: items.map(i => i.monthTheme || '').filter(Boolean),
        graphicTexts: items.map(i => i.graphicText).filter(Boolean),
        ctaPatterns: items.map(i => (i.keyOpportunities || '').split('\n')[1]?.replace('CTA: ', '') || '').filter(Boolean),
        visualConcepts: items.map(i => i.visualConcept).filter(Boolean),
        researchSources: items.map(i => i.researchSource || '').filter(Boolean),
      });
    }

    // Sort newest first
    fingerprints.sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));

    // Only keep last 3 months for comparison
    return fingerprints.slice(0, 3);
  } catch (err) {
    console.warn('[Gantt] Failed to load previous gantts for anti-repetition:', err);
    return [];
  }
}

// Build anti-repetition brief for AI prompt
function buildAntiRepetitionBrief(fingerprints: PreviousGanttFingerprint[]): string {
  if (fingerprints.length === 0) return '';

  const HEBREW_MONTHS = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  const lines: string[] = [];
  lines.push(`\n\n🚫🚫🚫 תוכן שכבר פורסם בחודשים קודמים — אסור לחזור עליו 🚫🚫🚫`);

  for (const fp of fingerprints) {
    lines.push(`\nחודש ${HEBREW_MONTHS[fp.month] || fp.month}/${fp.year} (${fp.itemCount} פריטים):`);

    if (fp.titles.length > 0) {
      lines.push(`  כותרות שכבר עלו: ${fp.titles.slice(0, 6).join(' | ')}`);
    }
    if (fp.hooks.length > 0) {
      lines.push(`  hooks שכבר נוצלו: ${fp.hooks.slice(0, 6).join(' | ')}`);
    }
    if (fp.contentTypes.length > 0) {
      const typeCounts = new Map<string, number>();
      fp.contentTypes.forEach(ct => typeCounts.set(ct, (typeCounts.get(ct) || 0) + 1));
      const overused = [...typeCounts.entries()].filter(([, c]) => c >= 3).map(([t]) => t);
      if (overused.length > 0) {
        lines.push(`  סוגי תוכן שנוצלו יתר על המידה (הפחת משמעותית): ${overused.join(', ')}`);
      }
    }
    if (fp.graphicTexts.length > 0) {
      lines.push(`  טקסטים גרפיים שכבר עלו: ${fp.graphicTexts.slice(0, 4).join(' | ')}`);
    }
  }

  lines.push(`\n🔴 חובה: כל פריט חייב להיות שונה מהחודשים הקודמים. אסור לחזור על אותו hook, כותרת, graphicText, או CTA. שנה זווית, טון, סגנון.`);
  return lines.join('\n');
}

// Novelty scoring — compare new items against previous gantts
function scoreNovelty(newItems: GeneratedItem[], fingerprints: PreviousGanttFingerprint[]): { score: number; repeatedItems: number; details: string[] } {
  if (fingerprints.length === 0) return { score: 100, repeatedItems: 0, details: ['אין חודשים קודמים להשוואה'] };

  const details: string[] = [];
  let repeatedItems = 0;

  // Collect all previous content into flat sets for comparison
  const prevTitles = new Set(fingerprints.flatMap(f => f.titles.map(t => t.toLowerCase().trim())));
  const prevHooks = new Set(fingerprints.flatMap(f => f.hooks.map(h => h.toLowerCase().trim())));
  const prevGraphicTexts = new Set(fingerprints.flatMap(f => f.graphicTexts.map(g => g.toLowerCase().trim())));
  const prevCTAs = new Set(fingerprints.flatMap(f => f.ctaPatterns.map(c => c.toLowerCase().trim())));

  newItems.forEach((item, idx) => {
    let itemRepeatScore = 0;

    // Title similarity (exact or strong overlap)
    const titleLower = item.title.toLowerCase().trim();
    if (prevTitles.has(titleLower)) {
      itemRepeatScore += 3;
      details.push(`Item ${idx}: כותרת זהה לחודש קודם: "${item.title}"`);
    } else {
      // Check word overlap (>60% shared words = too similar)
      const titleWords = new Set(titleLower.split(/\s+/).filter(w => w.length > 2));
      for (const prev of prevTitles) {
        const prevWords = new Set(prev.split(/\s+/).filter(w => w.length > 2));
        const shared = [...titleWords].filter(w => prevWords.has(w)).length;
        if (titleWords.size > 0 && shared / titleWords.size > 0.6) {
          itemRepeatScore += 1;
          details.push(`Item ${idx}: כותרת דומה מאוד לחודש קודם`);
          break;
        }
      }
    }

    // Hook similarity
    const hookLower = item.hook.toLowerCase().trim();
    if (prevHooks.has(hookLower)) {
      itemRepeatScore += 2;
      details.push(`Item ${idx}: hook זהה לחודש קודם`);
    }

    // Graphic text similarity
    const gtLower = item.graphicText.toLowerCase().trim();
    if (prevGraphicTexts.has(gtLower)) {
      itemRepeatScore += 2;
      details.push(`Item ${idx}: graphicText זהה לחודש קודם`);
    }

    // CTA similarity
    const ctaLower = item.cta.toLowerCase().trim();
    if (prevCTAs.has(ctaLower)) {
      itemRepeatScore += 1;
      details.push(`Item ${idx}: CTA זהה לחודש קודם`);
    }

    if (itemRepeatScore >= 2) repeatedItems++;
  });

  // Score: 100 = fully novel, 0 = all repeated
  const maxPenalty = newItems.length * 8; // max repeat score per item = 8
  const totalPenalty = details.length * 2; // rough penalty
  const score = Math.max(0, Math.round(100 - (totalPenalty / maxPenalty) * 100));

  return { score, repeatedItems, details };
}

// ============================================================
// MONTH-AWARE CONTENT PILLAR ROTATION
// ============================================================
const CONTENT_PILLARS = [
  'trust_building',        // אמון ושקיפות
  'authority_expertise',   // סמכות ומומחיות
  'differentiation',       // בידול מול מתחרים
  'offer_promotion',       // הצעות ומכירות
  'educational_value',     // ערך לימודי
  'emotional_storytelling',// סיפור רגשי
  'objection_handling',    // מענה להתנגדויות
  'social_proof',          // הוכחה חברתית
  'rtm_seasonal',          // שיווק בזמן אמת / עונתי
  'competitor_gap',        // ניצול פער מול מתחרים
  'community_engagement',  // מעורבות קהילתית
  'behind_scenes',         // מאחורי הקלעים
] as const;

// Each month gets a different emphasis rotation of pillars
function getMonthlyPillarEmphasis(month: number): { primary: string[]; secondary: string[] } {
  // Shift pillars based on month so each month has different focus
  const shift = ((month - 1) * 3) % CONTENT_PILLARS.length;
  const rotated = [...CONTENT_PILLARS.slice(shift), ...CONTENT_PILLARS.slice(0, shift)];

  return {
    primary: rotated.slice(0, 4),    // Top 4 pillars for this month
    secondary: rotated.slice(4, 8),  // Supporting pillars
  };
}

// Hebrew month seasonality context
function getMonthSeasonality(month: number): string {
  const seasonality: Record<number, string> = {
    1: 'תחילת שנה אזרחית, החלטות ויעדים חדשים, חורף, ימים קצרים, אווירת התחדשות',
    2: 'אמצע חורף, ולנטיינז, תחילת תכנון אביבי, אווירת אינטימיות',
    3: 'פורים, תחילת אביב, ניקיון פסח, התעוררות, אווירת שמחה ושינוי',
    4: 'פסח, חופשת אביב, חירות, משפחתיות, אווירת חגיגה וחופש',
    5: 'יום הזיכרון, יום העצמאות, ל"ג בעומר, אווירת גאווה לאומית',
    6: 'שבועות, תחילת קיץ, סוף שנת לימודים, אווירת חופש וחגיגה',
    7: 'קיץ מלא, חופש גדול, בילויים, נופש, אווירת קלילות ואנרגיה',
    8: 'סוף קיץ, חזרה לשגרה, הכנות לספטמבר, אווירת מעבר',
    9: 'ראש השנה, יום כיפור, סוכות, תחילת שנה יהודית, אווירת התחדשות רוחנית',
    10: 'שמחת תורה, סתיו, חזרה לשגרה, תחילת רבעון אחרון',
    11: 'סתיו מלא, גשמים, Black Friday, אווירת ביתיות ומכירות',
    12: 'חנוכה, סוף שנה, סיכומים, מתנות, אווירת חום וחגיגיות',
  };
  return seasonality[month] || '';
}

interface CreativeDNA {
  clientId: string;
  toneOfVoice?: string;
  sellingStyle?: string;
  visualStyle?: string;
  hookTypes?: string[];
  doNotUsePatterns?: string[];
  colorPalette?: string[];
}

// Helper: days in month
function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

// Helper: generate deterministic variations based on input
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Helper: pick random item from array using seed
function seedPick<T>(arr: T[], seed: number): T {
  const index = Math.floor(seededRandom(seed) * arr.length);
  return arr[index];
}

// Helper: rotate through array index
function rotateIndex(currentIndex: number, arrayLength: number): number {
  return currentIndex % arrayLength;
}

// Helper: get cycling content type
function getContentType(index: number): typeof CONTENT_TYPES[number] {
  return CONTENT_TYPES[rotateIndex(index, CONTENT_TYPES.length)];
}

// Helper: get cycling hook style
function getHookStyle(index: number): typeof HOOK_STYLES[number] {
  return HOOK_STYLES[rotateIndex(index, HOOK_STYLES.length)];
}

// Helper: get cycling graphic text style
function getGraphicTextStyle(index: number): typeof GRAPHIC_TEXT_STYLES[number] {
  return GRAPHIC_TEXT_STYLES[rotateIndex(index, GRAPHIC_TEXT_STYLES.length)];
}

// BANNED WEAK PHRASES — generic filler that indicates low-quality output
const BANNED_WEAK_PHRASES = [
  'קרא עוד',
  'גלה עוד',
  'לחץ כאן',
  'למידע נוסף',
  'בואו',
  'תוכן חדש',
  'עדכון חשוב',
  'חדשות',
  'הנה הסוד',
  'לא תאמינו',
  'שתפו',
  'תייגו',
  'רוצים לדעת',
  'מה דעתכם',
  'קונטנט',
  'עדכון',
];

// Helper: check if text contains English words (more than 2 consecutive ASCII letters)
function containsEnglish(text: string): boolean {
  // Allow platform names (facebook, instagram, tiktok) and format names, but block real English sentences
  const allowedEnglish = ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'reel', 'carousel', 'story', 'live', 'x', 'cta', 'hook', 'roi', 'kpi', 'seo', 'b2b', 'b2c', 'diy', '3d'];
  const cleaned = text.toLowerCase();
  // Find English word sequences (3+ letter words not in allowed list)
  const englishWords = cleaned.match(/[a-z]{3,}/g) || [];
  const realEnglish = englishWords.filter(w => !allowedEnglish.includes(w));
  return realEnglish.length >= 3; // 3+ non-allowed English words = rejected
}

// Helper: check if graphic text is weak/generic
function isWeakGraphicText(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (lower.length < 5) return true;
  for (const phrase of BANNED_WEAK_PHRASES) {
    if (lower === phrase || lower.startsWith(phrase + '\n') || lower.endsWith('\n' + phrase)) return true;
  }
  return false;
}

// Helper: validate a single item for Hebrew quality
function validateItemQuality(item: GeneratedItem, index: number): string[] {
  const issues: string[] = [];

  // Hebrew-only enforcement
  if (containsEnglish(item.title)) issues.push(`Item ${index}: title contains English`);
  if (containsEnglish(item.hook)) issues.push(`Item ${index}: hook contains English`);
  if (containsEnglish(item.graphicText)) issues.push(`Item ${index}: graphicText contains English`);
  if (containsEnglish(item.caption)) issues.push(`Item ${index}: caption contains English`);
  if (containsEnglish(item.cta)) issues.push(`Item ${index}: CTA contains English`);

  // Graphic text must be REAL ad copy, not filler
  if (isWeakGraphicText(item.graphicText)) {
    issues.push(`Item ${index}: graphicText is weak/generic — must be sharp ad copy`);
  }
  // Graphic text must have real substance (at least 8 chars per line)
  const graphicLines = item.graphicText.split('\n').filter(l => l.trim().length > 0);
  if (graphicLines.length < 1 || graphicLines.some(l => l.trim().length < 4)) {
    issues.push(`Item ${index}: graphicText lines too short — must be real ad copy`);
  }

  // Caption must be at least 50 chars (real social caption, not placeholder)
  if (item.caption.length < 50) {
    issues.push(`Item ${index}: caption too short (${item.caption.length} chars) — must be a full social caption`);
  }

  // Visual concept must be production-ready (60+ chars with actual design details)
  if (!item.visualConcept || item.visualConcept.length < 60) {
    issues.push(`Item ${index}: visualConcept too short (${item.visualConcept?.length || 0} chars) — must include composition, colors, objects, style, camera angle`);
  }

  // Hook must be compelling (not just "נושא חדש" or similar filler)
  if (item.hook.length < 10) {
    issues.push(`Item ${index}: hook too short — must be a real attention-grabbing opener`);
  }

  // CTA must be actionable and specific (not just "שתפו!")
  if (item.cta.length < 5) {
    issues.push(`Item ${index}: CTA too short — must be a specific call-to-action`);
  }

  return issues;
}

// Helper: check diversity of generated items
function checkDiversity(items: GeneratedItem[]): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check consecutive items don't have same content type
  for (let i = 1; i < items.length; i++) {
    if (items[i].contentType === items[i - 1].contentType) {
      issues.push(`Items ${i} and ${i - 1} have same contentType: ${items[i].contentType}`);
    }
  }

  // Check no identical hook openings (first 5 words)
  const hookOpenings = new Map<string, number>();
  items.forEach((item, idx) => {
    const opening = item.hook.split(' ').slice(0, 5).join(' ');
    if (hookOpenings.has(opening)) {
      issues.push(`Items ${idx} and ${hookOpenings.get(opening)} have similar hook openings`);
    } else {
      hookOpenings.set(opening, idx);
    }
  });

  // Check no identical CTAs
  const ctas = new Map<string, number>();
  items.forEach((item, idx) => {
    if (ctas.has(item.cta)) {
      issues.push(`Items ${idx} and ${ctas.get(item.cta)} have identical CTAs`);
    } else {
      ctas.set(item.cta, idx);
    }
  });

  // Check no identical graphic text
  const graphicTexts = new Map<string, number>();
  items.forEach((item, idx) => {
    if (graphicTexts.has(item.graphicText)) {
      issues.push(`Items ${idx} and ${graphicTexts.get(item.graphicText)} have identical graphicText`);
    } else {
      graphicTexts.set(item.graphicText, idx);
    }
  });

  // Quality validation for each item
  items.forEach((item, idx) => {
    const qualityIssues = validateItemQuality(item, idx);
    issues.push(...qualityIssues);
  });

  return {
    passed: issues.length === 0,
    issues,
  };
}

// Coherence validation — check that all fields within an item are derived from the same concept (title)
function validateItemCoherence(items: GeneratedItem[]): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  items.forEach((item, idx) => {
    if (!item.title || item.title.length < 5) return; // Skip items with no real title

    // Extract key words from title (words with 3+ chars)
    const titleWords = new Set(
      item.title.toLowerCase().split(/\s+/).filter(w => w.length >= 3)
    );
    if (titleWords.size === 0) return;

    // Check ideaSummary shares concept with title
    if (item.ideaSummary) {
      const ideaWords = new Set(item.ideaSummary.toLowerCase().split(/\s+/).filter(w => w.length >= 3));
      const sharedWithIdea = [...titleWords].filter(w => ideaWords.has(w)).length;
      if (titleWords.size > 2 && sharedWithIdea === 0) {
        issues.push(`Item ${idx}: ideaSummary has ZERO word overlap with title — likely disconnected concept`);
      }
    }

    // Check graphicText relates to title
    if (item.graphicText) {
      const gtWords = new Set(item.graphicText.toLowerCase().split(/\s+/).filter(w => w.length >= 3));
      const sharedWithGT = [...titleWords].filter(w => gtWords.has(w)).length;
      // graphicText is short, so even 1 shared word is ok — but 0 shared with a long title is suspicious
      if (titleWords.size > 3 && sharedWithGT === 0 && gtWords.size > 3) {
        issues.push(`Item ${idx}: graphicText appears disconnected from title concept`);
      }
    }

    // Check caption relates to title concept
    if (item.caption) {
      const captionWords = new Set(item.caption.toLowerCase().split(/\s+/).filter(w => w.length >= 3));
      const sharedWithCaption = [...titleWords].filter(w => captionWords.has(w)).length;
      if (titleWords.size > 2 && captionWords.size > 5 && sharedWithCaption === 0) {
        issues.push(`Item ${idx}: caption has ZERO word overlap with title — likely disconnected`);
      }
    }

    // Check visualConcept relates to the same concept
    if (item.visualConcept) {
      const vcWords = new Set(item.visualConcept.toLowerCase().split(/\s+/).filter(w => w.length >= 3));
      const sharedWithVC = [...titleWords].filter(w => vcWords.has(w)).length;
      if (titleWords.size > 2 && vcWords.size > 5 && sharedWithVC === 0) {
        issues.push(`Item ${idx}: visualConcept has ZERO word overlap with title — likely disconnected`);
      }
    }
  });

  return { passed: issues.length === 0, issues };
}

// ============================================================
// EXECUTION IDEAS — turn research into concrete content assignments
// ============================================================
interface ExecutionIdea {
  id: number;
  source: ResearchInsight['type'];
  sourceLabel: string;
  directive: string; // What content to create
  reference: string; // Original research text
}

function buildExecutionIdeas(insights: ResearchInsight[]): ExecutionIdea[] {
  const ideas: ExecutionIdea[] = [];
  let idCounter = 1;

  const transformations: Record<string, (insight: string) => string> = {
    weakness: (i) => `צור תוכן שמתקן את החולשה הזו: ${i}`,
    opportunity: (i) => `צור תוכן שמנצל את ההזדמנות: ${i}`,
    campaign_concept: (i) => `הפעל את קונספט הקמפיין הזה: ${i}`,
    content_angle: (i) => `צור פוסט מזווית התוכן: ${i}`,
    action_plan: (i) => `בצע את הפעולה דרך תוכן: ${i}`,
    competitor: (i) => `צור תוכן שמבדל מהמתחרים: ${i}`,
    audience: (i) => `צור תוכן שנוגע בכאב הקהל: ${i}`,
    manual_note: (i) => `בצע את ההנחיה האסטרטגית: ${i}`,
  };

  insights.forEach((insight) => {
    const transform = transformations[insight.type] || ((i: string) => `צור תוכן מבוסס: ${i}`);
    ideas.push({
      id: idCounter++,
      source: insight.type,
      sourceLabel: insight.label,
      directive: transform(insight.insight),
      reference: insight.insight,
    });
  });

  return ideas;
}

// Build execution brief — numbered list of EXACT content directives
function buildExecutionBrief(ideas: ExecutionIdea[], totalItems: number, monthOffset: number): string {
  if (ideas.length === 0) return '';

  const lines: string[] = [];
  lines.push(`\n\n🔴🔴🔴 רשימת ביצוע — כל פריט גאנט חייב לבצע אחת מההנחיות הבאות 🔴🔴🔴`);
  lines.push(`זוהי רשימה סגורה. אסור להמציא רעיונות שלא מופיעים כאן.\n`);

  // Assign ideas to slots with month-based rotation
  const startIndex = (monthOffset * 3) % ideas.length;
  for (let i = 0; i < totalItems; i++) {
    const idea = ideas[(startIndex + i) % ideas.length];
    lines.push(`פריט ${i + 1}: [${idea.sourceLabel}] ${idea.directive}`);
    lines.push(`  מקור: "${idea.reference}"`);
    lines.push(`  researchSource: "${idea.source}"`);
  }

  lines.push(`\n🔴 כל פריט חייב לבצע בדיוק את ההנחיה שלעיל. אסור לסטות. אסור להמציא. אסור גנרי.`);
  return lines.join('\n');
}

// Generic content detector — flag items that feel like filler, not research execution
function detectGenericContent(items: GeneratedItem[], hasResearch: boolean): { genericCount: number; issues: string[] } {
  if (!hasResearch) return { genericCount: 0, issues: [] };

  const issues: string[] = [];
  let genericCount = 0;

  // Common generic patterns that indicate AI ignored the research
  const GENERIC_PATTERNS = [
    /^טיפ(ים)?(\s|$)/,        // "טיפ..." generic tips
    /^(הנה|הינה)\s/,          // "הנה..."
    /^(גלו|גלה|גלי)\s/,      // "גלו..." generic discover
    /^(למד|למדו)\s.*טיפ/,     // "למדו X טיפים"
    /חדש(ות|ים)?\s+(באתר|בבלוג|בעסק)/, // "חדשות ב..." filler
    /עדכון\s+(חשוב|חדש)/,     // "עדכון חשוב" filler
    /תוכן\s+(חדש|מיוחד)/,     // "תוכן חדש" filler
  ];

  items.forEach((item, idx) => {
    let genericScore = 0;

    // Check if title is generic pattern
    for (const pattern of GENERIC_PATTERNS) {
      if (pattern.test(item.title)) {
        genericScore += 3;
        break;
      }
    }

    // Check if researchSource is missing when research exists
    if (!item.researchSource) genericScore += 4;

    // Check if researchReason is too short or generic
    if (!item.researchReason || item.researchReason.length < 15) genericScore += 2;

    // Check if ideaSummary doesn't reference any specific insight
    if (item.ideaSummary && item.ideaSummary.length < 20) genericScore += 1;

    // Title too short or vague
    if (item.title.length < 10) genericScore += 2;

    if (genericScore >= 4) {
      genericCount++;
      issues.push(`Item ${idx}: נראה גנרי (ניקוד: ${genericScore}) — title: "${item.title.slice(0, 40)}", researchSource: "${item.researchSource || 'חסר'}"`);
    }
  });

  return { genericCount, issues };
}

// Research linkage validation — when research exists, every item MUST have researchSource
function validateResearchLinkage(items: GeneratedItem[], hasResearch: boolean): { passed: boolean; issues: string[] } {
  if (!hasResearch) return { passed: true, issues: [] };

  const issues: string[] = [];
  const validSources = ['weakness', 'opportunity', 'competitor', 'audience', 'campaign_concept', 'content_angle', 'action_plan', 'manual_note'];

  items.forEach((item, idx) => {
    if (!item.researchSource || !validSources.includes(item.researchSource)) {
      issues.push(`Item ${idx}: missing or invalid researchSource (got "${item.researchSource || 'none'}") — must link to research`);
    }
    if (!item.researchReason || item.researchReason.length < 10) {
      issues.push(`Item ${idx}: missing or weak researchReason (got "${item.researchReason || 'none'}") — must explain research linkage`);
    }
  });

  return { passed: issues.length === 0, issues };
}

// Helper: fetch Creative DNA for client
function getCreativeDNA(clientId: string): CreativeDNA | null {
  try {
    const allDNA = creativeDNAStore.getAll();
    if (!Array.isArray(allDNA)) return null;
    const dna = allDNA.find((d: any) => d.clientId === clientId);
    return dna || null;
  } catch (error) {
    console.error('Error fetching Creative DNA:', error);
    return null;
  }
}

// Helper: generate gantt item type
function getItemType(format: string): GanttItemType {
  const mapping: Record<string, GanttItemType> = {
    image: 'social_post',
    video: 'social_post',
    reel: 'reel',
    carousel: 'carousel',
    story: 'story',
    live: 'social_post',
    text: 'social_post',
  };
  return mapping[format] || 'social_post';
}

export async function POST(
  req: NextRequest,
  { params }: { { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();

  try {
    const { id } = params;
    const body: GenerateGanttRequest = await req.json();

    // Validate input
    if (!body.month || !body.year || !body.weeklyPosts || !body.platforms) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Load and validate client
    const client = clients.getById(id);
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found', field: 'clientId' },
        { status: 400 }
      );
    }

    // Validate business context
    if (!client.businessField && !client.marketingGoals && !client.keyMarketingMessages) {
      return NextResponse.json(
        { error: 'חסרים נתונים ליצירת גאנט. אנא מלא שדה עסק, מטרות שיווק, או מסרים שיווקיים.' },
        { status: 400 }
      );
    }

    // Get holidays for this month
    const holidays = getRelevantHolidays(body.month, client.clientType, body.year);

    // ============================================================
    // SELECTIVE REGENERATION: Delete unprotected items, keep protected
    // ============================================================
    const protectedItemIds = new Set(body.protectedItemIds || []);
    const deleteItemIds = body.deleteItemIds || [];
    const protectedDates = new Set(body.protectedDates || []);
    const excludeTitles = new Set((body.excludeTitles || []).map(t => t.toLowerCase().trim()));
    const protectedCount = protectedItemIds.size;

    if (body.isRegeneration && deleteItemIds.length > 0) {
      // Delete only unprotected items
      for (const deleteId of deleteItemIds) {
        if (protectedItemIds.has(deleteId)) {
          console.warn(`[Gantt Regen] ⚠️ Skipping deletion of protected item: ${deleteId}`);
          continue;
        }
        try {
          clientGanttItems.delete(deleteId);
          console.log(`[Gantt Regen] 🗑️ Deleted unprotected item: ${deleteId}`);
        } catch (err) {
          console.warn(`[Gantt Regen] ⚠️ Failed to delete item ${deleteId}:`, err);
        }
      }
      console.log(`[Gantt Regen] 🔒 Protected: ${protectedCount} items. 🗑️ Deleted: ${deleteItemIds.length} items. Regenerating ${deleteItemIds.length} replacement items.`);
    }

    // Calculate total items to generate (subtract protected items during regeneration)
    const fullMonthItems = body.weeklyPosts * 4; // 4 weeks per month
    const totalItems = body.isRegeneration && protectedCount > 0
      ? Math.max(1, fullMonthItems - protectedCount)
      : fullMonthItems;
    const daysInTheMonth = daysInMonth(body.month, body.year);
    const daysBetweenItems = Math.floor(daysInTheMonth / fullMonthItems); // spacing based on full month, not reduced count

    // Parse campaign themes
    const campaignsList = body.campaigns
      ? body.campaigns.split(',').map((c) => c.trim())
      : [];

    // Fetch Creative DNA if available
    const creativeDNA = getCreativeDNA(id);

    // ============================================================
    // STEP 0: LOAD PREVIOUS GANTTS FOR ANTI-REPETITION
    // ============================================================
    const previousGantts = loadPreviousGantts(id, body.month, body.year);
    let antiRepetitionBrief = buildAntiRepetitionBrief(previousGantts);
    const monthSeasonality = getMonthSeasonality(body.month);
    const pillarEmphasis = getMonthlyPillarEmphasis(body.month);

    // Add protected/approved item titles to anti-repetition (don't generate similar content)
    if (excludeTitles.size > 0) {
      const titlesArr = [...excludeTitles];
      antiRepetitionBrief += `\n\n⛔ פריטים שאושרו או בעבודה — אסור ליצור תוכן דומה או זהה:\n`;
      titlesArr.forEach((t, i) => {
        antiRepetitionBrief += `  ${i + 1}. "${t}"\n`;
      });
      antiRepetitionBrief += `יש ליצור רעיונות שונים לחלוטין מהפריטים שלעיל.\n`;
    }

    console.log(`[Gantt] 📊 Anti-repetition: ${previousGantts.length} previous months loaded (${previousGantts.map(p => `${p.month}/${p.year}`).join(', ')}). Month pillars: ${pillarEmphasis.primary.join(', ')}. Excluded titles: ${excludeTitles.size}`);

    // ============================================================
    // STEP 1: LOAD SAVED CLIENT RESEARCH — PRIMARY SOURCE OF TRUTH
    // ============================================================
    const researchRecords = clientResearch.query((r: ClientResearch) => r.clientId === id);
    const latestResearch = researchRecords.length > 0 ? researchRecords[researchRecords.length - 1] : null;
    const hasResearch = !!(latestResearch && latestResearch.status === 'complete');

    // Extract structured insights from research
    let researchInsights: ResearchInsight[] = [];
    let researchBrief = '';
    let researchWarningMsg = '';

    if (hasResearch && latestResearch) {
      researchInsights = extractResearchInsights(latestResearch);
      console.log(`[Gantt] ✅ Research loaded for ${client.name}: ${researchInsights.length} insights extracted (research ID: ${latestResearch.id}, saved: ${latestResearch.savedAt || latestResearch.updatedAt})`);

      // Build the FULL research brief — this is the strategic backbone
      const r = latestResearch;
      const briefParts: string[] = [];

      briefParts.push(`\n\n████████████████████████████████████████`);
      briefParts.push(`█ בריף אסטרטגי מחקרי — מקור ראשי לייצור התוכן █`);
      briefParts.push(`████████████████████████████████████████`);
      briefParts.push(`\nזהו הבריף האסטרטגי שנבנה מחקר לקוח מעמיק. כל פריט תוכן חייב להיגזר ישירות מתוך הבריף הזה.`);
      briefParts.push(`אסור ליצור תוכן גנרי שלא קשור לממצאי המחקר.\n`);

      // Identity
      if (r.identity) {
        briefParts.push(`🧠 זהות העסק:`);
        briefParts.push(`  מוכרים באמת: ${r.identity.whatTheySell}`);
        briefParts.push(`  מיצוב: ${r.identity.positioning}`);
        briefParts.push(`  טון: ${r.identity.tone}`);
        briefParts.push(`  ערך ייחודי: ${r.identity.uniqueValue}`);
        briefParts.push(`  קהל יעד: ${r.identity.targetAudience}\n`);
      }

      // Audience deep dive
      if (r.audience) {
        briefParts.push(`👥 קהל יעד מעמיק:`);
        briefParts.push(`  קהל עיקרי: ${r.audience.primary}`);
        if (r.audience.secondary) briefParts.push(`  קהל משני: ${r.audience.secondary}`);
        if (r.audience.painPoints?.length > 0) {
          briefParts.push(`  נקודות כאב (חובה ליצור תוכן שמתייחס אליהן):`);
          r.audience.painPoints.forEach((pp, i) => briefParts.push(`    ${i + 1}. ${pp}`));
        }
        briefParts.push('');
      }

      // Manual strategic notes — HIGHEST PRIORITY
      if (r.strategicNotes?.trim()) {
        briefParts.push(`⭐ הערות אסטרטגיות ממנהל החשבון (עדיפות עליונה — גובר על כל מקור אחר):`);
        briefParts.push(`  ${r.strategicNotes.trim()}\n`);
      }

      // Weaknesses
      if (r.weaknesses?.length > 0) {
        briefParts.push(`🔴 חולשות שזוהו (חובה ליצור תוכן מתקן עבור כל אחת):`);
        r.weaknesses.forEach((w, i) => briefParts.push(`  ${i + 1}. [${w.severity}] ${w.area}: ${w.description} → המלצה: ${w.recommendation}`));
        briefParts.push('');
      }

      // Opportunities
      if (r.opportunities?.length > 0) {
        briefParts.push(`🟢 הזדמנויות (חובה ליצור תוכן פרואקטיבי):`);
        r.opportunities.forEach((o, i) => briefParts.push(`  ${i + 1}. [${o.potentialImpact}] ${o.title}: ${o.description} (${o.category})`));
        briefParts.push('');
      }

      // Content angles
      if (r.recommendedContentAngles?.length > 0) {
        briefParts.push(`📐 זוויות תוכן מומלצות (חובה להפוך לפריטי תוכן ממשיים):`);
        r.recommendedContentAngles.forEach((a, i) => briefParts.push(`  ${i + 1}. ${a}`));
        briefParts.push('');
      }

      // Campaign concepts
      if (r.recommendedCampaignConcepts?.length > 0) {
        briefParts.push(`🎯 קונספטים לקמפיינים (חובה להפוך לנושאי תוכן חודשיים):`);
        r.recommendedCampaignConcepts.forEach((c, i) => briefParts.push(`  ${i + 1}. ${c.name}: ${c.goal} (${c.platforms?.join(', ')}) [${c.format}]`));
        briefParts.push('');
      }

      // Competitor insights
      if (r.competitors?.length > 0) {
        briefParts.push(`⚔️ תובנות מתחרים (חובה ליצור תוכן שמבדל מהם):`);
        r.competitors.forEach((c, i) => {
          briefParts.push(`  ${i + 1}. ${c.name}: חולשה — ${c.weakness || 'לא ידוע'}`);
          if (c.whatWorks?.length > 0) briefParts.push(`     מה שעובד להם: ${c.whatWorks.join(', ')}`);
        });
        if (r.competitorSummary?.doMoreOf?.length > 0) briefParts.push(`  → לעשות יותר: ${r.competitorSummary.doMoreOf.join(', ')}`);
        if (r.competitorSummary?.avoid?.length > 0) briefParts.push(`  → להימנע: ${r.competitorSummary.avoid.join(', ')}`);
        briefParts.push('');
      }

      // Action plan
      if (r.actionPlan) {
        if (r.actionPlan.thingsToDo?.length > 0) {
          briefParts.push(`📋 תוכנית פעולה — דברים לעשות (חובה לבצע דרך התוכן):`);
          r.actionPlan.thingsToDo.forEach((t, i) => briefParts.push(`  ${i + 1}. [${t.priority}] ${t.action}`));
        }
        if (r.actionPlan.thingsToStop?.length > 0) {
          briefParts.push(`  🚫 דברים להפסיק (אסור ליצור תוכן שעושה את אלה): ${r.actionPlan.thingsToStop.map(t => t.action).join(', ')}`);
        }
        if (r.actionPlan.contentIdeas?.length > 0) {
          briefParts.push(`  💡 רעיונות תוכן ספציפיים מתוכנית הפעולה:`);
          r.actionPlan.contentIdeas.forEach((ci, i) => briefParts.push(`    ${i + 1}. ${ci.idea} (${ci.format}, ${ci.platform})`));
        }
        briefParts.push('');
      }

      briefParts.push(`████████████████████████████████████████`);
      briefParts.push(`█ סוף הבריף — כל פריט חייב להיגזר ממנו █`);
      briefParts.push(`████████████████████████████████████████`);

      researchBrief = briefParts.join('\n');
    } else {
      researchWarningMsg = 'לא נשמר חקר לקוח — הגאנט יופק עם פחות דיוק אסטרטגי';
      console.warn(`[Gantt] ⚠️ No saved research for client ${client.name} (${id}). Generating with reduced strategic precision.`);
    }

    // ============================================================
    // STEP 2: BUILD EXECUTION IDEAS FROM RESEARCH
    // ============================================================
    const executionIdeas = hasResearch ? buildExecutionIdeas(researchInsights) : [];
    const executionBrief = hasResearch ? buildExecutionBrief(executionIdeas, totalItems, body.month) : '';
    const ganttVersion = body.ganttVersion || 1;
    const isRegeneration = body.isRegeneration || false;

    console.log(`[Gantt] 📋 Execution ideas: ${executionIdeas.length} from ${researchInsights.length} insights. Version: ${ganttVersion}. Regeneration: ${isRegeneration}`);

    // ============================================================
    // STEP 3: BUILD PROMPTS — RESEARCH IS THE STRATEGIC BRIEF
    // ============================================================
    const knowledgeContext = getClientKnowledgeContext(id);
    const holidaysList = getRelevantHolidays(body.month, client.clientType, body.year);
    const holidaysSection = holidaysList.length > 0
      ? `\n\nחגים ואירועים בחודש זה:\n${holidaysList
          .map((h) => `- ${h.hebrewName} (${h.name}): ${h.contentIdeas.join(', ')}`)
          .join('\n')}\n\nשלב חגים רלוונטיים בתוכן — אך תמיד דרך הפריזמה של ממצאי המחקר.`
      : '';

    const contentTypesDescription = CONTENT_TYPES.map((ct, i) => `${i + 1}. ${ct}`).join('\n');
    const hookStylesDescription = HOOK_STYLES.map((hs, i) => `${i + 1}. ${hs}`).join('\n');
    const graphicStylesDescription = GRAPHIC_TEXT_STYLES.map((gs, i) => `${i + 1}. ${gs}`).join('\n');

    const dnaToneNote = creativeDNA?.toneOfVoice ? `\nטון Brand: ${creativeDNA.toneOfVoice}` : '';
    const dnaSellingNote = creativeDNA?.sellingStyle ? `\nגישת מכירה: ${creativeDNA.sellingStyle}` : '';
    const dnaVisualNote = creativeDNA?.visualStyle ? `\nכיוון ויזואלי: ${creativeDNA.visualStyle}` : '';
    const dnaProhibitionsNote = creativeDNA?.doNotUsePatterns?.length ? `\nאסור: ${creativeDNA.doNotUsePatterns.join(', ')}` : '';

    const HEBREW_MONTHS = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const monthName = HEBREW_MONTHS[body.month] || `חודש ${body.month}`;

    const monthContextBlock = `
📅 חודש יעד: ${monthName} ${body.year}
🌤️ עונתיות: ${monthSeasonality}
🎯 עמודי תוכן מרכזיים לחודש זה (חובה לתת להם דגש): ${pillarEmphasis.primary.join(', ')}
📌 עמודי תוכן משניים (ניתן לשלב): ${pillarEmphasis.secondary.join(', ')}

חובה: התוכן חייב להרגיש כמו תוכנית ספציפית ל-${monthName}. לא תוכנית גנרית.
שלב את האווירה העונתית, החגים, ורוח החודש בכל פריט.`;

    const systemPrompt = hasResearch
      ? `אתה מנוע ביצוע של בריף אסטרטגי — לא קריאייטור חופשי.
אתה מקבל רשימת הנחיות ביצוע מדויקות מחקר לקוח, ומייצר תוכנית תוכן חודשית שמבצעת אותן.

🔴 מצב: EXECUTION MODE — אתה לא ממציא רעיונות. אתה מבצע הנחיות.
🔴 כל פריט חייב לבצע הנחיה ספציפית מרשימת הביצוע. אסור להמציא רעיונות גנריים.
🔴 אם פריט לא מבצע הנחיה מהרשימה — הוא נפסל.

🚫 חוק ברזל #1: עברית בלבד. אפס אנגלית. מילים מותרות: facebook, instagram, tiktok, ROI, SEO.
🚫 חוק ברזל #2: כל פריט חייב לבצע הנחיה ספציפית מרשימת הביצוע. אסור תוכן גנרי.
🚫 חוק ברזל #3: כל פריט חייב לכלול researchSource ו-researchReason שמראים בדיוק איזו הנחיה הוא מבצע.
🚫 חוק ברזל #4: אסור לחזור על תוכן מחודשים קודמים. כל חודש חייב להרגיש חדש ושונה.
${isRegeneration ? `🚫 חוק ברזל #5: זהו ייצור מחדש (גרסה ${ganttVersion}). חובה לבחור זוויות ביצוע שונות לחלוטין מהגרסה הקודמת.` : ''}

לקוח: ${client.name} | תחום: ${client.businessField}
מטרות: ${client.marketingGoals || 'לא מוגדר'} | מסרים: ${client.keyMarketingMessages || 'לא מוגדר'}
${dnaToneNote}${dnaSellingNote}${dnaVisualNote}${dnaProhibitionsNote}
${monthContextBlock}

${researchBrief}
${executionBrief}
${antiRepetitionBrief}

📝 כל פריט = קמפיין אחד שלם שנולד מרעיון מרכזי אחד:

🔑 שיטת הקונספט האחד:
כל פריט מתחיל מ-title = הרעיון המרכזי / ההוק השיווקי.
כל שאר השדות נגזרים ישירות ממנו — כמו קמפיין אמיתי.

1. title — הרעיון המרכזי. זה ה-hook השיווקי, המשפט שמוכר את הפוסט. הכל נגזר ממנו.

2. ideaSummary — הרחבה של ה-title ב-2 משפטים. מסביר את אותו רעיון מרכזי — מה הערך, מה הכאב, מה הפתרון.

3. graphicText — טקסט מודעה שנגזר ישירות מה-title. שורה 1: hook חד (פרפרזה של ה-title). שורה 2: פאנץ׳/הבטחה שמשלימה אותו. מינימום 8 תווים/שורה.
   ✅ "הכסף שלך עובד בשבילך?\\nגלה איך תוך 30 יום" ❌ "קרא עוד", "גלה עוד", "בואו"

4. hook — משפט פתיחה שמוכר את אותו רעיון מרכזי. ספציפי, רגשי או פרובוקטיבי. מינימום 15 תווים. חייב להתאים ל-title.

5. caption — כיתוב מלא שמפתח את אותו רעיון מרכזי לפוסט שלם. פתיחה (מבוססת על ה-hook) + גוף (מרחיב את ה-ideaSummary) + CTA + האשטגים. מינימום 80 תווים.

6. visualConcept — הנחיית עיצוב שמבטאת ויזואלית את אותו רעיון מרכזי. מינימום 80 תווים. קומפוזיציה, רקע, צבעים, אלמנטים, סגנון, מיקום טקסט, אווירה — הכל חייב לשרת את ה-title.

7. cta — קריאה לפעולה ספציפית שקשורה ישירות לרעיון המרכזי. לא "שתפו" או "לחצו".

⚠️ בדיקת קוהרנטיות: אם קוראים את ה-title, ה-graphicText, ה-caption, וה-visualConcept ברצף — הם חייבים להרגיש כמו קמפיין אחד שלם, לא כמו 4 רעיונות שונים.

סוגי תוכן (סיבוב, לא שניים ברצף זהים):
${contentTypesDescription}

סגנונות hook (סיבוב): ${hookStylesDescription}
סגנונות graphicText (סיבוב): ${graphicStylesDescription}

כללי ברזל: אין חזרה על contentType/hookStyle/graphicTextStyle ברצף. אין hook/CTA/graphicText זהים. עברית בלבד. כל פריט חייב להיות ייחודי לחודש ${monthName}.`

      : `אתה קופירייטר פרסומי בכיר עבור ${client.name} (${client.businessField}).
אתה יוצר תוכנית תוכן חודשית ייחודית ל-${monthName} ${body.year}.

🚫 עברית בלבד. מילים מותרות באנגלית: facebook, instagram, tiktok, ROI, SEO.
🚫 אסור לחזור על תוכן מחודשים קודמים.

פרטי הלקוח:
- שם: ${client.name} | תחום: ${client.businessField}
- מטרות: ${client.marketingGoals || 'לא מוגדר'} | מסרים: ${client.keyMarketingMessages || 'לא מוגדר'}
${dnaToneNote}${dnaSellingNote}${dnaVisualNote}${dnaProhibitionsNote}
${knowledgeContext ? `\nהקשר:\n${knowledgeContext}` : ''}
${monthContextBlock}
${antiRepetitionBrief}

⚠️ אין חקר לקוח שמור — צור תוכן על בסיס הנתונים הבסיסיים לעיל, תוך התאמה לחודש ${monthName}.

📝 כל פריט = קמפיין אחד שלם. title = הרעיון המרכזי. כל שאר השדות נגזרים ממנו:
- ideaSummary: הרחבה של ה-title ב-2 משפטים
- graphicText: פרפרזה חדה של ה-title (שורה 1 hook + שורה 2 פאנץ׳)
- hook: משפט פתיחה שמוכר את אותו רעיון (15+ תווים)
- caption: פוסט מלא שמפתח את אותו רעיון (80+ תווים)
- visualConcept: הנחיית עיצוב שמבטאת את אותו רעיון ויזואלית (80+ תווים)
- cta: קריאה לפעולה שנגזרת מהרעיון — לא גנרית

סוגי תוכן (סיבוב):
${contentTypesDescription}

סגנונות hook: ${hookStylesDescription}
סגנונות graphicText: ${graphicStylesDescription}

כללים: עברית בלבד, אין חזרות ברצף, כל פריט ספציפי ל-${client.name} ול-${monthName}.`;

    const userPrompt = `צור בדיוק ${totalItems} פריטי קריאייטיב פרסומי עבור ${client.name} (${client.businessField}) לחודש ${monthName} ${body.year}.

⚠️ חוק עליון: כל טקסט בעברית בלבד. אנגלית = פסילה.
⚠️ חוק עליון: כל פריט חייב להיות חדש ושונה מחודשים קודמים. אסור לחזור על hook, כותרת, graphicText, או CTA שכבר עלו.

${hasResearch ? `🔴 חובה: הגאנט הזה הוא תוכנית ביצוע של הבריף המחקרי לחודש ${monthName} ספציפית.
כל פריט חייב להיגזר ישירות מתובנה ספציפית מהמחקר — אבל בזווית חדשה, טרייה, ומותאמת לחודש הזה.
אסור ליצור רעיון גנרי שלא מופיע בבריף. כל פריט חייב לכלול researchSource ו-researchReason.
אם תובנה מחקרית כבר שימשה בחודש קודם — השתמש בה בזווית שונה, hook שונה, וטון שונה.` : ''}

📅 הקשר חודשי:
- חודש: ${monthName} ${body.year}
- עונתיות: ${monthSeasonality}
- עמודי תוכן מרכזיים: ${pillarEmphasis.primary.join(', ')}
- חובה: לפחות פריט אחד שקשור ישירות לחג/אירוע של החודש

סיבוב חובה:
1. contentType: לא שניים ברצף זהים
2. hookStyle: סיבוב
3. graphicTextStyle: סיבוב

פרטי הקמפיין:
- קהל: ${client.marketingGoals || 'כללי'}
- פלטפורמות: ${body.platforms.join(', ')}
- פורמטים: ${body.formats.join(', ')}
${body.themes ? `- נושאים: ${body.themes}` : ''}
${body.customPrompt ? `- הנחיות: ${body.customPrompt}` : ''}
${holidaysSection}

🔑 שיטת הקונספט האחד — כל פריט הוא קמפיין שלם שנגזר מרעיון מרכזי אחד:
תחילה בחר title (= הרעיון המרכזי), ואז גזור ממנו את כל שאר השדות.
אסור ליצור שדות באופן עצמאי — הכל חייב להיות קוהרנטי ולשרת את אותו רעיון.

מבנה JSON נדרש:
[
  {
    "contentType": "pain_driven|authority|storytelling|offer_sales|educational|social_proof|rtm_holiday|controversial|behind_scenes|comparison",
    "hookStyle": "question|bold_statement|emotional|statistic|contradiction|story_opener",
    "graphicTextStyle": "short_punch|question|bold_claim|emotional|statistic|contradiction",
    "title": "הרעיון המרכזי — hook שיווקי חד בעברית, ספציפי ל-${client.name} ול-${monthName}",
    "hook": "משפט פתיחה שמוכר את אותו רעיון מרכזי מה-title — מינימום 15 תווים",
    "mainMessage": "הערך/כאב/פתרון שעומד מאחורי ה-title",
    "ideaSummary": "הרחבה של ה-title ב-2 משפטים — אותו רעיון, יותר עומק + רלוונטיות ל-${monthName}",
    "graphicText": "טקסט מודעה שנגזר מה-title. שורה 1: פרפרזה של ה-hook\\nשורה 2: הבטחה שמשלימה",
    "caption": "פוסט מלא שמפתח את הרעיון מה-title. פתיחה (מבוססת hook) + גוף + CTA + האשטגים. מינימום 80 תווים",
    "cta": "קריאה לפעולה שנגזרת ישירות מהרעיון ב-title — ספציפית, לא גנרית",
    "visualConcept": "הנחיית עיצוב שמבטאת ויזואלית את הרעיון מה-title — קומפוזיציה, צבעים, אלמנטים. מינימום 80 תווים",
    "dayOfMonth": "1-${daysInTheMonth}",
    "platform": "facebook|instagram|tiktok",
    "format": "image|video|reel|carousel|story|live|text",
    "researchSource": "weakness|opportunity|competitor|audience|campaign_concept|content_angle|action_plan|manual_note",
    "researchReason": "מבוסס על: [ציטוט התובנה המחקרית שממנה נגזר ה-title] + למה זה רלוונטי ל-${monthName}"
  }
]

${hasResearch ? `חובה: researchSource ו-researchReason בכל פריט. פריט בלי שיוך מחקרי = נפסל.` : ''}

⚠️ בדיקת קוהרנטיות: בכל פריט, אם קוראים title → graphicText → caption → visualConcept, הם חייבים לספר את אותו סיפור.
פריט שבו השדות מדברים על דברים שונים = פסול.

חובה: כל פריט ספציפי ל-${client.name} ולחודש ${monthName}. אסור תוכן גנרי. אסור חזרות מחודשים קודמים.`;

    let useAI = true;
    let aiError: string | null = null;
    let aiResult: any = null;
    let aiGeneratedItems: GeneratedItem[] = [];
    const MAX_GANTT_ATTEMPTS = 2;

    // Attempt AI generation with quality validation + retry
    for (let attempt = 1; attempt <= MAX_GANTT_ATTEMPTS; attempt++) {
      try {
        const attemptPrompt = attempt === 1 ? userPrompt :
          `${userPrompt}\n\n🔴 ניסיון ${attempt}: הפלט הקודם נפסל בגלל בעיות איכות. הפעם:\n- כל טקסט חייב להיות בעברית מלאה, אפס אנגלית\n- graphicText חייב להיות קופי פרסומי חד, לא "קרא עוד" או "גלה עוד"\n- caption חייב להיות מינימום 80 תווים\n- visualConcept חייב להיות מינימום 80 תווים עם פרטי עיצוב מדויקים\n- כל פריט חייב להיות ספציפי ל-${client.name}\n- ⚠️ קוהרנטיות: כל השדות בפריט חייבים לדבר על אותו רעיון מרכזי! title → hook → graphicText → caption → visualConcept = אותו קונספט.\n- אסור שדות מנותקים — אם ה-title מדבר על נושא X, כל השאר חייבים להיות על נושא X`;

        aiResult = await generateWithAI(systemPrompt, attemptPrompt);

        if (!aiResult.success) {
          if (aiResult.errorType === 'missing_api_key') {
            aiError = 'מפתח API חסר';
          } else if (aiResult.errorType === 'provider_failure') {
            aiError = aiResult.error || 'שגיאה בשירות ה-AI';
          } else {
            aiError = aiResult.error || 'תגובת ה-AI לא תקינה';
          }
          console.error(`[Gantt] AI generation attempt ${attempt} failed`, { clientId: id, errorMessage: aiError });
          useAI = false;
          break; // Don't retry on API failures
        } else if (!Array.isArray(aiResult.data)) {
          aiError = 'תגובת ה-AI לא תקינה';
          useAI = false;
          break;
        } else {
          // Parse AI results — NO weak defaults, leave empty to catch in validation
          aiGeneratedItems = aiResult.data.map((item: any, idx: number) => ({
            contentType: item.contentType || getContentType(idx),
            hookStyle: item.hookStyle || getHookStyle(idx),
            graphicTextStyle: item.graphicTextStyle || getGraphicTextStyle(idx),
            title: item.title || '',
            hook: item.hook || '',
            mainMessage: item.mainMessage || '',
            ideaSummary: item.ideaSummary || '',
            graphicText: item.graphicText || '',
            caption: item.caption || '',
            cta: item.cta || '',
            visualConcept: item.visualConcept || '',
            dayOfMonth: Math.min(Math.max(item.dayOfMonth || 1, 1), daysInTheMonth),
            platform: item.platform || seedPick(body.platforms, idx),
            format: item.format || seedPick(body.formats, idx),
            researchSource: item.researchSource || '',
            researchReason: item.researchReason || '',
          }));

          // Validate quality + diversity + novelty + coherence + generic detection
          const diversityCheck = checkDiversity(aiGeneratedItems);
          const researchCheck = validateResearchLinkage(aiGeneratedItems, hasResearch);
          const noveltyCheck = scoreNovelty(aiGeneratedItems, previousGantts);
          const coherenceCheck = validateItemCoherence(aiGeneratedItems);
          const genericCheck = detectGenericContent(aiGeneratedItems, hasResearch);
          const allIssues = [...diversityCheck.issues, ...researchCheck.issues, ...coherenceCheck.issues, ...genericCheck.issues];

          // 80% research enforcement: when research exists, at least 80% must have researchSource
          if (hasResearch) {
            const linkedCount = aiGeneratedItems.filter(i => i.researchSource).length;
            const linkedPct = Math.round((linkedCount / aiGeneratedItems.length) * 100);
            if (linkedPct < 80) {
              allIssues.push(`Research usage too low: ${linkedPct}% (${linkedCount}/${aiGeneratedItems.length}). Minimum 80% required.`);
            }
          }

          // Novelty issues are critical if score is very low
          if (noveltyCheck.score < 50 && previousGantts.length > 0) {
            allIssues.push(`Novelty score too low: ${noveltyCheck.score}/100 (${noveltyCheck.repeatedItems} repeated items)`);
          }

          // Generic content is critical
          if (genericCheck.genericCount > 0) {
            allIssues.push(`Generic content detected: ${genericCheck.genericCount} items feel like filler, not research execution`);
          }

          if (allIssues.length > 0) {
            const criticalIssues = allIssues.filter(i =>
              i.includes('English') || i.includes('weak/generic') || i.includes('too short') || i.includes('researchSource') || i.includes('researchReason') || i.includes('Novelty score') || i.includes('disconnected') || i.includes('Generic content') || i.includes('Research usage too low')
            );
            console.warn(`[Gantt] Attempt ${attempt} quality issues (${allIssues.length} total, ${criticalIssues.length} critical). Novelty: ${noveltyCheck.score}/100. Coherence: ${coherenceCheck.issues.length}. Generic: ${genericCheck.genericCount}.`, allIssues.slice(0, 10));

            if (criticalIssues.length > 0 && attempt < MAX_GANTT_ATTEMPTS) {
              console.log(`[Gantt] Retrying due to ${criticalIssues.length} critical issues (research: ${researchCheck.issues.length}, novelty: ${noveltyCheck.score}, coherence: ${coherenceCheck.issues.length}, generic: ${genericCheck.genericCount})...`);
              continue; // Retry
            }
            // On last attempt: use results but log warning
            if (!researchCheck.passed) {
              researchWarningMsg = `${researchCheck.issues.length} פריטים לא משויכים למחקר (מתוך ${aiGeneratedItems.length})`;
              console.warn(`[Gantt] ⚠️ Research linkage incomplete after ${attempt} attempts: ${researchCheck.issues.length} items missing research`);
            }
          }

          const linkedCount = aiGeneratedItems.filter(i => i.researchSource).length;
          const linkedPct = Math.round((linkedCount / aiGeneratedItems.length) * 100);
          console.log(`[Gantt] ✅ Attempt ${attempt} passed. Research: ${linkedPct}%. Novelty: ${noveltyCheck.score}/100. Coherence: ${coherenceCheck.issues.length}. Generic: ${genericCheck.genericCount}`);
          useAI = true;
          break; // Success
        }
      } catch (aiCallError) {
        const errorMessage = aiCallError instanceof Error ? aiCallError.message : 'Unknown error';
        aiError = 'תגובת ה-AI לא תקינה';
        console.error(`[Gantt] AI call attempt ${attempt} failed`, { clientId: id, errorMessage });
        useAI = false;
        break; // Don't retry on exceptions
      }
    }

    // Generate gantt items
    const newItems: ClientGanttItem[] = [];
    let dayCounter = 1;

    for (let i = 0; i < totalItems; i++) {
      // Skip dates occupied by protected items during selective regeneration
      let dayInMonth = Math.min(dayCounter, daysInTheMonth);
      let candidateDate = new Date(body.year, body.month - 1, dayInMonth).toISOString().split('T')[0];
      if (protectedDates.size > 0) {
        let safety = 0;
        while (protectedDates.has(candidateDate) && safety < daysInTheMonth) {
          dayCounter++;
          dayInMonth = Math.min(dayCounter, daysInTheMonth);
          candidateDate = new Date(body.year, body.month - 1, dayInMonth).toISOString().split('T')[0];
          safety++;
        }
      }
      const itemDate = new Date(body.year, body.month - 1, dayInMonth)
        .toISOString()
        .split('T')[0];

      let title: string;
      let hook: string;
      let mainMessage: string;
      let ideaSummary: string;
      let graphicText: string;
      let caption: string;
      let cta: string;
      let visualConcept: string;
      let platform: string;
      let format: ContentFormat;
      let contentType: typeof CONTENT_TYPES[number];
      let hookStyle: typeof HOOK_STYLES[number];
      let graphicTextStyle: typeof GRAPHIC_TEXT_STYLES[number];

      // Use AI-generated content if available, otherwise graceful fallback
      if (useAI && aiGeneratedItems && i < aiGeneratedItems.length) {
        const aiItem = aiGeneratedItems[i];
        title = aiItem.title;
        hook = aiItem.hook;
        mainMessage = aiItem.mainMessage;
        ideaSummary = aiItem.ideaSummary;
        graphicText = aiItem.graphicText;
        caption = aiItem.caption;
        cta = aiItem.cta;
        visualConcept = aiItem.visualConcept;
        contentType = aiItem.contentType;
        hookStyle = aiItem.hookStyle;
        graphicTextStyle = aiItem.graphicTextStyle;
        platform = aiItem.platform;
        format = (aiItem.format || seedPick(body.formats, i)) as ContentFormat;
      } else {
        // Graceful fallback — deterministic generation
        // If research existed but AI failed, log warning (don't block)
        if (hasResearch && i === 0) {
          console.warn(`[Gantt] ⚠️ AI generation failed but research exists for ${client.name} — falling back to deterministic generation with partial research context`);
          researchWarningMsg = 'החקר לא הוטמע במלואו, הגאנט הופק עם הקשר חלקי';
        }

        contentType = getContentType(i);
        hookStyle = getHookStyle(i);
        graphicTextStyle = getGraphicTextStyle(i);

        platform = seedPick(body.platforms, i) as string;
        format = seedPick(body.formats, i + 1) as ContentFormat;

        // Find relevant holiday
        const nearbyHoliday = holidays.find((h) => {
          const diff = Math.abs(dayInMonth - h.approximateDay);
          return diff <= 2;
        });

        // Generate deterministic content with diversity
        title = generateTitleDeterministic(
          nearbyHoliday,
          client.businessField,
          campaignsList,
          i,
          contentType
        );

        hook = generateHookDeterministic(contentType, hookStyle, client.businessField, i);
        mainMessage = generateMainMessageDeterministic(contentType, client.businessField, i);
        ideaSummary = generateIdeaSummaryDeterministic(contentType, body.platforms, i);
        graphicText = generateGraphicTextDeterministic(graphicTextStyle, client.businessField, i);
        caption = generateCaptionDeterministic(title, platform, i);
        cta = generateCTADeterministic(contentType, i);
        visualConcept = generateVisualConceptDeterministic(contentType, client.businessField, i);
      }

      // Resolve research traceability
      let researchSource = '';
      let researchReason = '';
      if (useAI && aiGeneratedItems && i < aiGeneratedItems.length) {
        researchSource = aiGeneratedItems[i].researchSource || '';
        researchReason = aiGeneratedItems[i].researchReason || '';
      }

      // Create gantt item with content type, hook style, and research snapshot
      const ganttGeneratedAt = new Date().toISOString();
      const ganttItem: ClientGanttItem = {
        id: 'cgi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        clientId: id,
        ganttType: 'monthly',
        month: body.month,
        year: body.year,
        date: itemDate,
        title,
        ideaSummary,
        graphicText,
        caption,
        visualConcept,
        itemType: getItemType(format),
        platform: platform as any,
        format,
        relatedVideoId: '',
        relatedFileUrl: '',
        imageUrls: [],
        attachedFiles: [],
        assigneeId: client.assignedManagerId,
        assignedManagerId: client.assignedManagerId,
        status: 'new_idea',
        internalNotes: body.customPrompt || '',
        clientNotes: '',
        holidayTag: (holidays.find((h) => Math.abs(dayInMonth - h.approximateDay) <= 2))?.hebrewName || '',
        campaignTag: '',
        monthTheme: contentType,  // Store content type
        suggestedRhythm: hookStyle,  // Store hook style
        keyOpportunities: `Hook: ${hook}\nCTA: ${cta}`,
        researchSource: researchSource as any,
        researchReason,
        researchVersionUsed: hasResearch && latestResearch ? latestResearch.id : undefined,
        researchSavedAt: hasResearch && latestResearch ? (latestResearch.savedAt || latestResearch.updatedAt) : undefined,
        ganttGeneratedAt,
        createdAt: ganttGeneratedAt,
        updatedAt: ganttGeneratedAt,
      };

      newItems.push(ganttItem);
      clientGanttItems.create(ganttItem);

      dayCounter += daysBetweenItems;
    }

    // Log research traceability stats
    const itemsWithResearch = newItems.filter(item => item.researchSource);
    const generationPath = useAI
      ? (hasResearch ? 'A: research + AI' : 'C: client data + AI')
      : (hasResearch ? 'B: fallback deterministic (research existed but AI failed)' : 'C: fallback deterministic (no research)');

    // Final novelty score for the generated items
    const finalNovelty = useAI ? scoreNovelty(aiGeneratedItems, previousGantts) : { score: 0, repeatedItems: 0, details: ['deterministic fallback'] };

    console.log(`[Gantt] ✅ Generated ${newItems.length} items. Path: ${generationPath}. Research-linked: ${itemsWithResearch.length}/${newItems.length}. Research found: ${hasResearch}. AI used: ${useAI}. Novelty: ${finalNovelty.score}/100. Previous months compared: ${previousGantts.length}`);

    return NextResponse.json({
      success: true,
      message: `Generated ${newItems.length} diverse gantt items for ${HEBREW_MONTHS[body.month]} ${body.year}`,
      items: newItems,
      ...(aiError && { aiNotice: `Fallback to deterministic: ${aiError}` }),
      ...(!hasResearch && { researchWarning: 'לא בוצעה חקירת לקוח — התוכן פחות מדויק' }),
      ...(researchWarningMsg && { researchLinkageWarning: researchWarningMsg }),
      researchLinked: itemsWithResearch.length,
      researchSnapshot: hasResearch && latestResearch ? {
        id: latestResearch.id,
        savedAt: latestResearch.savedAt || latestResearch.updatedAt,
        insightsUsed: researchInsights.length,
        insightTypes: [...new Set(researchInsights.map(i => i.type))],
      } : null,
      generationMeta: {
        month: body.month,
        year: body.year,
        monthName: HEBREW_MONTHS[body.month],
        ganttVersion,
        isRegeneration,
        generationPath,
        executionMode: hasResearch,
        executionIdeasTotal: executionIdeas.length,
        researchUsagePct: newItems.length > 0 ? Math.round((itemsWithResearch.length / newItems.length) * 100) : 0,
        genericItemsDetected: 0, // Will be set from final check
        previousGanttsCompared: previousGantts.length,
        previousMonths: previousGantts.map(p => `${p.month}/${p.year}`),
        noveltyScore: finalNovelty.score,
        repeatedItemsDetected: finalNovelty.repeatedItems,
        pillarEmphasis: pillarEmphasis.primary,
        seasonality: monthSeasonality,
        // Selective regeneration stats
        selectiveRegeneration: body.isRegeneration && protectedCount > 0 ? {
          protectedItems: protectedCount,
          deletedItems: deleteItemIds.length,
          regeneratedItems: newItems.length,
          excludedTitles: excludeTitles.size,
        } : null,
      },
      diversityInfo: {
        contentTypesUsed: CONTENT_TYPES.slice(0, Math.min(totalItems, CONTENT_TYPES.length)),
        hookStylesUsed: HOOK_STYLES.slice(0, Math.min(totalItems, HOOK_STYLES.length)),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    let clientIdForError = 'unknown';

    try {
      const { id } = params;
      clientIdForError = id;
    } catch (e) {
      // Use fallback if params can't be awaited
    }

    console.error('Error generating gantt', {
      clientId: clientIdForError,
      errorMessage,
      stack: errorStack,
    });

    return NextResponse.json(
      {
        error: 'תגובת ה-API לא תקינה. אנא נסה שוב.',
        details: errorMessage,
        errorType: 'unknown',
      },
      { status: 500 }
    );
  }
}

// DETERMINISTIC GENERATORS WITH DIVERSITY

function generateTitleDeterministic(
  holiday: any,
  businessField: string,
  campaigns: string[],
  index: number,
  contentType: typeof CONTENT_TYPES[number]
): string {
  if (holiday) {
    return `${holiday.hebrewName} — זווית ${contentType}`;
  }

  if (campaigns.length > 0) {
    return `${seedPick(campaigns, index)} | ${contentType}`;
  }

  const titleTemplates: Record<typeof CONTENT_TYPES[number], string[]> = {
    pain_driven: [
      `הבעיה שכולם לא רואים ב${businessField}`,
      `למה ה${businessField} שלך נכשל?`,
      `הדבר שהכי גורם כאב ב${businessField}`,
    ],
    authority: [
      `12 שנות ניסיון ב${businessField} לימדו אותנו`,
      `מה אנחנו יודעים שלא ידעתם ב${businessField}`,
      `הסוד של המנהיגים ב${businessField}`,
    ],
    storytelling: [
      `איך התחלנו עם כלום ב${businessField}`,
      `סיפור שינוי בעולם ${businessField}`,
      `היום שהכל השתנה ב${businessField}`,
    ],
    offer_sales: [
      `הצעה מיוחדת לחודש זה ב${businessField}`,
      `חסמנו עבורך עסקה בלעדית`,
      `75% הנחה על ${businessField} שלנו`,
    ],
    educational: [
      `5 טיפים שיהפכו את ${businessField} שלך`,
      `הגיד לך הכל על ${businessField}`,
      `קורס מהיר ב${businessField} בחודש`,
    ],
    social_proof: [
      `500+ לקוחות שלנו אומרים`,
      `מה אומרים עלינו בתעשיית ${businessField}`,
      `התוצאות הן מדברות בעצמן`,
    ],
    rtm_holiday: [
      `עבור החג הזה בעולם ${businessField}`,
      `כיצד ${businessField} חוגג הלילה`,
      `הרגע שלך להיות חלק מ${businessField}`,
    ],
    controversial: [
      `הכל טועה בנושא ${businessField}`,
      `הפכנו את החשיבה על ${businessField}`,
      `לפי דעתנו, ${businessField} צריך להשתנות`,
    ],
    behind_scenes: [
      `מה שלא ראיתם מאחורי הקלעים`,
      `הצוות שמעמיד את ${businessField} שלנו`,
      `יום בחיים של מומחה ב${businessField}`,
    ],
    comparison: [
      `אנחנו נגד כל השאר ב${businessField}`,
      `תחרות: אנחנו מנוצחים ב${businessField}`,
      `מה שהופך את ה${businessField} שלנו לייחודי`,
    ],
  };

  const templates = titleTemplates[contentType] || [`תוכן על ${businessField}`];
  return seedPick(templates, index);
}

function generateHookDeterministic(
  contentType: typeof CONTENT_TYPES[number],
  hookStyle: typeof HOOK_STYLES[number],
  businessField: string,
  index: number
): string {
  const templates: Record<typeof HOOK_STYLES[number], string[]> = {
    question: [
      `מה יקרה אם לא פעלת עכשיו?`,
      `האם תמיד היה לך כזה?`,
      `מתעניין למה כולם מדברים על זה?`,
      `מה אם היה דרך להשנות הכל?`,
      `כמה זמן עוד תחכה?`,
    ],
    bold_statement: [
      `רוב העסקים עושים את זה לא נכון.`,
      `אנחנו הפכנו את המשחק.`,
      `זה לא מה שאתה חושב.`,
      `התעשייה קרה כל הסודות.`,
      `אנחנו משנים את הכללים.`,
    ],
    emotional: [
      `הרגע שהבנתי שהכל השתנה...`,
      `לא יכולתי להאמין למה שראיתי.`,
      `זה הרגיש כמו חלום.`,
      `הרגיע הדבר שנתן לי כוח חדש.`,
      `תמיד יזכור לי לעולם.`,
    ],
    statistic: [
      `73% מהלקוחות שלנו ראו תוצאה בתוך שבוע.`,
      `4 מתוך 5 אומרים שזה שינה את חייהם.`,
      `1000+ מנויים הוספנו בחודש.`,
      `95% של הלקוחות חוזרים.`,
      `בממוצע, הם משיגים 3x תוצאות.`,
    ],
    contradiction: [
      `כולם אומרים שזה קשה, אבל זה בדיוק ההפך.`,
      `שום דבר לא כמו שחשבת.`,
      `אתה טועה לגבי הדבר הזה.`,
      `זה מסתתר בעומק, אבל יפתח את העיניים.`,
      `כך אתה טועה בנתון הזה.`,
    ],
    story_opener: [
      `לפני שנה קרה משהו שהפך את הכל...`,
      `זה התחיל כטעות קטנה.`,
      `הרגע שלקחתי החלטה שינה את כל הדברים.`,
      `הסיפור מתחיל בפגישה לא צפויה.`,
      `היום שקיבלתי את ההודעה הזאת...`,
    ],
  };

  const hooks = templates[hookStyle] || templates.question;
  return seedPick(hooks, index);
}

function generateMainMessageDeterministic(
  contentType: typeof CONTENT_TYPES[number],
  businessField: string,
  index: number
): string {
  const messages: Record<typeof CONTENT_TYPES[number], string[]> = {
    pain_driven: [
      `אתה בדיוק לוקה בכאב הזה מדי יום`,
      `זה הדבר שמעכב אותך מלהצליח`,
      `זה גם הדבר שכל המתחרים שלך מדלגים עליו`,
    ],
    authority: [
      `אנחנו למדנו את זה בדרך הקשה`,
      `הניסיון הזה עשה אותנו למובילים`,
      `תוכל לשתף בידע שלקח לנו שנים`,
    ],
    storytelling: [
      `וכאן זה הצליח כשלא אמרנו שום דבר`,
      `התוצאה הייתה חתיכה של קסם צפוי`,
      `עכשיו היא לא באותו מקום שהיא הייתה`,
    ],
    offer_sales: [
      `חשוב כי זה הצעה שלא תראה שוב`,
      `זה מוגבל לחודש זה בלבד`,
      `אנחנו זורקים את כל מה שנותר שלנו`,
    ],
    educational: [
      `לאחר קריאה זו, לא תשכח מעולם`,
      `זה יעזור לך לשחק בממדים חדשים`,
      `זוהי הידע שהעסקים בדרך כלל שוכרים יועץ כדי ללמוד`,
    ],
    social_proof: [
      `שאל כל אחד מהם במישרין`,
      `זה מה שקרה כשהם בחרו בנו`,
      `התצפיות שלהם משתדלות בעבורנו`,
    ],
    rtm_holiday: [
      `זה הרגע שלך להיות חלק מסיפור זה`,
      `חודש זה הוא על יצירת זיכרונות`,
      `עכשיו אנחנו חוגגים במשהו מיוחד`,
    ],
    controversial: [
      `ואנחנו לא משחקים בעמדות`,
      `רוב העולם לא יסכים, אבל הם טועים`,
      `אנחנו בחרנו לומר את המקום`,
    ],
    behind_scenes: [
      `וזו רק קצה קרח של מה שקורה`,
      `הצוות שלנו כל יום עושה זה`,
      `אנחנו שונים, ואנחנו לא מוכנים להחביא`,
    ],
    comparison: [
      `כאן איך אנחנו עומדים בעומק הניתוח`,
      `ואנחנו לא אומרים שאנחנו הטובים ביותר`,
      `אתה תוכל לראות בדיוק מדוע`,
    ],
  };

  const msgs = messages[contentType] || messages.educational;
  return seedPick(msgs, index);
}

function generateIdeaSummaryDeterministic(
  contentType: typeof CONTENT_TYPES[number],
  platforms: string[],
  index: number
): string {
  const summaries = [
    `קונטנט ממוקד ${seedPick(platforms, index)}`,
    `תוכן שמושך תשומת לב מיד`,
    `יצירה בעל ערך אמיתי`,
    `הודעה שתזכרו לכם`,
  ];
  return seedPick(summaries, index);
}

function generateGraphicTextDeterministic(
  graphicTextStyle: typeof GRAPHIC_TEXT_STYLES[number],
  businessField: string,
  index: number
): string {
  const styles: Record<typeof GRAPHIC_TEXT_STYLES[number], string[]> = {
    short_punch: [
      `הזמן שלך עכשיו.\nאל תחכה לרגע הנכון`,
      `${businessField} ברמה אחרת.\nזה מתחיל פה`,
      `עצור. תחשוב. תפעל.\nהתוצאות מדברות`,
      `מספיק לפספס.\nבוא נעשה את זה נכון`,
    ],
    question: [
      `כמה כסף אתה משאיר על השולחן?\n${businessField} חכם נראה אחרת`,
      `מה אם היית יודע את זה לפני שנה?\nעכשיו אתה יודע`,
      `למה 90% נכשלים ב${businessField}?\nהתשובה תפתיע אותך`,
    ],
    bold_claim: [
      `אנחנו לא הכי זולים.\nאנחנו הכי שווים את זה`,
      `${businessField} השתנה לנצח.\nמי שלא מתעדכן — נשאר מאחור`,
      `אין קיצורי דרך.\nיש דרך נכונה — וזו שלנו`,
    ],
    emotional: [
      `הרגע שהבנו שהכל השתנה.\nוהחלטנו לשנות גם לך`,
      `כל לקוח שלנו התחיל בדיוק כמוך.\nהיום? הם במקום אחר לגמרי`,
      `זה לא רק ${businessField}.\nזו ההשקעה הכי חכמה שתעשה`,
    ],
    statistic: [
      `97% מהלקוחות שלנו חוזרים.\nהסוד? תוצאות אמיתיות`,
      `פי 3 יותר תוצאות.\nבחצי מהזמן. בלי קסמים`,
      `1,000+ עסקים כבר שם.\nאתה עדיין בחוץ?`,
    ],
    contradiction: [
      `כולם אמרו שזה בלתי אפשרי.\nאנחנו עשינו את זה ב${businessField}`,
      `הדרך הקלה? היא בדיוק הבעיה.\nבוא נעשה את זה נכון`,
      `חשבת שאתה יודע הכל על ${businessField}?\nתחשוב שוב`,
    ],
  };

  const texts = styles[graphicTextStyle] || styles.short_punch;
  return seedPick(texts, index);
}

function generateCaptionDeterministic(title: string, platform: string, index: number): string {
  const templates = [
    `${title}\n\nאני אגיד לכם משהו שרוב האנשים לא רוצים לשמוע — אבל צריכים.\nבעולם שבו כולם עושים את אותו הדבר, ההבדל היחיד הוא איכות. ואיכות מתחילה בבחירה.\n\nאז מה הבחירה שלכם היום?\nשלחו לנו הודעה ונדבר על זה 👇\n\n#עסקים #שיווק #צמיחה`,
    `${title}\n\nלפני שנה חשבנו שהגענו לתקרה.\nהיום? אנחנו במקום אחר לגמרי — ולא בגלל מזל.\nבגלל אסטרטגיה, עקביות, ותוצאות שמדברות בעד עצמן.\n\nרוצים לדעת איך? הקישור בביו 🔗\n\n#תוצאות #צמיחהעסקית #הצלחה`,
    `${title}\n\nהנה העניין — אין קיצורי דרך.\nאבל יש דרך חכמה, ויש דרך שמבזבזת זמן.\nאנחנו בחרנו בדרך החכמה ואנחנו פה כדי לעזור גם לכם לעשות את אותו הדבר.\n\nמעניין אתכם? תכתבו לנו ״מעניין״ בתגובות 💬\n\n#טיפים #ערך #עסקיםקטנים`,
    `${title}\n\nהדבר הכי חשוב שלמדנו השנה?\nלהקשיב ללקוחות. לא רק לשמוע — להקשיב באמת.\nכל שיפור, כל מוצר חדש, כל שירות — נולד מהמילים שלכם.\n\nספרו לנו — מה הדבר הבא שהייתם רוצים? 👇\n\n#לקוחות #חדשנות #ביחד`,
  ];
  return seedPick(templates, index);
}

function generateCTADeterministic(
  contentType: typeof CONTENT_TYPES[number],
  index: number
): string {
  const ctas: Record<typeof CONTENT_TYPES[number], string[]> = {
    pain_driven: [
      `גלה את הפתרון היום`,
      `מה הצעד שלך הבא?`,
      `התחל עכשיו`,
    ],
    authority: [
      `קרא עוד מהמומחה`,
      `שיתוף ידע`,
      `בואו ללמוד`,
    ],
    storytelling: [
      `קרא את הסיפור המלא`,
      `עוד על הרעיון`,
      `זה פשוט התחלה`,
    ],
    offer_sales: [
      `קנה עכשיו בהנחה`,
      `תפס את ההצעה`,
      `בשביל אתכם בלבד`,
    ],
    educational: [
      `שמור את הטיפ הזה`,
      `למד עוד`,
      `מעכשיו`,
    ],
    social_proof: [
      `ראה למה בחרו בנו`,
      `קרא את התוצאות`,
      `פגוש את הקבוצה`,
    ],
    rtm_holiday: [
      `חגיגה איתנו`,
      `הוסף ללוח השנה`,
      `לא תפספס`,
    ],
    controversial: [
      `מה הדעה שלך?`,
      `תייג אותנו`,
      `אנחנו רוצים לשמוע`,
    ],
    behind_scenes: [
      `חקור מאחורי הקלעים`,
      `זה כל מה שקורה`,
      `כדי לראות עוד`,
    ],
    comparison: [
      `השווה בעצמך`,
      `בחן את ההבדל`,
      `סדר את הטבלה`,
    ],
  };

  const ctaList = ctas[contentType] || ctas.educational;
  return seedPick(ctaList, index);
}

function generateVisualConceptDeterministic(
  contentType: typeof CONTENT_TYPES[number],
  businessField: string,
  index: number
): string {
  const concepts: Record<typeof CONTENT_TYPES[number], string[]> = {
    pain_driven: [
      `רקע אדום כהה עם טקסטורת בטון, סמל כאב מתפוצץ בצהוב בהיר בפינה שמאל עליונה, טקסט לבן בולד בתחתית, זווית צילום ישירה, אווירה מתחרבשת ודחופה`,
      `רקע בצבע אפור-חום, דמות מוכנעת בצל מול קיר גבוה, אור חלקי מלמעלה, זווית צילום 45 מעלות, מצב רוח של אבדות`,
      `רקע בצבע בורדו כהה עם טקסטורת מתכת, מכשול בצבע שחור בקדמת התמונה, איום על הצבע הירוק, זווית צילום זוויתית, אווירה מסוכנת`,
    ],
    authority: [
      `רקע ערמוני עם ספריה חכמה בטקסטורה, סמל כתר או בול אמון בזהב בפינה ימין, טקסט מחוקק וברור בפרט גבוה, זווית צילום מהלחות עלי עיניים קטנה, אווירה בטוחה`,
      `רקע שחור עם פרטים בעננים ישרים, גרף עולה בצבע זהב, טקסט לבן בטיפוגרפיה עתיקה, זווית צילום מעט מעלה, מצב רוח מקצועי ומשביע רצון`,
      `רקע כחול כהה עם זהב מנצנץ, תוכן עתיק בספר פתוח, אור טבעי מצד שמאל, זווית צילום 30 מעלות, אווירה של חוכמה`,
    ],
    storytelling: [
      `רקע חם בצבע חום-זהב עם טקסטורת עץ עתיק, דמות בחיוך ממתין, אור שקיעה בפינה ימין, זווית צילום וימן הרגיע, מצב רוח של תקווה`,
      `רקע כחול כהה עם כוכבים, דרך צרה מואירה בנוף רחוק, דמות מהלכת קדימה, זווית צילום אופקית, אווירה של הרפתקה`,
      `רקע ירוק טבעי עם טקסטורת קנווס, עץ בעדינות בעומק, אור חם במרכז, זווית צילום פרקטיבית, מצב רוח של בהקה`,
    ],
    offer_sales: [
      `רקע בעל גרדיאנט מזהב לכסף, הנחה בטקסט גדול בצבע אדום בהיר בתוך בקבוק מתפוצץ, קופוני תולים בתחתית, זווית צילום ישרה, אווירה של עסק מתרגש`,
      `רקע אדום בהיר עם צלבים לבנים, טקסט מחיר בצבע לבן קרח בתחתית, ציין של מוגבל בזמן בשחור בפינה ימין עליונה, זווית צילום 15 מעלות מלמעלה, מצב רוח של דחיפה`,
      `רקע שחור עם זהב מנצנץ, תיבה מתנה פתוחה בתוך הלהבה זהובה, סמל הנחה גדול בלבן, זווית צילום מלמטה עלי, אווירה פרימיום`,
    ],
    educational: [
      `רקע בהיר בצבע בז', טבלה או מידע בשחור בתוך מיינציני מעוד, כוכבים קטנים לצד כל נקודה, זווית צילום ישירה, אווירה של שיעור`,
      `רקע לבן נקי עם קו פתוח בירוק, דיאגרמה מעבר לשלבים, סמל ראש בורוד בפינה, זווית צילום מעלה קלה, מצב רוח הוראה`,
      `רקע בצבע בריק כחול בהיר, טקסט בשחור פשוט וברור, איקון מידע בצבע כתום בצד, זווית צילום 20 מעלות, אווירה של ידע`,
    ],
    social_proof: [
      `רקע לבן עם טקסטורת נייר, ציטוט מודגש בשחור בתוך מלבן מוצל בורוד, דמותיים חיוכי בצד קטן, זווית צילום ישרה, אווירה של אמון`,
      `רקע בהיר ירוק עם כוכבים חמש כוכבים בזהב, תמונת פנים קטנה בטקסטורה מעל, ציטוט מחמד בתחתית, זווית צילום מתון, מצב רוח חיובי`,
      `רקע ניטרלי בתלת-מימד, דמויות מחוברות בקווים זהובים, מספר גדול בתחתית, זווית צילום מעלה קלה, אווירה של קהילה`,
    ],
    rtm_holiday: [
      `רקע בצבע חג עם דקורציות, לדוגמה עץ יפה באדום וזהב, סמל חג בירוק בפינה שמאל, טקסט כסף בתחתית, זווית צילום ישרה, אווירה חגיגית`,
      `רקע בחום עתיק עם נרות מדליקים בפינה, שיר סמל בוהה בלבן, זהב ודקורציה, זווית צילום רך, מצב רוח חם ובית`,
      `רקע צבעוני בהיר עם בלונים וקונפטי, סמל חג בתוך מעגל בצבע משופץ בתוך, טקסט בצבע בהיר בעמצע, זווית צילום מצחוקה, אווירה של חגיגה`,
    ],
    controversial: [
      `רקע שחור עם זינקים בנימה אדומה, סמל שאלה גדול בתוך מעגל אדום בתוך, טקסט לבן בתחתית בטיפוגרפיה נועזת, זווית צילום 45 מעלות, אווירה של מתח`,
      `רקע בתלת מימד עם קרע בתוכו, צדדים שונים בתוך הקרע מוצגים, טקסט שחור בסימן שאלה בלבן, זווית צילום מראה מעץ, מצב רוח של מחלוקת`,
      `רקע בעם זינק, שני חצים מנוגדים בצבע אדום וירוק, טקסט תגיד לנו בלבן בתחתית, זווית צילום מתחת, אווירה של דלילה`,
    ],
    behind_scenes: [
      `רקע בצבע חם חום-אפור עם חלקים של טקסטורה מעבודה, צוות קטן בראיה חלקית בצד, ריהוט עזה בצל, זווית צילום וחלקה, מצב רוח אמיתי`,
      `רקע בתוך סטודיו עם ציוד בטקסטורה מעמתית, אדם אחד עובד בתאורה טבעית בצד, צבעי אפור-כסף, זווית צילום מעמד צד, אווירה של עבודה`,
      `רקע בתוך חדר משרד בתאור רך, דמויות כמה מדברות בתחתית, קירות בצבע בז', זווית צילום מאחור, מצב רוח של שיתופיות`,
    ],
    comparison: [
      `רקע בצבע אפור קלסי, שתי אפשרויות בצד לצד עם בדלים בחצאים זהובים, X אדום על אחת וחיוך ירוק על אחרת, זווית צילום ישרה, אווירה של בחירה`,
      `רקע בלוח, טבלה משוואת תכנית לעומת תכנית עם מספרים, אדום לעומת ירוק, קווים מבחינה בוד, זווית צילום זו, מצב רוח ניתוח`,
      `רקע אפור עם שתי כפות במעגלים, אחת משקולות לבנה כבדה אחת וקלה, סקלה בתוך, זווית צילום מלמטה, אווירה של מאזן`,
    ],
  };

  const conceptsList = concepts[contentType] || concepts.educational;
  return seedPick(conceptsList, index);
}
