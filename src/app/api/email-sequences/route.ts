import { NextRequest, NextResponse } from 'next/server';
import { emailSequences } from '@/lib/db';
import { validateTikun40Compliance } from '@/lib/email/sequence-engine';

export const dynamic = 'force-dynamic';

// GET /api/email-sequences
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const trigger = searchParams.get('trigger');

    let all = await emailSequences.getAllAsync();
    if (status) all = all.filter((s: any) => s.status === status);
    if (trigger) all = all.filter((s: any) => s.trigger === trigger);

    all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(all);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load sequences' }, { status: 500 });
  }
}

// POST /api/email-sequences — Create sequence
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, trigger, steps, senderName, senderEmail, unsubscribeUrl } = body;

    if (!name || !trigger) {
      return NextResponse.json({ error: 'Missing: name, trigger' }, { status: 400 });
    }

    // Validate תיקון 40
    const complianceErrors = validateTikun40Compliance({ senderName, senderEmail, unsubscribeUrl });

    const sequence = await emailSequences.createAsync({
      name,
      description: description || '',
      trigger,
      status: 'draft',
      tikun40Compliant: complianceErrors.length === 0,
      unsubscribeUrl: unsubscribeUrl || '',
      senderName: senderName || '',
      senderEmail: senderEmail || '',
      steps: steps || [],
      totalSubscribers: 0,
      totalSent: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalUnsubscribed: 0,
      clientId: body.clientId || null,
    } as any);

    return NextResponse.json({
      ...sequence,
      complianceWarnings: complianceErrors,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
  }
}
