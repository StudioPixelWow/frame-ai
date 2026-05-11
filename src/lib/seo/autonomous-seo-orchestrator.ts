// Autonomous SEO Orchestrator — תזמורן יומי אוטונומי
// מרכז הפעולה: מתאם את כל 12+ מנועי האוטומציה לביצוע יומי אחד
// כל יום בתוכנית 60 הימים עובר דרך התזמורן הזה

import { WPConnection, getPages, getPosts } from './wordpress-client';
import { AutomationContext } from './seo-automator';
import { SEOActionEntry, SEOActionType, ActionStatus } from './seo-action-log';
import { ContentInventory, buildContentInventory } from './wp-content-inventory';
import { generateWithAI } from '@/lib/ai/openai-client';

// ============================================================================
// סוגי מודולים ורמות אישור — Types
// ============================================================================

/** כל מודולי האוטומציה הזמינים */
export type AutomationModule =
  | 'technical_seo' | 'internal_linking' | 'faq_schema' | 'meta_optimization'
  | 'content_refresh' | 'topic_clusters' | 'geo_visibility' | 'image_seo'
  | 'cta_optimization' | 'local_seo' | 'cannibalization' | 'authority_reinforcement'
  | 'humanization' | 'entity_graph' | 'gsc_intelligence' | 'ga4_conversion'
  | 'serp_monitoring' | 'adaptive_strategy';

/** רמת אישור — האם הפעולה בטוחה לביצוע אוטומטי */
export type ApprovalLevel = 'auto_safe' | 'requires_approval';

// ============================================================================
// ממשקי פעולה — Action Interfaces
// ============================================================================

/** פעולה בודדת שהתזמורן מייצר לביצוע */
export interface AutonomousAction {
  id: string;
  module: AutomationModule;
  actionType: SEOActionType;
  approvalLevel: ApprovalLevel;
  pageId?: number;
  pageUrl?: string;
  pageTitle?: string;
  description: string;
  seoReason: string;
  expectedImpact: 'critical' | 'high' | 'medium' | 'low';
  isReversible: boolean;
  status: 'queued' | 'analyzing' | 'in_progress' | 'waiting_approval' | 'approved' | 'completed' | 'failed' | 'rolled_back' | 'skipped';
  beforeValue?: string;
  afterValue?: string;
  rollbackData?: string;
  createdAt: string;
  executedAt?: string;
  day?: number;
  phase?: number;
}

/** תוכנית ביצוע יומית — מה לעשות היום */
export interface DailyExecutionPlan {
  date: string;
  day: number;               // יום בתוכנית 60 יום
  phase: number;             // 1-5
  phaseName: string;
  autoActions: AutonomousAction[];
  approvalActions: AutonomousAction[];
  skippedActions: AutonomousAction[];
  priorityOrder: AutomationModule[];
}

/** תוצאת ביצוע יומי — סיכום מה קרה */
export interface DailyExecutionResult {
  planId: string;
  date: string;
  day: number;
  phase: number;
  started: string;
  completed: string;
  durationMs: number;
  actionsExecuted: number;
  actionsPendingApproval: number;
  actionsFailed: number;
  actionsSkipped: number;
  moduleResults: Record<AutomationModule, ModuleResult>;
  summary: string;           // סיכום בעברית
  nextDayFocus: string[];    // על מה להתמקד מחר
  actions: AutonomousAction[];
}

/** תוצאת מודול בודד */
export interface ModuleResult {
  module: AutomationModule;
  executed: boolean;
  actionsCount: number;
  success: boolean;
  error?: string;
  durationMs: number;
  summary: string;
}

/** הגדרות תצורה לתזמורן */
export interface OrchestratorConfig {
  maxActionsPerDay: number;           // ברירת מחדל 50
  maxPagesPerModule: number;          // ברירת מחדל 10
  dryRun: boolean;                    // אם true — לא כותב לוורדפרס
  enabledModules: AutomationModule[]; // אילו מודולים להריץ
  autoApproveLevel: ApprovalLevel;    // 'auto_safe' = רק פעולות בטוחות אוטומטית
  dailyPriority: AutomationModule[];  // סדר עדיפויות להיום
}

// ============================================================================
// כל המודולים הזמינים — All Modules
// ============================================================================

const ALL_MODULES: AutomationModule[] = [
  'technical_seo', 'internal_linking', 'faq_schema', 'meta_optimization',
  'content_refresh', 'topic_clusters', 'geo_visibility', 'image_seo',
  'cta_optimization', 'local_seo', 'cannibalization', 'authority_reinforcement',
  'humanization', 'entity_graph', 'gsc_intelligence', 'ga4_conversion',
  'serp_monitoring', 'adaptive_strategy',
];

// ============================================================================
// ברירות מחדל — Default Config
// ============================================================================

/**
 * מחזיר הגדרות ברירת מחדל לתזמורן
 * סדר העדיפויות תואם למפרט התוכנית
 */
export function getDefaultConfig(): OrchestratorConfig {
  return {
    maxActionsPerDay: 50,
    maxPagesPerModule: 10,
    dryRun: false,
    enabledModules: [...ALL_MODULES],
    autoApproveLevel: 'auto_safe',
    dailyPriority: [
      'technical_seo',           // 1. בסיס טכני — תמיד ראשון
      'internal_linking',        // 2. קישורים פנימיים — ערך SEO גבוה
      'authority_reinforcement', // 3. חיזוק סמכות — תוכן תומך
      'content_refresh',         // 4. רענון תוכן — שדרוג קיים
      'meta_optimization',       // 5. אופטימיזציית מטא
      'faq_schema',              // 6. שאלות נפוצות וסכמה
      'geo_visibility',          // 7. נראות ב-GEO/AI
      'image_seo',               // 8. SEO תמונות
      'cta_optimization',        // 9. קריאות לפעולה
      'topic_clusters',          // 10. אשכולות נושאים
      'local_seo',               // 11. SEO מקומי
      'cannibalization',         // 12. זיהוי קניבליזציה
    ],
  };
}

// ============================================================================
// שלבי התוכנית — Phase Definitions
// ============================================================================

/** מפת שלבים — 5 פאזות בתוכנית 60 יום */
interface PhaseInfo {
  phase: number;
  name: string;
  focus: string[];
}

