// SEO Action Log — logging system for all automated SEO actions
// מערכת לוג פעולות SEO — תיעוד כל פעולה אוטומטית
// כל מנוע אוטומציה משתמש בלוג הזה לתעד מה בוצע, למה, ואיך לבטל

// ============================================================================
// סוגי פעולות וסטטוסים — Types
// ============================================================================

export type SEOActionType =
  | 'internal_link_added'
  | 'faq_added'
  | 'schema_added'
  | 'meta_title_updated'
  | 'meta_description_updated'
  | 'content_refreshed'
  | 'content_section_added'
  | 'image_alt_updated'
  | 'cta_added'
  | 'heading_fixed'
  | 'answer_block_added'
  | 'local_content_added'
  | 'broken_link_fixed'
  | 'slug_updated'
  | 'og_tags_updated'
  | 'category_updated'
  | 'article_published'
  | 'cannibalization_flagged'
  | 'technical_issue_found'
  | 'approval_requested';

export type ActionStatus = 'completed' | 'pending_approval' | 'failed' | 'rolled_back' | 'skipped';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface SEOActionEntry {
  id: string;
  planId: string;
  date: string;
  pageId?: number;
  pageUrl?: string;
  pageTitle?: string;
  actionType: SEOActionType;
  module: string;              // which engine performed this
  description: string;         // Hebrew description of what was done
  beforeValue?: string;
  afterValue?: string;
  seoReason: string;           // why this helps SEO
  expectedImpact: 'critical' | 'high' | 'medium' | 'low';
  status: ActionStatus;
  isReversible: boolean;
  rollbackData?: string;       // JSON of data needed to undo
  executionTimeMs?: number;
  day?: number;                // day in 60-day plan
  phase?: number;              // phase in 60-day plan
}

export interface DailyReport {
  planId: string;
  date: string;
  day: number;
  phase: number;
  actionsCompleted: number;
  actionsPendingApproval: number;
  actionsFailed: number;
  actionsSkipped: number;
  actionsByType: Record<string, number>;
  actionsByModule: Record<string, number>;
  topActions: SEOActionEntry[];
  summary: string;              // Hebrew summary
}

// ============================================================================
// סוג הפילטרים לשאילתות — Query Filters
// ============================================================================

export interface ActionFilters {
  actionType?: SEOActionType;
  status?: ActionStatus;
  module?: string;
  expectedImpact?: 'critical' | 'high' | 'medium' | 'low';
  dateFrom?: string;           // ISO date string
  dateTo?: string;             // ISO date string
  day?: number;
  phase?: number;
}

// ============================================================================
// ממשק הלוג — Action Log Interface
// ============================================================================

export interface SEOActionLog {
  /** תעד פעולה חדשה */
  log(entry: Omit<SEOActionEntry, 'id' | 'date'>): SEOActionEntry;

  /** קבל פעולות לפי planId עם פילטרים אופציונליים */
  getActions(planId: string, filters?: ActionFilters): SEOActionEntry[];

  /** קבל דוח יומי */
  getDailyReport(planId: string, date: string): DailyReport;

  /** בטל פעולה (rollback) */
  rollback(actionId: string): { success: boolean; error?: string };

  /** קבל פעולות לפי דף ספציפי */
  getActionsByPage(planId: string, pageId: number): SEOActionEntry[];

  /** קבל פעולות אחרונות */
  getRecentActions(planId: string, limit: number): SEOActionEntry[];

  /** יצור סיכום יומי בעברית */
  generateDailySummary(planId: string, date: string, day: number, phase: number): DailyReport;

  /** ייצוא ל-JSON לשמירה */
  toJSON(): string;

  /** ייבוא מ-JSON */
  fromJSON(json: string): void;

  /** כל הרשומות (לצורך דיבוג) */
  getAllEntries(): SEOActionEntry[];
}

// ============================================================================
// יצירת מזהה ייחודי — Simple ID Generator
// ============================================================================

function generateId(): string {
  // nanoid-style: timestamp + random characters
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `seo_${timestamp}_${random}`;
}

// ============================================================================
// תרגום סוגי פעולות לעברית — Hebrew Action Type Labels
// ============================================================================

