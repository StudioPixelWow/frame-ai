import { NextRequest, NextResponse } from 'next/server';
import { ok, err, loadPlan, notFound, updatePlanSafe, logActivity, withErrorBoundary } from '@/lib/seo/api-helpers';
import { generate60DayPlan } from '@/lib/seo/plan-engine';
import type { PlanInput } from '@/lib/seo/plan-engine';
import { generateWithAI } from '@/lib/ai/openai-client';

export const maxDuration = 300; // 5 minutes — needed for generating 8 full articles

/**
 * Call AI to generate smart keywords for the plan engine.
 * Returns an array of keyword strings prioritized for the business.
 */
async function generateAIKeywords(plan: any): Promise<string[]> {
  const facts = plan.websiteScan?.websiteFacts || {};
  const profile = plan.businessProfile || {};
  const businessName = plan.clientName || facts.business_name?.value || facts.business_name || '';
  const businessType = facts.business_type?.value || facts.business_type || profile.business_type || '';
  const products = facts.main_products_or_services?.value || facts.main_products_or_services || profile.main_products_or_services || [];
  const audience = facts.target_audience || profile.target_audience || '';

  if (!businessName && !businessType) return extractKeywordsFallback(plan);

  const context = [
    businessName ? `שם העסק: ${businessName}` : '',
    businessType ? `סוג העסק: ${businessType}` : '',
    Array.isArray(products) && products.length > 0 ? `שירותים: ${products.join(', ')}` : '',
    audience ? `קהל יעד: ${audience}` : '',
    plan.websiteUrl ? `אתר: ${plan.websiteUrl}` : '',
  ].filter(Boolean).join('\n');

  try {
    const result = await generateWithAI(
      'אתה מומחה SEO ישראלי. החזר רשימת 15 ביטויי מפתח בעברית שאנשים מחפשים בגוגל, מותאמים לעסק. החזר JSON בלבד: {"keywords": ["ביטוי 1", "ביטוי 2", ...]}',
      `הנה המידע על העסק:\n${context}\n\nצור 15 ביטויי SEO רלוונטיים בעברית. שלב ביטויים ראשיים, ביטויי שירותים, וביטויי זנב ארוך. JSON בלבד.`,
      { temperature: 0.7, maxTokens: 1000 }
    );
    if (result.success && result.data) {
      const data = result.data as any;
      if (Array.isArray(data.keywords)) {
        console.log('[60-DAY-PLAN] AI generated', data.keywords.length, 'keywords');
        return data.keywords.filter((k: string) => typeof k === 'string' && k.length > 1);
      }
    }
  } catch (e) {
    console.error('[60-DAY-PLAN] AI keyword generation failed, using fallback:', e);
  }
  return extractKeywordsFallback(plan);
}

/**
 * Call AI to generate article topics with full content briefs.
 * Returns structured article objects that the plan engine can use.
 */
async function generateAIArticles(plan: any, keywords: string[]): Promise<any[]> {
  const facts = plan.websiteScan?.websiteFacts || {};
  const profile = plan.businessProfile || {};
  const businessName = plan.clientName || facts.business_name?.value || facts.business_name || '';
  const businessType = facts.business_type?.value || facts.business_type || profile.business_type || '';

  if (!businessName && !businessType) return [];

  const topKeywords = keywords.slice(0, 8).join(', ');

  try {
    const result = await generateWithAI(
      `אתה מומחה תוכן ו-SEO ישראלי עם 15 שנות ניסיון. אתה יוצר תוכניות תוכן אסטרטגיות לעסקים.`,
      `העסק: ${businessName} (${businessType})
ביטויי מפתח: ${topKeywords}
השנה הנוכחית: ${new Date().getFullYear()}

צור 8 נושאי מאמרים אסטרטגיים שיקדמו את העסק בגוגל ובפלטפורמות AI.
כל מאמר חייב לקדם ביטוי מפתח ספציפי.
חשוב: אל תשתמש בשנים ישנות בכותרות — השתמש בשנת ${new Date().getFullYear()} בלבד.

החזר JSON בלבד:
{"articles": [
  {
    "title": "כותרת המאמר בעברית",
    "targetKeyword": "ביטוי המפתח שהמאמר מקדם",
    "outline": ["כותרת משנה 1", "כותרת משנה 2", "כותרת משנה 3", "כותרת משנה 4"],
    "wordCount": 1500,
    "whyThisArticle": "למה מאמר זה חשוב"
  }
]}`,
      { temperature: 0.8, maxTokens: 3000 }
    );
    if (result.success && result.data) {
      const data = result.data as any;
      if (Array.isArray(data.articles)) {
        console.log('[60-DAY-PLAN] AI generated', data.articles.length, 'article topics');
        return data.articles;
      }
    }
  } catch (e) {
    console.error('[60-DAY-PLAN] AI article generation failed:', e);
  }
  return [];
}

