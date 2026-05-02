import { NextResponse } from 'next/server';
import { runHealthCheck } from '@/lib/system-health';

export async function GET() {
  try {
    const data = await runHealthCheck();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[system-health] GET error:', error);
    return NextResponse.json({ error: 'Failed to load health data' }, { status: 500 });
  }
}
