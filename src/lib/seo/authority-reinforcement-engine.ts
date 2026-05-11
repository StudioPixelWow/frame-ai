// מנוע חיזוק סמכות — Authority Reinforcement Engine
// מזהה דפי עמוד (pillar), דפי מכירה (money) ודפים חלשים, ובונה תוכנית חיזוק

import { WPConnection, updatePageContent } from './wordpress-client';
import {
  ContentItem,
  ContentInventory,
} from './wp-content-inventory';
import { generateWithAI } from '@/lib/ai/openai-client';
import { SEOActionEntry } from './seo-action-log';
import { AutomationContext } from './seo-automator';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface AuthorityPage {
  pageId: number;
  pageUrl: string;
  pageTitle: string;
  type: 'pillar' | 'money' | 'authority' | 'supporting' | 'weak';
  authorityScore: number;  // 0-100
  inboundLinks: number;
  outboundLinks: number;
  wordCount: number;
  hasSchema: boolean;
  hasFAQ: boolean;
  hasCTA: boolean;
  semanticDepth: number;
  improvementPotential: number;  // 0-100
}

export interface ReinforcementAction {
  pageId: number;
  pageUrl: string;
  actionType: 'add_internal_links' | 'improve_semantic_depth' | 'add_faq' | 'add_trust_signals' | 'add_supporting_content' | 'improve_ai_readability' | 'add_schema' | 'strengthen_cta';
  description: string;
  impactEstimate: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

export interface AuthorityResult {
  pillarPages: AuthorityPage[];
  moneyPages: AuthorityPage[];
  weakPages: AuthorityPage[];
  highPotentialPages: AuthorityPage[];
  reinforcementPlan: ReinforcementAction[];
  overallAuthorityScore: number;
  actions: SEOActionEntry[];
}

// ============================================================================
// סיווג סמכות דף — Page Authority Classification
// ============================================================================

/**
 * מדרג דף לפי סמכותו — שילוב של קישורים, תוכן, סכמה ומבנה
 */
export function classifyPageAuthority(
  item: ContentItem,
  inventory: ContentInventory,
  context: AutomationContext
): AuthorityPage {
  // חישוב קישורים נכנסים — כמה דפים מקשרים לדף הזה
  let inboundLinks = 0;
  for (const [, linkedIds] of inventory.internalLinkMap) {
    if (linkedIds.includes(item.id)) {
      inboundLinks++;
    }
  }

  // קישורים יוצאים
  const outboundLinks = item.internalLinks.length;

  // עומק סמנטי — כמה כותרות, גיוון, כיסוי נושאי
  const semanticDepth = calculateSemanticDepth(item, context);

  // חישוב ציון סמכות
  const slugDepth = item.slug.split('/').filter(Boolean).length;
  const isTopLevel = slugDepth <= 1;

  // מילות מפתח בכותרת/תוכן
  const keywordRelevance = calculateKeywordRelevance(item, context);

  // ציון סמכות משוקלל
  const authorityScore = Math.round(
    Math.min(inboundLinks * 8, 25) +              // קישורים נכנסים (עד 25)
    Math.min(item.wordCount / 50, 20) +            // אורך תוכן (עד 20)
    (item.hasSchema ? 10 : 0) +                    // סכמה
    (item.hasFAQ ? 8 : 0) +                        // FAQ
    (item.hasCTA ? 7 : 0) +                        // CTA
    (isTopLevel ? 10 : 0) +                        // דף ראשי בהיררכיה
    Math.min(semanticDepth, 10) +                  // עומק סמנטי (עד 10)
    Math.min(keywordRelevance, 10)                 // רלוונטיות מילות מפתח (עד 10)
  );

  // סיווג סוג הדף
  const type = classifyPageType(item, authorityScore, isTopLevel, inboundLinks, context);

  // פוטנציאל שיפור — ככל שיש יותר חסרונות, יש יותר מקום לשיפור
  const maxPossibleScore = 100;
  const improvementPotential = Math.round(
    ((maxPossibleScore - authorityScore) / maxPossibleScore) * 100
  );

  return {
    pageId: item.id,
    pageUrl: item.url,
    pageTitle: item.title,
    type,
    authorityScore: Math.min(authorityScore, 100),
    inboundLinks,
    outboundLinks,
    wordCount: item.wordCount,
    hasSchema: item.hasSchema,
    hasFAQ: item.hasFAQ,
    hasCTA: item.hasCTA,
    semanticDepth,
    improvementPotential,
  };
}

/**
 * חישוב עומק סמנטי — מספר כותרות, מגוון נושאים, עומק מבנה
 */
function calculateSemanticDepth(item: ContentItem, context: AutomationContext): number {
  let depth = 0;

  // מספר כותרות h2/h3 מעיד על עומק
  depth += Math.min(item.h2Count * 2, 6);
  depth += Math.min(item.h3Count, 4);

  // תוכן ארוך = יותר עומק
  if (item.wordCount > 800) depth += 2;
  if (item.wordCount > 1500) depth += 2;

  // תמונות מגוונות
  if (item.images.length >= 2) depth += 1;

  // קישורים חיצוניים (מקורות) מעידים על סמכות
  if (item.externalLinks.length >= 1) depth += 1;

  return Math.min(depth, 15);
}

/**
 * חישוב רלוונטיות מילות מפתח לדף
 */
function calculateKeywordRelevance(item: ContentItem, context: AutomationContext): number {
  let score = 0;
  const titleLower = item.title.toLowerCase();
  const textLower = item.plainText.toLowerCase();

  for (const kw of context.targetKeywords) {
    const kwLower = kw.toLowerCase();
    if (titleLower.includes(kwLower)) score += 3;
    if (textLower.includes(kwLower)) score += 1;
  }

  // Yoast focus keyword
  if (item.yoastMeta.focusKeyword) score += 2;

  return Math.min(score, 10);
}

/**
 * סיווג סוג דף — pillar, money, authority, supporting, weak
 */
function classifyPageType(
  item: ContentItem,
  authorityScore: number,
  isTopLevel: boolean,
  inboundLinks: number,
  context: AutomationContext
): AuthorityPage['type'] {
  const titleLower = item.title.toLowerCase();

  // דפי כסף — מכילים מילות מפתח מסחריות, CTA, מחיר
  const moneySignals = [
    'מחיר', 'עלות', 'הזמנה', 'שירות', 'price', 'order', 'buy', 'service',
    'חבילה', 'תעריף', 'הצעת מחיר',
  ];
  const isMoneyPage = moneySignals.some(sig => titleLower.includes(sig)) ||
    (item.hasCTA && item.wordCount > 300 && isTopLevel);

  if (isMoneyPage && authorityScore >= 30) return 'money';

  // דפי עמוד (Pillar) — ארוכים, מקושרים, ברמה עליונה
  if (isTopLevel && item.wordCount > 800 && inboundLinks >= 2) return 'pillar';
  if (authorityScore >= 60 && item.wordCount > 600) return 'pillar';

  // דפי סמכות — ציון גבוה אבל לא pillar
  if (authorityScore >= 40) return 'authority';

  // דפי תמיכה — תוכן בסדר אבל לא בולט
  if (authorityScore >= 20 && item.wordCount >= 200) return 'supporting';

  // חלש — דפים עם תוכן דל או ציון נמוך
  return 'weak';
}

// ============================================================================
// תוכנית חיזוק — Reinforcement Plan
// ============================================================================

/**
 * בונה תוכנית חיזוק מותאמת לכל דף חלש או בעל פוטנציאל
 */
export function generateReinforcementPlan(
  pages: AuthorityPage[],
  inventory: ContentInventory,
  context: AutomationContext
): ReinforcementAction[] {
  const actions: ReinforcementAction[] = [];

  for (const page of pages) {
    // דפי pillar/money חלשים — עדיפות גבוהה
    const isPriority = page.type === 'pillar' || page.type === 'money';

    // חסר קישורים נכנסים
    if (page.inboundLinks < 2) {
      actions.push({
        pageId: page.pageId,
        pageUrl: page.pageUrl,
        actionType: 'add_internal_links',
        description: `הוסף קישורים פנימיים מדפים אחרים אל "${page.pageTitle}" — כרגע יש רק ${page.inboundLinks} קישורים נכנסים`,
        impactEstimate: isPriority ? 'critical' : 'high',
        reason: 'קישורים פנימיים מעבירים סמכות ומסייעים לגוגל להבין שזה דף חשוב',
      });
    }

    // חסר סכמה
    if (!page.hasSchema) {
      actions.push({
        pageId: page.pageId,
        pageUrl: page.pageUrl,
        actionType: 'add_schema',
        description: `הוסף Schema Markup לדף "${page.pageTitle}"`,
        impactEstimate: isPriority ? 'high' : 'medium',
        reason: 'Schema עוזר לגוגל להבין את סוג התוכן ומשפר הצגה בתוצאות חיפוש',
      });
    }

    // חסר FAQ
    if (!page.hasFAQ && page.wordCount > 300) {
      actions.push({
        pageId: page.pageId,
        pageUrl: page.pageUrl,
        actionType: 'add_faq',
        description: `הוסף שאלות נפוצות לדף "${page.pageTitle}"`,
        impactEstimate: isPriority ? 'high' : 'medium',
        reason: 'FAQ schema מגדיל נראות בחיפוש ונותן מענה ישיר לשאלות משתמשים',
      });
    }

    // חסר CTA
    if (!page.hasCTA && (page.type === 'money' || page.type === 'pillar')) {
      actions.push({
        pageId: page.pageId,
        pageUrl: page.pageUrl,
        actionType: 'strengthen_cta',
        description: `הוסף קריאה לפעולה (CTA) לדף "${page.pageTitle}"`,
        impactEstimate: 'high',
        reason: 'דף מכירה/עמוד ללא CTA מפספס המרות — חשוב להוסיף כפתור פעולה',
      });
    }

    // תוכן דל — צריך העשרה
    if (page.wordCount < 400 && page.type !== 'weak') {
      actions.push({
        pageId: page.pageId,
        pageUrl: page.pageUrl,
        actionType: 'improve_semantic_depth',
        description: `העשר את תוכן הדף "${page.pageTitle}" — כרגע רק ${page.wordCount} מילים`,
        impactEstimate: isPriority ? 'critical' : 'high',
        reason: 'תוכן דל מוריד סמכות ומקשה על גוגל לדרג את הדף',
      });
    }

    // עומק סמנטי נמוך
    if (page.semanticDepth < 5 && page.wordCount > 500) {
      actions.push({
        pageId: page.pageId,
        pageUrl: page.pageUrl,
        actionType: 'improve_semantic_depth',
        description: `שפר מבנה כותרות ועומק תוכן בדף "${page.pageTitle}"`,
        impactEstimate: 'medium',
        reason: 'מבנה כותרות טוב ותוכן עמוק מסייעים לגוגל להבין את הנושא לעומק',
      });
    }

    // דף money בלי אותות אמון
    if (page.type === 'money' && page.semanticDepth < 8) {
      actions.push({
        pageId: page.pageId,
        pageUrl: page.pageUrl,
        actionType: 'add_trust_signals',
        description: `הוסף אותות אמון לדף המכירה "${page.pageTitle}" — עדויות, תעודות, ניסיון`,
        impactEstimate: 'high',
        reason: 'דפי מכירה זקוקים לאותות E-E-A-T חזקים כדי לשכנע גוגל ומשתמשים',
      });
    }

    // שיפור קריאות ל-AI
    if (page.type === 'pillar' || page.type === 'authority') {
      const contentItem = inventory.items.find(i => i.id === page.pageId);
      if (contentItem && !contentItem.hasSchema) {
        actions.push({
          pageId: page.pageId,
          pageUrl: page.pageUrl,
          actionType: 'improve_ai_readability',
          description: `שפר קריאות AI עבור "${page.pageTitle}" — הוסף מבנה ברור שמנועי AI יכולים לפרש`,
          impactEstimate: 'medium',
          reason: 'מנועי AI כמו ChatGPT ו-Gemini מעדיפים תוכן מובנה ובהיר',
        });
      }
    }
  }

  // מיון לפי השפעה — critical ראשון
  const impactOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => (impactOrder[a.impactEstimate] ?? 3) - (impactOrder[b.impactEstimate] ?? 3));

