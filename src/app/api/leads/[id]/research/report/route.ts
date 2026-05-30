import { NextRequest, NextResponse } from 'next/server';
import { getResearchByLeadId } from '@/lib/leads/lead-research-orchestrator';
import { leadResearch, leads } from '@/lib/db/collections';
import { generateLeadResearchPdfHtml } from '@/lib/leads/lead-pdf-generator';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const research = await getResearchByLeadId(id);

    if (!research?.report) {
      return NextResponse.json({ error: 'No report found' }, { status: 404 });
    }

    const format = req.nextUrl.searchParams.get('format');

    if (format === 'pdf') {
      // Fetch lead name for branded PDF
      const allLeads = await leads.queryFilteredAsync([{ column: 'id', op: 'eq', value: id }]);
      const lead = allLeads?.[0];
      const leadName = (lead as any)?.data?.name || (lead as any)?.data?.businessName || 'לקוח';

      const html = generateLeadResearchPdfHtml({
        leadName,
        websiteUrl: research.websiteUrl || '',
        scores: research.scores || {},
        websiteFacts: research.websiteFacts || {},
        socialPresence: research.socialPresence || {},
        googlePresence: research.googlePresence || {},
        seoAnalysis: research.seoAnalysis || {},
        geoAnalysis: research.geoAnalysis || {},
        competitorAnalysis: research.competitorAnalysis || {},
        salesOpportunities: research.salesOpportunities || [],
        quarterPlan: research.quarterPlan || {},
        report: research.report || {},
        deepAnalysis: (research as any).deepAnalysis || {},
      });

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    return NextResponse.json({ report: research.report });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// Update report (edit content before sending)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const research = await getResearchByLeadId(id);

    if (!research) {
      return NextResponse.json({ error: 'No research found' }, { status: 404 });
    }

    const body = await req.json();
    const updatedReport = { ...research.report, ...body, editedContent: body.editedContent };

    await leadResearch.updateAsync(research.id, { report: updatedReport } as any);

    return NextResponse.json({ report: updatedReport });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
