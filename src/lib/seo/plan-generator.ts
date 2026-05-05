// @ts-nocheck
import type {
  GapAnalysisResult,
  KeywordGap,
  ContentGap,
  TechnicalGap,
} from './gap-analysis';
import type { WhyAnalysisResult, WhyFactor } from './why-engine';
import type { WebsiteFacts } from './website-facts';
import type { GSCData } from './gsc-api';
import type { CrawlResult } from './crawler';

// ============================================================================
// INTERFACES
// ============================================================================

export interface PlanGeneratorInput {
  websiteFacts: WebsiteFacts;
  gapAnalysis: GapAnalysisResult;
  whyAnalysis?: WhyAnalysisResult[];
  gscData?: GSCData | null;
  crawlResult?: CrawlResult | null;
  businessGoals?: string[];
}

export interface PlanValidation {
  isValid: boolean;
  missingData: string[];
  dataCompleteness: number;
  canGeneratePartial: boolean;
}

export interface PlanTask {
  id: string;
  day: number;
  phase: number;
  title: string;
  titleEn: string;
  description: string;
  category: 'technical' | 'content' | 'ai_optimization' | 'monitoring';
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedHours: number;
  reason: {
    dataSource: 'gsc' | 'serp' | 'crawl' | 'gap_analysis' | 'why_engine';
    evidence: string;
    gap?: KeywordGap | ContentGap | TechnicalGap;
  };
  impact: {
    expectedImprovement: string;
    metric: string;
    currentValue?: number;
    targetValue?: number;
  };
  relatedUrl?: string;
  relatedKeywords?: string[];
  deliverable: string;
  status: 'pending' | 'in_progress' | 'done';
}

export interface PlanPhase {
  number: number;
  name: string;
  nameEn: string;
  days: [number, number];
  focus: string;
  taskCount: number;
}

export interface GeneratedPlan {
  id: string;
  generatedAt: string;
  dataCompleteness: number;
  phases: PlanPhase[];
  tasks: PlanTask[];
  totalTasks: number;
  limitations: string[];
  summary: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validatePlanInput(input: PlanGeneratorInput): PlanValidation {
  const missingData: string[] = [];
  let dataPoints = 0;
  const maxDataPoints = 5;

  // Check required fields
  if (!input.websiteFacts || !input.websiteFacts.business_type) {
    missingData.push('חובה: מידע על סוג העסק');
  }

  if (!input.gapAnalysis) {
    missingData.push('חובה: ניתוח פערים (Gap Analysis)');
  } else {
    dataPoints++;
  }

  // Check optional but valuable data
  if (input.gscData) {
    dataPoints++;
  } else {
    missingData.push('אין נתוני Google Search Console');
  }

  if (input.crawlResult) {
    dataPoints++;
  } else {
    missingData.push('אין נתוני זחילה אתר');
  }

  if (input.whyAnalysis && input.whyAnalysis.length > 0) {
    dataPoints++;
  } else {
    missingData.push('אין ניתוח Why Engine');
  }

  if (input.businessGoals && input.businessGoals.length > 0) {
    dataPoints++;
  }

  const dataCompleteness = Math.round((dataPoints / maxDataPoints) * 100);
  const hasMinimalData =
    !!input.websiteFacts?.business_type &&
    (!!input.gapAnalysis || !!input.crawlResult);
  const canGeneratePartial = !input.gscData || !input.crawlResult;

  return {
    isValid: hasMinimalData,
    missingData,
    dataCompleteness,
    canGeneratePartial,
  };
}

// ============================================================================
// TASK GENERATION
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createTechnicalTask(
  gap: TechnicalGap,
  day: number,
  evidence: string
): PlanTask {
  const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    broken_links: 'critical',
    missing_meta: 'high',
    slow_pages: 'high',
    missing_h1: 'medium',
    missing_canonical: 'critical',
    redirect_chain: 'high',
    duplicate_content: 'high',
    missing_schema: 'medium',
  };

