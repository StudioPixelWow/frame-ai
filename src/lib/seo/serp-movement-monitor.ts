// SERP Movement Monitor — מעקב תנועות דירוג בתוצאות החיפוש
// מזהה עליות, ירידות, תנודתיות, כניסות חדשות, ואיבודים

import type { SEOActionEntry } from './seo-action-log';
import { createActionLog } from './seo-action-log';
import type { AutomationContext } from './seo-automator';
import type { GSCData } from './gsc-intelligence-engine';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface SERPMovement {
  pageUrl: string;
  keyword: string;
  previousPosition: number | null;
  currentPosition: number | null;
  change: number;
  trend: 'rising' | 'falling' | 'stable' | 'volatile' | 'new' | 'lost';
  impressionsDelta?: number;
  clicksDelta?: number;
}

export interface SERPMonitorResult {
  movements: SERPMovement[];
  risers: SERPMovement[];
  fallers: SERPMovement[];
  volatileKeywords: SERPMovement[];
  newRankings: SERPMovement[];
  lostRankings: SERPMovement[];
  summary: string;
  actions: SEOActionEntry[];
}

// ============================================================================
// תוצאה ריקה — כשאין נתונים
// ============================================================================

function emptyResult(): SERPMonitorResult {
  return {
    movements: [],
    risers: [],
    fallers: [],
    volatileKeywords: [],
    newRankings: [],
    lostRankings: [],
    summary: 'אין נתוני GSC זמינים להשוואה. לא ניתן לעקוב אחרי תנועות דירוג.',
    actions: [],
  };
}

// ============================================================================
// סיווג תנועה — Movement Classification
// ============================================================================

/**
 * סיווג סוג התנועה בין שני מיקומים
 * prev=null → דירוג חדש, curr=null → איבוד דירוג
 */
export function classifyMovement(
  prev: number | null,
  curr: number | null
): 'rising' | 'falling' | 'stable' | 'volatile' | 'new' | 'lost' {
  // דירוג חדש — לא היה קודם
  if (prev === null && curr !== null) return 'new';

  // איבוד דירוג — היה ונעלם
  if (prev !== null && curr === null) return 'lost';

  // שניהם null — לא רלוונטי, מסווג כ-stable
  if (prev === null || curr === null) return 'stable';

  const change = prev - curr; // חיובי = עלייה (מיקום נמוך יותר = טוב יותר)

  // תנודתיות — שינוי גדול מאוד
  if (Math.abs(change) > 15) return 'volatile';

  // עלייה — שיפור של 3+ מיקומים
  if (change >= 3) return 'rising';

  // ירידה — נפילה של 3+ מיקומים
  if (change <= -3) return 'falling';

  // יציב — שינוי קטן
  return 'stable';
}

// ============================================================================
// ניתוח תנועות SERP — Main Analysis
// ============================================================================

/**
 * ניתוח תנועות דירוג — השוואה בין שתי תקופות GSC
 * אם אחד מהנתונים null או לא זמין — מחזיר תוצאה ריקה
 */
