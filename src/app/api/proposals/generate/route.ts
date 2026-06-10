/** POST /api/proposals/generate { clientName, businessField?, services[], budget?, goals?, tone?, clientId? }
 *  → { proposal, html }. Generates a persuasive Hebrew work proposal, grounded in
 *  the client card when a clientId is provided. */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { generateProposal, type ProposalInput } from '@/lib/proposals/engine';
import { proposalToHtml } from '@/lib/proposals/html';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.clientName?.trim()) return NextResponse.json({ error: 'נדרש שם לקוח' }, { status: 400 });

    let businessField = body.businessField || '';
    let logoUrl: string | undefined;
    // Ground in the client card if a clientId was passed.
    if (body.clientId) {
      try {
        const { getClientById } = await import('@/lib/db/client-helpers');
        const c: any = await getClientById(body.clientId);
        if (c) { businessField = businessField || c.clientType || ''; logoUrl = c.logoUrl || undefined; }
      } catch { /* non-fatal */ }
    }

    const input: ProposalInput = {
      clientName: String(body.clientName).trim(),
      businessField,
      services: Array.isArray(body.services) ? body.services.filter(Boolean) : [],
      budget: body.budget || '',
      goals: body.goals || '',
      tone: body.tone || 'מקצועי',
    };

    const proposal = await generateProposal(input);
    const html = proposalToHtml(proposal, input, { logoUrl });
    return NextResponse.json({ success: true, proposal, html });
  } catch {
    return NextResponse.json({ error: 'יצירת ההצעה נכשלה' }, { status: 400 });
  }
}
