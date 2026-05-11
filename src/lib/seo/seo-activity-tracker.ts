// SEO Activity Tracker — מעקב פעילות מרכזי לכל המודולים
// כל המנועים מזינים לכאן — קישורים, תוכן, FAQ, סכמות, מטא, ועוד
// מספק תצוגה שבועית, חודשית, ויומית עם הקשר לקוח

import { SEOActionEntry, SEOActionType, ActionStatus, ActionFilters } from './seo-action-log';

// ============================================================================
// סוגי קטגוריות פעילות — Activity Categories
// ============================================================================

export type ActivityCategory =
  | 'content_optimization' | 'internal_linking' | 'metadata' | 'faq_schema'
  | 'geo_visibility' | 'technical_seo' | 'strategic' | 'conversion' | 'local_seo'
  | 'image_seo' | 'reporting' | 'monitoring';

// ============================================================================
// ממשקי פעילות — Activity Interfaces
// ============================================================================

export interface ActivityEntry extends SEOActionEntry {
  clientId?: string;
  clientName?: string;
  websiteUrl?: string;
  category: ActivityCategory;
  executedBy: 'system' | 'admin' | 'ai';
  relatedKeyword?: string;
  relatedTopic?: string;
  relatedCluster?: string;
  weekNumber?: number;
  aiVisibilityImpact?: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface WeeklySummary {
  planId: string;
  clientId?: string;
  clientName?: string;
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  totalActions: number;
  completedActions: number;
  pendingApproval: number;
  failedActions: number;
  actionsByCategory: Record<ActivityCategory, number>;
  pagesImproved: number;
  internalLinksAdded: number;
  faqsAdded: number;
  schemasAdded: number;
  metaUpdated: number;
  contentRefreshed: number;
  imagesOptimized: number;
  technicalIssuesFound: number;
  technicalIssuesFixed: number;
  topActions: ActivityEntry[];
  insights: string[];
  nextWeekFocus: string[];
}

export interface MonthlyReport {
  planId: string;
  month: string;
  totalActions: number;
  weekSummaries: WeeklySummary[];
  overallProgress: number;
  keyAchievements: string[];
  areasForImprovement: string[];
}

// ============================================================================
// מיפוי סוג פעולה לקטגוריה — Action Type to Category Mapping
// ============================================================================

const ACTION_CATEGORY_MAP: Record<SEOActionType, ActivityCategory> = {
  'internal_link_added': 'internal_linking',
  'faq_added': 'faq_schema',
  'schema_added': 'faq_schema',
  'meta_title_updated': 'metadata',
  'meta_description_updated': 'metadata',
  'content_refreshed': 'content_optimization',
  'content_section_added': 'content_optimization',
  'image_alt_updated': 'image_seo',
  'cta_added': 'conversion',
  'heading_fixed': 'technical_seo',
  'answer_block_added': 'geo_visibility',
  'local_content_added': 'local_seo',
  'broken_link_fixed': 'technical_seo',
  'slug_updated': 'technical_seo',
  'og_tags_updated': 'metadata',
  'category_updated': 'content_optimization',
  'article_published': 'content_optimization',
  'cannibalization_flagged': 'strategic',
  'technical_issue_found': 'monitoring',
  'approval_requested': 'reporting',
};

// ============================================================================
// מיפוי רמת סיכון — Risk Level Mapping
// ============================================================================

/** פעולות עם רמת סיכון גבוהה — שינויים שקשה לבטל */
const HIGH_RISK_ACTIONS: SEOActionType[] = [
  'slug_updated',
  'article_published',
];

/** פעולות עם רמת סיכון בינונית — משפיעות על SEO ישירות */
const MEDIUM_RISK_ACTIONS: SEOActionType[] = [
  'meta_title_updated',
  'meta_description_updated',
  'content_refreshed',
  'category_updated',
  'og_tags_updated',
];

// ============================================================================
// פונקציית עזר — מספר שבוע בשנה
// ============================================================================

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diffMs = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
}