/**
 * מחזיר את השלב הנוכחי לפי מספר היום
 * ימים 1-7: פאזה 1 — בסיס
 * ימים 8-14: פאזה 2 — מבנה
 * ימים 15-30: פאזה 3 — סמכות תוכן
 * ימים 31-45: פאזה 4 — GEO + AI
 * ימים 46-60: פאזה 5 — אופטימיזציה
 */
export function getPhaseForDay(day: number): PhaseInfo {
  if (day < 1) day = 1;
  if (day > 60) day = 60;

  if (day <= 7) {
    return {
      phase: 1,
      name: 'בסיס — Foundation',
      focus: [
        'סריקה טכנית מלאה',
        'בניית מלאי תוכן',
        'זיהוי עמודי פילאר',
        'ביקורת מטאדאטה',
        'ביקורת סכמה',
        'מיפוי גרף קישורים',
      ],
    };
  }

  if (day <= 14) {
    return {
      phase: 2,
      name: 'מבנה — Structural',
      focus: [
        'קישורים פנימיים',
        'תיקון עמודים יתומים',
        'הוספת FAQ ו-Schema',
        'ניקוי מטאדאטה',
        'הוספת CTA',
        'תיקון ALT לתמונות',
      ],
    };
  }

  if (day <= 30) {
    return {
      phase: 3,
      name: 'סמכות תוכן — Content Authority',
      focus: [
        'כתיבת מאמרים תומכים',
        'רענון תוכן חלש',
        'חיזוק אשכולות נושאים',
        'בלוקי תשובות AI',
        'עומק סמנטי',
      ],
    };
  }

  if (day <= 45) {
    return {
      phase: 4,
      name: 'GEO + נראות AI — AI Visibility',
      focus: [
        'קריאות AI',
        'מבני תשובות',
        'הגדרות ישויות',
        'SEO מקומי',
        'סימני אמון',
        'נתונים מובנים',
      ],
    };
  }

  // ימים 46-60
  return {
    phase: 5,
    name: 'אופטימיזציה — Optimization',
    focus: [
      'רענון לפי ביצועים',
      'מטאדאטה CTR',
      'זיהוי קניבליזציה',
      'עמודים בעלי פוטנציאל גבוה',
      'המרות',
      'דוח סופי',
    ],
  };
}

// ============================================================================
// מודולים לפי שלב — Modules Per Phase
// ============================================================================

/**
 * אילו מודולים פעילים בכל שלב
 * technical_seo פעיל תמיד — כל פאזה מוסיפה מודולים רלוונטיים
 */
export function getModulesForPhase(phase: number): AutomationModule[] {
  // מודולים בסיסיים — תמיד פעילים
  const base: AutomationModule[] = ['technical_seo'];

  switch (phase) {
    case 1:
      // פאזה 1 — בסיס: סריקה, מלאי, זיהוי מבנה
      return [
        ...base,
        'meta_optimization',
        'image_seo',
        'entity_graph',
        'gsc_intelligence',
      ];

    case 2:
      // פאזה 2 — מבנה: קישורים, סכמה, CTA, תיקונים
      return [
        ...base,
        'internal_linking',
        'faq_schema',
        'meta_optimization',
        'image_seo',
        'cta_optimization',
      ];

    case 3:
      // פאזה 3 — סמכות תוכן: מאמרים, רענון, אשכולות
      return [
        ...base,
        'internal_linking',
        'authority_reinforcement',
        'content_refresh',
        'topic_clusters',
        'faq_schema',
        'humanization',
        'entity_graph',
      ];

    case 4:
      // פאזה 4 — GEO + AI: נראות, מקומי, אמון
      return [
        ...base,
        'geo_visibility',
        'local_seo',
        'humanization',
        'entity_graph',
        'faq_schema',
        'authority_reinforcement',
        'adaptive_strategy',
      ];

    case 5:
      // פאזה 5 — אופטימיזציה: ביצועים, CTR, קניבליזציה
      return [
        ...base,
        'content_refresh',
        'meta_optimization',
        'cannibalization',
        'gsc_intelligence',
        'ga4_conversion',
        'serp_monitoring',
        'adaptive_strategy',
        'internal_linking',
      ];

    default:
      return base;
  }
}

// ============================================================================
// סיווג רמת אישור — Approval Classification
// ============================================================================

/** רשימת פעולות בטוחות — ביצוע אוטומטי */
const AUTO_SAFE_ACTIONS: SEOActionType[] = [
  'internal_link_added',
  'faq_added',
  'schema_added',
  'meta_title_updated',
  'meta_description_updated',
  'image_alt_updated',
  'cta_added',
  'answer_block_added',
  'heading_fixed',
  'content_section_added',
  'broken_link_fixed',
  'og_tags_updated',
  'category_updated',
];

/** רשימת פעולות שדורשות אישור ידני */
const REQUIRES_APPROVAL_ACTIONS: SEOActionType[] = [
  'slug_updated',
  'content_refreshed',
  'article_published',
  'cannibalization_flagged',
  'local_content_added',
];

/** דפים רגישים — תמיד דורשים אישור */
const SENSITIVE_PAGE_PATTERNS = [
  /^\/?$/,                 // דף הבית
  /\/contact/i,            // צור קשר
  /\/about/i,              // אודות
  /\/services?\/?$/i,      // שירותים
  /\/pricing/i,            // תמחור
  /\/legal/i,              // משפטי
  /\/terms/i,              // תנאי שימוש
  /\/privacy/i,            // מדיניות פרטיות
  /\/medical/i,            // רפואי
  /\/health/i,             // בריאות
  /\/finance/i,            // פיננסי
];

/**
 * מסווג האם פעולה מסוימת בטוחה לביצוע אוטומטי
 * לוקח בחשבון: סוג הפעולה, סוג הדף, היקף השינוי
 */
