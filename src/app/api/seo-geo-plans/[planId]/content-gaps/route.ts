import { NextRequest } from 'next/server';
import { ok, loadPlan, notFound, withErrorBoundary } from '@/lib/seo/api-helpers';
import { analyzeSemantics } from '@/lib/seo/semantic-intelligence';

/**
 * GET /api/seo-geo-plans/[planId]/content-gaps
 *
 * Returns content gaps with semantic intelligence:
 * - Traditional content gaps from plan
 * - Topical authority gaps from semantic analysis
 * - Missing cluster coverage
 * - Orphan pages
 * - Intent coverage gaps
 */
export const GET = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  const { plan, error } = await loadPlan(planId, req);
  if (error) return error;
  if (!plan) return notFound('Plan');

  const url = new URL(req.url);
  const importanceFilter = url.searchParams.get('importance');
  const typeFilter = url.searchParams.get('type'); // 'content' | 'topical' | 'semantic' | 'all'

  // Traditional content gaps from plan
  let contentGaps = (plan as any).contentGaps || [];
  if (importanceFilter) {
    contentGaps = contentGaps.filter((g: any) => g.importance === importanceFilter);
  }

  // Semantic intelligence gaps
  let semanticGaps: any[] = [];
  let topicalGaps: any[] = [];
  let orphanPages: string[] = [];
  let intentCoverage: any = null;

  // Try to get semantic analysis from stored data or compute live
  const storedSemantic = (plan as any).semanticAnalysis;
  const scannedPages = (plan as any).scannedPages || [];

  if (storedSemantic && storedSemantic.topicalMap) {
    // Use stored semantic analysis
    topicalGaps = storedSemantic.topicalMap
      .filter((c: any) => c.coverage < 60)
      .map((c: any) => ({
        type: 'topical_gap',
        topic: c.topic,
        coverage: c.coverage,
        authority: c.authority,
        depth: c.depth,
        hasPillar: c.hasPillar,
        gaps: c.gaps,
        aiOpportunity: c.aiOpportunity,
        intent: c.intent,
        severity: c.coverage < 30 ? 'critical' : c.coverage < 50 ? 'warning' : 'info',
        recommendation: c.gaps[0] || `שפר כיסוי של "${c.topic}" — כרגע ${c.coverage}%`,
      }));

    orphanPages = storedSemantic.orphanPages || [];
    intentCoverage = storedSemantic.contentIntents || null;

    // Link graph recommendations as semantic gaps
    if (storedSemantic.linkGraph?.recommendations) {
      semanticGaps = storedSemantic.linkGraph.recommendations.map((r: any) => ({
        type: 'linking_gap',
        subType: r.type,
        fromUrl: r.fromUrl,
        toUrl: r.toUrl,
        reason: r.reason,
        impact: r.impact,
        anchorSuggestion: r.anchorSuggestion,
        severity: r.impact === 'high' ? 'warning' : 'info',
      }));
    }
  } else if (scannedPages.length > 0) {
    // Compute light semantic analysis on-the-fly
    try {
      const businessName = (plan as any).businessProfile?.business_name || (plan as any).clientName || '';
      const products = (plan as any).businessProfile?.main_products_or_services || [];
      const analysis = analyzeSemantics(scannedPages, businessName, products);

      topicalGaps = analysis.topicalMap
        .filter(c => c.coverage < 60)
        .map(c => ({
          type: 'topical_gap',
          topic: c.topic,
          coverage: c.coverage,
          authority: c.authority,
          depth: c.depth,
          hasPillar: c.hasPillar,
          gaps: c.gaps,
          aiOpportunity: c.aiOpportunity,
          intent: c.intent,
          severity: c.coverage < 30 ? 'critical' : c.coverage < 50 ? 'warning' : 'info',
          recommendation: c.gaps[0] || `שפר כיסוי של "${c.topic}" — כרגע ${c.coverage}%`,
        }));

      orphanPages = analysis.orphanPages;
      intentCoverage = analysis.contentIntents;

      semanticGaps = analysis.linkGraph.recommendations.map(r => ({
        type: 'linking_gap',
        subType: r.type,
        fromUrl: r.fromUrl,
        toUrl: r.toUrl,
        reason: r.reason,
        impact: r.impact,
        anchorSuggestion: r.anchorSuggestion,
        severity: r.impact === 'high' ? 'warning' : 'info',
      }));
    } catch {
      // Semantic analysis failed — return only traditional gaps
    }
  }

  // Filter by type if requested
  const allGaps = typeFilter === 'content' ? contentGaps
    : typeFilter === 'topical' ? topicalGaps
    : typeFilter === 'semantic' ? semanticGaps
    : [...contentGaps, ...topicalGaps, ...semanticGaps];

  return ok({
    gaps: allGaps,
    contentGaps,
    topicalGaps,
    semanticGaps,
    orphanPages,
    intentCoverage,
    summary: {
      totalGaps: allGaps.length,
      criticalGaps: allGaps.filter((g: any) => g.severity === 'critical').length,
      topicalCoverageGaps: topicalGaps.length,
      linkingGaps: semanticGaps.length,
      orphanPages: orphanPages.length,
    },
    total: allGaps.length,
  });
});
