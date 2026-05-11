// אופטימיזציית נראות GEO — התאמת דפים למנועי חיפוש AI
// GEO Visibility Optimizer — optimizes pages for AI search engines
// (Google AI Overview, ChatGPT, Gemini, Claude, Perplexity)

import type { WPConnection } from './wordpress-client';
import { updatePageContent } from './wordpress-client';
import { generateWithAI } from '@/lib/ai/openai-client';
import type { ContentItem, ContentInventory } from './wp-content-inventory';
import { buildContentInventory } from './wp-content-inventory';
import type { SEOActionEntry } from './seo-action-log';
import { createActionLog } from './seo-action-log';
import type { AutomationContext } from './seo-automator';

// ============================================================================
// סוגים וממשקים
// ============================================================================

export interface GEOOptimization {
  pageId: number;
  pageUrl: string;
  pageTitle: string;
  currentGEOScore: number; // 0-100
  optimizations: GEOAction[];
  targetPlatforms: string[];
}

export interface GEOAction {
  type:
    | 'answer_block'
    | 'definition'
    | 'structured_explanation'
    | 'entity_enrichment'
    | 'trust_signal'
    | 'summary_section'
    | 'expert_paragraph'
    | 'faq_for_ai';
  content: string; // HTML להוספה
  insertionPoint: 'after_intro' | 'before_conclusion' | 'after_h2' | 'end_of_content';
  reason: string;
  expectedImpact: string;
}

export interface GEOResult {
  pagesOptimized: number;
  answerBlocksAdded: number;
  definitionsAdded: number;
  structuredExplanationsAdded: number;
  entityEnrichmentsAdded: number;
  trustSignalsAdded: number;
  actions: SEOActionEntry[];
}

// ============================================================================
// פלטפורמות AI נתמכות
// ============================================================================

const AI_PLATFORMS = [
  'Google AI Overview',
  'ChatGPT Search',
  'Gemini',
  'Claude',
  'Perplexity',
];

// ============================================================================
// ניקוד מוכנות GEO
// ============================================================================

/**
 * ציון מוכנות GEO — כמה הדף מותאם לציטוט על-ידי מנועי AI
 * בודק: בלוק תשובה, הגדרות, מבנה, ישויות, FAQ, אותות אמינות, סיכום
 */
export function scoreGEOReadiness(
  item: ContentItem,
  context: AutomationContext
): number {
  let score = 0;
  const plainLower = item.plainText.toLowerCase();

  // --- בלוק תשובה ישירה (פסקה ראשונה עונה על שאלה) --- (0-20)
  const firstParagraph = item.plainText.slice(0, 250).trim();
  if (firstParagraph.length >= 50) {
    // יש פסקת פתיחה סבירה
    score += 8;
    // בדוק אם כוללת מילת מפתח
    const hasKeywordInOpening = context.targetKeywords.some((kw) =>
      firstParagraph.toLowerCase().includes(kw.toLowerCase())
    );
    if (hasKeywordInOpening) score += 7;
    // בדוק אם כוללת שם עסק
    if (firstParagraph.toLowerCase().includes(context.businessName.toLowerCase())) {
      score += 5;
    }
  }

  // --- הגדרות (definition blocks) --- (0-10)
  const hasDefinition =
    plainLower.includes('הגדרה') ||
    plainLower.includes('מהו ') ||
    plainLower.includes('מהי ') ||
    plainLower.includes('מה זה ') ||
    plainLower.includes('definition');
  if (hasDefinition) score += 10;

  // --- סקשנים מובנים (structured sections) --- (0-15)
  if (item.h2Count >= 2) score += 5;
  if (item.h2Count >= 4) score += 5;
  // בדוק אם יש רשימות ממוספרות או בולטים
  const hasLists =
    item.content.includes('<ol') ||
    item.content.includes('<ul') ||
    item.content.includes('<li');
  if (hasLists) score += 5;

  // --- כיסוי ישויות (entities) --- (0-15)
  const entities = [context.businessName, context.location, ...context.products].filter(Boolean);
  const mentionedEntities = entities.filter((e) =>
    plainLower.includes(e.toLowerCase())
  );
  const entityRatio = entities.length > 0 ? mentionedEntities.length / entities.length : 0;
  score += Math.round(entityRatio * 15);

  // --- FAQ --- (0-10)
  if (item.hasFAQ) score += 10;

  // --- אותות אמינות (trust signals) --- (0-15)
  const trustIndicators = [
    'ניסיון', 'מומחה', 'מומחית', 'מוסמך', 'מוסמכת',
    'שנות ניסיון', 'מקצועי', 'מקצועית', 'הכשרה',
    'expert', 'certified', 'professional', 'experience',
    'מקור', 'מחקר', 'לפי', 'על-פי', 'according',
  ];
  const trustCount = trustIndicators.filter((t) => plainLower.includes(t)).length;
  score += Math.min(trustCount * 3, 15);

  // --- סקשן סיכום --- (0-10)
  const hasSummary =
    plainLower.includes('סיכום') ||
    plainLower.includes('לסיכום') ||
    plainLower.includes('בשורה התחתונה') ||
    plainLower.includes('summary') ||
    plainLower.includes('conclusion');
  if (hasSummary) score += 10;

  // --- אורך תוכן מינימלי --- (0-5)
  if (item.wordCount >= 300) score += 3;
  if (item.wordCount >= 800) score += 2;

  return Math.min(100, score);
}