export function classifyApproval(action: Partial<AutonomousAction>): ApprovalLevel {
  // בדיקת דף רגיש — תמיד דורש אישור
  if (action.pageUrl) {
    const url = action.pageUrl.toLowerCase();
    for (const pattern of SENSITIVE_PAGE_PATTERNS) {
      if (pattern.test(url)) {
        return 'requires_approval';
      }
    }
  }

  // בדיקת דף הבית לפי כותרת
  if (action.pageTitle) {
    const title = action.pageTitle.toLowerCase();
    if (title === 'home' || title === 'homepage' || title === 'דף הבית' || title === 'ראשי') {
      return 'requires_approval';
    }
  }

  // בדיקת סוג פעולה — slug/redirect תמיד דורשים אישור
  if (action.actionType === 'slug_updated') {
    return 'requires_approval';
  }

  // רענון תוכן גדול — דורש אישור
  if (action.actionType === 'content_refreshed') {
    return 'requires_approval';
  }

  // פרסום מאמר חדש — דורש אישור
  if (action.actionType === 'article_published') {
    return 'requires_approval';
  }

  // קניבליזציה — רק סימון, דורש אישור לפעולה
  if (action.actionType === 'cannibalization_flagged') {
    return 'requires_approval';
  }

  // תוכן מקומי בכמות גדולה — דורש אישור
  if (action.actionType === 'local_content_added') {
    return 'requires_approval';
  }

  // אם הפעולה לא הפיכה — דורש אישור
  if (action.isReversible === false) {
    return 'requires_approval';
  }

  // פעולות בטוחות — ביצוע אוטומטי
  if (action.actionType && AUTO_SAFE_ACTIONS.includes(action.actionType)) {
    return 'auto_safe';
  }

  // ברירת מחדל — דורש אישור (גישה שמרנית)
  return 'requires_approval';
}

// ============================================================================
// מזהה ייחודי — ID Generator
// ============================================================================

