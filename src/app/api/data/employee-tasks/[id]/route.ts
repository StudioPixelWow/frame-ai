/**
 * GET /api/data/employee-tasks/[id] - Get a single employee task
 * PUT /api/data/employee-tasks/[id] - Update an employee task
 * DELETE /api/data/employee-tasks/[id] - Delete an employee task
 */

import { NextRequest, NextResponse } from 'next/server';
import { employeeTasks, clientGanttItems } from '@/lib/db';
import type { EmployeeTask } from '@/lib/db/schema';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await params;
    const employeeTask = employeeTasks.getById(id);
    if (!employeeTask) {
      return NextResponse.json({ error: 'Employee task not found' }, { status: 404 });
    }
    return NextResponse.json(employeeTask);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch employee task' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await params;
    const before = employeeTasks.getById(id) as EmployeeTask | null;
    const body = await req.json();
    const updated = employeeTasks.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Employee task not found' }, { status: 404 });
    }

    // ── Reverse sync: Task completed → update linked gantt item ──
    const task = updated as EmployeeTask;
    if (task.ganttItemId && task.status === 'completed' && before?.status !== 'completed') {
      try {
        clientGanttItems.update(task.ganttItemId, { status: 'published' });
        console.log('[Task→Gantt Sync] Gantt item', task.ganttItemId, 'marked published (task completed)');
      } catch { /* gantt item may not exist — safe to ignore */ }
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update employee task' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await params;
    const deleted = employeeTasks.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Employee task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete employee task' },
      { status: 500 }
    );
  }
}
