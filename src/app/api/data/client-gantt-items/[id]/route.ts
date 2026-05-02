/**
 * GET /api/data/client-gantt-items/[id] - Get a single client gantt item
 * PUT /api/data/client-gantt-items/[id] - Update a client gantt item
 * DELETE /api/data/client-gantt-items/[id] - Delete a client gantt item
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientGanttItems, employeeTasks } from '@/lib/db';
import type { EmployeeTask, ClientGanttItem } from '@/lib/db/schema';
import { ensureSeeded } from '@/lib/db/seed';
import { getClientById } from '@/lib/db/client-helpers';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const item = await clientGanttItems.getByIdAsync(id);
    if (!item) {
      return NextResponse.json({ error: 'Client gantt item not found' }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch client gantt item' },
      { status: 500 }
    );
  }
}

/** Statuses that trigger employee task creation */
const WORK_STATUSES = ['in_progress', 'approved', 'draft'];

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const body = await req.json();

    // Read current item BEFORE update to detect status transition
    const before = await clientGanttItems.getByIdAsync(id) as ClientGanttItem | null;
    const updated = await clientGanttItems.updateAsync(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Client gantt item not found' }, { status: 404 });
    }

    // ── Gantt → Employee Task sync ──
    // When status moves to in_progress or approved, auto-create an employee task
    const newStatus = (updated as ClientGanttItem).status;
    const oldStatus = before?.status;
    if (
      newStatus !== oldStatus &&
      WORK_STATUSES.includes(newStatus) &&
      (!oldStatus || !WORK_STATUSES.includes(oldStatus))
    ) {
      const gantt = updated as ClientGanttItem;
      // Check if a task already exists for this gantt item
      const allTasks = await employeeTasks.getAllAsync() as EmployeeTask[];
      const existingTask = allTasks.find(t => t.ganttItemId === gantt.id);

      if (!existingTask) {
        // Determine assignee: gantt assignee → client's assigned manager → fallback
        const assigneeId = gantt.assigneeId || gantt.assignedManagerId || '';

        // Resolve client name
        let clientName = '';
        if (gantt.clientId) {
          const client = await getClientById(gantt.clientId);
          clientName = (client as any)?.name || '';
        }

        // Due date = gantt date minus 4 days
        let dueDate: string | null = null;
        if (gantt.date) {
          const d = new Date(gantt.date);
          d.setDate(d.getDate() - 4);
          dueDate = d.toISOString().split('T')[0];
        }

        const newTask: Omit<EmployeeTask, 'id'> = {
          title: gantt.title || 'משימת גאנט',
          description: gantt.ideaSummary || gantt.caption || '',
          assignedEmployeeId: assigneeId,
          clientId: gantt.clientId || null,
          clientName,
          projectId: null,
          ganttItemId: gantt.id,
          dueDate,
          status: 'new',
          priority: 'medium',
          files: [],
          notes: `נוצר אוטומטית מגאנט: ${gantt.title}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const created = await employeeTasks.createAsync(newTask);
        console.log('[Gantt→Task Sync] Created employee task:', created.id, 'for gantt:', gantt.id, 'assignee:', assigneeId, 'due:', dueDate);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update client gantt item' },
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
    const deleted = await clientGanttItems.deleteAsync(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Client gantt item not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete client gantt item' },
      { status: 500 }
    );
  }
}