  return actions;
}

// ============================================================================
// ביצוע מנוע חיזוק — Execute Authority Reinforcement
// ============================================================================

/**
 * מריץ ניתוח סמכות מלא ובונה תוכנית חיזוק
 */
export async function executeAuthorityReinforcement(
  inventory: ContentInventory,
  connection: WPConnection,
  context: AutomationContext,
  options?: { dryRun?: boolean; maxActions?: number }
): Promise<AuthorityResult> {
  const dryRun = options?.dryRun ?? true;
  const maxActions = options?.maxActions ?? 20;
  const actions: SEOActionEntry[] = [];

  // שלב 1: סווג את כל הדפים
  const allPages: AuthorityPage[] = inventory.items.map(item =>
    classifyPageAuthority(item, inventory, context)
  );

  // שלב 2: חלוקה לקטגוריות
  const pillarPages = allPages.filter(p => p.type === 'pillar');
  const moneyPages = allPages.filter(p => p.type === 'money');
  const weakPages = allPages.filter(p => p.type === 'weak');
  const highPotentialPages = allPages
    .filter(p => p.improvementPotential >= 50 && p.type !== 'weak')
    .sort((a, b) => b.improvementPotential - a.improvementPotential)
    .slice(0, 10);

  // שלב 3: בנה תוכנית חיזוק
  const priorityPages = [...pillarPages, ...moneyPages, ...highPotentialPages];
  const uniquePages = priorityPages.filter(
    (p, idx) => priorityPages.findIndex(pp => pp.pageId === p.pageId) === idx
  );
  const reinforcementPlan = generateReinforcementPlan(uniquePages, inventory, context).slice(0, maxActions);

  // שלב 4: ביצוע פעולות (אם לא dryRun)
  if (!dryRun) {
    for (const action of reinforcementPlan) {
      if (action.actionType === 'add_faq' || action.actionType === 'improve_semantic_depth') {
        // יצירת תוכן משופר עם AI
        const contentItem = inventory.items.find(i => i.id === action.pageId);
        if (!contentItem) continue;

        const prompt = action.actionType === 'add_faq'
          ? `צור 3-5 שאלות נפוצות (FAQ) רלוונטיות עבור דף בנושא "${contentItem.title}" של העסק "${context.businessName}" בתחום ${context.industry}. החזר HTML עם כותרת h2 ורשימת שאלות ותשובות.`
          : `שפר את התוכן הבא על ידי הוספת עומק סמנטי, כותרות משנה ומידע נוסף. שמור על הטון הקיים.\n\nתוכן נוכחי:\n${contentItem.content.slice(0, 2000)}`;

        const aiResult = await generateWithAI(
          `אתה כותב תוכן SEO מקצועי בעברית עבור "${context.businessName}".`,
          prompt,
          { temperature: 0.4, maxTokens: 1500 }
        );

        if (aiResult.success && aiResult.data) {
          const newContent = action.actionType === 'add_faq'
            ? contentItem.content + '\n\n' + (aiResult.data as string)
            : (aiResult.data as string);

          const updateResult = await updatePageContent(connection, action.pageId, newContent);

          actions.push({
            id: `authority-${action.actionType}-${action.pageId}-${Date.now()}`,
            planId: context.planId || '',
            date: new Date().toISOString(),
            pageId: action.pageId,
            pageUrl: action.pageUrl,
            pageTitle: contentItem.title,
            actionType: action.actionType === 'add_faq' ? 'faq_added' : 'content_section_added',
            module: 'authority-reinforcement-engine',
            description: action.description,
            beforeValue: contentItem.content.slice(0, 200),
            afterValue: newContent.slice(0, 200),
            seoReason: action.reason,
            expectedImpact: action.impactEstimate,
            status: updateResult.success ? 'completed' : 'failed',
            isReversible: true,
            rollbackData: JSON.stringify({ pageId: action.pageId, originalContent: contentItem.content }),
          });
        }
      }
    }
  }

  // תיעוד הניתוח
  actions.push({
    id: `authority-analysis-${Date.now()}`,
    planId: context.planId || '',
    date: new Date().toISOString(),
    actionType: 'technical_issue_found',
    module: 'authority-reinforcement-engine',
    description: `ניתוח סמכות: ${pillarPages.length} דפי עמוד, ${moneyPages.length} דפי מכירה, ${weakPages.length} דפים חלשים. ${reinforcementPlan.length} פעולות חיזוק מומלצות.`,
    seoReason: 'ניתוח מקיף של סמכות הדפים מזהה היכן להשקיע מאמצי SEO',
    expectedImpact: 'high',
    status: 'completed',
    isReversible: false,
  });

  // ציון סמכות כולל
  const overallAuthorityScore = allPages.length > 0
    ? Math.round(allPages.reduce((sum, p) => sum + p.authorityScore, 0) / allPages.length)
    : 0;

  return {
    pillarPages,
    moneyPages,
    weakPages,
    highPotentialPages,
    reinforcementPlan,
    overallAuthorityScore,
    actions,
  };
}