/** יצירת מזהה ייחודי לפעולה */
function generateActionId(module: AutomationModule, day: number): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${module}_d${day}_${timestamp}_${random}`;
}

// ============================================================================
// בניית תוכנית ביצוע יומית — Build Daily Plan
// ============================================================================

/**
 * בונה תוכנית ביצוע יומית — מגדיר מה לעשות, בלי לבצע
 * שלבים:
 * 1. קובע פאזה ושלב
 * 2. בוחר מודולים רלוונטיים לפאזה
 * 3. מייצר פעולות לכל מודול לפי מלאי התוכן
 * 4. מסווג כל פעולה (אוטומטי / דורש אישור)
 * 5. ממיין לפי עדיפות ומחזיר תוכנית
 */
export function buildDailyExecutionPlan(
  day: number,
  inventory: ContentInventory,
  context: AutomationContext,
  config?: Partial<OrchestratorConfig>,
): DailyExecutionPlan {
  const fullConfig = { ...getDefaultConfig(), ...config };
  const phaseInfo = getPhaseForDay(day);
  const phaseModules = getModulesForPhase(phaseInfo.phase);

  // סינון מודולים — רק מודולים שמופעלים וגם רלוונטיים לפאזה
  const activeModules = fullConfig.dailyPriority.filter(
    (m) => phaseModules.includes(m) && fullConfig.enabledModules.includes(m),
  );

  const allActions: AutonomousAction[] = [];

  // ייצור פעולות לכל מודול פעיל
  for (const mod of activeModules) {
    const moduleActions = generateModuleActions(
      mod,
      day,
      phaseInfo.phase,
      inventory,
      context,
      fullConfig,
    );
    allActions.push(...moduleActions);
  }

  // הגבלת מספר פעולות יומי
  const limitedActions = allActions.slice(0, fullConfig.maxActionsPerDay);

  // סיווג: אוטומטי / דורש אישור / דלג
  const autoActions: AutonomousAction[] = [];
  const approvalActions: AutonomousAction[] = [];
  const skippedActions: AutonomousAction[] = [];

  for (const action of limitedActions) {
    action.approvalLevel = classifyApproval(action);

    if (action.approvalLevel === 'auto_safe') {
      action.status = 'queued';
      autoActions.push(action);
    } else {
      action.status = 'waiting_approval';
      approvalActions.push(action);
    }
  }

  // פעולות שנחתכו מעבר למגבלה — דילוג
  for (const action of allActions.slice(fullConfig.maxActionsPerDay)) {
    action.status = 'skipped';
    skippedActions.push(action);
  }

  return {
    date: new Date().toISOString().split('T')[0],
    day,
    phase: phaseInfo.phase,
    phaseName: phaseInfo.name,
    autoActions,
    approvalActions,
    skippedActions,
    priorityOrder: activeModules,
  };
}

// ============================================================================
// ייצור פעולות למודול — Module Action Generator
// ============================================================================

/**
 * מייצר פעולות מתוכננות למודול ספציפי לפי מלאי התוכן
 * כל מודול בודק מה חסר ומייצר פעולות בהתאם
 */
function generateModuleActions(
  module: AutomationModule,
  day: number,
  phase: number,
  inventory: ContentInventory,
  context: AutomationContext,
  config: OrchestratorConfig,
): AutonomousAction[] {
  const actions: AutonomousAction[] = [];
  const maxPages = config.maxPagesPerModule;

  switch (module) {
    // ──────────────────────────────────────────────────
    // SEO טכני — בדיקות תשתית
    // ──────────────────────────────────────────────────
    case 'technical_seo': {
      // בדיקת דפים עם בעיות כותרות
      const headingIssues = inventory.items.filter(
        (item) => item.h1Count !== 1 || item.h2Count === 0,
      );
      for (const item of headingIssues.slice(0, maxPages)) {
        actions.push(createAction(module, day, phase, {
          actionType: 'heading_fixed',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `תיקון מבנה כותרות: ${item.h1Count} H1, ${item.h2Count} H2`,
          seoReason: 'מבנה כותרות תקין חיוני לקריאות מנועי חיפוש ו-AI',
          expectedImpact: 'high',
          isReversible: true,
        }));
      }

      // בדיקת דפים ללא סכמה
      for (const item of inventory.pagesWithoutSchema.slice(0, maxPages)) {
        actions.push(createAction(module, day, phase, {
          actionType: 'technical_issue_found',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `דף ללא Schema markup — נדרש להוסיף סכמה מתאימה`,
          seoReason: 'סכמה עוזרת לגוגל להבין את סוג התוכן ולהציג Rich Results',
          expectedImpact: 'medium',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // קישורים פנימיים — חיבור דפים
    // ──────────────────────────────────────────────────
    case 'internal_linking': {
      // תיקון דפים יתומים — אין קישורים נכנסים
      for (const item of inventory.orphanPages.slice(0, maxPages)) {
        actions.push(createAction(module, day, phase, {
          actionType: 'internal_link_added',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `הוספת קישורים פנימיים לדף יתום — אין קישורים נכנסים`,
          seoReason: 'דפים יתומים לא מקבלים Link Equity ולא מתגלים על ידי גוגל',
          expectedImpact: 'high',
          isReversible: true,
        }));
      }

      // תיקון דפים מבוי סתום — אין קישורים יוצאים
      for (const item of inventory.deadEndPages.slice(0, maxPages)) {
        actions.push(createAction(module, day, phase, {
          actionType: 'internal_link_added',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `הוספת קישורים פנימיים יוצאים — דף מבוי סתום`,
          seoReason: 'דפים ללא קישורים יוצאים עוצרים את זרימת ה-PageRank',
          expectedImpact: 'medium',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // FAQ ו-Schema
    // ──────────────────────────────────────────────────
    case 'faq_schema': {
      for (const item of inventory.pagesWithoutFAQ.slice(0, maxPages)) {
        actions.push(createAction(module, day, phase, {
          actionType: 'faq_added',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `הוספת בלוק שאלות נפוצות עם FAQPage Schema`,
          seoReason: 'FAQ מגביר סיכוי ל-Rich Results ומרחיב את שטח ה-SERP',
          expectedImpact: 'medium',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // אופטימיזציית מטא
    // ──────────────────────────────────────────────────
    case 'meta_optimization': {
      // כותרות כפולות
      for (const [title, items] of inventory.duplicateMetaTitles) {
        if (items.length < 2) continue;
        for (const item of items.slice(0, maxPages)) {
          actions.push(createAction(module, day, phase, {
            actionType: 'meta_title_updated',
            pageId: item.id,
            pageUrl: item.url,
            pageTitle: item.title,
            description: `תיקון כותרת מטא כפולה — "${title}" משותפת ל-${items.length} דפים`,
            seoReason: 'כותרות מטא כפולות מבלבלות את גוגל ופוגעות ב-CTR',
            expectedImpact: 'high',
            isReversible: true,
            beforeValue: title,
          }));
        }
      }

      // תיאורי מטא כפולים
      for (const [desc, items] of inventory.duplicateMetaDescriptions) {
        if (items.length < 2) continue;
        for (const item of items.slice(0, maxPages)) {
          actions.push(createAction(module, day, phase, {
            actionType: 'meta_description_updated',
            pageId: item.id,
            pageUrl: item.url,
            pageTitle: item.title,
            description: `תיקון תיאור מטא כפול — משותף ל-${items.length} דפים`,
            seoReason: 'תיאורי מטא כפולים פוגעים ב-CTR ומבלבלים מנועי חיפוש',
            expectedImpact: 'medium',
            isReversible: true,
          }));
        }
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // רענון תוכן
    // ──────────────────────────────────────────────────
    case 'content_refresh': {
      // דפים עם תוכן דל — פחות מ-300 מילים
      for (const item of inventory.thinContentPages.slice(0, maxPages)) {
        actions.push(createAction(module, day, phase, {
          actionType: 'content_refreshed',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `הרחבת תוכן דל — ${item.wordCount} מילים בלבד`,
          seoReason: 'תוכן דל (מתחת 300 מילים) נחשב לאיכות נמוכה בעיני גוגל',
          expectedImpact: 'high',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // אשכולות נושאים
    // ──────────────────────────────────────────────────
    case 'topic_clusters': {
      // זיהוי דפים שיכולים להוות מרכז אשכול
      const pillarCandidates = inventory.pages.filter(
        (p) => p.wordCount >= 800 && p.h2Count >= 3,
      );
      for (const item of pillarCandidates.slice(0, Math.min(3, maxPages))) {
        actions.push(createAction(module, day, phase, {
          actionType: 'internal_link_added',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `חיזוק אשכול נושא סביב דף פילאר — "${item.title}"`,
          seoReason: 'אשכולות נושאים מחזקים Topical Authority בעיני גוגל',
          expectedImpact: 'high',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // נראות GEO / AI
    // ──────────────────────────────────────────────────
    case 'geo_visibility': {
      // דפים ללא בלוק תשובה מובנה — חשוב ל-AI Search
      const pagesNeedingAnswerBlocks = inventory.pages.filter(
        (p) => p.wordCount >= 200 && !p.hasFAQ,
      );
      for (const item of pagesNeedingAnswerBlocks.slice(0, maxPages)) {
        actions.push(createAction(module, day, phase, {
          actionType: 'answer_block_added',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `הוספת בלוק תשובה מובנה לנראות AI — ChatGPT, Gemini, Perplexity`,
          seoReason: 'בלוקי תשובה מובנים מגבירים סיכוי לציטוט ב-AI Search',
          expectedImpact: 'high',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // SEO תמונות
    // ──────────────────────────────────────────────────
    case 'image_seo': {
      // תמונות ללא ALT text — מקובצות לפי דף
      const pagesWithMissingAlt = inventory.items.filter(
        (item) => item.images.some((img) => !img.hasAlt),
      );
      for (const item of pagesWithMissingAlt.slice(0, maxPages)) {
        const missingCount = item.images.filter((img) => !img.hasAlt).length;
        actions.push(createAction(module, day, phase, {
          actionType: 'image_alt_updated',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `הוספת ALT text ל-${missingCount} תמונות בדף`,
          seoReason: 'ALT text מאפשר לגוגל להבין תמונות ומשפר נגישות',
          expectedImpact: 'medium',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // אופטימיזציית CTA
    // ──────────────────────────────────────────────────
    case 'cta_optimization': {
      for (const item of inventory.pagesWithoutCTA.slice(0, maxPages)) {
        actions.push(createAction(module, day, phase, {
          actionType: 'cta_added',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `הוספת קריאה לפעולה (CTA) — דף ללא CTA כרגע`,
          seoReason: 'CTA מגביר שיעור המרה ומאותת לגוגל על דף שימושי',
          expectedImpact: 'medium',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // SEO מקומי
    // ──────────────────────────────────────────────────
    case 'local_seo': {
      // הוספת סכמת LocalBusiness לדפים רלוונטיים
      const pagesWithoutLocalSchema = inventory.pages.filter(
        (p) => !p.schemaTypes.includes('LocalBusiness'),
      );
      for (const item of pagesWithoutLocalSchema.slice(0, Math.min(5, maxPages))) {
        actions.push(createAction(module, day, phase, {
          actionType: 'schema_added',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `הוספת LocalBusiness Schema — חיזוק נראות מקומית`,
          seoReason: 'סכמת LocalBusiness חיונית לדירוג בחיפוש מקומי',
          expectedImpact: 'medium',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // זיהוי קניבליזציה
    // ──────────────────────────────────────────────────
    case 'cannibalization': {
      // כותרות מטא כפולות — סימן לקניבליזציה אפשרית
      for (const [title, items] of inventory.duplicateMetaTitles) {
        if (items.length < 2) continue;
        actions.push(createAction(module, day, phase, {
          actionType: 'cannibalization_flagged',
          description: `זוהתה קניבליזציה פוטנציאלית: ${items.length} דפים עם כותרת דומה — "${title}"`,
          seoReason: 'קניבליזציה גורמת לגוגל להתלבט בין דפים ופוגעת בדירוג שניהם',
          expectedImpact: 'high',
          isReversible: false,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // חיזוק סמכות — מאמרים תומכים
    // ──────────────────────────────────────────────────
    case 'authority_reinforcement': {
      // ייצור פעולות ליצירת תוכן תומך לדפי פילאר
      const pillarPages = inventory.pages.filter(
        (p) => p.type === 'page' && p.wordCount >= 500,
      );
      for (const item of pillarPages.slice(0, Math.min(3, maxPages))) {
        actions.push(createAction(module, day, phase, {
          actionType: 'article_published',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `יצירת מאמר תומך לחיזוק סמכות הדף — "${item.title}"`,
          seoReason: 'מאמרים תומכים מחזקים Topical Authority ו-E-E-A-T',
          expectedImpact: 'high',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // האנשה — Humanization
    // ──────────────────────────────────────────────────
    case 'humanization': {
      // דפים שנראים "רובוטיים" — תוכן AI ללא מגע אנושי
      const roboticPages = inventory.items.filter(
        (item) => item.wordCount >= 300 && item.h2Count >= 2,
      );
      for (const item of roboticPages.slice(0, Math.min(5, maxPages))) {
        actions.push(createAction(module, day, phase, {
          actionType: 'content_section_added',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `שיפור האנשה — הוספת שפה טבעית, דוגמאות, ושיח ישיר`,
          seoReason: 'גוגל מעדיף תוכן אנושי ואותנטי — E-E-A-T Experience',
          expectedImpact: 'medium',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // גרף ישויות סמנטי
    // ──────────────────────────────────────────────────
    case 'entity_graph': {
      // דפים ראשיים ללא הגדרות ישויות מפורשות
      const pagesNeedingEntities = inventory.pages.filter(
        (p) => p.wordCount >= 400 && !p.schemaTypes.includes('Article'),
      );
      for (const item of pagesNeedingEntities.slice(0, Math.min(5, maxPages))) {
        actions.push(createAction(module, day, phase, {
          actionType: 'schema_added',
          pageId: item.id,
          pageUrl: item.url,
          pageTitle: item.title,
          description: `הוספת Article Schema עם הגדרות ישויות סמנטיות`,
          seoReason: 'ישויות מסייעות לגוגל להבין את ה-Knowledge Graph של האתר',
          expectedImpact: 'medium',
          isReversible: true,
        }));
      }
      break;
    }

    // ──────────────────────────────────────────────────
    // GSC Intelligence — נתוני Search Console
    // ──────────────────────────────────────────────────
    case 'gsc_intelligence': {
      // פעולות GSC הן לרוב ניתוחיות — מייצרות תובנות לפעולה
      actions.push(createAction(module, day, phase, {
        actionType: 'technical_issue_found',
        description: `ניתוח ביצועי GSC — זיהוי הזדמנויות CTR ודירוג`,
        seoReason: 'נתוני GSC חושפים הזדמנויות לשיפור CTR ודירוג מהיר',
        expectedImpact: 'high',
        isReversible: true,
      }));
      break;
    }

    // ──────────────────────────────────────────────────
    // GA4 Conversion — ניתוח המרות
    // ──────────────────────────────────────────────────
    case 'ga4_conversion': {
      actions.push(createAction(module, day, phase, {
        actionType: 'technical_issue_found',
        description: `ניתוח המרות GA4 — זיהוי דפים עם פוטנציאל המרה גבוה`,
        seoReason: 'שיפור דפים עם תנועה גבוהה אך המרה נמוכה',
        expectedImpact: 'high',
        isReversible: true,
      }));
      break;
    }

    // ──────────────────────────────────────────────────
    // ניטור תנועות SERP
    // ──────────────────────────────────────────────────
    case 'serp_monitoring': {
      actions.push(createAction(module, day, phase, {
        actionType: 'technical_issue_found',
        description: `ניטור תנועות SERP — זיהוי ירידות ועליות בדירוג`,
        seoReason: 'זיהוי מהיר של ירידות מאפשר תגובה לפני שהנזק מצטבר',
        expectedImpact: 'medium',
        isReversible: true,
      }));
      break;
    }

    // ──────────────────────────────────────────────────
    // אסטרטגיה אדפטיבית
    // ──────────────────────────────────────────────────
    case 'adaptive_strategy': {
      actions.push(createAction(module, day, phase, {
        actionType: 'technical_issue_found',
        description: `עדכון אסטרטגיה אדפטיבית — בדיקת ביצועים והתאמת תוכנית`,
        seoReason: 'התאמת אסטרטגיה לפי ביצועים בפועל מגבירה יעילות',
        expectedImpact: 'medium',
        isReversible: true,
      }));
      break;
    }
  }

  return actions;
}

// ============================================================================
// יצירת אובייקט פעולה — Action Factory
// ============================================================================

/** יוצר אובייקט פעולה עם ברירות מחדל */
function createAction(
  module: AutomationModule,
  day: number,
  phase: number,
  partial: Partial<AutonomousAction>,
): AutonomousAction {
  return {
    id: generateActionId(module, day),
    module,
    actionType: partial.actionType || 'technical_issue_found',
    approvalLevel: 'auto_safe', // ייקבע מאוחר יותר
    pageId: partial.pageId,
    pageUrl: partial.pageUrl,
    pageTitle: partial.pageTitle,
    description: partial.description || '',
    seoReason: partial.seoReason || '',
    expectedImpact: partial.expectedImpact || 'medium',
    isReversible: partial.isReversible ?? true,
    status: 'queued',
    beforeValue: partial.beforeValue,
    afterValue: partial.afterValue,
    rollbackData: partial.rollbackData,
    createdAt: new Date().toISOString(),
    day,
    phase,
  };
}

// ============================================================================
// ביצוע מודול בודד — Execute Single Module
// ============================================================================

/**
 * שולח ומפעיל מודול בודד — dispatcher למנועי האוטומציה
 * כל מודול נטען דינמית כדי למנוע תלות מעגלית
 * שגיאות נתפסות ומתועדות — לא עוצרות את שאר הביצוע
 */
export async function executeModule(
  module: AutomationModule,
  inventory: ContentInventory,
  connection: WPConnection,
  context: AutomationContext,
  config: OrchestratorConfig,
): Promise<ModuleResult> {
  const startTime = Date.now();

  try {
    switch (module) {
      // ─── SEO טכני ───
      case 'technical_seo': {
        const { runTechnicalSeoScan } = await import('./technical-seo-monitor');
        const result = await runTechnicalSeoScan(connection);
        return buildModuleResult(module, startTime, true, result?.issues?.length ?? 0, 'סריקה טכנית הושלמה');
      }

      // ─── קישורים פנימיים ───
      case 'internal_linking': {
        const { runInternalLinkingPass } = await import('./internal-linking-engine');
        const result = await runInternalLinkingPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.linksAdded ?? 0, 'סבב קישורים פנימיים הושלם');
      }

      // ─── FAQ ו-Schema ───
      case 'faq_schema': {
        const { runFaqSchemaPass } = await import('./faq-schema-engine');
        const result = await runFaqSchemaPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.faqsAdded ?? 0, 'הוספת FAQ ו-Schema הושלמה');
      }

      // ─── אופטימיזציית מטא ───
      case 'meta_optimization': {
        const { runMetaOptimizationPass } = await import('./meta-optimization-engine');
        const result = await runMetaOptimizationPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.metaUpdated ?? 0, 'אופטימיזציית מטא הושלמה');
      }

      // ─── רענון תוכן ───
      case 'content_refresh': {
        const { runContentRefreshPass } = await import('./content-refresh-engine');
        const result = await runContentRefreshPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.pagesRefreshed ?? 0, 'רענון תוכן הושלם');
      }

      // ─── אשכולות נושאים ───
      case 'topic_clusters': {
        const { runTopicClusterPass } = await import('./topic-cluster-builder');
        const result = await runTopicClusterPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.clustersBuilt ?? 0, 'בניית אשכולות הושלמה');
      }

      // ─── נראות GEO / AI ───
      case 'geo_visibility': {
        const { runGeoVisibilityPass } = await import('./geo-visibility-optimizer');
        const result = await runGeoVisibilityPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.blocksAdded ?? 0, 'שיפור נראות GEO הושלם');
      }

      // ─── SEO תמונות ───
      case 'image_seo': {
        const { runImageSeoPass } = await import('./image-seo-engine');
        const result = await runImageSeoPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.imagesUpdated ?? 0, 'עדכון SEO תמונות הושלם');
      }

      // ─── CTA ───
      case 'cta_optimization': {
        const { runCtaOptimizationPass } = await import('./cta-optimizer');
        const result = await runCtaOptimizationPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.ctasAdded ?? 0, 'אופטימיזציית CTA הושלמה');
      }

      // ─── SEO מקומי ───
      case 'local_seo': {
        const { runLocalSeoPass } = await import('./local-seo-engine');
        const result = await runLocalSeoPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.localPagesUpdated ?? 0, 'עדכון SEO מקומי הושלם');
      }

      // ─── קניבליזציה ───
      case 'cannibalization': {
        const { runCannibalizationDetection } = await import('./cannibalization-detector');
        const result = await runCannibalizationDetection(inventory, context);
        return buildModuleResult(module, startTime, true, result?.issuesFound ?? 0, 'סריקת קניבליזציה הושלמה');
      }

      // ─── חיזוק סמכות ───
      case 'authority_reinforcement': {
        const { runAuthorityReinforcementPass } = await import('./authority-reinforcement-engine');
        const result = await runAuthorityReinforcementPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.articlesCreated ?? 0, 'חיזוק סמכות הושלם');
      }

      // ─── האנשה ───
      case 'humanization': {
        const { runHumanizationPass } = await import('./humanization-engine');
        const result = await runHumanizationPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.pagesHumanized ?? 0, 'האנשת תוכן הושלמה');
      }

      // ─── גרף ישויות ───
      case 'entity_graph': {
        const { runEntityGraphPass } = await import('./semantic-entity-graph');
        const result = await runEntityGraphPass(inventory, connection, context);
        return buildModuleResult(module, startTime, true, result?.entitiesMapped ?? 0, 'מיפוי ישויות הושלם');
      }

      // ─── GSC Intelligence ───
      case 'gsc_intelligence': {
        const { runGscIntelligencePass } = await import('./gsc-intelligence-engine');
        const result = await runGscIntelligencePass(context);
        return buildModuleResult(module, startTime, true, result?.insightsFound ?? 0, 'ניתוח GSC הושלם');
      }

      // ─── GA4 Conversion ───
      case 'ga4_conversion': {
        const { runGa4ConversionPass } = await import('./ga4-conversion-engine');
        const result = await runGa4ConversionPass(context);
        return buildModuleResult(module, startTime, true, result?.opportunitiesFound ?? 0, 'ניתוח GA4 הושלם');
      }

      // ─── ניטור SERP ───
      case 'serp_monitoring': {
        const { runSerpMonitoringPass } = await import('./serp-movement-monitor');
        const result = await runSerpMonitoringPass(context);
        return buildModuleResult(module, startTime, true, result?.movementsDetected ?? 0, 'ניטור SERP הושלם');
      }

      // ─── אסטרטגיה אדפטיבית ───
      case 'adaptive_strategy': {
        const { runAdaptiveStrategyPass } = await import('./adaptive-strategy-engine');
        const result = await runAdaptiveStrategyPass(inventory, context);
        return buildModuleResult(module, startTime, true, result?.adjustmentsMade ?? 0, 'עדכון אסטרטגיה הושלם');
      }

      default:
        return buildModuleResult(module, startTime, false, 0, `מודול לא מזוהה: ${module}`);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Orchestrator] שגיאה במודול ${module}:`, errMsg);
    return {
      module,
      executed: true,
      actionsCount: 0,
      success: false,
      error: errMsg,
      durationMs: Date.now() - startTime,
      summary: `שגיאה בביצוע ${module}: ${errMsg}`,
    };
  }
}

