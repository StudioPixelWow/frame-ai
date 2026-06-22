import { NextRequest, NextResponse } from 'next/server';
import { creativeFeedback } from '@/lib/db/collections';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, feedbackType, assetId, creativeOutputId, feedbackNote, feedbackSource } = body;

    if (!clientId || !feedbackType) {
      return NextResponse.json({ error: 'Missing clientId or feedbackType' }, { status: 400 });
    }

    const fb = await creativeFeedback.createAsync({
      clientId,
      assetId: assetId || null,
      creativeOutputId: creativeOutputId || null,
      feedbackSource: feedbackSource || 'manual',
      feedbackType,
      feedbackValue: '',
      feedbackNote: feedbackNote || '',
      createdBy: null,
    });

    return NextResponse.json({ success: true, feedback: fb }, { status: 201 });
  } catch (err: any) {
    console.error('[creative-studio/feedback] Error:', err);
    return NextResponse.json({ error: err?.message || 'Feedback failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    const all = await creativeFeedback.getAllAsync();
    const filtered = clientId ? all.filter((f: any) => f.clientId === clientId) : all;

    return NextResponse.json(filtered);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
