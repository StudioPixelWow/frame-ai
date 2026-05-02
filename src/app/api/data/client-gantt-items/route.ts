/**
 * GET /api/data/client-gantt-items - Get all client gantt items
 * POST /api/data/client-gantt-items - Create a new client gantt item
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientGanttItems } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { scopeForClient } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  ensureSeeded();
  try {
    const all = await clientGanttItems.getAllAsync();
    const scoped = scopeForClient(req, all, (item: any) => item.clientId);
    return NextResponse.json(scoped);
  } catch (error) {
    console.error('[client-gantt-items GET] error:', error instanceof Error ? error.message : error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await clientGanttItems.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[client-gantt-items POST] error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to create client gantt item' },
      { status: 400 }
    );
  }
}