/** בונה תוצאת מודול סטנדרטית */
function buildModuleResult(
  module: AutomationModule,
  startTime: number,
  success: boolean,
  actionsCount: number,
  summary: string,
): ModuleResult {
  return {
    module,
    executed: true,
    actionsCount,
    success,
    durationMs: Date.now() - startTime,
    summary,
  };
}

// ============================================================================
// ביצוע יומי מלא — Main Daily Execution
// ============================================================================

/**
 * נקודת הכניסה הראשית — מריץ את כל הזרימה היומית
 * שלבים:
 * 1. בנייה מלאי תוכן
 * 2. קביעת שלב ומודולים פעילים
 * 3. בניית תוכנית ביצוע
 * 4. ביצוע כל מודול בסדר עדיפויות
 * 5. איסוף תוצאות
 * 6. סיכום יומי בעברית
 * 7. הצעת מוקד למחר
 * 8. החזרת תוצאה מלאה
 */
export async function executeDaily(
  planId: string,
  day: number,
  connection: WPConnection,
  context: AutomationContext,
  config?: Partial<OrchestratorConfig>,
): Promise<DailyExecutionResult> {
  const startTime = Date.now();
  const started = new Date().toISOString();
  const fullConfig = { ...getDefaultConfig(), ...config };

  console.log(`[Orchestrator] ═══════════════════════════════════════`);
  console.log(`[Orchestrator] התחלת ביצוע יומי — יום ${day}`);
  console.log(`[Orchestrator] ═══════════════════════════════════════`);

  // ── שלב 1: בניית מלאי תוכן ──
  console.log(`[Orchestrator] שלב 1: בניית מלאי תוכן...`);
  const inventory = await buildContentInventory(connection);

  // ── שלב 2: קביעת פאזה ──
  const phaseInfo = getPhaseForDay(day);
  console.log(`[Orchestrator] שלב 2: פאזה ${phaseInfo.phase} — ${phaseInfo.name}`);

  // ── שלב 3: בניית תוכנית ביצוע ──
  console.log(`[Orchestrator] שלב 3: בניית תוכנית ביצוע...`);
  const plan = buildDailyExecutionPlan(day, inventory, context, fullConfig);
  console.log(`[Orchestrator]   → ${plan.autoActions.length} פעולות אוטומטיות`);
  console.log(`[Orchestrator]   → ${plan.approvalActions.length} פעולות ממתינות לאישור`);

  // ── שלב 4: ביצוע מודולים ──
  console.log(`[Orchestrator] שלב 4: ביצוע מודולים...`);
  const moduleResults = {} as Record<AutomationModule, ModuleResult>;
  const executedActions: AutonomousAction[] = [];

  let actionsExecuted = 0;
  let actionsFailed = 0;

  // ביצוע בסדר עדיפויות
  for (const mod of plan.priorityOrder) {
    // בדיקה אם יש פעולות אוטומטיות למודול הזה
    const moduleAutoActions = plan.autoActions.filter((a) => a.module === mod);

    if (moduleAutoActions.length === 0 && !fullConfig.enabledModules.includes(mod)) {
      // אין פעולות ומודול לא מופעל — דלג
      moduleResults[mod] = {
        module: mod,
        executed: false,
        actionsCount: 0,
        success: true,
        durationMs: 0,
        summary: 'דולג — אין פעולות רלוונטיות',
      };
      continue;
    }

    console.log(`[Orchestrator]   ▶ מריץ: ${mod} (${moduleAutoActions.length} פעולות)`);

    // הרצת המודול אם לא ב-dryRun
    if (!fullConfig.dryRun) {
      const result = await executeModule(mod, inventory, connection, context, fullConfig);
      moduleResults[mod] = result;

      // עדכון סטטוס פעולות
      for (const action of moduleAutoActions) {
        if (result.success) {
          action.status = 'completed';
          action.executedAt = new Date().toISOString();
          actionsExecuted++;
        } else {
          action.status = 'failed';
          actionsFailed++;
        }
        executedActions.push(action);
      }
    } else {
      // dryRun — סימולציה בלבד
      moduleResults[mod] = {
        module: mod,
        executed: false,
        actionsCount: moduleAutoActions.length,
        success: true,
        durationMs: 0,
        summary: `[DRY RUN] ${moduleAutoActions.length} פעולות סומלצו`,
      };
      for (const action of moduleAutoActions) {
        action.status = 'skipped';
        executedActions.push(action);
      }
    }
  }

  // הוספת פעולות ממתינות לאישור לרשימה
  for (const action of plan.approvalActions) {
    executedActions.push(action);
  }

  // ── שלב 5: סיכום יומי ──
  console.log(`[Orchestrator] שלב 5: הכנת סיכום...`);
  const completed = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  // ── שלב 6: סיכום בעברית ──
  const summary = await generateDailySummaryWithAI(
    day,
    phaseInfo,
    actionsExecuted,
    plan.approvalActions.length,
    actionsFailed,
    moduleResults,
    context,
  );

  // ── שלב 7: מוקד למחר ──
  const nextDayFocus = calculateNextDayFocus(day, phaseInfo, moduleResults, plan);

  console.log(`[Orchestrator] ═══════════════════════════════════════`);
  console.log(`[Orchestrator] ביצוע הושלם — ${durationMs}ms`);
  console.log(`[Orchestrator]   בוצעו: ${actionsExecuted}`);
  console.log(`[Orchestrator]   ממתינים: ${plan.approvalActions.length}`);
  console.log(`[Orchestrator]   נכשלו: ${actionsFailed}`);
  console.log(`[Orchestrator] ═══════════════════════════════════════`);

  return {
    planId,
    date: plan.date,
    day,
    phase: phaseInfo.phase,
    started,
    completed,
    durationMs,
    actionsExecuted,
    actionsPendingApproval: plan.approvalActions.length,
    actionsFailed,
    actionsSkipped: plan.skippedActions.length,
    moduleResults,
    summary,
    nextDayFocus,
    actions: executedActions,
  };
}

