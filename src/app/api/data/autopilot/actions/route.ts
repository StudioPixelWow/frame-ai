import { NextResponse } from 'next/server';
import { updateAutopilotAction } from '@/lib/autopilot';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { actionId, status, approvedBy, rejectedBy, rejectionReason, failedReason } = body;

    if (!actionId || !status) {
      return NextResponse.json(
        { error: 'actionId and status are required' },
        { status: 400 }
      );
    }

    const success = await updateAutopilotAction(actionId, {
      status,
      approvedBy,
      rejectedBy,
      rejectionReason,
      failedReason,
    });

    return NextResponse.json({ ok: success });
  } catch (error) {
    console.error('[autopilot/actions] POST error:', error);
    return NextResponse.json({ error: 'Failed to update action' }, { status: 500 });
  }
}
