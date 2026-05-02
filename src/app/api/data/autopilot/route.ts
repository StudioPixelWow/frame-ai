import { NextResponse } from 'next/server';
import { getAutopilotDashboardData } from '@/lib/autopilot';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || undefined;
    const data = await getAutopilotDashboardData(clientId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[autopilot] GET error:', error);
    return NextResponse.json({ error: 'Failed to load autopilot data' }, { status: 500 });
  }
}
