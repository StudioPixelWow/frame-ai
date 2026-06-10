/**
 * GET /api/data/employee-tasks - Get all employee tasks
 * POST /api/data/employee-tasks - Create a new employee task
 */

import { NextRequest, NextResponse } from 'next/server';
import { employeeTasks } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { getRequestRole, getRequestEmployeeId } from '@/lib/auth/api-guard';
import { sweepOverdueGantt } from '@/lib/tasks/overdue';

export async function GET(req: NextRequest) {
  ensureSeeded();
  try {
    // Move gantt items overdue >2 days (and their tasks) to "missed" before reading.
    try { await sweepOverdueGantt(); } catch { /* non-blocking */ }

    const tasks = await employeeTasks.getAllAsync();
    // Privacy: an employee only sees their OWN tasks; admin/employee-manager see all.
    const role = getRequestRole(req);
    if (role === 'employee') {
      const employeeId = getRequestEmployeeId(req);
      const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
      const doneStatuses = new Set(['completed', 'approved', 'under_review']);
      const mine = (tasks as any[]).filter((t) => {
        if (!(t.assignedEmployeeId === employeeId || t.employeeId === employeeId)) return false;
        if (t.status === 'missed') return false; // not-done → manager only
        // Hide tasks whose date already passed (yesterday or earlier) — unless done/in-review.
        if (t.dueDate && !doneStatuses.has(t.status)) {
          const d = new Date(t.dueDate).getTime();
          if (!Number.isNaN(d) && d < startToday.getTime()) return false;
        }
        return true;
      });
      // Sort by nearest due date first (tasks without a date go last).
      mine.sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      });
      return NextResponse.json(mine);
    }
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