const ACTION_TYPE_LABELS_HE: Record<SEOActionType, string> = {
  'internal_link_added': 'קישורים פנימיים הוספו',
  'faq_added': 'FAQ sections נוספו',
  'schema_added': 'Schema markup נוסף',
  'meta_title_updated': 'כותרות meta שודרגו',
  'meta_description_updated': 'meta descriptions שודרגו',
  'content_refreshed': 'תוכן רוענן',
  'content_section_added': 'סקציות תוכן נוספו',
  'image_alt_updated': 'alt tags לתמונות עודכנו',
  'cta_added': 'CTA נוספו',
  'heading_fixed': 'מבנה כותרות תוקן',
  'answer_block_added': 'בלוקי תשובה נוספו',
  'local_content_added': 'תוכן מקומי נוסף',
  'broken_link_fixed': 'קישורים שבורים תוקנו',
  'slug_updated': 'slug עודכן',
  'og_tags_updated': 'OG tags עודכנו',
  'category_updated': 'קטגוריה עודכנה',
  'article_published': 'מאמרים פורסמו',
  'cannibalization_flagged': 'קניבליזציה סומנה',
  'technical_issue_found': 'בעיות טכניות נמצאו',
  'approval_requested': 'אישורים נדרשו',
};

// ============================================================================
// מימוש הלוג — Implementation
// ============================================================================

/**
 * יצירת מערכת לוג פעולות SEO חדשה
 * כל הנתונים נשמרים בזיכרון עם אפשרות ייצוא/ייבוא JSON
 */
