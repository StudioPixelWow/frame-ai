import { NextResponse } from 'next/server';
import { runAutopilotLoop } from '@/lib/autopilot';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, triggeredBy = 'manual' } = body;

    const result = await runAutopilotLoop({
      clientId: clientId || undefined,
      triggeredBy,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[autopilot/scan] POST error:', error);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
