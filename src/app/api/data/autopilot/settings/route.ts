import { NextResponse } from 'next/server';
import { upsertAutopilotSettings, getClientAutopilotData } from '@/lib/autopilot';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }
    const data = await getClientAutopilotData(clientId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[autopilot/settings] GET error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, clientName, mode, goals, isActive, isPaused, maxActionsPerDay } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const success = await upsertAutopilotSettings({
      clientId,
      clientName,
      mode,
      goals,
      isActive,
      isPaused,
      maxActionsPerDay,
    });

    return NextResponse.json({ ok: success });
  } catch (error) {
    console.error('[autopilot/settings] POST error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
