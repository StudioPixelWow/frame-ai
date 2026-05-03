import { NextRequest, NextResponse } from 'next/server';
import { ok, err, loadPlan, notFound, updatePlanSafe, logActivity, generateId, withErrorBoundary } from '@/lib/seo/api-helpers';
import type { SeoInsight, SeoContentGap, SeoCompetitor } from '@/lib/db/schema';

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  const insights: SeoInsight[] = [];
  const contentGaps: SeoContentGap[] = [];
  const competitors: SeoCompetitor[] = [];

  // Generate insights from scan issues
  if (plan.websiteScan?.issues && plan.websiteScan.issues.length > 0) {
    plan.websiteScan.issues.slice(0, 3).forEach((issue) => {
      insights.push({
        id: generateId('ins'),
        category: issue.impact === 'high' ? 'weakness' : 'opportunity',
        title: issue.title,
        description: issue.description,
        impact: issue.impact as 'high' | 'medium' | 'low',
        source: 'website_scan',
        actionable: true,
        suggestedAction: `Fix ${issue.category} issue: ${issue.title}`,
      });
    });
  }

  // Generate insights from visibility gaps
  const mentionedQueries = new Set(
    (plan.visibilityResults || []).filter((r) => r.mentioned).map((r) => r.queryId)
  );
  const visibilityGaps = (plan.visibilityQueries || []).filter((q) => !mentionedQueries.has(q.id));

  if (visibilityGaps.length > 0) {
    visibilityGaps.slice(0, 3).forEach((gap) => {
      insights.push({
        id: generateId('ins'),
        category: 'opportunity',
        title: `AI visibility gap: "${gap.query}"`,
        description: `Your business is not mentioned in AI model results for "${gap.query}", despite being relevant.`,
        impact: gap.importance === 'high' ? 'high' : 'medium',
        source: 'ai_visibility',
        actionable: true,
        suggestedAction: `Create content targeting "${gap.query}" with schema markup and FAQ.`,
      });
    });
  }

  // Generate content gaps from unmentioned queries
  visibilityGaps.forEach((gap) => {
    contentGaps.push({
      id: generateId('gap'),
      query: gap.query,
      category: gap.category,
      intent: gap.intent,
      importance: gap.importance,
      suggestedAction: `Create comprehensive content for "${gap.query}"`,
      relatedUrl: null,
    });
  });

  // Generate mock competitors
  const competitorCount = Math.min(5, Math.max(3, visibilityGaps.length));
  for (let i = 0; i < competitorCount; i++) {
    competitors.push({
      id: generateId('comp'),
      domain: `competitor${i + 1}.com`,
      name: `Competitor ${i + 1}`,
      overlapScore: Math.floor(Math.random() * 40) + 40,
      strengths: ['Strong content', 'Good backlinks', 'Local presence'],
      weaknesses: ['Slow site', 'Poor mobile', 'Dated design'],
      topKeywords: [
        `keyword${i + 1}`,
        `related term ${i + 1}`,
        `topic ${i + 1}`,
      ],
      discoveredAt: new Date().toISOString(),
    });
  }

  // Update plan with insights, content gaps, and competitors
  const updated = await updatePlanSafe(planId, {
    insights,
    contentGaps,
    competitors,
    status: 'insights_ready',
  });

  if (!updated) return err('Failed to save insights', 500);

  logActivity(planId, 'generate_insights', {
    insightsCount: insights.length,
    contentGapsCount: contentGaps.length,
    competitorsCount: competitors.length,
  });

  return ok({
    insights,
    contentGaps,
    competitors,
  });
});
