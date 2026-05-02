import { NextResponse } from 'next/server';
import { getStrategyDashboardData } from '@/lib/strategy';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || undefined;

    const data = await getStrategyDashboardData(clientId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[strategy] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load strategy data' },
      { status: 500 }
    );
  }
}
