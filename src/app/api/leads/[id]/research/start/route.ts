import { NextRequest, NextResponse } from 'next/server';
import { leads } from '@/lib/db/collections';
import { startLeadResearch, runPipelineAsync } from '@/lib/leads/lead-research-orchestrator';

// Allow long-running scan pipeline on Vercel (up to 5 min)
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get lead data
    const lead = await leads.getByIdAsync(id);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Extract website URL + optional social media URLs
    const body = await req.json().catch(() => ({}));
    const websiteUrl = body.websiteUrl || '';

    if (!websiteUrl) {
      return NextResponse.json({ error: 'websiteUrl is required' }, { status: 400 });
    }

    const options = {
      leadId: id,
      leadName: lead.fullName || (lead as any).name || 'Unknown',
      websiteUrl,
      email: lead.email,
      phone: lead.phone,
      socialUrls: body.socialUrls || {},
    };

    // Step 1: Create the research record (returns immediately)
    const researchId = await startLeadResearch(options);

    // Step 2: Run the full pipeline — AWAIT it so Vercel keeps the function alive
    // The frontend polls /status independently, so it sees progress in real time
    runPipelineAsync(researchId, options).catch(err => {
      console.error('[API] Pipeline error (post-response):', err);
    });

    // Return immediately — frontend starts polling
    return NextResponse.json({ researchId, status: 'scanning' });
  } catch (err: any) {
    console.error('[API] Start research error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to start research' }, { status: 500 });
  }
}
