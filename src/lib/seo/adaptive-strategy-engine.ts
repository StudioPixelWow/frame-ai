// Adaptive Strategy Engine — מנוע אסטרטגיה אדפטיבית
// הופך את תוכנית 60 היום לדינאמית על בסיס נתוני ביצועים אמיתיים
// עולה → דוחף, יורד → מחליף גישה, חדש → מנצל, תקוע → מנסה אחרת

import type { ContentInventory } from './wp-content-inventory';
import type { SEOActionEntry } from './seo-action-log';
import { createActionLog } from './seo-action-log';
import type { AutomationContext } from './seo-automator';
import type { GSCData, GSCPage } from './gsc-intelligence-engine';
import type { GA4Data } from './ga4-conversion-engine';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface PerformanceSnapshot {
  date: string;
  gscData?: GSCData;
  ga4Data?: GA4Data;
  inventoryMetrics: {
    totalPages: number;
    avgWordCount: number;
    orphanPages: number;
    pagesWithSchema: number;
    pagesWithFAQ: number;
  };
  actionsCompleted: number;
  actionsPending: number;
}

export interface StrategyAdjustment {
  type: 'boost_page' | 'reduce_priority' | 'shift_resources' | 'emergency_fix' | 'capitalize_momentum' | 'recover_decline' | 'new_opportunity';
  reason: string;
  affectedPages: string[];
  previousPriority: string;
  newPriority: string;
  recommendedActions: string[];
  confidence: number; // 0-100
}

export interface AdaptiveStrategyResult {
  adjustments: StrategyAdjustment[];
  pagesGainingMomentum: string[];
  pagesDeclining: string[];
  pagesStagnating: string[];
  newOpportunities: string[];
  shiftedPriorities: Array<{ from: string; to: string; reason: string }>;
  dailyFocusRecommendation: string;
  summary: string;
}

// ============================================================================
// תוצאה ריקה — כשאין מספיק נתונים
// ============================================================================

function emptyResult(): AdaptiveStrategyResult {
  return {
    adjustments: [],
    pagesGainingMomentum: [],
    pagesDeclining: [],
    pagesStagnating: [],
    newOpportunities: [],
    shiftedPriorities: [],
    dailyFocusRecommendation: 'אין מספיק נתונים להתאמת אסטרטגיה. ממשיכים לפי התוכנית המקורית.',
    summary: 'אין נתוני ביצועים זמינים לניתוח מגמות. מומלץ לחבר GSC/GA4 לקבלת תובנות אדפטיביות.',
  };
}

// ============================================================================
// עוזרים — Helpers
// ============================================================================

/** חילוץ נתוני דף מ-GSC snapshot */
function getGSCPageData(pageUrl: string, snapshot: PerformanceSnapshot): GSCPage | undefined {
  if (!snapshot.gscData?.available) return undefined;
  return snapshot.gscData.pages.find(p => p.page.replace(/\/$/, '') === pageUrl.replace(/\/$/, ''));
}

/** חילוץ נתוני דף מ-GA4 snapshot */
function getGA4PageData(pageUrl: string, snapshot: PerformanceSnapshot) {
  if (!snapshot.ga4Data?.available) return undefined;
  return snapshot.ga4Data.pages.find(p => p.pageUrl.replace(/\/$/, '') === pageUrl.replace(/\/$/, ''));
}

/** חישוב מיקום ממוצע של דף לאורך כל ה-snapshots */
function avgPosition(pageUrl: string, snapshots: PerformanceSnapshot[]): number | null {
  const positions: number[] = [];
  for (const snap of snapshots) {
    const page = getGSCPageData(pageUrl, snap);
    if (page) positions.push(page.position);
  }
  if (positions.length === 0) return null;
  return positions.reduce((a, b) => a + b, 0) / positions.length;
}

/** איסוף כל URLs הייחודיים מכל ה-snapshots */
function collectAllPageUrls(snapshots: PerformanceSnapshot[]): string[] {
  const urls = new Set<string>();
  for (const snap of snapshots) {
    if (snap.gscData?.available) {
      for (const page of snap.gscData.pages) {
        urls.add(page.page.replace(/\/$/, ''));
      }
    }
  }
  return Array.from(urls);
}

// ============================================================================
// חישוב מומנטום — Momentum Calculation
// ============================================================================

/**
 * חישוב מומנטום דף — ערך בין -100 ל-+100
 * חיובי = עולה, שלילי = יורד, 0 = יציב
 * משתמש בשינויי מיקום, CTR, חשיפות, וקליקים
 */
