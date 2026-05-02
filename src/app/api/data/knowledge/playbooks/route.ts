import { NextResponse } from 'next/server';
import { industryPlaybooks } from '@/lib/db';
import { getPlaybookSummary } from '@/lib/knowledge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const industry = searchParams.get('industry');

    const allPlaybooks = await industryPlaybooks.getAllAsync();

    if (industry) {
      const playbook = allPlaybooks.find(p => p.industry === industry);
      if (!playbook) {
        return NextResponse.json(
          { error: `No playbook found for industry: ${industry}` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        playbook,
        summary: getPlaybookSummary(playbook),
      });
    }

    // Return all playbooks with summaries
    const withSummaries = allPlaybooks.map(p => ({
      playbook: p,
      summary: getPlaybookSummary(p),
    }));

    return NextResponse.json(withSummaries);
  } catch (error) {
    console.error('[knowledge/playbooks] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load playbooks' },
      { status: 500 }
    );
  }
}
