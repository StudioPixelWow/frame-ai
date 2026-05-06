import { NextRequest } from 'next/server';
import { ok, err, loadPlan, notFound, updatePlanSafe, logActivity, withErrorBoundary } from '@/lib/seo/api-helpers';
import { generateWithAI } from '@/lib/ai/openai-client';

// Vercel Hobby max = 60s. Article generation needs the full budget.
export const maxDuration = 60;

/**
 * POST /api/seo-geo-plans/[planId]/generate-article
 *
 * Generates a full 1500+ word article via GPT for a specific content task.
 * Body: { articleIndex: number, title: string, targetKeyword: string, outline?: string[] }
 *
 * Returns the full article text and saves it to the plan's aiArticles array.
 */
export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  const body = await req.json();
  const { articleIndex, title, targetKeyword, outline } = body;

  if (!title) return err('Missing article title', 400);

  const facts = plan.websiteScan?.websiteFacts || {} as any;
  const profile = plan.businessProfile || {} as any;
  const businessName = plan.clientName || facts.business_name?.value || facts.business_name || '';
  const businessType = facts.business_type?.value || facts.business_type || profile.business_type || '';
  const products = facts.main_products_or_services?.value || facts.main_products_or_services || profile.main_products_or_services || [];

  const outlineSection = Array.isArray(outline) && outline.length > 0
    ? `\nמבנה המאמר (כותרות משנה):\n${outline.map((h: string, i: number) => `${i + 1}. ${h}`).join('\n')}`
    : '';

  const productsStr = Array.isArray(products) && products.length > 0
    ? `\nשירותים/מוצרים: ${products.join(', ')}`
    : '';

  try {
    const result = await generateWithAI(
      `אתה כותב תוכן SEO מקצועי בעברית. כתוב מאמרים איכותיים שמדרגים גבוה בגוגל.

כללים:
- עברית מקצועית וטבעית
- אורך: 600-800 מילים
- שלב ביטוי מפתח 3-4 פעמים
- כותרות H2 ברורות
- דוגמאות מעשיות
- FAQ קצר (2 שאלות)
- CTA לעסק`,
      `כתוב מאמר SEO בעברית.

עסק: ${businessName} (${businessType})${productsStr}
כותרת: "${title}"
ביטוי מפתח: "${targetKeyword || title}"${outlineSection}

כתוב מאמר (600-800 מילים):
1. פתיחה (80 מילים)
2. 3-4 סעיפים עם H2 (כל אחד 150 מילים)
3. FAQ — 2 שאלות ותשובות
4. סיכום + CTA ל-${businessName}

החזר JSON:
{
  "article": "HTML עם h2, h3, p, ul, li",
  "wordCount": 700,
  "metaTitle": "כותרת Meta (60 תווים)",
  "metaDescription": "תיאור Meta (155 תווים)",
  "faq": [{"question": "שאלה", "answer": "תשובה"}]
}`,
      { temperature: 0.7, maxTokens: 3000 }
    );

    if (result.success && result.data) {
      const data = result.data as any;

      // Save to plan's aiArticles
      const existingArticles = Array.isArray(plan.aiArticles) ? [...plan.aiArticles] : [];
      if (typeof articleIndex === 'number' && articleIndex >= 0 && articleIndex < existingArticles.length) {
        existingArticles[articleIndex] = {
          ...existingArticles[articleIndex],
          fullArticle: data.article || '',
          wordCount: data.wordCount || 1500,
          metaTitle: data.metaTitle || '',
          metaDescription: data.metaDescription || '',
          faq: data.faq || [],
          generatedAt: new Date().toISOString(),
          status: 'written',
        };
        await updatePlanSafe(planId, { aiArticles: existingArticles });
      }

      logActivity(planId, 'generate_article', {
        title,
        targetKeyword,
        wordCount: data.wordCount,
        articleIndex,
      });

      return ok({
        article: data.article || '',
        wordCount: data.wordCount || 0,
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
        faq: data.faq || [],
      });
    }

    return err('AI failed to generate article', 500);
  } catch (e) {
    console.error('[GENERATE-ARTICLE] Error:', e);
    return err('Failed to generate article', 500);
  }
});