/**
 * Generate the full article content (1500+ words) for a single article.
 * Called automatically during plan generation for all 8 articles.
 */
async function generateFullArticle(plan: any, article: any): Promise<any> {
  const facts = plan.websiteScan?.websiteFacts || {};
  const profile = plan.businessProfile || {};
  const businessName = plan.clientName || facts.business_name?.value || facts.business_name || '';
  const businessType = facts.business_type?.value || facts.business_type || profile.business_type || '';
  const products = facts.main_products_or_services?.value || facts.main_products_or_services || profile.main_products_or_services || [];

  const title = article.title || '';
  const targetKeyword = article.targetKeyword || title;
  const outline = article.outline || [];

  const outlineSection = Array.isArray(outline) && outline.length > 0
    ? `\nמבנה המאמר (כותרות משנה):\n${outline.map((h: string, i: number) => `${i + 1}. ${h}`).join('\n')}`
    : '';

  const productsStr = Array.isArray(products) && products.length > 0
    ? `\nשירותים/מוצרים: ${products.join(', ')}`
    : '';

  try {
    const result = await generateWithAI(
      `אתה כותב תוכן SEO מקצועי בעברית עם 15 שנות ניסיון. אתה כותב מאמרים מלאים, עמוקים ומקצועיים שמדרגים גבוה בגוגל ומקבלים אזכורים במנועי AI.

כללים:
- כתוב בעברית מקצועית וטבעית
- אורך מינימלי: 1500 מילים
- שלב את ביטוי המפתח בצורה טבעית (3-5 פעמים)
- כתוב כותרות H2 ו-H3 ברורות
- כלול דוגמאות מעשיות ונתונים
- סיים עם FAQ (3 שאלות ותשובות)
- סיים עם CTA לעסק
- אל תכתוב "מאמר זה..." או "במאמר הזה..." — כתוב ישר לתוכן`,
      `כתוב מאמר SEO מלא בעברית.

שם העסק: ${businessName}
סוג העסק: ${businessType}${productsStr}
השנה הנוכחית: ${new Date().getFullYear()}

כותרת המאמר: "${title}"
ביטוי מפתח: "${targetKeyword}"${outlineSection}
חשוב: כל אזכור שנה במאמר חייב להיות ${new Date().getFullYear()} — אל תשתמש בשנים ישנות.

כתוב את המאמר המלא (1500+ מילים). כלול:
1. פתיחה מרתקת (150 מילים)
2. 4-6 סעיפים עם H2 (כל אחד 200-300 מילים)
3. תת-סעיפים עם H3 לפחות ב-2 סעיפים
4. דוגמאות מעשיות ונתונים
5. FAQ — 3 שאלות ותשובות
6. סיכום + CTA ל-${businessName}

החזר JSON:
{
  "article": "תוכן המאמר המלא בHTML עם תגיות h2, h3, p, ul, li",
  "wordCount": 1500,
  "metaTitle": "כותרת Meta (60 תווים)",
  "metaDescription": "תיאור Meta (155 תווים)",
  "faq": [{"question": "שאלה", "answer": "תשובה"}]
}`,
      { temperature: 0.7, maxTokens: 8000 }
    );

    if (result.success && result.data) {
      const data = result.data as any;
      return {
        fullArticle: data.article || '',
        wordCount: data.wordCount || 1500,
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
        faq: data.faq || [],
        generatedAt: new Date().toISOString(),
        status: 'written',
      };
    }
  } catch (e) {
    console.error(`[60-DAY-PLAN] Failed to generate article "${title}":`, e);
  }
  return null;
}

/**
 * Fallback: Extract keywords from business profile ONLY (no H1 tags — those are unreliable)
 */
function extractKeywordsFallback(plan: any): string[] {
  const keywords = new Set<string>();
  const profile = plan.businessProfile || {};

  // PRIORITY 1: User-confirmed business profile products
  const profileProducts = profile.main_products_or_services;
  if (Array.isArray(profileProducts)) {
    profileProducts.forEach((service: string) => {
      if (service && typeof service === 'string' && service.length < 50) {
        keywords.add(service.trim());
      }
    });
  }

  // PRIORITY 2: WebsiteFacts products (AI-extracted, not raw H1 tags)
  if (keywords.size === 0 && plan.websiteScan?.websiteFacts?.main_products_or_services) {
    const facts = plan.websiteScan.websiteFacts.main_products_or_services;
    if (Array.isArray(facts)) {
      facts.forEach((service: string) => {
        if (service && typeof service === 'string' && service.length < 50) {
          keywords.add(service.trim());
        }
      });
    }
  }

  // NEVER use H1 tags as keywords — they often contain irrelevant content from scanned pages

  return Array.from(keywords).slice(0, 20);
}

