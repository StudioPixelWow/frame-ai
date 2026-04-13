/**
 * GET /api/data/client-gantt-items - Get all client gantt items
 * POST /api/data/client-gantt-items - Create a new client gantt item
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientGanttItems } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(clientGanttItems.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch client gantt items' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = clientGanttItems.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create client gantt item' },
      { status: 400 }
    );
  }
}