export function calculatePageMomentum(
  pageUrl: string,
  snapshots: PerformanceSnapshot[]
): number {
  if (snapshots.length < 2) return 0;

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted[sorted.length - 1];
  const older = sorted[0];

  const recentGSC = getGSCPageData(pageUrl, recent);
  const olderGSC = getGSCPageData(pageUrl, older);

  // אין נתונים — אין מומנטום
  if (!recentGSC && !olderGSC) return 0;

  // דף חדש שלא היה קיים קודם — מומנטום חיובי
  if (recentGSC && !olderGSC) return 50;

  // דף שנעלם — מומנטום שלילי
  if (!recentGSC && olderGSC) return -50;

  // שני הנתונים קיימים — חישוב
  let momentum = 0;

  // שינוי מיקום (ירידה במיקום = עלייה בדירוג = חיובי)
  const posChange = (olderGSC!.position - recentGSC!.position);
  momentum += clamp(posChange * 5, -40, 40);

  // שינוי חשיפות
  if (olderGSC!.impressions > 0) {
    const impChange = (recentGSC!.impressions - olderGSC!.impressions) / olderGSC!.impressions;
    momentum += clamp(impChange * 30, -20, 20);
  }

  // שינוי CTR
  const ctrChange = recentGSC!.ctr - olderGSC!.ctr;
  momentum += clamp(ctrChange * 10, -20, 20);

  // שינוי קליקים
  if (olderGSC!.clicks > 0) {
    const clickChange = (recentGSC!.clicks - olderGSC!.clicks) / olderGSC!.clicks;
    momentum += clamp(clickChange * 20, -20, 20);
  }

  return clamp(Math.round(momentum), -100, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// ניתוח מגמות ביצועים — Performance Trend Analysis
// ============================================================================

/**
 * ניתוח מגמות כלליות — עלייה, ירידה, סטגנציה
 */
export function analyzePerformanceTrends(
  snapshots: PerformanceSnapshot[]
): {
  overallDirection: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  avgPositionTrend: number;
  impressionsTrend: number;
  actionCompletionRate: number;
} {
  if (snapshots.length < 2) {
    return {
      overallDirection: 'insufficient_data',
      avgPositionTrend: 0,
      impressionsTrend: 0,
      actionCompletionRate: 0,
    };
  }

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted[sorted.length - 1];
  const older = sorted[0];

  // מגמת מיקום ממוצע
  let avgPositionTrend = 0;
  if (recent.gscData?.available && older.gscData?.available) {
    const recentAvgPos = recent.gscData.pages.length > 0
      ? recent.gscData.pages.reduce((s, p) => s + p.position, 0) / recent.gscData.pages.length
      : 0;
    const olderAvgPos = older.gscData.pages.length > 0
      ? older.gscData.pages.reduce((s, p) => s + p.position, 0) / older.gscData.pages.length
      : 0;
    avgPositionTrend = olderAvgPos - recentAvgPos; // חיובי = שיפור
  }

  // מגמת חשיפות
  let impressionsTrend = 0;
  if (recent.gscData?.available && older.gscData?.available) {
    const recentImps = recent.gscData.pages.reduce((s, p) => s + p.impressions, 0);
    const olderImps = older.gscData.pages.reduce((s, p) => s + p.impressions, 0);
    impressionsTrend = olderImps > 0 ? (recentImps - olderImps) / olderImps : 0;
  }

  // שיעור השלמת פעולות
  const totalActions = recent.actionsCompleted + recent.actionsPending;
  const actionCompletionRate = totalActions > 0 ? recent.actionsCompleted / totalActions : 0;

  // כיוון כללי
  let overallDirection: 'improving' | 'declining' | 'stable' = 'stable';
  if (avgPositionTrend > 1 || impressionsTrend > 0.1) overallDirection = 'improving';
  else if (avgPositionTrend < -1 || impressionsTrend < -0.1) overallDirection = 'declining';

  return { overallDirection, avgPositionTrend, impressionsTrend, actionCompletionRate };
}

// ============================================================================
// יצירת התאמות אסטרטגיה — Strategy Adjustments
// ============================================================================

/**
 * מנוע ההתאמה המרכזי — מייצר המלצות לשינוי אסטרטגיה
 */
export function generateStrategyAdjustments(
  currentSnapshot: PerformanceSnapshot,
  previousSnapshots: PerformanceSnapshot[],
  inventory: ContentInventory,
  context: AutomationContext
): AdaptiveStrategyResult {
  const allSnapshots = [...previousSnapshots, currentSnapshot];

  // בדיקה אם יש מספיק נתונים
  if (allSnapshots.length < 2 || !currentSnapshot.gscData?.available) {
    return emptyResult();
  }

  const allUrls = collectAllPageUrls(allSnapshots);
  const adjustments: StrategyAdjustment[] = [];

  const pagesGainingMomentum: string[] = [];
  const pagesDeclining: string[] = [];
  const pagesStagnating: string[] = [];
  const newOpportunities: string[] = [];
  const shiftedPriorities: Array<{ from: string; to: string; reason: string }> = [];

  // ניתוח כל דף
  for (const url of allUrls) {
    const momentum = calculatePageMomentum(url, allSnapshots);
    const currentGSC = getGSCPageData(url, currentSnapshot);
    const currentGA4 = getGA4PageData(url, currentSnapshot);

    // דף בעלייה — מומנטום חיובי
    if (momentum >= 30) {
      pagesGainingMomentum.push(url);

      // אם קרוב לעמוד 1, דוחפים חזק
      if (currentGSC && currentGSC.position >= 5 && currentGSC.position <= 15) {
        adjustments.push({
          type: 'capitalize_momentum',
          reason: `הדף ${url} בעלייה (מומנטום: +${momentum}) ובמיקום ${currentGSC.position.toFixed(1)} — הזדמנות להגיע לעמוד 1`,
          affectedPages: [url],
          previousPriority: 'medium',
          newPriority: 'critical',
          recommendedActions: [
            'הגדלת קישורים פנימיים מדפים חזקים',
            'רענון תוכן — הוספת פסקאות ו-FAQ',
            'שיפור כותרת ותיאור ל-CTR גבוה יותר',
            'הוספת Schema מתאים',
          ],
          confidence: 80,
        });
      } else if (currentGSC && currentGSC.position <= 5) {
        adjustments.push({
          type: 'boost_page',
          reason: `הדף ${url} בעמוד 1 ובעלייה — לחזק כדי לשמר`,
          affectedPages: [url],
          previousPriority: 'high',
          newPriority: 'high',
          recommendedActions: [
            'שמירת עדכניות התוכן',
            'מעקב אחר מתחרים',
            'חיזוק קישורים פנימיים',
          ],
          confidence: 75,
        });
      }
    }

    // דף בירידה — מומנטום שלילי
    else if (momentum <= -30) {
      pagesDeclining.push(url);

      // האם שווה להשקיע בהצלה?
      const hasConversions = currentGA4 && currentGA4.conversions > 0;
      const highImpressions = currentGSC && currentGSC.impressions > 500;

      if (hasConversions || highImpressions) {
        adjustments.push({
          type: 'recover_decline',
          reason: `הדף ${url} בירידה (מומנטום: ${momentum}) אך ${hasConversions ? 'מייצר המרות' : 'יש לו חשיפות גבוהות'} — שווה להציל`,
          affectedPages: [url],
          previousPriority: 'medium',
          newPriority: 'high',
          recommendedActions: [
            'ניתוח מתחרים — מה השתנה?',
            'רענון תוכן מקיף',
            'בדיקת בעיות טכניות (מהירות, mobile)',
            'בניית קישורים פנימיים חדשים',
          ],
          confidence: 70,
        });
      } else {
        adjustments.push({
          type: 'reduce_priority',
          reason: `הדף ${url} בירידה ולא מייצר ערך עסקי — מומלץ להפנות משאבים`,
          affectedPages: [url],
          previousPriority: 'medium',
          newPriority: 'low',
          recommendedActions: [
            'הפניית משאבים לדפים עם פוטנציאל גבוה יותר',
            'שיקול מיזוג עם דף חזק יותר',
          ],
          confidence: 60,
        });

        // מציע להעביר משאבים
        if (pagesGainingMomentum.length > 0) {
          shiftedPriorities.push({
            from: url,
            to: pagesGainingMomentum[0],
            reason: `${url} יורד, ${pagesGainingMomentum[0]} עולה — העברת משאבים`,
          });
        }
      }
    }

    // דף תקוע — מומנטום קרוב ל-0 עם חשיפות
    else if (Math.abs(momentum) < 10 && currentGSC && currentGSC.impressions > 200) {
      pagesStagnating.push(url);

      if (currentGSC.position >= 8 && currentGSC.position <= 20) {
        adjustments.push({
          type: 'shift_resources',
          reason: `הדף ${url} תקוע במיקום ${currentGSC.position.toFixed(1)} — צריך גישה שונה`,
          affectedPages: [url],
          previousPriority: 'medium',
          newPriority: 'medium',
          recommendedActions: [
            'ניסוי גישת תוכן שונה',
            'הוספת FAQ או קטע "שאלות ותשובות"',
            'שיפור E-E-A-T — הוספת מומחיות ומקורות',
            'בדיקת שאילתות חדשות — אולי יש זווית אחרת',
          ],
          confidence: 55,
        });
      }
    }

    // דף חדש — מומנטום 50 (ברירת מחדל לחדשים)
    if (momentum === 50) {
      newOpportunities.push(url);
      adjustments.push({
        type: 'new_opportunity',
        reason: `דף חדש ${url} נכנס לדירוג — הזדמנות לטפח`,
        affectedPages: [url],
        previousPriority: 'none',
        newPriority: 'high',
        recommendedActions: [
          'בניית קישורים פנימיים מדפים קשורים',
          'ודא Schema מתאים',
          'שיפור כותרת ותיאור',
          'הוספת תוכן נוסף אם הדף דק',
        ],
        confidence: 65,
      });
    }
  }

  // מיון התאמות לפי ביטחון
  adjustments.sort((a, b) => b.confidence - a.confidence);

  // המלצת פוקוס יומית
  const dailyFocusRecommendation = buildDailyFocus(adjustments, pagesGainingMomentum, pagesDeclining, context);

  // סיכום בעברית
  const summary = buildAdaptiveSummary(
    adjustments, pagesGainingMomentum, pagesDeclining, pagesStagnating, newOpportunities, context
  );

  return {
    adjustments,
    pagesGainingMomentum,
    pagesDeclining,
    pagesStagnating,
    newOpportunities,
    shiftedPriorities,
    dailyFocusRecommendation,
    summary,
  };
}

// ============================================================================
// בניית המלצות — Recommendations
// ============================================================================

/** המלצת פוקוס יומית */
function buildDailyFocus(
  adjustments: StrategyAdjustment[],
  rising: string[],
  declining: string[],
  context: AutomationContext
): string {
  // עדיפות 1: ניצול מומנטום
  const capitalize = adjustments.find(a => a.type === 'capitalize_momentum');
  if (capitalize) {
    return `🚀 פוקוס היום: ${capitalize.affectedPages[0]} בעלייה ליד עמוד 1 — ${capitalize.recommendedActions[0]}`;
  }

  // עדיפות 2: הצלת דף כסף
  const recover = adjustments.find(a => a.type === 'recover_decline');
  if (recover) {
    return `🔧 פוקוס היום: ${recover.affectedPages[0]} בירידה אך חשוב — ${recover.recommendedActions[0]}`;
  }

  // עדיפות 3: דפים חדשים
  const newOp = adjustments.find(a => a.type === 'new_opportunity');
  if (newOp) {
    return `✨ פוקוס היום: דף חדש ${newOp.affectedPages[0]} נכנס לדירוג — ${newOp.recommendedActions[0]}`;
  }

  // עדיפות 4: דפים תקועים
  const stagnant = adjustments.find(a => a.type === 'shift_resources');
  if (stagnant) {
    return `🔄 פוקוס היום: ${stagnant.affectedPages[0]} תקוע — לנסות גישה חדשה`;
  }

  return `📋 פוקוס היום: המשך לפי תוכנית 60 היום — ${context.targetKeywords[0] || 'אופטימיזציה כללית'}`;
}

/** בניית סיכום טקסטואלי */
function buildAdaptiveSummary(
  adjustments: StrategyAdjustment[],
  rising: string[],
  declining: string[],
  stagnating: string[],
  newOps: string[],
  context: AutomationContext
): string {
  const lines: string[] = [
    `🔄 ניתוח אדפטיבי עבור ${context.businessName}:`,
    `• ${rising.length} דפים בעלייה | ${declining.length} בירידה | ${stagnating.length} תקועים`,
    `• ${newOps.length} הזדמנויות חדשות`,
    `• ${adjustments.length} התאמות אסטרטגיה מומלצות`,
  ];

  const criticalAdjustments = adjustments.filter(
    a => a.type === 'capitalize_momentum' || a.type === 'emergency_fix'
  );
  if (criticalAdjustments.length > 0) {
    lines.push(`• ${criticalAdjustments.length} פעולות דחופות שדורשות טיפול מיידי`);
  }

  return lines.join('\n');
}

// ============================================================================
// ביצוע מלא — Execute
// ============================================================================

/**
 * ביצוע ניתוח אדפטיבי מלא
 * מקבל snapshots לאורך זמן ומייצר התאמות לאסטרטגיה
 */
export async function executeAdaptiveStrategy(
  snapshots: PerformanceSnapshot[],
  inventory: ContentInventory,
  context: AutomationContext
): Promise<AdaptiveStrategyResult> {
  if (snapshots.length === 0) {
    return emptyResult();
  }

  // מיון לפי תאריך
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const currentSnapshot = sorted[sorted.length - 1];
  const previousSnapshots = sorted.slice(0, -1);

  // אם יש רק snapshot אחד — אין מה להשוות
  if (previousSnapshots.length === 0) {
    return {
      ...emptyResult(),
      summary: 'זהו ה-snapshot הראשון. לאחר snapshot נוסף נוכל לזהות מגמות ולהתאים אסטרטגיה.',
      dailyFocusRecommendation: `📋 המשך לפי תוכנית 60 היום — ${context.targetKeywords[0] || 'אופטימיזציה כללית'}`,
    };
  }

  return generateStrategyAdjustments(currentSnapshot, previousSnapshots, inventory, context);
}
