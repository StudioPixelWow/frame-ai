// מנוע תעדוף הזדמנויות — Opportunity Priority Engine
// מתעדף פעולות SEO מכל המנועים לפי השפעה, קושי וביטחון

import { SEOActionEntry } from './seo-action-log';
import { AutomationContext } from './seo-automator';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface SEOOpportunity {
  id: string;
  source: string;              // איזה מנוע מצא את ההזדמנות
  type: string;
  pageUrl?: string;
  keyword?: string;
  description: string;
  impactScore: number;         // 0-100
  difficultyScore: number;     // 0-100 (נמוך = קל יותר)
  confidenceScore: number;     // 0-100
  seoValue: number;            // 0-100
  conversionValue: number;     // 0-100
  aiVisibilityValue: number;   // 0-100
  authorityValue: number;      // 0-100
  compositeScore: number;      // שקלול משוקלל
  recommendedAction: string;
  estimatedEffort: 'minutes' | 'hours' | 'days';
  autoExecutable: boolean;
  requiresApproval: boolean;
}

export interface PrioritizedPlan {
  opportunities: SEOOpportunity[];
  autoExecute: SEOOpportunity[];      // בטוחים לביצוע אוטומטי
  needsApproval: SEOOpportunity[];    // דורשים אישור אנושי
  topPriorities: SEOOpportunity[];    // 10 עדיפויות עליונות
  quickWins: SEOOpportunity[];        // השפעה גבוהה, מאמץ נמוך
  strategicInvestments: SEOOpportunity[]; // השפעה גבוהה, מאמץ גבוה
  summary: string;
}

// ============================================================================
// חישוב ציון משוקלל — Composite Score Calculation
// ============================================================================

/**
 * מחשב ציון משוקלל להזדמנות SEO
 * הנוסחה: (impact×0.3 + seoValue×0.2 + conversionValue×0.15 + aiVisibility×0.15 + authority×0.1 + ease×0.1) × confidence/100
 */
