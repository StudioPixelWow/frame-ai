/**
 * GET /api/data/client-email-logs - Get all client email logs
 * POST /api/data/client-email-logs - Create a new client email log
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientEmailLogs } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(clientEmailLogs.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch client email logs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = clientEmailLogs.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create client email log' },
      { status: 400 }
    );
  }
}
