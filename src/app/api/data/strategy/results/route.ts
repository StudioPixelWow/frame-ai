import { NextResponse } from 'next/server';
import { recordStrategyResult, getLearningData } from '@/lib/strategy';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || undefined;
    const data = await getLearningData(clientId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[strategy/results] GET error:', error);
    return NextResponse.json({ error: 'Failed to load results' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { strategyId, actionId, actionType, outcome, notes, performanceBefore, performanceAfter } = body;

    if (!strategyId || !actionId || !outcome) {
      return NextResponse.json(
        { error: 'strategyId, actionId, and outcome are required' },
        { status: 400 }
      );
    }

    const success = await recordStrategyResult({
      strategyId,
      actionId,
      actionType: actionType || 'unknown',
      outcome,
      notes,
      performanceBefore,
      performanceAfter,
    });

    return NextResponse.json({ ok: success });
  } catch (error) {
    console.error('[strategy/results] POST error:', error);
    return NextResponse.json({ error: 'Failed to record result' }, { status: 500 });
  }
}
