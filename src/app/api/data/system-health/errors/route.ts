import { NextResponse } from 'next/server';
import { getErrors, resolveError, trackError } from '@/lib/system-health';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') as any || undefined;
    const severity = searchParams.get('severity') as any || undefined;
    const resolved = searchParams.get('resolved');
    const clientId = searchParams.get('clientId') || undefined;

    const errors = await getErrors({
      source,
      severity,
      resolved: resolved !== null ? resolved === 'true' : undefined,
      clientId,
    });
    return NextResponse.json({ errors });
  } catch (error) {
    console.error('[system-health/errors] GET error:', error);
    return NextResponse.json({ error: 'Failed to load errors' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, errorId, ...trackInput } = body;

    if (action === 'resolve' && errorId) {
      const ok = await resolveError(errorId);
      return NextResponse.json({ ok });
    }

    if (action === 'track') {
      const id = await trackError(trackInput);
      return NextResponse.json({ ok: !!id, id });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[system-health/errors] POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