// ============================================================================
// יצירת תוכן GEO בעזרת AI
// ============================================================================

/**
 * יצירת תשובה ישירה וקצרה (50-80 מילים) — מתאימה לציטוט ב-Google AI Overview
 */
export async function generateConciseAnswer(
  pageTitle: string,
  content: string,
  keyword: string,
  businessName: string
): Promise<string> {
  const systemPrompt = `אתה כותב תשובות קצרות ומדויקות בעברית, מותאמות לציטוט על-ידי Google AI Overview.
כללים:
- 50-80 מילים בלבד
- התחל עם תשובה ישירה (ללא "בוא נדבר על...")
- כלול את מילת המפתח ואת שם העסק
- שפה מקצועית וסמכותית
- החזר HTML: פסקה אחת ב-<p>`;

  const userPrompt = `כותרת הדף: ${pageTitle}
מילת מפתח: ${keyword}
שם עסק: ${businessName}
תוכן הדף (קיצור): ${content.substring(0, 600)}

כתוב תשובה ישירה וקצרה. HTML בלבד.`;

  const result = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.5,
    maxTokens: 400,
  });

  if (!result.success || !result.data) return '';
  let html = String(result.data);
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');
  return html.trim();
}

/**
 * יצירת פסקת הגדרה ברורה
 */
export async function generateDefinitionBlock(
  term: string,
  context: string,
  businessName: string
): Promise<string> {
  const systemPrompt = `אתה כותב הגדרות ברורות וקצרות בעברית. ההגדרות מיועדות לציטוט על-ידי מנועי חיפוש AI.
כללים:
- 2-3 משפטים
- התחל עם "מה זה [TERM]?" כ-H3
- הגדרה ישירה ומדויקת
- כלול את שם העסק כשרלוונטי
- החזר HTML (H3 + פסקה)`;

  const userPrompt = `מונח להגדרה: ${term}
שם עסק: ${businessName}
הקשר: ${context.substring(0, 400)}

כתוב בלוק הגדרה. HTML בלבד.`;

  const result = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.5,
    maxTokens: 400,
  });

  if (!result.success || !result.data) return '';
  let html = String(result.data);
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');
  return html.trim();
}

/**
 * יצירת הסבר מובנה — שלבים או תהליך
 */
export async function generateStructuredExplanation(
  topic: string,
  content: string
): Promise<string> {
  const systemPrompt = `אתה כותב הסברים מובנים בעברית — שלב-אחר-שלב או רשימה מאורגנת.
כללים:
- 3-6 שלבים/נקודות
- כל שלב: כותרת קצרה + משפט הסבר
- השתמש ברשימה ממוספרת (<ol>) או בולטים (<ul>)
- כלול כותרת H3
- החזר HTML בלבד`;

  const userPrompt = `נושא: ${topic}
הקשר תוכן: ${content.substring(0, 500)}

כתוב הסבר מובנה. HTML בלבד.`;

  const result = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.6,
    maxTokens: 800,
  });

  if (!result.success || !result.data) return '';
  let html = String(result.data);
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');
  return html.trim();
}

