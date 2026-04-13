/**
 * GET /api/data/tasks/[id] - Get a single task
 * PUT /api/data/tasks/[id] - Update a task
 * DELETE /api/data/tasks/[id] - Delete a task
 */

import { NextRequest, NextResponse } from 'next/server';
import { tasks } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = params;
    const task = tasks.getById(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = params;
    const body = await req.json();
    const updated = tasks.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = params;
    const deleted = tasks.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