// ============================================================================
// categorizeAction — מיפוי סוג פעולה לקטגוריה
// ============================================================================

export function categorizeAction(actionType: SEOActionType): ActivityCategory {
  return ACTION_CATEGORY_MAP[actionType] || 'technical_seo';
}

// ============================================================================
// enrichActivity — העשרת רשומה עם הקשר לקוח ומטא-דאטא
// ============================================================================

export function enrichActivity(
  entry: SEOActionEntry,
  clientId?: string,
  clientName?: string,
  websiteUrl?: string
): ActivityEntry {
  const category = categorizeAction(entry.actionType);

  // קביעת מי ביצע — לפי שם המודול
  let executedBy: 'system' | 'admin' | 'ai' = 'system';
  const moduleLower = entry.module.toLowerCase();
  if (moduleLower.includes('ai') || moduleLower.includes('gpt') || moduleLower.includes('claude') || moduleLower.includes('llm')) {
    executedBy = 'ai';
  } else if (moduleLower.includes('admin') || moduleLower.includes('manual') || moduleLower.includes('user')) {
    executedBy = 'admin';
  }

  // קביעת רמת סיכון
  let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'low';
  if (HIGH_RISK_ACTIONS.includes(entry.actionType)) {
    riskLevel = 'high';
  } else if (MEDIUM_RISK_ACTIONS.includes(entry.actionType)) {
    riskLevel = 'medium';
  } else if (entry.actionType === 'technical_issue_found' || entry.actionType === 'cannibalization_flagged') {
    riskLevel = 'none'; // מדווחים בלבד, לא משנים
  }

  // מספר שבוע
  const weekNumber = getWeekNumber(entry.date);

  return {
    ...entry,
    clientId,
    clientName,
    websiteUrl,
    category,
    executedBy,
    weekNumber,
    riskLevel,
  };
}

// ============================================================================
// initEmptyCategoryCounts — אתחול ספירות קטגוריות
// ============================================================================

function initEmptyCategoryCounts(): Record<ActivityCategory, number> {
  return {
    content_optimization: 0,
    internal_linking: 0,
    metadata: 0,
    faq_schema: 0,
    geo_visibility: 0,
    technical_seo: 0,
    strategic: 0,
    conversion: 0,
    local_seo: 0,
    image_seo: 0,
    reporting: 0,
    monitoring: 0,
  };
}

// ============================================================================
// getWeeklySummary — סיכום שבועי מלא
// ============================================================================

