import { NextResponse } from 'next/server';
import {
  pauseAutopilotGlobally,
  resumeAutopilotGlobally,
  pauseAutopilotForClient,
  resumeAutopilotForClient,
  retryFailedActions,
  resetClientFailures,
  getAdminSummary,
} from '@/lib/system-health';

export async function GET() {
  try {
    const summary = await getAdminSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[system-health/controls] GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, clientId } = body;

    switch (action) {
      case 'pauseGlobal': {
        const result = await pauseAutopilotGlobally();
        return NextResponse.json({ ok: true, ...result });
      }
      case 'resumeGlobal': {
        const result = await resumeAutopilotGlobally();
        return NextResponse.json({ ok: true, ...result });
      }
      case 'pauseClient': {
        if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
        const ok = await pauseAutopilotForClient(clientId);
        return NextResponse.json({ ok });
      }
      case 'resumeClient': {
        if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
        const ok = await resumeAutopilotForClient(clientId);
        return NextResponse.json({ ok });
      }
      case 'retryFailed': {
        const result = await retryFailedActions(clientId);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'resetFailures': {
        if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
        const ok = await resetClientFailures(clientId);
        return NextResponse.json({ ok });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[system-health/controls] POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
