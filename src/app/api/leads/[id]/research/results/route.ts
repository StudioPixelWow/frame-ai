import { NextRequest, NextResponse } from 'next/server';
import { getResearchByLeadId } from '@/lib/leads/lead-research-orchestrator';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const research = await getResearchByLeadId(id);

    if (!research) {
      return NextResponse.json({ error: 'No research found' }, { status: 404 });
    }

    return NextResponse.json({
      scores: research.scores,
      websiteFacts: research.websiteFacts,
      socialPresence: research.socialPresence,
      googlePresence: research.googlePresence,
      seoAnalysis: research.seoAnalysis,
      geoAnalysis: research.geoAnalysis,
      competitorAnalysis: research.competitorAnalysis,
      salesOpportunities: research.salesOpportunities,
      quarterPlan: research.quarterPlan,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
