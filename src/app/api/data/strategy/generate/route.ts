import { NextResponse } from 'next/server';
import { generateStrategy } from '@/lib/strategy';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { clientId, triggeredBy } = body;

    const result = await generateStrategy({
      clientId: clientId || undefined,
      triggeredBy: triggeredBy || 'manual',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[strategy/generate] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate strategy' },
      { status: 500 }
    );
  }
}