// ============================================================================
// סיכום יומי — Daily Summary
// ============================================================================

/**
 * יוצר סיכום יומי קריא בעברית
 * משתמש ב-AI ליצירת טקסט טבעי, עם fallback מובנה
 */
export function generateDailySummary(result: DailyExecutionResult, _context: AutomationContext): string {
  const phaseInfo = getPhaseForDay(result.day);

  const lines: string[] = [
    `📊 סיכום יומי — יום ${result.day}/60`,
    `שלב: ${phaseInfo.name}`,
    ``,
    `✅ פעולות שבוצעו: ${result.actionsExecuted}`,
    `⏳ ממתינות לאישור: ${result.actionsPendingApproval}`,
    `❌ נכשלו: ${result.actionsFailed}`,
    `⏭️ דולגו: ${result.actionsSkipped}`,
    `⏱️ זמן ביצוע: ${(result.durationMs / 1000).toFixed(1)} שניות`,
    ``,
    `── תוצאות מודולים ──`,
  ];

  // תוצאות כל מודול שהופעל
  const executedModules = Object.entries(result.moduleResults)
    .filter(([, r]) => r.executed)
    .sort(([, a], [, b]) => b.actionsCount - a.actionsCount);

  for (const [, modResult] of executedModules) {
    const icon = modResult.success ? '✅' : '❌';
    lines.push(`  ${icon} ${modResult.module}: ${modResult.summary} (${modResult.actionsCount} פעולות, ${modResult.durationMs}ms)`);
  }

  // מוקד למחר
  if (result.nextDayFocus.length > 0) {
    lines.push(``);
    lines.push(`── מוקד למחר ──`);
    for (const focus of result.nextDayFocus) {
      lines.push(`  → ${focus}`);
    }
  }

  return lines.join('\n');
}

