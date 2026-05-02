import { NextResponse } from 'next/server';
import { updateActionStatus } from '@/lib/strategy';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { strategyId, actionId, status } = body;

    if (!strategyId || !actionId || !status) {
      return NextResponse.json(
        { error: 'strategyId, actionId, and status are required' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected', 'executed'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be approved, rejected, or executed' },
        { status: 400 }
      );
    }

    const success = await updateActionStatus(strategyId, actionId, status);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update action' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[strategy/actions] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to update action status' },
      { status: 500 }
    );
  }
}