/**
 * העשרת תוכן בישויות — שם עסק, מיקום, מוצרים, מונחי תעשייה
 */
export async function generateEntityEnrichment(
  content: string,
  businessName: string,
  products: string[],
  location: string
): Promise<string> {
  const systemPrompt = `אתה כותב פסקאות העשרה סמנטית בעברית שמשלבות ישויות עסקיות בצורה טבעית.
כללים:
- פסקה אחת (3-4 משפטים)
- שלב את שם העסק, המיקום, והמוצרים/שירותים בצורה טבעית
- אל תיראה כספאם — כתוב טקסט שמוסיף ערך
- החזר HTML: <p> בלבד`;

  const productList = products.slice(0, 5).join(', ');
  const userPrompt = `שם עסק: ${businessName}
מיקום: ${location}
מוצרים/שירותים: ${productList}
הקשר תוכן: ${content.substring(0, 400)}

כתוב פסקת העשרה. HTML בלבד.`;

  const result = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.6,
    maxTokens: 400,
  });

  if (!result.success || !result.data) return '';
  let html = String(result.data);
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');
  return html.trim();
}

/**
 * יצירת פסקת אמינות — expert-style trust paragraph
 */
export async function generateTrustSignal(
  businessName: string,
  industry: string,
  topic: string
): Promise<string> {
  const systemPrompt = `אתה כותב פסקאות אמינות מקצועיות בעברית שמשדרות סמכות ומומחיות.
כללים:
- 2-3 משפטים
- שלב ניסיון, מומחיות, או הכשרה מקצועית
- התייחס לתחום התעשייה
- כלול את שם העסק
- אל תמציא עובדות ספציפיות (מספרים, שנים) — כתוב באופן כללי
- החזר HTML: <p> עם class="trust-signal"`;

  const userPrompt = `שם עסק: ${businessName}
תעשייה: ${industry}
נושא: ${topic}

כתוב פסקת אמינות. HTML בלבד.`;

  const result = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.6,
    maxTokens: 400,
  });

  if (!result.success || !result.data) return '';
  let html = String(result.data);
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');
  return html.trim();
}

// ============================================================================
// ניתוח וייצור אופטימיזציות לדף
// ============================================================================

/**
 * נתח דף ובנה רשימת אופטימיזציות GEO נדרשות
 */
