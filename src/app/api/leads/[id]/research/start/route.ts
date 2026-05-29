import { NextRequest, NextResponse } from 'next/server';
import { leads } from '@/lib/db/collections';
import { startLeadResearch } from '@/lib/leads/lead-research-orchestrator';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get lead data
    const lead = await leads.getByIdAsync(id);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Extract website URL from lead data
    const body = await req.json().catch(() => ({}));
    const websiteUrl = body.websiteUrl || '';

    if (!websiteUrl) {
      return NextResponse.json({ error: 'websiteUrl is required' }, { status: 400 });
    }

    const researchId = await startLeadResearch({
      leadId: id,
      leadName: lead.fullName || lead.name || 'Unknown',
      websiteUrl,
      email: lead.email,
      phone: lead.phone,
    });

    return NextResponse.json({ researchId, status: 'scanning' });
  } catch (err: any) {
    console.error('[API] Start research error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to start research' }, { status: 500 });
  }
}
