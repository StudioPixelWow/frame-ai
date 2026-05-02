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
    const tasks = await employeeTasks.getAllAsync();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('[employee-tasks GET] error:', error instanceof Error ? error.message : error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await employeeTasks.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[employee-tasks POST] error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to create employee task' },
      { status: 400 }
    );
  }
}