export function scoreOpportunity(opp: Partial<SEOOpportunity>): SEOOpportunity {
  const impact = opp.impactScore ?? 0;
  const difficulty = opp.difficultyScore ?? 50;
  const confidence = opp.confidenceScore ?? 50;
  const seoValue = opp.seoValue ?? 0;
  const conversionValue = opp.conversionValue ?? 0;
  const aiVisibilityValue = opp.aiVisibilityValue ?? 0;
  const authorityValue = opp.authorityValue ?? 0;

  const ease = 100 - difficulty; // קלות = הפוך מקושי

  const rawScore =
    impact * 0.3 +
    seoValue * 0.2 +
    conversionValue * 0.15 +
    aiVisibilityValue * 0.15 +
    authorityValue * 0.1 +
    ease * 0.1;

  const compositeScore = Math.round((rawScore * confidence) / 100);

  // סיווג רמת אישור
  const approvalLevel = classifyApprovalLevel({
    ...opp,
    compositeScore,
    impactScore: impact,
    difficultyScore: difficulty,
    confidenceScore: confidence,
    seoValue,
    conversionValue,
    aiVisibilityValue,
    authorityValue,
  } as SEOOpportunity);

  const autoExecutable = approvalLevel === 'auto_safe';
  const requiresApproval = approvalLevel === 'requires_approval';

  return {
    id: opp.id || `opp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: opp.source || 'unknown',
    type: opp.type || 'general',
    pageUrl: opp.pageUrl,
    keyword: opp.keyword,
    description: opp.description || '',
    impactScore: impact,
    difficultyScore: difficulty,
    confidenceScore: confidence,
    seoValue,
    conversionValue,
    aiVisibilityValue,
    authorityValue,
    compositeScore,
    recommendedAction: opp.recommendedAction || '',
    estimatedEffort: opp.estimatedEffort || inferEffort(difficulty),
    autoExecutable,
    requiresApproval,
  };
}

/**
 * הסקת מאמץ צפוי מציון קושי
 */
function inferEffort(difficulty: number): 'minutes' | 'hours' | 'days' {
  if (difficulty <= 30) return 'minutes';
  if (difficulty <= 70) return 'hours';
  return 'days';
}

// ============================================================================
// סיווג רמת אישור — Approval Level Classification
// ============================================================================

/** סוגי פעולות בטוחות לביצוע אוטומטי */
const AUTO_SAFE_TYPES = new Set([
  'internal_link',
  'add_faq',
  'add_schema',
  'alt_text',
  'image_alt',
  'semantic_enrichment',
  'meta_description',
  'heading_fix',
  'answer_block',
  'broken_link_fix',
  'faq_schema',
  'local_schema',
]);

/** סוגי פעולות שדורשות אישור */
const APPROVAL_REQUIRED_TYPES = new Set([
  'url_change',
  'redirect',
  'slug_change',
  'major_rewrite',
  'homepage_edit',
  'service_page_rewrite',
  'page_deletion',
  'category_restructure',
  'content_removal',
  'meta_title_homepage',
]);

/**
 * מסווג אם הזדמנות בטוחה לביצוע אוטומטי או דורשת אישור
 */
export function classifyApprovalLevel(opp: SEOOpportunity): 'auto_safe' | 'requires_approval' {
  const type = opp.type.toLowerCase();

  // בדיקה ישירה לפי סוג
  if (APPROVAL_REQUIRED_TYPES.has(type)) return 'requires_approval';
  if (AUTO_SAFE_TYPES.has(type)) return 'auto_safe';

  // בדיקות נוספות מבוססות תוכן
  const desc = opp.description.toLowerCase();

  // שינויי URL/redirect תמיד דורשים אישור
  if (desc.includes('redirect') || desc.includes('url') || desc.includes('slug')) {
    return 'requires_approval';
  }

  // עריכת עמוד ראשי/שירותים דורשת אישור
  if (desc.includes('עמוד ראשי') || desc.includes('homepage') || desc.includes('דף הבית')) {
    return 'requires_approval';
  }

  // שכתוב כבד דורש אישור
  if (desc.includes('שכתוב') || desc.includes('rewrite') || desc.includes('מחיקה')) {
    return 'requires_approval';
  }

  // ברירת מחדל: קושי גבוה = דורש אישור
  if (opp.difficultyScore > 70) return 'requires_approval';

  return 'auto_safe';
}

// ============================================================================
// תעדוף הזדמנויות — Prioritize Opportunities
// ============================================================================

/**
 * ממיין ומחלק הזדמנויות לקטגוריות פעולה
 */
export function prioritizeOpportunities(opportunities: SEOOpportunity[]): PrioritizedPlan {
  // מיון לפי ציון משוקלל — גבוה ראשון
  const sorted = [...opportunities].sort((a, b) => b.compositeScore - a.compositeScore);

  // חלוקה לקטגוריות
  const autoExecute = sorted.filter(o => o.autoExecutable);
  const needsApproval = sorted.filter(o => o.requiresApproval);
  const topPriorities = sorted.slice(0, 10);

  // Quick wins: השפעה גבוהה (>50) + קושי נמוך (<40)
  const quickWins = sorted.filter(
    o => o.impactScore > 50 && o.difficultyScore < 40
  ).slice(0, 10);

  // השקעות אסטרטגיות: השפעה גבוהה (>60) + קושי גבוה (>60)
  const strategicInvestments = sorted.filter(
    o => o.impactScore > 60 && o.difficultyScore > 60
  ).slice(0, 10);

  // סיכום בעברית
  const summary = buildSummary(sorted, autoExecute, needsApproval, quickWins);

  return {
    opportunities: sorted,
    autoExecute,
    needsApproval,
    topPriorities,
    quickWins,
    strategicInvestments,
    summary,
  };
}

/**
 * בונה סיכום טקסטואלי בעברית
 */
function buildSummary(
  all: SEOOpportunity[],
  autoExecute: SEOOpportunity[],
  needsApproval: SEOOpportunity[],
  quickWins: SEOOpportunity[]
): string {
  const avgScore = all.length > 0
    ? Math.round(all.reduce((sum, o) => sum + o.compositeScore, 0) / all.length)
    : 0;

  const parts: string[] = [
    `נמצאו ${all.length} הזדמנויות SEO (ציון ממוצע: ${avgScore}/100).`,
  ];

  if (autoExecute.length > 0) {
    parts.push(`${autoExecute.length} פעולות בטוחות לביצוע אוטומטי.`);
  }
  if (needsApproval.length > 0) {
    parts.push(`${needsApproval.length} פעולות דורשות אישור.`);
  }
  if (quickWins.length > 0) {
    parts.push(`${quickWins.length} הזדמנויות "ניצחון מהיר" — השפעה גבוהה עם מאמץ מועט.`);
  }

  if (all.length > 0) {
    parts.push(`עדיפות עליונה: ${all[0].description}`);
  }

  return parts.join(' ');
}

// ============================================================================
// בניית תוכנית מתועדפת מכל המנועים — Build Prioritized Plan
// ============================================================================

/**
 * אוסף תוצאות מכל מנועי ה-SEO ובונה תוכנית מתועדפת אחת
 */
export function buildPrioritizedPlan(
  allResults: {
    gsc?: { opportunities?: Array<{ keyword: string; position: number; impressions: number; url?: string }> };
    ga4?: { insights?: Array<{ page: string; metric: string; value: number }> };
    technical?: { issues?: Array<{ type: string; description: string; pageUrl?: string; severity?: string }> };
    authority?: { reinforcementPlan?: Array<{ pageId: number; pageUrl: string; actionType: string; description: string; impactEstimate: string; reason: string }> };
    entity?: { missingEntities?: Array<{ name: string; type: string; reason: string }>; semanticGaps?: Array<{ topic: string; gap: string; suggestedAction: string }> };
    content?: { recommendations?: Array<{ pageUrl: string; type: string; description: string; impact?: string }> };
  },
  context: AutomationContext
): PrioritizedPlan {
  const opportunities: SEOOpportunity[] = [];

  // === GSC: הזדמנויות מ-Search Console ===
  if (allResults.gsc?.opportunities) {
    for (const gscOpp of allResults.gsc.opportunities) {
      // מילות מפתח קרובות לעמוד 1 = פוטנציאל גבוה
      const nearPageOne = gscOpp.position <= 20 && gscOpp.position > 10;
      const onPageOne = gscOpp.position <= 10;

      opportunities.push(scoreOpportunity({
        source: 'gsc',
        type: nearPageOne ? 'ranking_push' : 'keyword_opportunity',
        pageUrl: gscOpp.url,
        keyword: gscOpp.keyword,
        description: onPageOne
          ? `חזק דירוג "${gscOpp.keyword}" — כרגע במקום ${Math.round(gscOpp.position)}`
          : `קדם "${gscOpp.keyword}" לעמוד 1 — כרגע במקום ${Math.round(gscOpp.position)} עם ${gscOpp.impressions} חשיפות`,
        impactScore: nearPageOne ? 80 : onPageOne ? 60 : 40,
        difficultyScore: nearPageOne ? 30 : onPageOne ? 20 : 60,
        confidenceScore: Math.min(gscOpp.impressions / 10, 90),
        seoValue: nearPageOne ? 85 : 50,
        conversionValue: 40,
        aiVisibilityValue: 30,
        authorityValue: 20,
        recommendedAction: nearPageOne
          ? `שפר תוכן ומבנה בדף שמדורג ל-"${gscOpp.keyword}" כדי לעלות לעמוד 1`
          : `אופטם את הדף ל-"${gscOpp.keyword}" — הוסף תוכן, סכמה וקישורים פנימיים`,
        estimatedEffort: nearPageOne ? 'hours' : 'days',
      }));
    }
  }

  // === Technical: בעיות טכניות ===
  if (allResults.technical?.issues) {
    for (const issue of allResults.technical.issues) {
      const severityMap: Record<string, number> = { critical: 90, high: 70, medium: 50, low: 30 };
      const impact = severityMap[issue.severity || 'medium'] || 50;

      opportunities.push(scoreOpportunity({
        source: 'technical',
        type: issue.type,
        pageUrl: issue.pageUrl,
        description: issue.description,
        impactScore: impact,
        difficultyScore: 25,
        confidenceScore: 85,
        seoValue: impact,
        conversionValue: 10,
        aiVisibilityValue: 20,
        authorityValue: 15,
        recommendedAction: `תקן: ${issue.description}`,
        estimatedEffort: 'minutes',
      }));
    }
  }

  // === Authority: חיזוק סמכות ===
  if (allResults.authority?.reinforcementPlan) {
    for (const action of allResults.authority.reinforcementPlan) {
      const impactMap: Record<string, number> = { critical: 90, high: 70, medium: 50, low: 30 };
      const impact = impactMap[action.impactEstimate] || 50;

      opportunities.push(scoreOpportunity({
        source: 'authority-engine',
        type: action.actionType,
        pageUrl: action.pageUrl,
        description: action.description,
        impactScore: impact,
        difficultyScore: action.actionType === 'add_internal_links' ? 20 : 45,
        confidenceScore: 75,
        seoValue: 60,
        conversionValue: action.actionType === 'strengthen_cta' ? 70 : 20,
        aiVisibilityValue: action.actionType === 'improve_ai_readability' ? 80 : 30,
        authorityValue: 70,
        recommendedAction: action.description,
        estimatedEffort: 'hours',
      }));
    }
  }

  // === Entity: פערים סמנטיים ===
  if (allResults.entity?.missingEntities) {
    for (const missing of allResults.entity.missingEntities) {
      opportunities.push(scoreOpportunity({
        source: 'entity-graph',
        type: 'missing_entity',
        keyword: missing.name,
        description: missing.reason,
        impactScore: 55,
        difficultyScore: 35,
        confidenceScore: 70,
        seoValue: 50,
        conversionValue: 15,
        aiVisibilityValue: 60,
        authorityValue: 45,
        recommendedAction: `הוסף אזכורים של "${missing.name}" בדפים רלוונטיים לחיזוק הגרף הסמנטי`,
        estimatedEffort: 'hours',
      }));
    }
  }

  if (allResults.entity?.semanticGaps) {
    for (const gap of allResults.entity.semanticGaps) {
      opportunities.push(scoreOpportunity({
        source: 'entity-graph',
        type: 'semantic_gap',
        keyword: gap.topic,
        description: gap.gap,
        impactScore: 50,
        difficultyScore: 40,
        confidenceScore: 65,
        seoValue: 55,
        conversionValue: 10,
        aiVisibilityValue: 65,
        authorityValue: 40,
        recommendedAction: gap.suggestedAction,
        estimatedEffort: 'hours',
      }));
    }
  }

  // === Content: המלצות תוכן ===
  if (allResults.content?.recommendations) {
    for (const rec of allResults.content.recommendations) {
      const impactMap: Record<string, number> = { critical: 90, high: 70, medium: 50, low: 30 };
      const impact = impactMap[rec.impact || 'medium'] || 50;

      opportunities.push(scoreOpportunity({
        source: 'content-engine',
        type: rec.type,
        pageUrl: rec.pageUrl,
        description: rec.description,
        impactScore: impact,
        difficultyScore: 40,
        confidenceScore: 70,
        seoValue: 55,
        conversionValue: 30,
        aiVisibilityValue: 35,
        authorityValue: 25,
        recommendedAction: rec.description,
        estimatedEffort: 'hours',
      }));
    }
  }

  return prioritizeOpportunities(opportunities);
}