function buildPageOptimizations(
  item: ContentItem,
  context: AutomationContext
): GEOOptimization {
  const geoScore = scoreGEOReadiness(item, context);
  const optimizations: GEOAction[] = [];
  const plainLower = item.plainText.toLowerCase();

  // --- בלוק תשובה ישירה ---
  const firstParagraph = item.plainText.slice(0, 250).trim();
  const hasDirectAnswer = firstParagraph.length >= 50 &&
    context.targetKeywords.some((kw) => firstParagraph.toLowerCase().includes(kw.toLowerCase()));

  if (!hasDirectAnswer) {
    optimizations.push({
      type: 'answer_block',
      content: '', // ייוצר ע"י AI
      insertionPoint: 'after_intro',
      reason: 'חסר בלוק תשובה ישירה — מנועי AI מעדיפים תשובות מידיות',
      expectedImpact: 'שיפור סיכוי ציטוט ב-Google AI Overview ו-Perplexity',
    });
  }

  // --- הגדרה ---
  const hasDefinition =
    plainLower.includes('הגדרה') ||
    plainLower.includes('מהו ') ||
    plainLower.includes('מהי ') ||
    plainLower.includes('מה זה ');
  if (!hasDefinition) {
    optimizations.push({
      type: 'definition',
      content: '',
      insertionPoint: 'after_h2',
      reason: 'חסרה הגדרה — מנועי AI משתמשים בהגדרות כציטוטים מועדפים',
      expectedImpact: 'שיפור ציטוט עבור שאילתות "מה זה X"',
    });
  }

  // --- הסבר מובנה ---
  const hasStructured =
    item.content.includes('<ol') ||
    (item.content.includes('<ul') && item.h2Count >= 3);
  if (!hasStructured && item.wordCount > 200) {
    optimizations.push({
      type: 'structured_explanation',
      content: '',
      insertionPoint: 'after_h2',
      reason: 'חסר הסבר מובנה (שלבים/רשימה) — מנועי AI מעדיפים תוכן מסודר',
      expectedImpact: 'שיפור הצגה ב-ChatGPT Search ו-Gemini',
    });
  }

  // --- העשרת ישויות ---
  const entities = [context.businessName, context.location, ...context.products].filter(Boolean);
  const mentionedEntities = entities.filter((e) =>
    plainLower.includes(e.toLowerCase())
  );
  if (entities.length > 0 && mentionedEntities.length / entities.length < 0.5) {
    optimizations.push({
      type: 'entity_enrichment',
      content: '',
      insertionPoint: 'before_conclusion',
      reason: 'כיסוי ישויות חלש — מנועי AI צריכים ישויות לייחוס תוכן',
      expectedImpact: 'שיפור רלוונטיות וייחוס לעסק ספציפי',
    });
  }

  // --- אות אמינות ---
  const trustIndicators = ['ניסיון', 'מומחה', 'מוסמך', 'מקצועי', 'הכשרה'];
  const hasTrust = trustIndicators.some((t) => plainLower.includes(t));
  if (!hasTrust) {
    optimizations.push({
      type: 'trust_signal',
      content: '',
      insertionPoint: 'end_of_content',
      reason: 'חסרים אותות אמינות — מנועי AI מעדיפים מקורות סמכותיים',
      expectedImpact: 'שיפור דירוג E-E-A-T וציטוט מועדף',
    });
  }

  return {
    pageId: item.id,
    pageUrl: item.url,
    pageTitle: item.title,
    currentGEOScore: geoScore,
    optimizations,
    targetPlatforms: AI_PLATFORMS,
  };
}

// ============================================================================
// החלת אופטימיזציות
// ============================================================================

/**
 * החלת אופטימיזציות GEO על דפים — יצירת תוכן AI והזרקה לדפים
 */
