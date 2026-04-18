/**
 * GET /api/data/employee-tasks - Get all employee tasks
 * POST /api/data/employee-tasks - Create a new employee task
 */

import { NextRequest, NextResponse } from 'next/server';
import { employeeTasks } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await employeeTasks.getAllAsync());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch employee tasks' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await employeeTasks.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create employee task' },
      { status: 400 }
    );
  }
}