/**
 * סיכום יומי עם AI — יותר טבעי וקריא
 * אם ה-AI נכשל, חוזר לסיכום מובנה
 */
async function generateDailySummaryWithAI(
  day: number,
  phaseInfo: PhaseInfo,
  actionsExecuted: number,
  actionsPending: number,
  actionsFailed: number,
  moduleResults: Record<AutomationModule, ModuleResult>,
  context: AutomationContext,
): Promise<string> {
  try {
    const modulesSummary = Object.entries(moduleResults)
      .filter(([, r]) => r.executed)
      .map(([, r]) => `${r.module}: ${r.summary} (${r.actionsCount} פעולות)`)
      .join('\n');

    const aiResult = await generateWithAI(
      'אתה מומחה SEO ישראלי. כתוב סיכום יומי קצר, ברור ומקצועי בעברית.',
      `סכם את הביצוע היומי של תוכנית SEO:
יום: ${day}/60
שלב: ${phaseInfo.name}
מוקד השלב: ${phaseInfo.focus.join(', ')}
עסק: ${context.businessName} (${context.industry})

תוצאות:
- פעולות שבוצעו: ${actionsExecuted}
- ממתינות לאישור: ${actionsPending}
- נכשלו: ${actionsFailed}

מודולים:
${modulesSummary}

כתוב סיכום של 3-5 משפטים. מקצועי, תמציתי, בעברית.`,
      { temperature: 0.3, maxTokens: 300 },
    );

    if (aiResult.success && aiResult.data) {
      return String(aiResult.data);
    }
  } catch {
    // fallback למטה
  }

  // Fallback — סיכום מובנה
  return [
    `יום ${day}/60 — ${phaseInfo.name}`,
    `בוצעו ${actionsExecuted} פעולות, ${actionsPending} ממתינות לאישור, ${actionsFailed} נכשלו.`,
    `מוקד: ${phaseInfo.focus.slice(0, 3).join(', ')}.`,
  ].join(' ');
}