export async function applyGEOOptimizations(
  optimizations: GEOOptimization[],
  connection: WPConnection,
  dryRun: boolean = false,
  planId: string = ''
): Promise<GEOResult> {
  const actionLog = createActionLog();
  const result: GEOResult = {
    pagesOptimized: 0,
    answerBlocksAdded: 0,
    definitionsAdded: 0,
    structuredExplanationsAdded: 0,
    entityEnrichmentsAdded: 0,
    trustSignalsAdded: 0,
    actions: [],
  };

  for (const opt of optimizations) {
    if (opt.optimizations.length === 0) continue;

    try {
      console.log(`[GEO] מייעל דף: ${opt.pageTitle} (${opt.optimizations.length} אופטימיזציות)`);

      // אם dry run, רשום בלבד ללא שינוי
      if (dryRun) {
        for (const action of opt.optimizations) {
          actionLog.log({
            planId,
            actionType: geoActionToSEOActionType(action.type),
            module: 'geo-visibility-optimizer',
            status: 'skipped',
            pageId: opt.pageId,
            pageUrl: opt.pageUrl,
            pageTitle: opt.pageTitle,
            description: `[DRY RUN] ${action.type}: ${action.reason}`,
            seoReason: action.reason,
            expectedImpact: 'medium',
            isReversible: false,
          });
        }
        continue;
      }

      // טען את תוכן הדף הנוכחי (משתמשים בתוכן מהאופטימיזציה)
      // בפועל נזדקק לתוכן — נשלוף מ-inventory או API
      let pageContent = ''; // ייקבע מהאינוונטורי

      // צור ויישם כל אופטימיזציה
      let contentChanged = false;
      for (const action of opt.optimizations) {
        let generatedContent = '';

        switch (action.type) {
          case 'answer_block': {
            const keyword = opt.pageTitle;
            generatedContent = await generateConciseAnswer(opt.pageTitle, pageContent, keyword, '');
            if (generatedContent) result.answerBlocksAdded++;
            break;
          }
          case 'definition': {
            generatedContent = await generateDefinitionBlock(opt.pageTitle, pageContent, '');
            if (generatedContent) result.definitionsAdded++;
            break;
          }
          case 'structured_explanation': {
            generatedContent = await generateStructuredExplanation(opt.pageTitle, pageContent);
            if (generatedContent) result.structuredExplanationsAdded++;
            break;
          }
          case 'entity_enrichment': {
            generatedContent = await generateEntityEnrichment(pageContent, '', [], '');
            if (generatedContent) result.entityEnrichmentsAdded++;
            break;
          }
          case 'trust_signal': {
            generatedContent = await generateTrustSignal('', '', opt.pageTitle);
            if (generatedContent) result.trustSignalsAdded++;
            break;
          }
        }

        if (generatedContent) {
          action.content = generatedContent;
          pageContent = insertContentAtPoint(pageContent, generatedContent, action.insertionPoint);
          contentChanged = true;
        }
      }

      // עדכן את הדף אם היו שינויים
      if (contentChanged && pageContent) {
        const updateResult = await updatePageContent(connection, opt.pageId, pageContent);
        if (updateResult.success) {
          result.pagesOptimized++;
          actionLog.log({
            planId,
            actionType: 'content_section_added',
            module: 'geo-visibility-optimizer',
            status: 'completed',
            pageId: opt.pageId,
            pageUrl: opt.pageUrl,
            pageTitle: opt.pageTitle,
            description: `אופטימיזציית GEO: ${opt.optimizations.map((o) => o.type).join(', ')}`,
            seoReason: 'שיפור נראות בתוצאות מנועי חיפוש AI',
            expectedImpact: 'high',
            isReversible: true,
          });
        } else {
          actionLog.log({
            planId,
            actionType: 'content_section_added',
            module: 'geo-visibility-optimizer',
            status: 'failed',
            pageId: opt.pageId,
            pageUrl: opt.pageUrl,
            pageTitle: opt.pageTitle,
            description: `שגיאה בעדכון: ${updateResult.error || 'לא ידוע'}`,
            seoReason: 'שיפור נראות GEO',
            expectedImpact: 'high',
            isReversible: false,
          });
        }
      }
    } catch (error) {
      console.error(`[GEO] שגיאה באופטימיזציית דף ${opt.pageId}:`, error);
      actionLog.log({
        planId,
        actionType: 'content_section_added',
        module: 'geo-visibility-optimizer',
        status: 'failed',
        pageId: opt.pageId,
        pageUrl: opt.pageUrl,
        pageTitle: opt.pageTitle,
        description: `שגיאה: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
        seoReason: 'שיפור נראות GEO',
        expectedImpact: 'high',
        isReversible: false,
      });
    }
  }

  result.actions = actionLog.getAllEntries();
  return result;
}

// ============================================================================
// אורקסטרציה ראשית
// ============================================================================

/**
 * הרצת אופטימיזציית GEO מלאה — סריקה, ניתוח, יצירת תוכן, והחלה
 */
export async function executeGEOOptimizer(
  connection: WPConnection,
  context: AutomationContext,
  inventory?: ContentInventory,
  options?: {
    maxPagesPerRun?: number;
    dryRun?: boolean;
  }
): Promise<GEOResult> {
  const maxPages = options?.maxPagesPerRun ?? 10;
  const dryRun = options?.dryRun ?? false;

  // שלב 1: בנה אינוונטורי אם לא סופק
  const inv = inventory ?? await buildContentInventory(connection);

  // שלב 2: ציין כל דף ובנה אופטימיזציות
  const allOptimizations: Array<{ opt: GEOOptimization; score: number }> = [];

  for (const item of inv.items) {
    const opt = buildPageOptimizations(item, context);
    if (opt.optimizations.length > 0) {
      allOptimizations.push({ opt, score: opt.currentGEOScore });
    }
  }

  // שלב 3: מיין לפי ציון GEO (הנמוך ביותר קודם) ובחר עד maxPages
  allOptimizations.sort((a, b) => a.score - b.score);
  const selectedOptimizations = allOptimizations
    .slice(0, maxPages)
    .map((o) => o.opt);

  console.log(
    `[GEO] נמצאו ${allOptimizations.length} דפים לאופטימיזציה, ` +
    `נבחרו ${selectedOptimizations.length} (סף: ${maxPages})`
  );

  // שלב 4: אכלס תוכן AI ויישם
  // נזדקק לתוכן המלא מהאינוונטורי עבור כל דף
  for (const opt of selectedOptimizations) {
    const item = inv.items.find((i) => i.id === opt.pageId);
    if (!item) continue;

    // אכלס את התוכן שנוצר ע"י AI עבור כל אופטימיזציה
    for (const action of opt.optimizations) {
      try {
        switch (action.type) {
          case 'answer_block': {
            const keyword = context.targetKeywords[0] || item.title;
            action.content = await generateConciseAnswer(
              item.title,
              item.plainText,
              keyword,
              context.businessName
            );
            break;
          }
          case 'definition': {
            const term = context.targetKeywords[0] || item.title;
            action.content = await generateDefinitionBlock(
              term,
              item.plainText,
              context.businessName
            );
            break;
          }
          case 'structured_explanation': {
            action.content = await generateStructuredExplanation(
              item.title,
              item.plainText
            );
            break;
          }
          case 'entity_enrichment': {
            action.content = await generateEntityEnrichment(
              item.plainText,
              context.businessName,
              context.products,
              context.location
            );
            break;
          }
          case 'trust_signal': {
            action.content = await generateTrustSignal(
              context.businessName,
              context.industry,
              item.title
            );
            break;
          }
        }
      } catch (error) {
        console.error(`[GEO] שגיאה ביצירת ${action.type} עבור דף ${item.id}:`, error);
        action.content = '';
      }
    }

    // סנן אופטימיזציות ריקות
    opt.optimizations = opt.optimizations.filter((a) => a.content.length > 0);
  }

  // שלב 5: יישם אופטימיזציות עם תוכן ממולא
  // נעבד את ההחלה ידנית (לא דרך applyGEOOptimizations) כדי לגשת לתוכן המלא
  const actionLog = createActionLog();
  const result: GEOResult = {
    pagesOptimized: 0,
    answerBlocksAdded: 0,
    definitionsAdded: 0,
    structuredExplanationsAdded: 0,
    entityEnrichmentsAdded: 0,
    trustSignalsAdded: 0,
    actions: [],
  };

  for (const opt of selectedOptimizations) {
    if (opt.optimizations.length === 0) continue;

    const item = inv.items.find((i) => i.id === opt.pageId);
    if (!item) continue;

    if (dryRun) {
      for (const action of opt.optimizations) {
        actionLog.log({
          planId: context.planId || '',
          actionType: geoActionToSEOActionType(action.type),
          module: 'geo-visibility-optimizer',
          status: 'skipped',
          pageId: opt.pageId,
          pageUrl: opt.pageUrl,
          pageTitle: opt.pageTitle,
          description: `[DRY RUN] ${action.type}: ${action.reason}`,
          seoReason: action.reason,
          expectedImpact: 'medium',
          isReversible: false,
        });
        countGEOAction(result, action.type);
      }
      continue;
    }

    try {
      // הזרק אופטימיזציות לתוכן הדף
      let content = item.content;
      for (const action of opt.optimizations) {
        content = insertContentAtPoint(content, action.content, action.insertionPoint);
        countGEOAction(result, action.type);
      }

      const updateResult = await updatePageContent(connection, opt.pageId, content);
      if (updateResult.success) {
        result.pagesOptimized++;
        actionLog.log({
          planId: context.planId || '',
          actionType: 'content_section_added',
          module: 'geo-visibility-optimizer',
          status: 'completed',
          pageId: opt.pageId,
          pageUrl: opt.pageUrl,
          pageTitle: opt.pageTitle,
          description: `אופטימיזציית GEO: ${opt.optimizations.map((o) => o.type).join(', ')}`,
          seoReason: 'שיפור נראות בתוצאות מנועי חיפוש AI',
          expectedImpact: 'high',
          isReversible: true,
          rollbackData: JSON.stringify({ originalContent: item.content }),
        });
      } else {
        actionLog.log({
          planId: context.planId || '',
          actionType: 'content_section_added',
          module: 'geo-visibility-optimizer',
          status: 'failed',
          pageId: opt.pageId,
          pageUrl: opt.pageUrl,
          pageTitle: opt.pageTitle,
          description: `שגיאה בעדכון: ${updateResult.error || 'שגיאה לא ידועה'}`,
          seoReason: 'שיפור נראות GEO',
          expectedImpact: 'high',
          isReversible: false,
        });
      }
    } catch (error) {
      console.error(`[GEO] שגיאה ביישום אופטימיזציות לדף ${opt.pageId}:`, error);
      actionLog.log({
        planId: context.planId || '',
        actionType: 'content_section_added',
        module: 'geo-visibility-optimizer',
        status: 'failed',
        pageId: opt.pageId,
        pageUrl: opt.pageUrl,
        pageTitle: opt.pageTitle,
        description: `שגיאה: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
        seoReason: 'שיפור נראות GEO',
        expectedImpact: 'high',
        isReversible: false,
      });
    }
  }

  result.actions = actionLog.getAllEntries();
  return result;
}