export function getWeeklySummary(
  entries: ActivityEntry[],
  planId: string,
  weekStart: string,
  weekEnd: string
): WeeklySummary {
  // סנן לפי תקופה ו-planId
  const weekEntries = entries.filter(e =>
    e.planId === planId &&
    e.date >= weekStart &&
    e.date <= weekEnd
  );

  const completed = weekEntries.filter(e => e.status === 'completed');
  const pending = weekEntries.filter(e => e.status === 'pending_approval');
  const failed = weekEntries.filter(e => e.status === 'failed');

  // ספירה לפי קטגוריה
  const actionsByCategory = initEmptyCategoryCounts();
  for (const entry of weekEntries) {
    actionsByCategory[entry.category] = (actionsByCategory[entry.category] || 0) + 1;
  }

  // ספירות ספציפיות — רק פעולות שהושלמו
  const pagesImproved = new Set(completed.filter(e => e.pageId).map(e => e.pageId)).size;
  const internalLinksAdded = completed.filter(e => e.actionType === 'internal_link_added').length;
  const faqsAdded = completed.filter(e => e.actionType === 'faq_added').length;
  const schemasAdded = completed.filter(e => e.actionType === 'schema_added').length;
  const metaUpdated = completed.filter(e =>
    e.actionType === 'meta_title_updated' || e.actionType === 'meta_description_updated'
  ).length;
  const contentRefreshed = completed.filter(e =>
    e.actionType === 'content_refreshed' || e.actionType === 'content_section_added'
  ).length;
  const imagesOptimized = completed.filter(e => e.actionType === 'image_alt_updated').length;
  const technicalIssuesFound = weekEntries.filter(e => e.actionType === 'technical_issue_found').length;
  const technicalIssuesFixed = completed.filter(e =>
    e.actionType === 'broken_link_fixed' || e.actionType === 'heading_fixed'
  ).length;

  // פעולות מובילות — לפי חשיבות
  const impactOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const topActions = [...completed]
    .sort((a, b) => (impactOrder[a.expectedImpact] ?? 3) - (impactOrder[b.expectedImpact] ?? 3))
    .slice(0, 10);

  // מספר שבוע
  const weekNumber = getWeekNumber(weekStart);

  // שם לקוח — קח מהרשומה הראשונה
  const clientId = weekEntries[0]?.clientId;
  const clientName = weekEntries[0]?.clientName;

  const summary: WeeklySummary = {
    planId,
    clientId,
    clientName,
    weekStart,
    weekEnd,
    weekNumber,
    totalActions: weekEntries.length,
    completedActions: completed.length,
    pendingApproval: pending.length,
    failedActions: failed.length,
    actionsByCategory,
    pagesImproved,
    internalLinksAdded,
    faqsAdded,
    schemasAdded,
    metaUpdated,
    contentRefreshed,
    imagesOptimized,
    technicalIssuesFound,
    technicalIssuesFixed,
    topActions,
    insights: [],
    nextWeekFocus: [],
  };

  // הוסף תובנות ופוקוס לשבוע הבא
  summary.insights = generateInsights(summary);
  summary.nextWeekFocus = generateNextWeekFocus(summary, weekEntries[0]?.day ?? 0);

  return summary;
}

// ============================================================================
// getMonthlyReport — דוח חודשי מצטבר
// ============================================================================

