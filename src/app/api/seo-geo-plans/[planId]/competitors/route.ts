import { NextRequest } from 'next/server';
import { ok, loadPlan, notFound, withErrorBoundary } from '@/lib/seo/api-helpers';
import { analyzeCompetitors, type CompetitorAnalysisInput } from '@/lib/seo/competitor-engine';

/**
 * GET /api/seo-geo-plans/[planId]/competitors
 *
 * Returns competitor intelligence:
 * - If plan already has competitorAnalysis stored, returns it
 * - Otherwise generates fresh analysis from available scan data
 */
export const GET = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  // Check if we already have stored competitor analysis
  const storedAnalysis = (plan as any).competitorAnalysis;
  if (storedAnalysis && storedAnalysis.competitors && storedAnalysis.competitors.length > 0) {
    return ok({
      competitors: storedAnalysis.competitors,
      authorityGaps: storedAnalysis.authorityGaps || [],
      contentOpportunities: storedAnalysis.contentOpportunities || [],
      strategicInsights: storedAnalysis.strategicInsights || [],
      aiVisibilityComparison: storedAnalysis.aiVisibilityComparison || [],
      summary: storedAnalysis.summary || { totalCompetitors: storedAnalysis.competitors.length },
      total: storedAnalysis.competitors.length,
      source: 'stored',
    });
  }

  // Fallback: try to build analysis from existing plan data
  const websiteScan = (plan as any).websiteScan || {};
  const aiQueries = websiteScan.aiQueries || [];
  const domain = ((plan as any).websiteUrl || (plan as any).url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

  if (!domain) {
    return ok({
      competitors: [],
      authorityGaps: [],
      contentOpportunities: [],
      strategicInsights: [],
      summary: { totalCompetitors: 0, overallThreatLevel: 'low' },
      total: 0,
      source: 'no_data',
      message: 'אין מספיק נתונים לניתוח מתחרים. הרץ סריקת אתר קודם.',
    });
  }

  // Build competitor analysis from available plan data
  const input: CompetitorAnalysisInput = {
    domain,
    aiScanResults: aiQueries.length > 0 ? aiQueries.map((q: any) => ({
      platform: q.platform,
      query: q.query,
      found: q.found,
      snippet: q.snippet,
      competitorsMentioned: q.competitorsMentioned || [],
    })) : null,
    crawlPages: (plan as any).scannedPages?.map((p: any) => ({
      url: p.url,
      title: p.title || '',
      h1Tags: p.h1Tags,
      h2Tags: p.h2Tags,
      wordCount: p.wordCount,
      hasSchema: p.hasSchema,
    })) || null,
    knownCompetitors: (plan as any).businessProfile?.known_competitors || (plan as any).competitors?.map((c: any) => c.domain) || [],
    targetKeywords: (plan as any).clientKeywords || (plan as any).targetKeywords || [],
  };

  const analysis = analyzeCompetitors(input);

  return ok({
    competitors: analysis.competitors,
    authorityGaps: analysis.authorityGaps,
    contentOpportunities: analysis.contentOpportunities,
    strategicInsights: analysis.strategicInsights,
    aiVisibilityComparison: analysis.aiVisibilityComparison,
    summary: analysis.summary,
    total: analysis.competitors.length,
    source: 'live_analysis',
  });
});
