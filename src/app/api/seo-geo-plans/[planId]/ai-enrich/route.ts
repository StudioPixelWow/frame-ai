import { NextRequest } from 'next/server';
import { ok, err, loadPlan, notFound, updatePlanSafe, logActivity, withErrorBoundary } from '@/lib/seo/api-helpers';
import { generateWithAI } from '@/lib/ai/openai-client';

/**
 * AI SEO Enrichment Endpoint
 *
 * Calls GPT to generate:
 * - 20 smart SEO keywords in 4 categories (CORE, שירותים, בידול, LONG TAIL)
 * - 5 real competitors with analysis
 * - 10 article topics with full content briefs
 *
 * All based on actual business data from the scan.
 */

function buildBusinessContext(plan: any): string {
  const parts: string[] = [];

  const scan = plan.websiteScan || {};
  const facts = scan.websiteFacts || {};
  const profile = plan.businessProfile || {};

  // Business identity
  const businessName = plan.clientName || facts.business_name?.value || facts.business_name || profile.business_name || '';
  const businessType = facts.business_type?.value || facts.business_type || profile.business_type || '';
  const industry = facts.detected_industry?.value || facts.industry || profile.industry || '';
  const location = facts.detected_location?.value || facts.location || profile.location || '';

  if (businessName) parts.push(`שם העסק: ${businessName}`);
  if (businessType) parts.push(`סוג העסק: ${businessType}`);
  if (industry) parts.push(`תחום: ${industry}`);
  if (location) parts.push(`מיקום: ${location}`);

  // Products/Services
  const products = facts.main_products_or_services?.value || facts.main_products_or_services || profile.main_products_or_services || [];
  if (Array.isArray(products) && products.length > 0) {
    parts.push(`שירותים/מוצרים: ${products.join(', ')}`);
  }

  // Target audience
  const audience = facts.target_audience || profile.target_audience || '';
  if (audience) parts.push(`קהל יעד: ${audience}`);

  // Known competitors
  const competitors = facts.known_competitors || profile.known_competitors || [];
  if (Array.isArray(competitors) && competitors.length > 0) {
    parts.push(`מתחרים ידועים: ${competitors.join(', ')}`);
  }

  // Website URL
  if (plan.websiteUrl) parts.push(`כתובת האתר: ${plan.websiteUrl}`);

  // Meta info from scan
  if (scan.metaTitle) parts.push(`כותרת האתר: ${scan.metaTitle}`);
  if (scan.metaDescription) parts.push(`תיאור האתר: ${scan.metaDescription}`);

  // H1 tags (cleaned)
  if (scan.h1Tags && Array.isArray(scan.h1Tags) && scan.h1Tags.length > 0) {
    const cleaned = scan.h1Tags
      .filter((t: string) => t && t.length < 80 && !t.includes('http'))
      .slice(0, 5);
    if (cleaned.length > 0) parts.push(`כותרות H1 באתר: ${cleaned.join(', ')}`);
  }

  // AI visibility queries that were found
  const aiQueries = scan.aiQueries || [];
  if (Array.isArray(aiQueries) && aiQueries.length > 0) {
    const found = aiQueries.filter((q: any) => q.found).map((q: any) => q.query).slice(0, 5);
    const missed = aiQueries.filter((q: any) => !q.found).map((q: any) => q.query).slice(0, 5);
    if (found.length > 0) parts.push(`שאילתות AI שהעסק נמצא בהן: ${found.join(', ')}`);
    if (missed.length > 0) parts.push(`שאילתות AI שהעסק לא נמצא בהן: ${missed.join(', ')}`);
  }

  // Technical issues
  const issues = scan.issues || [];
  if (Array.isArray(issues) && issues.length > 0) {
    const critical = issues.filter((i: any) => i.impact === 'high' || i.type === 'critical').slice(0, 3);
    if (critical.length > 0) {
      parts.push(`בעיות טכניות קריטיות: ${critical.map((i: any) => i.title).join(', ')}`);
    }
  }

  return parts.join('\n');
}

const SYSTEM_PROMPT = `אתה מומחה SEO ושיווק דיגיטלי בישראל עם 15 שנות ניסיון.
אתה מקבל מידע על עסק ישראלי וצריך לייצר אסטרטגיית SEO מותאמת אישית.

חוקים קריטיים:
1. כל התוכן בעברית בלבד
2. ביטויי מפתח חייבים להיות ביטויים שאנשים באמת מחפשים בגוגל ישראל
3. מתחרים חייבים להיות עסקים אמיתיים בתחום (לא ממציאים שמות)
4. נושאי מאמרים חייבים להיות רלוונטיים לעסק ולקידום ביטויי ה-SEO
5. כל הפלט ב-JSON תקני בלבד, בלי markdown, בלי backticks`;