export function getMonthlyReport(
  entries: ActivityEntry[],
  planId: string,
  month: string // YYYY-MM
): MonthlyReport {
  // סנן פעולות לחודש הזה
  const monthEntries = entries.filter(e =>
    e.planId === planId && e.date.startsWith(month)
  );

  // בנה סיכומים שבועיים — חלק את החודש לשבועות
  const year = parseInt(month.split('-')[0]);
  const monthNum = parseInt(month.split('-')[1]) - 1;
  const firstDay = new Date(year, monthNum, 1);
  const lastDay = new Date(year, monthNum + 1, 0);

  const weekSummaries: WeeklySummary[] = [];
  let currentStart = new Date(firstDay);

  // מצא את יום ראשון הקרוב (תחילת שבוע)
  while (currentStart <= lastDay) {
    const weekEnd = new Date(currentStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    // ודא שלא חורג מהחודש
    const effectiveEnd = weekEnd > lastDay ? lastDay : weekEnd;

    const weekStartStr = currentStart.toISOString().slice(0, 10);
    const weekEndStr = effectiveEnd.toISOString().slice(0, 10);

    const weekSummary = getWeeklySummary(entries, planId, weekStartStr, weekEndStr + 'T23:59:59');
    if (weekSummary.totalActions > 0) {
      weekSummaries.push(weekSummary);
    }

    currentStart.setDate(currentStart.getDate() + 7);
  }

  // חישוב התקדמות כוללת — אחוז פעולות שהושלמו
  const totalActions = monthEntries.length;
  const completedActions = monthEntries.filter(e => e.status === 'completed').length;
  const overallProgress = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  // הישגים עיקריים
  const keyAchievements: string[] = [];
  const totalLinks = monthEntries.filter(e => e.actionType === 'internal_link_added' && e.status === 'completed').length;
  const totalFaqs = monthEntries.filter(e => e.actionType === 'faq_added' && e.status === 'completed').length;
  const totalContent = monthEntries.filter(e =>
    (e.actionType === 'content_refreshed' || e.actionType === 'content_section_added') && e.status === 'completed'
  ).length;
  const totalPages = new Set(monthEntries.filter(e => e.pageId && e.status === 'completed').map(e => e.pageId)).size;

  if (totalLinks > 0) keyAchievements.push(`נוספו ${totalLinks} קישורים פנימיים`);
  if (totalFaqs > 0) keyAchievements.push(`נוספו ${totalFaqs} בלוקי FAQ`);
  if (totalContent > 0) keyAchievements.push(`שודרגו ${totalContent} קטעי תוכן`);
  if (totalPages > 0) keyAchievements.push(`שופרו ${totalPages} דפים`);
  if (completedActions > 0) keyAchievements.push(`הושלמו ${completedActions} פעולות מתוך ${totalActions}`);

  // תחומי שיפור
  const areasForImprovement: string[] = [];
  const failedCount = monthEntries.filter(e => e.status === 'failed').length;
  const pendingCount = monthEntries.filter(e => e.status === 'pending_approval').length;

  if (failedCount > 0) areasForImprovement.push(`${failedCount} פעולות נכשלו — יש לבדוק ולתקן`);
  if (pendingCount > 0) areasForImprovement.push(`${pendingCount} פעולות ממתינות לאישור`);
  if (overallProgress < 70) areasForImprovement.push('אחוז ההשלמה מתחת ל-70% — יש להגביר קצב');

  // קטגוריות שלא כוסו
  const categoryCounts = initEmptyCategoryCounts();
  for (const entry of monthEntries) {
    categoryCounts[entry.category]++;
  }
  if (categoryCounts.internal_linking === 0) areasForImprovement.push('לא בוצעו פעולות קישורים פנימיים');
  if (categoryCounts.image_seo === 0) areasForImprovement.push('לא בוצעה אופטימיזציה לתמונות');

  return {
    planId,
    month,
    totalActions,
    weekSummaries,
    overallProgress,
    keyAchievements,
    areasForImprovement,
  };
}

// ============================================================================
// getDailySummary — תצוגת יום בודד
// ============================================================================

export function getDailySummary(
  entries: ActivityEntry[],
  date: string
): { actions: ActivityEntry[]; count: number; summary: string } {
  const datePrefix = date.slice(0, 10);
  const dayActions = entries.filter(e => e.date.startsWith(datePrefix));
  const completed = dayActions.filter(e => e.status === 'completed');

  if (dayActions.length === 0) {
    return { actions: [], count: 0, summary: 'לא בוצעו פעולות ביום זה.' };
  }

  // בנה סיכום לפי קטגוריות
  const categoryCounts = new Map<ActivityCategory, number>();
  for (const entry of completed) {
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);
  }

  const CATEGORY_LABELS_HE: Record<ActivityCategory, string> = {
    content_optimization: 'אופטימיזציית תוכן',
    internal_linking: 'קישורים פנימיים',
    metadata: 'מטא-דאטא',
    faq_schema: 'FAQ וסכמות',
    geo_visibility: 'נראות GEO',
    technical_seo: 'SEO טכני',
    strategic: 'אסטרטגיה',
    conversion: 'המרות',
    local_seo: 'SEO מקומי',
    image_seo: 'SEO תמונות',
    reporting: 'דיווח',
    monitoring: 'ניטור',
  };

  const parts = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `${count} ${CATEGORY_LABELS_HE[cat]}`);

  const pendingCount = dayActions.filter(e => e.status === 'pending_approval').length;
  let summary = `בוצעו ${completed.length} פעולות`;
  if (parts.length > 0) {
    summary += `: ${parts.join(', ')}`;
  }
  summary += '.';
  if (pendingCount > 0) {
    summary += ` ${pendingCount} ממתינות לאישור.`;
  }

  return { actions: dayActions, count: dayActions.length, summary };
}

// ============================================================================
// getClientActivities — פעילויות מסוננות ללקוח
// ============================================================================

