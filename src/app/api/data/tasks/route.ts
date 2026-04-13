/**
 * GET /api/data/tasks - Get all tasks
 * POST /api/data/tasks - Create a new task
 */

import { NextRequest, NextResponse } from 'next/server';
import { tasks } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(tasks.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = tasks.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 400 }
    );
  }
}