  const hoursMap: Record<string, number> = {
    broken_links: 3,
    missing_meta: 4,
    slow_pages: 6,
    missing_h1: 2,
    missing_canonical: 2,
    redirect_chain: 4,
    duplicate_content: 5,
    missing_schema: 3,
  };

  const titleMap: Record<string, [string, string]> = {
    broken_links: ['תיקון קישורים שבורים', 'Fix broken links'],
    missing_meta: ['הוספת Meta Tags חסרים', 'Add missing meta tags'],
    slow_pages: ['שיפור מהירות עמודים', 'Improve page speed'],
    missing_h1: ['הוספת H1 Headers', 'Add H1 headers'],
    missing_canonical: ['הוספת Canonical Tags', 'Add canonical tags'],
    redirect_chain: ['פתרון שרשרות הפנייה', 'Fix redirect chains'],
    duplicate_content: ['תיקון תוכן משוכפל', 'Fix duplicate content'],
    missing_schema: ['הוספת Schema Markup', 'Add structured data'],
  };

  const [titleHe, titleEn] = titleMap[gap.type] || [
    `תיקון: ${gap.type}`,
    `Fix: ${gap.type}`,
  ];
  const priority = severityMap[gap.type] || 'medium';
  const estimatedHours = hoursMap[gap.type] || 4;

  return {
    id: generateId('tech'),
    day,
    phase: 1,
    title: titleHe,
    titleEn,
    description: `תיקון בעיה טכנית: ${gap.type}. ${evidence}. השפעה ישירה על זחילה של Google ודירוג מנוע החיפוש.`,
    category: 'technical',
    priority,
    estimatedHours,
    reason: {
      dataSource: 'crawl',
      evidence,
      gap,
    },
    impact: {
      expectedImprovement: 'שיפור הזחילה והאינדקסציה של Google',
      metric: 'crawl_efficiency',
      currentValue: { critical: 3, warning: 2, info: 1 }[gap.severity],
      targetValue: 0,
    },
    deliverable: `דוח תיקון ${gap.type} עם צילומי מסך לפני ואחרי`,
    status: 'pending',
  };
}

function createKeywordTask(
  gap: KeywordGap,
  day: number,
  evidence: string
): PlanTask {
  const priorityMap: Record<string, 'critical' | 'high' | 'medium'> = {
    high: 'critical',
    medium: 'high',
    low: 'medium',
  };

  const priority = priorityMap[gap.opportunity] || 'medium';
  const estimatedHours = gap.opportunity === 'high' ? 6 : 4;

  return {
    id: generateId('kwrd'),
    day,
    phase: 2,
    title: `יצירת תוכן: "${gap.keyword}"`,
    titleEn: `Create content: "${gap.keyword}"`,
    description: `יצירת או הרחבת תוכן עבור מילת מפתח: "${gap.keyword}". ${evidence}. מוקד אופטימיזציה על דירוג, CTR, והשגת קהל יעד חדש.`,
    category: 'content',
    priority,
    estimatedHours,
    reason: {
      dataSource: 'gap_analysis',
      evidence,
      gap,
    },
    impact: {
      expectedImprovement: `דירוג עבור "${gap.keyword}" וגדילה בחיפושים ובעמדות`,
      metric: 'position',
      currentValue: gap.currentMetrics.position || undefined,
      targetValue: 5,
    },
    relatedKeywords: [gap.keyword],
    relatedUrl: gap.competitors?.[0]?.domain || gap.relatedUrl,
    deliverable: `עמוד תוכן מלא אופטימיזציה עם H1, H2, FAQ, וקישורים פנימיים`,
    status: 'pending',
  };
}

