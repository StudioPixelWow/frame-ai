import { NextRequest, NextResponse } from 'next/server';
import { getResearchByLeadId } from '@/lib/leads/lead-research-orchestrator';
import { leadResearch } from '@/lib/db/collections';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const research = await getResearchByLeadId(id);

    if (!research?.report) {
      return NextResponse.json({ error: 'No report found' }, { status: 404 });
    }

    if (!research.report.approved) {
      return NextResponse.json({ error: 'Report must be approved before sending' }, { status: 400 });
    }

    const body = await req.json();
    const recipientEmail = body.email;

    if (!recipientEmail) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    // Send email with PDF (will be fully implemented in Phase 4)
    try {
      const { sendEmail } = await import('@/lib/email/email-service');
      await sendEmail({
        to: recipientEmail,
        subject: `דוח מחקר דיגיטלי — ${research.leadName} | Studio Pixel`,
        html: `<div dir="rtl" style="font-family: Arial, sans-serif;">
          <h2>שלום,</h2>
          <p>מצורף דוח מחקר דיגיטלי מקיף שהכנו עבור ${research.leadName}.</p>
          <p>הדוח כולל ניתוח SEO, נראות AI, ניתוח מתחרים, ותוכנית צמיחה רבעונית.</p>
          <br/>
          <p>בברכה,</p>
          <p><strong>Studio Pixel</strong></p>
          <p>054-636-5333 | https://s-pixel.co.il</p>
        </div>`,
      });
    } catch (emailErr: any) {
      console.error('[API] Email send failed:', emailErr);
      return NextResponse.json({ error: 'Email send failed: ' + emailErr?.message }, { status: 500 });
    }

    // Update report as sent
    const updatedReport = {
      ...research.report,
      sentAt: new Date().toISOString(),
      sentTo: recipientEmail,
    };

    await leadResearch.updateAsync(research.id, { report: updatedReport } as any);

    return NextResponse.json({ sent: true, sentTo: recipientEmail });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