export function getClientActivities(
  entries: ActivityEntry[],
  clientId: string,
  filters?: ActionFilters
): ActivityEntry[] {
  let result = entries.filter(e => e.clientId === clientId);

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

// ============================================================================
// generateInsights — יצירת תובנות שבועיות בעברית
// ============================================================================

export function generateInsights(summary: WeeklySummary): string[] {
  const insights: string[] = [];

  // תובנה 1: אחוז השלמה
  if (summary.totalActions > 0) {
    const completionRate = Math.round((summary.completedActions / summary.totalActions) * 100);
    if (completionRate >= 90) {
      insights.push(`שבוע מצוין — ${completionRate}% מהפעולות הושלמו בהצלחה.`);
    } else if (completionRate >= 70) {
      insights.push(`שבוע טוב — ${completionRate}% מהפעולות הושלמו. יש מקום לשיפור קל.`);
    } else {
      insights.push(`אחוז השלמה נמוך (${completionRate}%) — יש לבדוק חסמים ולשפר בשבוע הבא.`);
    }
  }

  // תובנה 2: קישורים פנימיים
  if (summary.internalLinksAdded > 0) {
    insights.push(`נוספו ${summary.internalLinksAdded} קישורים פנימיים — מחזקים את מבנה האתר ומפזרים link equity.`);
  }

  // תובנה 3: תוכן
  if (summary.contentRefreshed > 0) {
    insights.push(`${summary.contentRefreshed} קטעי תוכן רועננו — תוכן מעודכן מעדיף בדירוג גוגל ובמענה AI.`);
  }

  // תובנה 4: בעיות טכניות
  if (summary.technicalIssuesFound > 0 && summary.technicalIssuesFixed > 0) {
    const fixRate = Math.round((summary.technicalIssuesFixed / summary.technicalIssuesFound) * 100);
    insights.push(`נמצאו ${summary.technicalIssuesFound} בעיות טכניות, ${summary.technicalIssuesFixed} תוקנו (${fixRate}%).`);
  } else if (summary.technicalIssuesFound > 0) {
    insights.push(`נמצאו ${summary.technicalIssuesFound} בעיות טכניות — יש לטפל בהן בהקדם.`);
  }

  // הגבל ל-4 תובנות
  return insights.slice(0, 4);
}

// ============================================================================
// generateNextWeekFocus — פוקוס לשבוע הבא
// ============================================================================

export function generateNextWeekFocus(summary: WeeklySummary, day: number): string[] {
  const focus: string[] = [];

  // התבסס על ימים שנותרו בתוכנית (60 ימים)
  const totalDays = 60;
  const remainingDays = Math.max(0, totalDays - day);

  if (remainingDays <= 0) {
    focus.push('התוכנית הושלמה — עבור לשלב תחזוקה שוטפת.');
    return focus;
  }

  // בדוק מה חסר ותעדף
  if (summary.pendingApproval > 0) {
    focus.push(`לאשר ${summary.pendingApproval} פעולות שממתינות — חסימה מעכבת את ההתקדמות.`);
  }

  if (summary.failedActions > 0) {
    focus.push(`לטפל ב-${summary.failedActions} פעולות שנכשלו ולהריץ שוב.`);
  }

  // פוקוס לפי שלב בתוכנית
  if (day <= 15) {
    // פאזה 1 — תשתית טכנית
    if (summary.actionsByCategory.technical_seo < 3) {
      focus.push('להמשיך בתיקוני SEO טכני — headings, broken links, מבנה URL.');
    }
    if (summary.actionsByCategory.metadata < 2) {
      focus.push('לשדרג meta titles ו-descriptions לדפים מרכזיים.');
    }
  } else if (day <= 30) {
    // פאזה 2 — תוכן ומבנה
    if (summary.actionsByCategory.content_optimization < 3) {
      focus.push('להגביר רענון תוכן — לעדכן דפים עם ביצועים נמוכים.');
    }
    if (summary.actionsByCategory.internal_linking < 2) {
      focus.push('להוסיף קישורים פנימיים בין דפים קשורים.');
    }
  } else if (day <= 45) {
    // פאזה 3 — סמכות וקישורים
    focus.push('לחזק את מבנה הקישורים הפנימי ולבנות topic clusters.');
    if (summary.actionsByCategory.faq_schema < 2) {
      focus.push('להוסיף FAQ schemas לדפים מרכזיים לשיפור CTR.');
    }
  } else {
    // פאזה 4 — אופטימיזציה מתקדמת
    focus.push('אופטימיזציה מתקדמת — GEO, AI visibility, conversion optimization.');
    if (summary.actionsByCategory.image_seo < 2) {
      focus.push('לבצע אופטימיזציה לתמונות — alt tags, lazy loading, WebP.');
    }
  }

  // הגבל ל-4 פריטי פוקוס
  return focus.slice(0, 4);
}

// ============================================================================
// createActivityTracker — מערכת מעקב עם אחסון בזיכרון
// ============================================================================

export function createActivityTracker() {
  // אחסון פעילויות לפי planId
  const activitiesMap = new Map<string, ActivityEntry[]>();

  /** הוסף פעילות חדשה */
  function track(entry: ActivityEntry): ActivityEntry {
    const planEntries = activitiesMap.get(entry.planId) || [];
    planEntries.push(entry);
    activitiesMap.set(entry.planId, planEntries);
    return entry;
  }

  /** הוסף פעולה מ-SEOActionEntry עם העשרה אוטומטית */
  function trackFromAction(
    entry: SEOActionEntry,
    clientId?: string,
    clientName?: string,
    websiteUrl?: string
  ): ActivityEntry {
    const enriched = enrichActivity(entry, clientId, clientName, websiteUrl);
    return track(enriched);
  }

  /** קבל את כל הפעילויות של planId */
  function getAll(planId: string): ActivityEntry[] {
    return activitiesMap.get(planId) || [];
  }

  /** קבל את כל הפעילויות מכל התוכניות */
  function getAllEntries(): ActivityEntry[] {
    const all: ActivityEntry[] = [];
    for (const entries of activitiesMap.values()) {
      all.push(...entries);
    }
    return all;
  }

  /** סנן פעילויות */
  function filter(planId: string, filters: ActionFilters): ActivityEntry[] {
    let result = getAll(planId);

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

  /** סיכום שבועי */
  function weeklySummary(planId: string, weekStart: string, weekEnd: string): WeeklySummary {
    return getWeeklySummary(getAll(planId), planId, weekStart, weekEnd);
  }

  /** דוח חודשי */
  function monthlyReport(planId: string, month: string): MonthlyReport {
    return getMonthlyReport(getAll(planId), planId, month);
  }

  /** סיכום יומי */
  function dailySummary(date: string): { actions: ActivityEntry[]; count: number; summary: string } {
    return getDailySummary(getAllEntries(), date);
  }

  /** פעילויות לפי לקוח */
  function clientActivities(clientId: string, filters?: ActionFilters): ActivityEntry[] {
    return getClientActivities(getAllEntries(), clientId, filters);
  }

  /** ייצוא ל-JSON */
  function toJSON(): string {
    const data: Record<string, ActivityEntry[]> = {};
    for (const [key, entries] of activitiesMap.entries()) {
      data[key] = entries;
    }
    return JSON.stringify(data, null, 2);
  }

  /** ייבוא מ-JSON */
  function fromJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      activitiesMap.clear();
      for (const [key, entries] of Object.entries(data)) {
        activitiesMap.set(key, entries as ActivityEntry[]);
      }
    } catch (err) {
      console.error('[ACTIVITY-TRACKER] שגיאה בפרסור JSON:', err);
    }
  }

  /** ניקוי כל הנתונים */
  function clear(): void {
    activitiesMap.clear();
  }

  /** מספר הרשומות */
  function count(planId?: string): number {
    if (planId) {
      return (activitiesMap.get(planId) || []).length;
    }
    let total = 0;
    for (const entries of activitiesMap.values()) {
      total += entries.length;
    }
    return total;
  }

  return {
    track,
    trackFromAction,
    getAll,
    getAllEntries,
    filter,
    weeklySummary,
    monthlyReport,
    dailySummary,
    clientActivities,
    toJSON,
    fromJSON,
    clear,
    count,
  };
}