export function analyzeSERPMovements(
  currentGSC: GSCData | null,
  previousGSC: GSCData | null,
  context: AutomationContext
): SERPMonitorResult {
  // בדיקת זמינות נתונים
  if (!currentGSC?.available && !previousGSC?.available) {
    return emptyResult();
  }

  // אם יש רק נתונים נוכחיים — הכל "חדש"
  if (!previousGSC?.available && currentGSC?.available) {
    return buildFirstTimeResult(currentGSC, context);
  }

  // אם יש רק נתונים ישנים — הכל "אבוד" (מצב לא סביר, אבל מכוסה)
  if (previousGSC?.available && !currentGSC?.available) {
    return buildLostResult(previousGSC, context);
  }

  // שני המקורות זמינים — השוואה מלאה
  const movements: SERPMovement[] = [];

  // בניית מפות: query → נתונים
  const prevQueryMap = new Map<string, { position: number; impressions: number; clicks: number; page?: string }>();
  for (const q of previousGSC!.queries) {
    prevQueryMap.set(q.query, { position: q.position, impressions: q.impressions, clicks: q.clicks, page: q.page });
  }

  const currQueryMap = new Map<string, { position: number; impressions: number; clicks: number; page?: string }>();
  for (const q of currentGSC!.queries) {
    currQueryMap.set(q.query, { position: q.position, impressions: q.impressions, clicks: q.clicks, page: q.page });
  }

  // כל השאילתות הייחודיות
  const allKeywords = new Set([...prevQueryMap.keys(), ...currQueryMap.keys()]);

  for (const keyword of allKeywords) {
    const prev = prevQueryMap.get(keyword);
    const curr = currQueryMap.get(keyword);

    const prevPos = prev?.position ?? null;
    const currPos = curr?.position ?? null;
    const change = (prevPos !== null && currPos !== null) ? (prevPos - currPos) : 0;
    const trend = classifyMovement(prevPos, currPos);

    const impressionsDelta = (curr?.impressions ?? 0) - (prev?.impressions ?? 0);
    const clicksDelta = (curr?.clicks ?? 0) - (prev?.clicks ?? 0);

    movements.push({
      pageUrl: curr?.page || prev?.page || '',
      keyword,
      previousPosition: prevPos,
      currentPosition: currPos,
      change,
      trend,
      impressionsDelta,
      clicksDelta,
    });
  }

  // סיווג לקטגוריות
  const risers = movements.filter(m => m.trend === 'rising').sort((a, b) => b.change - a.change);
  const fallers = movements.filter(m => m.trend === 'falling').sort((a, b) => a.change - b.change);
  const volatileKeywords = movements.filter(m => m.trend === 'volatile');
  const newRankings = movements.filter(m => m.trend === 'new');
  const lostRankings = movements.filter(m => m.trend === 'lost');

  // פעולות מומלצות
  const actionLog = createActionLog();
  const actions = generateMovementActions(movements, context);
  for (const action of actions) {
    actionLog.log(action);
  }

  // סיכום בעברית
  const summary = buildMovementSummary(risers, fallers, volatileKeywords, newRankings, lostRankings, context);

  return {
    movements,
    risers,
    fallers,
    volatileKeywords,
    newRankings,
    lostRankings,
    summary,
    actions: actionLog.getAllEntries(),
  };
}

// ============================================================================
// יצירת פעולות — Action Generation
// ============================================================================

/**
 * יצירת פעולות SEO על בסיס תנועות דירוג
 */
export function generateMovementActions(
  movements: SERPMovement[],
  context: AutomationContext
): Omit<SEOActionEntry, 'id' | 'date'>[] {
  const actions: Omit<SEOActionEntry, 'id' | 'date'>[] = [];

  // דפים בעלייה — לנצל מומנטום
  const risers = movements.filter(m => m.trend === 'rising' && m.currentPosition !== null && m.currentPosition <= 15);
  for (const riser of risers.slice(0, 5)) {
    actions.push({
      planId: context.planId || 'serp-monitor',
      pageUrl: riser.pageUrl,
      pageTitle: riser.keyword,
      actionType: 'internal_link_added',
      module: 'serp-movement-monitor',
      description: `"${riser.keyword}" עלה ${riser.change} מיקומים למיקום ${riser.currentPosition} — לחזק עם קישורים פנימיים`,
      seoReason: `מומנטום חיובי — שיפור של ${riser.change} מיקומים. חיזוק עכשיו יכול לשמר ולהמשיך עלייה`,
      expectedImpact: riser.currentPosition! <= 5 ? 'high' : 'medium',
      status: 'pending_approval',
      isReversible: true,
    });
  }

  // דפים בירידה — אזהרה
  const fallers = movements.filter(m => m.trend === 'falling' && m.previousPosition !== null && m.previousPosition <= 10);
  for (const faller of fallers.slice(0, 5)) {
    actions.push({
      planId: context.planId || 'serp-monitor',
      pageUrl: faller.pageUrl,
      pageTitle: faller.keyword,
      actionType: 'content_refreshed',
      module: 'serp-movement-monitor',
      description: `"${faller.keyword}" ירד ${Math.abs(faller.change)} מיקומים ממיקום ${faller.previousPosition} — דורש טיפול`,
      seoReason: `ירידה בדירוג — נפילה של ${Math.abs(faller.change)} מיקומים. צריך רענון תוכן וחיזוק`,
      expectedImpact: 'high',
      status: 'pending_approval',
      isReversible: true,
    });
  }

  // דירוגים שאבדו — אזהרה קריטית
  const lost = movements.filter(m => m.trend === 'lost');
  for (const lostItem of lost.slice(0, 3)) {
    actions.push({
      planId: context.planId || 'serp-monitor',
      pageUrl: lostItem.pageUrl,
      pageTitle: lostItem.keyword,
      actionType: 'technical_issue_found',
      module: 'serp-movement-monitor',
      description: `"${lostItem.keyword}" איבד דירוג לחלוטין (היה ${lostItem.previousPosition}) — בדיקה דחופה`,
      seoReason: 'איבוד דירוג מלא — עלול להצביע על בעיה טכנית, עונש, או שינוי אלגוריתם',
      expectedImpact: 'critical',
      status: 'pending_approval',
      isReversible: false,
    });
  }

  // דירוגים חדשים — הזדמנות
  const newRankings = movements.filter(m => m.trend === 'new' && m.currentPosition !== null && m.currentPosition <= 20);
  for (const newItem of newRankings.slice(0, 3)) {
    actions.push({
      planId: context.planId || 'serp-monitor',
      pageUrl: newItem.pageUrl,
      pageTitle: newItem.keyword,
      actionType: 'content_section_added',
      module: 'serp-movement-monitor',
      description: `"${newItem.keyword}" נכנס לדירוג במיקום ${newItem.currentPosition} — לטפח`,
      seoReason: 'דירוג חדש — הזדמנות לחיזוק מהיר לפני שמתייצב',
      expectedImpact: newItem.currentPosition! <= 10 ? 'high' : 'medium',
      status: 'pending_approval',
      isReversible: true,
    });
  }

  return actions;
}