function createContentGapTask(
  gap: ContentGap,
  day: number,
  phase: 2 | 3,
  evidence: string
): PlanTask {
  const isPhase3 = phase === 3;
  const estimatedHours = isPhase3 ? 5 : 4;

  const title = isPhase3
    ? `הוספת FAQ ו-Schema: "${gap.url}"`
    : `הרחבת תוכן: "${gap.url}"`;
  const titleEn = isPhase3
    ? `Add FAQ & Schema: "${gap.url}"`
    : `Expand content: "${gap.url}"`;

  const description = isPhase3
    ? `הוספת סעיף FAQ מבוסס על תוכן "People Also Ask" ו-Schema Markup עבור נושא: "${gap.url}". ${evidence}`
    : `הרחבת תוכן קיים או יצירת חדש עבור נושא: "${gap.url}". ${evidence}`;

  const category = isPhase3 ? 'ai_optimization' : 'content';
  const deliverable = isPhase3
    ? `סעיף FAQ בעיצוב Schema.org Question-Answer, וכן Schema Markup רלוונטי`
    : `עמוד תוכן מורחב עם קישורים פנימיים וקשרים סמנטיים`;

  return {
    id: generateId('cont'),
    day,
    phase,
    title,
    titleEn,
    description,
    category,
    priority: gap.severity === 'critical' ? 'critical' : gap.severity === 'warning' ? 'high' : 'medium',
    estimatedHours,
    reason: {
      dataSource: 'gap_analysis',
      evidence,
      gap,
    },
    impact: {
      expectedImprovement: `שיפור כיסוי נושא וגדילה בתוכן ארוך יותר`,
      metric: 'content_length_and_coverage',
    },
    relatedUrl: gap.url,
    relatedKeywords: gap.relatedKeywords || [],
    deliverable,
    status: 'pending',
  };
}

function createWhyEngineTask(
  whyAnalysis: WhyAnalysisResult,
  day: number,
  evidence: string
): PlanTask {
  return {
    id: generateId('why'),
    day,
    phase: 3,
    title: `אופטימיזציה לגורמי דירוג: "${whyAnalysis.targetUrl}"`,
    titleEn: `Optimize ranking factors: "${whyAnalysis.targetUrl}"`,
    description: `ניתוח Why Engine זיהה גורמי דירוג ספציפיים המשפיעים על הדירוג של דף זה. ${evidence}. אופטימיזציה של גורמים אלה צפויה להשיג שיפור דירוג משמעותי.`,
    category: 'ai_optimization',
    priority: 'high',
    estimatedHours: 5,
    reason: {
      dataSource: 'why_engine',
      evidence,
    },
    impact: {
      expectedImprovement: `שיפור דירוג דף על ידי אופטימיזציה לגורמי דירוג ספציפיים`,
      metric: 'ranking_factors_score',
    },
    relatedUrl: whyAnalysis.targetUrl,
    deliverable: `דוח אופטימיזציה עם שינויים מיושמים וציוני ערך לפני/אחרי`,
    status: 'pending',
  };
}

function createMonitoringTask(
  taskCount: number,
  day: number,
  evidence: string
): PlanTask {
  return {
    id: generateId('mon'),
    day,
    phase: 4,
    title: `ניטור ויוחסות של ${taskCount} משימות`,
    titleEn: `Monitor and report on ${taskCount} tasks`,
    description: `ניטור מערכות של שינויים שבוצעו בשלבים 1-3. ${evidence}. יוחסות כל שיפור לתוכן או שינוי טכני ספציפי.`,
    category: 'monitoring',
    priority: 'high',
    estimatedHours: 4,
    reason: {
      dataSource: 'gsc',
      evidence,
    },
    impact: {
      expectedImprovement: `הבנה חצי-חודשית של שיפור הדירוג והתנועה`,
      metric: 'position_movement',
    },
    deliverable: `דוח ניטור ב-Google Search Console עם ניתוח השפעה`,
    status: 'pending',
  };
}

// ============================================================================
// PLAN GENERATION
// ============================================================================

