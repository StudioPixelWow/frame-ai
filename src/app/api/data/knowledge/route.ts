import { NextResponse } from 'next/server';
import { getKnowledgeDashboardData } from '@/lib/knowledge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || undefined;

    const data = await getKnowledgeDashboardData(clientId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[knowledge] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load knowledge data' },
      { status: 500 }
    );
  }
}
