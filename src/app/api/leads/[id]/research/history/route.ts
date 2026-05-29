import { NextRequest, NextResponse } from 'next/server';
import { getResearchHistoryByLeadId } from '@/lib/leads/lead-research-orchestrator';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const history = await getResearchHistoryByLeadId(id);
    return NextResponse.json({ history });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
