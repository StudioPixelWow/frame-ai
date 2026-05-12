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
    const websiteUrl = (plan as any).websiteUrl || '';
    const location = facts.detected_location?.value || facts.location || (plan as any).businessProfile?.location || 'ישראל';
    const isLocal = location !== 'ישראל' && location.length > 0;
    const currentYear = new Date().getFullYear();

    const result = await generateWithAI(
      `אתה כותב תוכן מומחה SEO ברמה הגבוהה ביותר בעברית מלאה. כל הטקסט בעברית — כולל שמות מקומות: "ישראל" (לא Israel), "תל אביב" (לא Tel Aviv). מונחים טכניים מקובלים כמו SEO מותרים, אבל כל שאר הטקסט בעברית. אתה מפיק מאמרים מעמיקים של 1500-2000 מילים שמדרגים בעמוד הראשון של גוגל. כל מאמר שלך כולל קישורים, נתונים, דוגמאות מעשיות, וטון של מומחה בכיר בתחום. החזר JSON בלבד.`,
      `כתוב מאמר מומחה SEO מעמיק בעברית.

═══ פרטי העסק ═══
עסק: ${businessName} (${businessType})${productsStr}
מיקום: ${location}
אתר: ${websiteUrl}
השנה הנוכחית: ${currentYear}

═══ פרטי המאמר ═══
כותרת: "${title}"
ביטוי מפתח: "${targetKeyword || title}"${outlineSection}

═══ הנחיות כתיבה — רמת מומחה ═══

📏 אורך: 1500-2000 מילים (לא פחות מ-1500!)

🔗 קישורים (חובה):
- 2-3 קישורים פנימיים (href="${websiteUrl}/..." עם anchor text רלוונטי)
- 2-3 קישורים חיצוניים למקורות סמכותיים (target="_blank" rel="noopener")

${isLocal ? `📍 Local SEO: ציין "${location}" לפחות 4 פעמים, כלול ביטויים לוקאליים כמו "ב${location}", "${targetKeyword || title} ב${location}", הזכר אזורים סמוכים` : ''}

👨‍🏫 טון: מומחה בכיר עם 15+ שנות ניסיון, כלול נתונים ומספרים, טיפים מעשיים, דוגמאות מהשטח

📋 מבנה:
1. פתיחה מושכת (120-150 מילים) — הביטוי ב-100 מילים הראשונות
2. 5-7 סעיפי H2 מעמיקים (כל אחד 200+ מילים עם H3 פנימי)
3. בכל סעיף: רשימה (ul/ol) או דוגמה מעשית
4. FAQ — 3 שאלות ותשובות מעמיקות
5. סיכום + CTA ל-${businessName} (100 מילים)

🖋️ HTML: h2, h3, p, ul, ol, li, strong, a, blockquote
⚠️ כל שנה = ${currentYear} בלבד

🚫 עברית בלבד — שמות מקומות בעברית: "ישראל" (לא "Israel"), "תל אביב" (לא "Tel Aviv"). אין מילים באנגלית בגוף המאמר, פרט למונחים טכניים מקובלים (SEO, CTA וכו׳).

החזר JSON:
{
  "article": "HTML מלא עם h2, h3, p, ul, li, a, strong",
  "wordCount": 1700,
  "metaTitle": "כותרת Meta (עד 60 תווים, כולל ביטוי + ${currentYear})",
  "metaDescription": "תיאור Meta (עד 155 תווים, עם CTA)",
  "faq": [{"question": "שאלה", "answer": "תשובה מפורטת"}]
}`,
      { temperature: 0.75, maxTokens: 8000 }
    );

    if (result.success && result.data) {
      let data: any;

      // Handle both parsed JSON and raw text responses
      if (typeof result.data === 'string') {
        // AI returned raw text instead of JSON — wrap it as article HTML
        const rawText = result.data as string;
        data = {
          article: rawText,
          wordCount: rawText.split(/\s+/).length,
          metaTitle: title,
          metaDescription: `${title} — ${businessName}`,
          faq: [],
        };
        console.log('[GENERATE-ARTICLE] AI returned raw text, wrapping as article');
      } else {
        data = result.data;
      }

      // Ensure article content exists
      const articleContent = data.article || data.content || data.text || '';
      if (!articleContent) {
        console.error('[GENERATE-ARTICLE] No article content in AI response:', JSON.stringify(data).slice(0, 500));
        return err('AI returned empty article content — try again', 500);
      }

      // Save to plan's aiArticles
      const existingArticles = Array.isArray(plan.aiArticles) ? [...plan.aiArticles] : [];
      if (typeof articleIndex === 'number' && articleIndex >= 0 && articleIndex < existingArticles.length) {
        existingArticles[articleIndex] = {
          ...existingArticles[articleIndex],
          fullArticle: articleContent,
          wordCount: data.wordCount || articleContent.split(/\s+/).length,
          metaTitle: data.metaTitle || title,
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
        wordCount: data.wordCount || articleContent.split(/\s+/).length,
        articleIndex,
      });

      return ok({
        article: articleContent,
        wordCount: data.wordCount || articleContent.split(/\s+/).length,
        metaTitle: data.metaTitle || title,
        metaDescription: data.metaDescription || '',
        faq: data.faq || [],
      });
    }

    console.error('[GENERATE-ARTICLE] AI call failed:', result.error);
    return err(`AI failed to generate article: ${result.error || 'unknown error'}`, 500);
  } catch (e) {
    console.error('[GENERATE-ARTICLE] Error:', e);
    return err('Failed to generate article', 500);
  }
});
