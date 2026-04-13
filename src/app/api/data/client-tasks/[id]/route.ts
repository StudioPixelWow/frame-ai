/**
 * GET /api/data/client-tasks/[id] - Get a single client task
 * PUT /api/data/client-tasks/[id] - Update a client task
 * DELETE /api/data/client-tasks/[id] - Delete a client task
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientTasks } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const task = clientTasks.getById(id);
    if (!task) {
      return NextResponse.json({ error: 'Client task not found' }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch client task' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const body = await req.json();
    const updated = clientTasks.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Client task not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update client task' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const deleted = clientTasks.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Client task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete client task' },
      { status: 500 }
    );
  }
}