/**
 * Merge client-provided keywords (priority) with AI-generated keywords.
 * Client keywords always come first; duplicates are removed.
 */
function mergeKeywords(clientKeywords: any[] | undefined, aiKeywords: string[]): string[] {
  const clientKws: string[] = (clientKeywords || [])
    .map((k: any) => (typeof k === 'string' ? k : k?.keyword || '').trim())
    .filter(Boolean);

  if (clientKws.length === 0) return aiKeywords;

  const seen = new Set(clientKws.map(k => k.toLowerCase()));
  const merged = [...clientKws];
  for (const kw of aiKeywords) {
    if (!seen.has(kw.toLowerCase())) {
      merged.push(kw);
      seen.add(kw.toLowerCase());
    }
  }
  console.log(`[60-DAY-PLAN] Merged keywords: ${clientKws.length} client + ${merged.length - clientKws.length} AI = ${merged.length} total`);
  return merged;
}

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  // ── Step 1: Use existing AI data if available, otherwise generate fresh ──
  console.log('[60-DAY-PLAN] Starting AI enrichment for plan:', planId);

  // Check if plan already has AI-enriched data (from ai-enrich endpoint)
  const existingAiKeywords = Array.isArray(plan.aiKeywords) && plan.aiKeywords.length > 0
    ? plan.aiKeywords.map((k: any) => k.keyword || k).filter(Boolean)
    : [];
  const existingAiArticles = Array.isArray(plan.aiArticles) && plan.aiArticles.length > 0
    ? plan.aiArticles
    : [];

  let aiKeywords: string[];
  let finalArticles: any[];

  if (existingAiKeywords.length > 0) {
    // Use existing AI data — don't regenerate
    console.log('[60-DAY-PLAN] Using existing AI keywords:', existingAiKeywords.length);
    aiKeywords = existingAiKeywords;
    finalArticles = existingAiArticles.length > 0 ? existingAiArticles : await generateAIArticles(plan, aiKeywords);
  } else {
    // Generate fresh AI data
    aiKeywords = await generateAIKeywords(plan);
    console.log('[60-DAY-PLAN] AI keywords generated:', aiKeywords.length);
    finalArticles = await generateAIArticles(plan, aiKeywords);
  }

  console.log('[60-DAY-PLAN] AI enrichment complete:', {
    keywords: aiKeywords.length,
    articles: finalArticles.length,
  });

  // Save AI enrichment data to plan for frontend tabs
  const enrichmentData: Record<string, any> = {};
  if (aiKeywords.length > 0) {
    enrichmentData.aiKeywords = aiKeywords.map((kw, i) => ({
      keyword: kw,
      category: i < 5 ? 'CORE' : i < 10 ? 'שירותים' : i < 13 ? 'בידול' : 'LONG TAIL',
      searchVolume: 'בינוני',
      difficulty: 'בינוני',
      intent: i < 5 ? 'מסחרי' : 'מידעי',
    }));
  }
  if (finalArticles.length > 0) {
    enrichmentData.aiArticles = finalArticles.map((a: any, i: number) => ({
      id: `article-${i + 1}`,
      title: a.title || '',
      targetKeyword: a.targetKeyword || '',
      outline: a.outline || [],
      wordCount: a.wordCount || 1500,
      whyThisArticle: a.whyThisArticle || '',
      status: 'planned',
    }));
  }
  if (Object.keys(enrichmentData).length > 0) {
    enrichmentData.aiEnrichedAt = new Date().toISOString();
    await updatePlanSafe(planId, enrichmentData);
  }

  // ── Step 2: Article content generation ──
  // NOTE: Full article generation (8 × 1500 words) takes 2-4 minutes which exceeds
  // Vercel's 60s timeout on Hobby plan. Articles are generated on-demand via the
  // /generate-article endpoint instead. We only save the outlines/topics here.
  const articlesToWrite = enrichmentData.aiArticles || (Array.isArray(plan.aiArticles) ? plan.aiArticles : []);
  if (articlesToWrite.length > 0) {
    console.log(`[60-DAY-PLAN] ${articlesToWrite.length} article topics saved. Full content will be generated on-demand.`);
    // Don't generate full articles here — it takes too long and causes timeout
    finalArticles = articlesToWrite;
  }

  // Build PlanInput from plan data
  const planInput: PlanInput = {
    clientName: plan.clientName,
    websiteUrl: plan.websiteUrl,
    websiteScan: plan.websiteScan
      ? {
          url: plan.websiteScan.url,
          hasSSL: plan.websiteScan.hasSSL,
          loadTimeMs: plan.websiteScan.loadTimeMs,
          mobileOptimized: plan.websiteScan.mobileOptimized,
          metaTitle: plan.websiteScan.metaTitle,
          metaDescription: plan.websiteScan.metaDescription,
          h1Tags: plan.websiteScan.h1Tags,
          totalPages: plan.websiteScan.totalPages,
          indexedPages: plan.websiteScan.indexedPages,
          brokenLinks: plan.websiteScan.brokenLinks,
          hasRobotsTxt: plan.websiteScan.hasRobotsTxt,
          hasSitemap: plan.websiteScan.hasSitemap,
          domainAuthority: plan.websiteScan.domainAuthority,
          structuredData: plan.websiteScan.structuredData,
          openGraph: plan.websiteScan.openGraph,
          canonicalTags: plan.websiteScan.canonicalTags,
          techStack: plan.websiteScan.techStack,
          cmsDetected: plan.websiteScan.cmsDetected,
          issues: plan.websiteScan.issues.map((issue) => ({
            type: issue.type,
            category: issue.category,
            title: issue.title,
            description: issue.description,
            impact: issue.impact,
          })),
        }
      : null,
    scannedPages: plan.scannedPages || [],
    visibilityResults: (plan.visibilityResults || []).map((result) => ({
      queryId: result.queryId,
      query: result.query,
      results: [
        {
          engine: result.engine,
          mentioned: result.mentioned,
          position: result.position,
          sentiment: result.sentiment,
        },
      ],
    })),
    visibilityQueries: (plan.visibilityQueries || []).map((q) => ({
      id: q.id,
      query: q.query,
      category: q.category,
      intent: q.intent,
      importance: q.importance,
    })),
    competitors: (plan.competitors || []).map((c) => c.domain),
    contentGaps: (plan.contentGaps || []).map((gap) => ({
      query: gap.query,
      category: gap.category,
      intent: gap.intent,
      importance: gap.importance,
    })),
    goals: (plan.goals || []).map((g) => ({
      id: g.id,
      type: g.type,
      label: g.label,
      targetMetric: g.targetMetric,
      currentValue: g.currentValue,
      targetValue: g.targetValue,
      priority: g.priority,
    })),
    targetKeywords: mergeKeywords(plan.clientKeywords, aiKeywords.length > 0 ? aiKeywords : extractKeywordsFallback(plan)),
    aiArticles: finalArticles,
    businessProfile: plan.businessProfile || undefined,
    targetLocation: plan.businessProfile?.location || 'Israel',
    targetLanguage: 'Hebrew',
    insights: (plan.insights || []).map((insight) => ({
      id: insight.id,
      category: insight.category,
      title: insight.title,
      description: insight.description,
      impact: insight.impact,
      action: insight.suggestedAction,
    })),
  };

  // Call plan engine
  const generatedPlan = generate60DayPlan(planInput);

  // Merge daily article entries into aiArticles so they appear in the Articles tab
  const existingAiArticlesForMerge: any[] = Array.isArray(plan.aiArticles) ? plan.aiArticles : [];
  const dailyEntries = generatedPlan.dailyArticleEntries || [];
  // Remove old daily articles (type === 'daily_seo_article') and add fresh ones
  const nonDailyArticles = existingAiArticlesForMerge.filter((a: any) => a?.type !== 'daily_seo_article');
  const mergedAiArticles = [...nonDailyArticles, ...dailyEntries];

  // Update plan with generated data
  const updated = await updatePlanSafe(planId, {
    days: generatedPlan.days,
    phases: generatedPlan.phases,
    totalTasks: generatedPlan.totalTasks,
    totalHours: generatedPlan.totalHours,
    aiArticles: mergedAiArticles,
    status: 'plan_generated',
    generatedAt: new Date().toISOString(),
  });

  if (!updated) return err('Failed to save generated plan', 500);

  logActivity(planId, 'generate_60_day_plan', {
    totalDays: generatedPlan.days.length,
    totalTasks: generatedPlan.totalTasks,
    totalHours: generatedPlan.totalHours,
    phases: generatedPlan.phases.length,
  });

  return ok({
    days: generatedPlan.days,
    phases: generatedPlan.phases,
    totalTasks: generatedPlan.totalTasks,
    totalHours: generatedPlan.totalHours,
    generatedAt: new Date().toISOString(),
  });
});
