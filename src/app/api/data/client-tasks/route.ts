/**
 * GET /api/data/client-tasks - Get all client tasks
 * POST /api/data/client-tasks - Create a new client task
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientTasks } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await clientTasks.getAllAsync());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch client tasks' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await clientTasks.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create client task' },
      { status: 400 }
    );
  }
}
