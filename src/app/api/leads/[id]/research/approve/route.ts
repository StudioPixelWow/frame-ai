import { NextRequest, NextResponse } from 'next/server';
import { getResearchByLeadId } from '@/lib/leads/lead-research-orchestrator';
import { leadResearch } from '@/lib/db/collections';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const research = await getResearchByLeadId(id);

    if (!research?.report) {
      return NextResponse.json({ error: 'No report to approve' }, { status: 404 });
    }

    const updatedReport = {
      ...research.report,
      approved: true,
      approvedAt: new Date().toISOString(),
    };

    await leadResearch.updateAsync(research.id, { report: updatedReport } as any);

    return NextResponse.json({ approved: true, report: updatedReport });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
