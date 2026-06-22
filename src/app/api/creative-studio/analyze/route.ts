import { NextRequest, NextResponse } from 'next/server';
// Legacy import kept for reference:
// import { analyzeBrandDNA } from '@/lib/creative/brand-analysis-service';
import { analyzeMarketingDNA } from '@/lib/services/zono-creative/marketingAnalysisService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { clientId, entityType, entityId, entityName } = await req.json();

    if (!clientId && !entityId) {
      return NextResponse.json({ error: 'clientId or entityId required' }, { status: 400 });
    }

    // Backward compatibility: if only clientId provided, default to client entity
    const resolvedEntityType = entityType || 'client';
    const resolvedEntityId = entityId || clientId;
    const resolvedEntityName = entityName || clientId;

    const result = await analyzeMarketingDNA(resolvedEntityType, resolvedEntityId, resolvedEntityName);

    return NextResponse.json({
      success: result.success,
      profile: result.profile,
      job: result.job,
      provider: result.job?.provider || 'unknown',
      error: result.error,
    });
  } catch (err: any) {
    console.error('[creative-studio/analyze] Error:', err);
    return NextResponse.json({ error: err?.message || 'Analysis failed' }, { status: 500 });
  }
}