// ============================================================================
// חישוב מוקד למחר — Next Day Focus
// ============================================================================

/**
 * מחשב על מה להתמקד ביום הבא
 * לפי: שגיאות היום, מודולים שלא רצו, מודולים של המחר
 */
function calculateNextDayFocus(
  day: number,
  _currentPhase: PhaseInfo,
  moduleResults: Record<AutomationModule, ModuleResult>,
  plan: DailyExecutionPlan,
): string[] {
  const focus: string[] = [];

  // מודולים שנכשלו — לנסות שוב מחר
  const failedModules = Object.entries(moduleResults)
    .filter(([, r]) => r.executed && !r.success)
    .map(([mod]) => mod);

  if (failedModules.length > 0) {
    focus.push(`ניסיון חוזר: ${failedModules.join(', ')}`);
  }

  // פעולות ממתינות לאישור — תזכורת
  if (plan.approvalActions.length > 0) {
    focus.push(`${plan.approvalActions.length} פעולות ממתינות לאישור ידני`);
  }

  // מה צפוי מחר — פאזה של מחר
  const tomorrow = getPhaseForDay(day + 1);
  if (tomorrow.phase !== _currentPhase.phase) {
    focus.push(`מעבר לשלב חדש: ${tomorrow.name}`);
  }

  // מודולים חדשים שנכנסים מחר
  const tomorrowModules = getModulesForPhase(tomorrow.phase);
  const todayModules = new Set(plan.priorityOrder);
  const newModules = tomorrowModules.filter((m) => !todayModules.has(m));

  if (newModules.length > 0) {
    focus.push(`מודולים חדשים למחר: ${newModules.join(', ')}`);
  }

  // מוקד ברירת מחדל
  if (focus.length === 0) {
    focus.push(`המשך ${tomorrow.focus[0] || 'אופטימיזציה'}`);
  }

  return focus;
}