export function createActionLog(): SEOActionLog {
  let entries: SEOActionEntry[] = [];

  // ===== log =====
  function log(entry: Omit<SEOActionEntry, 'id' | 'date'>): SEOActionEntry {
    const fullEntry: SEOActionEntry = {
      ...entry,
      id: generateId(),
      date: new Date().toISOString(),
    };
    entries.push(fullEntry);
    return fullEntry;
  }

  // ===== getActions =====
  function getActions(planId: string, filters?: ActionFilters): SEOActionEntry[] {
    let result = entries.filter(e => e.planId === planId);

    if (!filters) return result;

    if (filters.actionType) {
      result = result.filter(e => e.actionType === filters.actionType);
    }
    if (filters.status) {
      result = result.filter(e => e.status === filters.status);
    }
    if (filters.module) {
      result = result.filter(e => e.module === filters.module);
    }
    if (filters.expectedImpact) {
      result = result.filter(e => e.expectedImpact === filters.expectedImpact);
    }
    if (filters.dateFrom) {
      result = result.filter(e => e.date >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      result = result.filter(e => e.date <= filters.dateTo!);
    }
    if (filters.day !== undefined) {
      result = result.filter(e => e.day === filters.day);
    }
    if (filters.phase !== undefined) {
      result = result.filter(e => e.phase === filters.phase);
    }

    return result;
  }

  // ===== getDailyReport =====
  function getDailyReport(planId: string, date: string): DailyReport {
    // סנן פעולות לפי תאריך (התאמה ליום בלבד, ללא שעה)
    const datePrefix = date.slice(0, 10); // YYYY-MM-DD
    const dayActions = entries.filter(
      e => e.planId === planId && e.date.startsWith(datePrefix)
    );

    const actionsCompleted = dayActions.filter(e => e.status === 'completed').length;
    const actionsPendingApproval = dayActions.filter(e => e.status === 'pending_approval').length;
    const actionsFailed = dayActions.filter(e => e.status === 'failed').length;
    const actionsSkipped = dayActions.filter(e => e.status === 'skipped').length;

    // ספירה לפי סוג פעולה
    const actionsByType: Record<string, number> = {};
    for (const action of dayActions) {
      actionsByType[action.actionType] = (actionsByType[action.actionType] || 0) + 1;
    }

    // ספירה לפי מודול
    const actionsByModule: Record<string, number> = {};
    for (const action of dayActions) {
      actionsByModule[action.module] = (actionsByModule[action.module] || 0) + 1;
    }

    // פעולות מובילות — לפי חשיבות
    const impactOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const topActions = [...dayActions]
      .sort((a, b) => (impactOrder[a.expectedImpact] ?? 3) - (impactOrder[b.expectedImpact] ?? 3))
      .slice(0, 10);

    // יום ופאזה — קח מהפעולה הראשונה אם קיימת
    const day = dayActions[0]?.day ?? 0;
    const phase = dayActions[0]?.phase ?? 0;

    return {
      planId,
      date: datePrefix,
      day,
      phase,
      actionsCompleted,
      actionsPendingApproval,
      actionsFailed,
      actionsSkipped,
      actionsByType,
      actionsByModule,
      topActions,
      summary: buildHebrewSummary(dayActions, actionsCompleted),
    };
  }

  // ===== rollback =====
  function rollback(actionId: string): { success: boolean; error?: string } {
    const entry = entries.find(e => e.id === actionId);
    if (!entry) {
      return { success: false, error: `פעולה ${actionId} לא נמצאה` };
    }
    if (!entry.isReversible) {
      return { success: false, error: `פעולה ${actionId} אינה הפיכה` };
    }
    if (entry.status === 'rolled_back') {
      return { success: false, error: `פעולה ${actionId} כבר בוטלה` };
    }

    // סמן כבוטלה — הביצוע בפועל הוא אחריות המנוע הקורא
    entry.status = 'rolled_back';
    return { success: true };
  }

  // ===== getActionsByPage =====
  function getActionsByPage(planId: string, pageId: number): SEOActionEntry[] {
    return entries.filter(e => e.planId === planId && e.pageId === pageId);
  }

  // ===== getRecentActions =====
  function getRecentActions(planId: string, limit: number): SEOActionEntry[] {
    return entries
      .filter(e => e.planId === planId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  // ===== generateDailySummary =====
  function generateDailySummary(
    planId: string,
    date: string,
    day: number,
    phase: number
  ): DailyReport {
    const report = getDailyReport(planId, date);
    // עדכן יום ופאזה מהפרמטרים
    report.day = day;
    report.phase = phase;
    // יצר סיכום מעודכן עם יום ופאזה
    const datePrefix = date.slice(0, 10);
    const dayActions = entries.filter(
      e => e.planId === planId && e.date.startsWith(datePrefix)
    );
    report.summary = buildHebrewSummaryWithContext(dayActions, report.actionsCompleted, day, phase);
    return report;
  }

  // ===== toJSON / fromJSON =====
  function toJSON(): string {
    return JSON.stringify(entries, null, 2);
  }

  function fromJSON(json: string): void {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        entries = parsed;
      }
    } catch (err) {
      console.error('[SEO-LOG] שגיאה בפרסור JSON:', err);
    }
  }

  // ===== getAllEntries =====
  function getAllEntries(): SEOActionEntry[] {
    return [...entries];
  }

  return {
    log,
    getActions,
    getDailyReport,
    rollback,
    getActionsByPage,
    getRecentActions,
    generateDailySummary,
    toJSON,
    fromJSON,
    getAllEntries,
  };
}

// ============================================================================
// בניית סיכום יומי בעברית — Hebrew Summary Builder
// ============================================================================

/**
 * בניית סיכום יומי בעברית
 * דוגמה: "היום בוצעו 15 פעולות: 5 קישורים פנימיים הוספו, 3 FAQ sections נוספו..."
 */
function buildHebrewSummary(actions: SEOActionEntry[], completedCount: number): string {
  if (actions.length === 0) {
    return 'לא בוצעו פעולות היום.';
  }

  // ספור לפי סוג (רק completed)
  const completedActions = actions.filter(a => a.status === 'completed');
  const typeCounts = new Map<SEOActionType, number>();
  for (const action of completedActions) {
    typeCounts.set(action.actionType, (typeCounts.get(action.actionType) || 0) + 1);
  }

  // בנה רשימת פעולות ממוינת לפי כמות
  const sortedTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
  const parts = sortedTypes.map(([type, count]) => {
    const label = ACTION_TYPE_LABELS_HE[type] || type;
    return `${count} ${label}`;
  });

  const pendingCount = actions.filter(a => a.status === 'pending_approval').length;
  const failedCount = actions.filter(a => a.status === 'failed').length;

  let summary = `היום בוצעו ${completedCount} פעולות`;
  if (parts.length > 0) {
    summary += `: ${parts.join(', ')}`;
  }
  summary += '.';

  if (pendingCount > 0) {
    summary += ` ${pendingCount} פעולות ממתינות לאישור.`;
  }
  if (failedCount > 0) {
    summary += ` ${failedCount} פעולות נכשלו.`;
  }

  return summary;
}

/**
 * סיכום יומי עם הקשר של יום ופאזה
 */
function buildHebrewSummaryWithContext(
  actions: SEOActionEntry[],
  completedCount: number,
  day: number,
  phase: number
): string {
  const baseSummary = buildHebrewSummary(actions, completedCount);

  if (day === 0 && phase === 0) return baseSummary;

  const phaseNames: Record<number, string> = {
    1: 'תשתית טכנית',
    2: 'תוכן ומבנה',
    3: 'סמכות וקישורים',
    4: 'אופטימיזציה מתקדמת',
  };

  const phaseName = phaseNames[phase] || `פאזה ${phase}`;
  return `יום ${day} (${phaseName}): ${baseSummary}`;
}