export function generatePlan(input: PlanGeneratorInput): GeneratedPlan {
  const planId = generateId('plan');
  const validation = validatePlanInput(input);

  if (!validation.isValid) {
    return {
      id: planId,
      generatedAt: new Date().toISOString(),
      dataCompleteness: validation.dataCompleteness,
      phases: [],
      tasks: [],
      totalTasks: 0,
      limitations: validation.missingData,
      summary:
        'לא ניתן ליצור תוכנית. יש להעביר נתוני חובה: פרטי אתר וניתוח פערים.',
    };
  }

  const tasks: PlanTask[] = [];
  const limitations: string[] = [];

  // ========== PHASE 1: TECHNICAL FOUNDATIONS (Days 1-10) ==========
  let day = 1;

  if (input.crawlResult?.technicalIssues) {
    const technicalIssues = input.crawlResult.technicalIssues.slice(0, 8);

    technicalIssues.forEach((gap) => {
      if (day <= 10) {
        const evidence = gap.description || `זוהתה בעיה: ${gap.type}`;
        tasks.push(createTechnicalTask(gap, day, evidence));
        day++;
      }
    });
  } else {
    limitations.push('אין נתוני זחילה - שלב טכני מוגבל');
  }

  // ========== PHASE 2: CONTENT & KEYWORDS (Days 11-30) ==========
  day = 11;

  // Process keyword gaps
  if (input.gapAnalysis?.keywordGaps) {
    const sortedKeywordGaps = [...input.gapAnalysis.keywordGaps]
      .sort((a, b) => {
        const priorityScore = {
          high: 3,
          medium: 2,
          low: 1,
        };
        return (
          (priorityScore[b.opportunity as keyof typeof priorityScore] ||
            0) -
          (priorityScore[a.opportunity as keyof typeof priorityScore] ||
            0)
        );
      })
      .slice(0, 12);

    sortedKeywordGaps.forEach((gap) => {
      if (day <= 30) {
        const evidence =
          gap.currentMetrics.impressions && gap.currentMetrics.impressions > 0
            ? `ממוצע ${gap.currentMetrics.impressions} impressions, דירוג נוכחי: ${gap.currentMetrics.position || 'לא דורג'}`
            : `הזדמנות בינונית כיסוי תוכן`;
        tasks.push(createKeywordTask(gap, day, evidence));
        day++;
      }
    });
  }

  // Process content gaps (continue in phase 2)
  if (input.gapAnalysis?.contentGaps) {
    const contentGapsPhase2 = input.gapAnalysis.contentGaps
      .filter((g) => g.severity === 'critical' || g.severity === 'warning')
      .slice(0, 8);

    contentGapsPhase2.forEach((gap) => {
      if (day <= 30) {
        const evidence =
          gap.relatedKeywords && gap.relatedKeywords.length > 0
            ? `קשור ל-${gap.relatedKeywords.length} מילות מפתח רלוונטיות`
            : `סחף תוכן משמעותי`;
        tasks.push(createContentGapTask(gap, day, 2, evidence));
        day++;
      }
    });
  }

  // ========== PHASE 3: AI OPTIMIZATION (Days 31-45) ==========
  day = 31;

  // Process FAQ/PAA from Why Engine
  if (input.whyAnalysis && input.whyAnalysis.length > 0) {
    const whyAnalysisPhase3 = input.whyAnalysis.slice(0, 6);

    whyAnalysisPhase3.forEach((analysis) => {
      if (day <= 45) {
        const paaCount = analysis.factors.filter(
          (f) => f.factor === 'paa'
        ).length;
        const evidence =
          paaCount > 0
            ? `${paaCount} שאלות בסעיף "People Also Ask" שלא מכוסות`
            : `גורמי דירוג מומלצים להשגת Top 3`;
        tasks.push(createWhyEngineTask(analysis, day, evidence));
        day++;
      }
    });
  }

  // Add content gaps Phase 3 (FAQ + Schema)
  if (input.gapAnalysis?.contentGaps) {
    const contentGapsPhase3 = input.gapAnalysis.contentGaps
      .filter((g) => g.severity === 'info')
      .slice(0, 5);

    contentGapsPhase3.forEach((gap) => {
      if (day <= 45) {
        const evidence =
          gap.relatedKeywords && gap.relatedKeywords.length > 0
            ? `סעיף FAQ עבור ${gap.relatedKeywords.length} שאלות`
            : `הוספת Schema עבור עיצוב עמודה`;
        tasks.push(createContentGapTask(gap, day, 3, evidence));
        day++;
      }
    });
  }

  // ========== PHASE 4: MONITORING (Days 46-60) ==========
  day = 46;

  const monitoringTaskCount = Math.min(tasks.length, 15);
  if (input.gscData) {
    const evidence =
      input.gscData.totalImpressions > 0
        ? `בהתאם ל-${input.gscData.totalImpressions} impressions חודשיים`
        : `בהתאם לנתוני GSC`;

    tasks.push(createMonitoringTask(monitoringTaskCount, day, evidence));
    day++;

    // Add re-scan task
    if (day <= 60) {
      tasks.push({
        id: generateId('rescan'),
        day,
        phase: 4,
        title: 'הערכה חוזרת של אתר וניתוח תוכנית',
        titleEn: 'Re-assess website and analyze plan progress',
        description:
          'ביצוע זחילה חוזרת של אתר, ניתוח פערים משודרג, והערכת השפעת כל התוכנית על דירוגים ותנועה.',
        category: 'monitoring',
        priority: 'high',
        estimatedHours: 6,
        reason: {
          dataSource: 'gsc',
          evidence: 'ביצוע הערכה כוללת של התוכנית בחצי נקודה',
        },
        impact: {
          expectedImprovement: 'הבנה ברורה של מהו עובד ומה עדיין צריך שיפור',
          metric: 'overall_improvement',
        },
        deliverable:
          'דוח הערכה חוזרת עם משימות עדכוניות לשלבים הבאים',
        status: 'pending',
      });
    }
  } else {
    limitations.push('אין נתוני GSC - ניטור מוגבל');
  }

  // ========== BUILD PHASES METADATA ==========
  const phases: PlanPhase[] = [
    {
      number: 1,
      name: 'יסודות טכניים',
      nameEn: 'Technical Foundations',
      days: [1, 10],
      focus: 'תיקון בעיות טכניות, מטא-תגים, ומהירות',
      taskCount: tasks.filter((t) => t.phase === 1).length,
    },
    {
      number: 2,
      name: 'תוכן ומילות מפתח',
      nameEn: 'Content & Keywords',
      days: [11, 30],
      focus: 'יצירת תוכן חדש עבור פערים בכיסוי מילות מפתח',
      taskCount: tasks.filter((t) => t.phase === 2).length,
    },
    {
      number: 3,
      name: 'אופטימיזציה ל-AI',
      nameEn: 'AI Optimization',
      days: [31, 45],
      focus: 'FAQ, Schema Markup, ותוכן סמנטי',
      taskCount: tasks.filter((t) => t.phase === 3).length,
    },
    {
      number: 4,
      name: 'ניטור ואופטימיזציה',
      nameEn: 'Monitoring & Optimization',
      days: [46, 60],
      focus: 'ניטור שינויים, ניתוח השפעה, תכנון הבא',
      taskCount: tasks.filter((t) => t.phase === 4).length,
    },
  ];

  // ========== BUILD SUMMARY ==========
  const technicalTaskCount = tasks.filter((t) => t.phase === 1).length;
  const contentTaskCount = tasks.filter((t) => t.phase === 2).length;
  const aiTaskCount = tasks.filter((t) => t.phase === 3).length;
  const monitoringTaskCount_ = tasks.filter((t) => t.phase === 4).length;

  const summary =
    `תוכנית SEO של 60 יום עם ${tasks.length} משימות מונחות נתונים. ` +
    `שלב 1: ${technicalTaskCount} משימות טכניות. ` +
    `שלב 2: ${contentTaskCount} משימות תוכן. ` +
    `שלב 3: ${aiTaskCount} משימות אופטימיזציה AI. ` +
    `שלב 4: ${monitoringTaskCount_} משימות ניטור. ` +
    `כל משימה מתווה ישירות לפער נתונים ממציאות, עם ראיות מפורשות וציפיות השפעה.`;

  return {
    id: planId,
    generatedAt: new Date().toISOString(),
    dataCompleteness: validation.dataCompleteness,
    phases,
    tasks: tasks.slice(0, 60),
    totalTasks: Math.min(tasks.length, 60),
    limitations,
    summary,
  };
}
