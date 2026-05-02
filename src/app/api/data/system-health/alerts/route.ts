import { NextResponse } from 'next/server';
import { getActiveAlerts, acknowledgeAlert, acknowledgeAllAlerts } from '@/lib/system-health';

export async function GET() {
  try {
    const alerts = await getActiveAlerts();
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('[system-health/alerts] GET error:', error);
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, alertId } = body;

    if (action === 'acknowledge' && alertId) {
      const ok = await acknowledgeAlert(alertId);
      return NextResponse.json({ ok });
    }

    if (action === 'acknowledgeAll') {
      const count = await acknowledgeAllAlerts();
      return NextResponse.json({ ok: true, count });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[system-health/alerts] POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
