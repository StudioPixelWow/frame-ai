import { NextRequest, NextResponse } from 'next/server';
import { getResearchByLeadId } from '@/lib/leads/lead-research-orchestrator';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const research = await getResearchByLeadId(id);

    if (!research) {
      return NextResponse.json({ status: 'idle', research: null });
    }

    return NextResponse.json({
      status: research.status,
      progress: research.progress,
      currentStage: research.currentStage,
      stages: research.stages,
      research,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