// ============================================================================
// עוזרים — Helpers
// ============================================================================

/** תוצאה עבור snapshot ראשון — הכל חדש */
function buildFirstTimeResult(data: GSCData, context: AutomationContext): SERPMonitorResult {
  const newRankings: SERPMovement[] = data.queries.map(q => ({
    pageUrl: q.page || '',
    keyword: q.query,
    previousPosition: null,
    currentPosition: q.position,
    change: 0,
    trend: 'new' as const,
    impressionsDelta: q.impressions,
    clicksDelta: q.clicks,
  }));

  return {
    movements: newRankings,
    risers: [],
    fallers: [],
    volatileKeywords: [],
    newRankings,
    lostRankings: [],
    summary: `📊 מעקב ראשון עבור ${context.businessName}: ${newRankings.length} שאילתות מדורגות זוהו. נתוני בסיס נשמרו — השוואה תהיה זמינה במעקב הבא.`,
    actions: [],
  };
}

/** תוצאה כשכל הדירוגים אבדו */
function buildLostResult(data: GSCData, context: AutomationContext): SERPMonitorResult {
  const lostRankings: SERPMovement[] = data.queries.map(q => ({
    pageUrl: q.page || '',
    keyword: q.query,
    previousPosition: q.position,
    currentPosition: null,
    change: 0,
    trend: 'lost' as const,
    impressionsDelta: -q.impressions,
    clicksDelta: -q.clicks,
  }));

  return {
    movements: lostRankings,
    risers: [],
    fallers: [],
    volatileKeywords: [],
    newRankings: [],
    lostRankings,
    summary: `⚠️ אזהרה עבור ${context.businessName}: נתוני GSC נוכחיים לא זמינים אך היו ${lostRankings.length} שאילתות מדורגות. יתכן שמדובר בבעיה זמנית בחיבור.`,
    actions: [],
  };
}

/** בניית סיכום תנועות */
function buildMovementSummary(
  risers: SERPMovement[],
  fallers: SERPMovement[],
  volatile: SERPMovement[],
  newRankings: SERPMovement[],
  lostRankings: SERPMovement[],
  context: AutomationContext
): string {
  const lines: string[] = [
    `📈 סיכום תנועות SERP עבור ${context.businessName}:`,
  ];

  if (risers.length > 0) {
    lines.push(`• ${risers.length} מילות מפתח בעלייה`);
    const topRiser = risers[0];
    lines.push(`  🔺 הגדולה: "${topRiser.keyword}" — +${topRiser.change} מיקומים (עכשיו: ${topRiser.currentPosition})`);
  }

  if (fallers.length > 0) {
    lines.push(`• ${fallers.length} מילות מפתח בירידה`);
    const topFaller = fallers[0];
    lines.push(`  🔻 הגדולה: "${topFaller.keyword}" — ${topFaller.change} מיקומים`);
  }

  if (newRankings.length > 0) {
    lines.push(`• ${newRankings.length} דירוגים חדשים`);
  }

  if (lostRankings.length > 0) {
    lines.push(`• ⚠️ ${lostRankings.length} דירוגים שאבדו — דורש בדיקה`);
  }

  if (volatile.length > 0) {
    lines.push(`• ${volatile.length} מילות מפתח תנודתיות`);
  }

  if (risers.length === 0 && fallers.length === 0 && newRankings.length === 0 && lostRankings.length === 0) {
    lines.push('• אין שינויים משמעותיים — דירוגים יציבים');
  }

  return lines.join('\n');
}