function buildUserPrompt(context: string): string {
  return `הנה המידע על העסק:
${context}

צור אסטרטגיית SEO מלאה בפורמט JSON הבא (בלי backticks, בלי markdown, רק JSON טהור):

{
  "keywords": {
    "core": [
      {"keyword": "ביטוי מפתח ראשי", "searchVolume": "גבוה/בינוני/נמוך", "difficulty": "קשה/בינוני/קל", "intent": "מסחרי/מידעי/ניווטי"}
    ],
    "services": [
      {"keyword": "ביטוי שירות", "searchVolume": "...", "difficulty": "...", "intent": "..."}
    ],
    "differentiation": [
      {"keyword": "ביטוי בידול", "searchVolume": "...", "difficulty": "...", "intent": "..."}
    ],
    "longTail": [
      {"keyword": "ביטוי זנב ארוך", "searchVolume": "...", "difficulty": "...", "intent": "..."}
    ]
  },
  "competitors": [
    {
      "name": "שם המתחרה",
      "domain": "example.co.il",
      "strengths": ["חוזק 1", "חוזק 2"],
      "weaknesses": ["חולשה 1"],
      "estimatedTraffic": "גבוה/בינוני/נמוך",
      "mainKeywords": ["ביטוי 1", "ביטוי 2"]
    }
  ],
  "articles": [
    {
      "title": "כותרת המאמר",
      "targetKeyword": "ביטוי מפתח ראשי",
      "secondaryKeywords": ["ביטוי 2", "ביטוי 3"],
      "outline": ["כותרת משנה 1", "כותרת משנה 2", "כותרת משנה 3", "כותרת משנה 4"],
      "wordCount": 1500,
      "intent": "מידעי/מסחרי",
      "callToAction": "הנעה לפעולה מומלצת",
      "whyThisArticle": "למה מאמר זה חשוב לקידום העסק"
    }
  ]
}

דרישות:
- keywords: 5 ביטויים בכל קטגוריה (סה"כ 20). ביטויים אמיתיים שאנשים מחפשים בישראל.
  - core: ביטויים ראשיים של התחום (לדוגמה: "עורך דין תעבורה", "מספרה בתל אביב")
  - services: ביטויי שירותים ספציפיים (לדוגמה: "ייצוג בבית משפט", "צביעת שיער")
  - differentiation: ביטויים שמבדלים את העסק (לדוגמה: "עורך דין תעבורה 24/7", "מספרה טבעונית")
  - longTail: שאילתות ארוכות שאנשים מחפשים (לדוגמה: "כמה עולה עורך דין תעבורה", "איך לבחור מספרה")
- competitors: 5 מתחרים אמיתיים בתחום בישראל. אם לא מכיר מתחרים ספציפיים, תן שמות גנריים של סוגי עסקים מתחרים עם דומיינים לדוגמה.
- articles: 10 נושאי מאמרים. כל מאמר חייב לקדם ביטוי מפתח ספציפי. תן outline מלא עם 4-6 כותרות משנה.`;
}

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  const businessContext = buildBusinessContext(plan);

  if (!businessContext || businessContext.length < 20) {
    return err('אין מספיק מידע על העסק. יש להריץ סריקה קודם.', 400);
  }

  console.log('[AI-ENRICH] Starting AI enrichment for plan:', planId);
  console.log('[AI-ENRICH] Business context length:', businessContext.length);

  const result = await generateWithAI(
    SYSTEM_PROMPT,
    buildUserPrompt(businessContext),
    { temperature: 0.8, maxTokens: 6000 }
  );

  if (!result.success) {
    console.error('[AI-ENRICH] AI generation failed:', result.error);
    return err(`שגיאה ביצירת תוכן AI: ${result.error}`, 500);
  }

  const aiData = result.data as any;

  // Validate structure
  if (!aiData || typeof aiData !== 'object') {
    console.error('[AI-ENRICH] Invalid AI response structure');
    return err('תגובת AI לא תקינה', 500);
  }

  // Normalize keywords into flat array with categories
  const normalizedKeywords: any[] = [];
  const kwCategories = { core: 'CORE', services: 'שירותים', differentiation: 'בידול', longTail: 'LONG TAIL' };
  for (const [key, label] of Object.entries(kwCategories)) {
    const items = aiData.keywords?.[key] || [];
    for (const item of items) {
      normalizedKeywords.push({
        keyword: item.keyword || '',
        category: label,
        searchVolume: item.searchVolume || 'בינוני',
        difficulty: item.difficulty || 'בינוני',
        intent: item.intent || 'מידעי',
      });
    }
  }

  // Normalize competitors
  const normalizedCompetitors = (aiData.competitors || []).map((c: any) => ({
    name: c.name || '',
    domain: c.domain || '',
    strengths: c.strengths || [],
    weaknesses: c.weaknesses || [],
    estimatedTraffic: c.estimatedTraffic || 'בינוני',
    mainKeywords: c.mainKeywords || [],
    source: 'ai_generated',
  }));

  // Normalize articles
  const normalizedArticles = (aiData.articles || []).map((a: any, i: number) => ({
    id: `article-${i + 1}`,
    title: a.title || '',
    targetKeyword: a.targetKeyword || '',
    secondaryKeywords: a.secondaryKeywords || [],
    outline: a.outline || [],
    wordCount: a.wordCount || 1500,
    intent: a.intent || 'מידעי',
    callToAction: a.callToAction || '',
    whyThisArticle: a.whyThisArticle || '',
    status: 'planned',
  }));

  // Save enrichment to plan
  const enrichment = {
    aiKeywords: normalizedKeywords,
    aiCompetitors: normalizedCompetitors,
    aiArticles: normalizedArticles,
    aiEnrichedAt: new Date().toISOString(),
  };

  const updated = await updatePlanSafe(planId, enrichment);
  if (!updated) return err('Failed to save AI enrichment', 500);

  logActivity(planId, 'ai_enrich', {
    keywordsCount: normalizedKeywords.length,
    competitorsCount: normalizedCompetitors.length,
    articlesCount: normalizedArticles.length,
  });

  console.log('[AI-ENRICH] Success:', {
    keywords: normalizedKeywords.length,
    competitors: normalizedCompetitors.length,
    articles: normalizedArticles.length,
  });

  return ok(enrichment);
});