// ============================================================================
// פונקציות עזר פנימיות
// ============================================================================

/**
 * הזרקת תוכן בנקודת הכנסה מוגדרת
 */
function insertContentAtPoint(
  content: string,
  newHtml: string,
  insertionPoint: GEOAction['insertionPoint']
): string {
  if (!newHtml || !content) return content || newHtml;

  switch (insertionPoint) {
    case 'after_intro': {
      // אחרי H1 או פסקה ראשונה
      const h1End = content.indexOf('</h1>');
      if (h1End > 0) {
        const pos = h1End + '</h1>'.length;
        return content.substring(0, pos) + '\n\n' + newHtml + '\n\n' + content.substring(pos);
      }
      const firstPEnd = content.indexOf('</p>');
      if (firstPEnd > 0) {
        const pos = firstPEnd + '</p>'.length;
        return content.substring(0, pos) + '\n\n' + newHtml + '\n\n' + content.substring(pos);
      }
      return newHtml + '\n\n' + content;
    }

    case 'before_conclusion': {
      // לפני הפסקה האחרונה
      const lastPStart = content.lastIndexOf('<p');
      if (lastPStart > 0) {
        return content.substring(0, lastPStart) + newHtml + '\n\n' + content.substring(lastPStart);
      }
      return content + '\n\n' + newHtml;
    }

    case 'after_h2': {
      // אחרי ה-H2 הראשון
      const h2End = content.indexOf('</h2>');
      if (h2End > 0) {
        const pos = h2End + '</h2>'.length;
        return content.substring(0, pos) + '\n\n' + newHtml + '\n\n' + content.substring(pos);
      }
      // אם אין H2, הוסף באמצע
      const mid = Math.floor(content.length / 2);
      const nearestP = content.indexOf('</p>', mid);
      if (nearestP > 0) {
        const pos = nearestP + '</p>'.length;
        return content.substring(0, pos) + '\n\n' + newHtml + '\n\n' + content.substring(pos);
      }
      return content + '\n\n' + newHtml;
    }

    case 'end_of_content':
    default: {
      return content + '\n\n' + newHtml;
    }
  }
}

/**
 * המרת סוג פעולת GEO לסוג פעולת SEO Action Log
 */
function geoActionToSEOActionType(type: GEOAction['type']): import('./seo-action-log').SEOActionType {
  switch (type) {
    case 'answer_block': return 'answer_block_added';
    case 'definition': return 'content_section_added';
    case 'structured_explanation': return 'content_section_added';
    case 'entity_enrichment': return 'content_section_added';
    case 'trust_signal': return 'content_section_added';
    case 'summary_section': return 'content_section_added';
    case 'expert_paragraph': return 'content_section_added';
    case 'faq_for_ai': return 'faq_added';
    default: return 'content_section_added';
  }
}

/**
 * ספירת סוג פעולת GEO בתוצאות
 */
function countGEOAction(result: GEOResult, type: GEOAction['type']): void {
  switch (type) {
    case 'answer_block':
      result.answerBlocksAdded++;
      break;
    case 'definition':
      result.definitionsAdded++;
      break;
    case 'structured_explanation':
      result.structuredExplanationsAdded++;
      break;
    case 'entity_enrichment':
      result.entityEnrichmentsAdded++;
      break;
    case 'trust_signal':
      result.trustSignalsAdded++;
      break;
  }
}
