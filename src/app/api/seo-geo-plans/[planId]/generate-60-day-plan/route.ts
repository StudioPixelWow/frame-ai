import { NextRequest, NextResponse } from 'next/server';
import { ok, err, loadPlan, notFound, updatePlanSafe, logActivity, withErrorBoundary } from '@/lib/seo/api-helpers';
import { generate60DayPlan } from '@/lib/seo/plan-engine';
import type { PlanInput } from '@/lib/seo/plan-engine';
import { generateWithAI } from '@/lib/ai/openai-client';

/**
 * Call AI to generate smart keywords for the plan engine.
 * Returns an array of keyword strings prioritized for the business.
 */
async function generateAIKeywords(plan: any): Promise<string[]> {
  const facts = plan.websiteScan?.websiteFacts || {};
  const profile = plan.businessProfile || {};
  const businessName = plan.clientName || facts.business_name || '';
  const businessType = facts.business_type || profile.business_type || '';
  const products = facts.main_products_or_services || profile.main_products_or_services || [];
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
  const businessName = plan.clientName || facts.business_name || '';
  const businessType = facts.business_type || profile.business_type || '';

  if (!businessName && !businessType) return [];

  const topKeywords = keywords.slice(0, 8).join(', ');

  try {
    const result = await generateWithAI(
      `אתה מומחה תוכן ו-SEO ישראלי עם 15 שנות ניסיון. אתה יוצר תוכניות תוכן אסטרטגיות לעסקים.`,
      `העסק: ${businessName} (${businessType})
ביטויי מפתח: ${topKeywords}

צור 8 נושאי מאמרים אסטרטגיים שיקדמו את העסק בגוגל ובפלטפורמות AI.
כל מאמר חייב לקדם ביטוי מפתח ספציפי.

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
 * Fallback: Extract keywords from plan data (H1/H2 tags, products, queries)
 */
function extractKeywordsFallback(plan: any): string[] {
  const keywords = new Set<string>();

  if (plan.websiteScan?.websiteFacts?.main_products_or_services && Array.isArray(plan.websiteScan.websiteFacts.main_products_or_services)) {
    plan.websiteScan.websiteFacts.main_products_or_services.forEach((service: string) => {
      if (service && typeof service === 'string' && service.length < 50) {
        keywords.add(service.trim());
      }
    });
  }

  if (plan.websiteScan?.h1Tags && Array.isArray(plan.websiteScan.h1Tags)) {
    plan.websiteScan.h1Tags.forEach((tag: string) => {
      if (tag && typeof tag === 'string' && tag.length < 50) {
        keywords.add(tag.trim());
      }
    });
  }

  if (plan.visibilityQueries && Array.isArray(plan.visibilityQueries) && keywords.size === 0) {
    plan.visibilityQueries.slice(0, 10).forEach((q: any) => {
      if (q.query && typeof q.query === 'string') {
        keywords.add(q.query.trim());
      }
    });
  }

  return Array.from(keywords).slice(0, 20);
}

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  // ── Step 1: Generate AI-powered keywords and articles ──
  console.log('[60-DAY-PLAN] Starting AI enrichment for plan:', planId);
  const [aiKeywords, aiArticles] = await Promise.all([
    generateAIKeywords(plan),
    generateAIArticles(plan, []),
  ]);

  // If we got AI keywords, regenerate articles with them for better targeting
  let finalArticles = aiArticles;
  if (aiKeywords.length > 0 && aiArticles.length === 0) {
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
    targetKeywords: aiKeywords.length > 0 ? aiKeywords : extractKeywordsFallback(plan),
    aiArticles: finalArticles,
    targetLocation: 'Israel',
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

  // Update plan with generated data
  const updated = await updatePlanSafe(planId, {
    days: generatedPlan.days,
    phases: generatedPlan.phases,
    totalTasks: generatedPlan.totalTasks,
    totalHours: generatedPlan.totalHours,
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
