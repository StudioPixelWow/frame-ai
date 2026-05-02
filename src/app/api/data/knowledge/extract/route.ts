import { NextResponse } from 'next/server';
import { runKnowledgeExtraction } from '@/lib/knowledge';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { clientId, forceRefresh, triggeredBy } = body;

    const result = await runKnowledgeExtraction({
      clientId: clientId || undefined,
      forceRefresh: forceRefresh || false,
      triggeredBy: triggeredBy || 'manual',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[knowledge/extract] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to run knowledge extraction' },
      { status: 500 }
    );
  }
}
