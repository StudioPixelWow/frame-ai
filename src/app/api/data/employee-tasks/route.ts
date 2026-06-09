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
      const mine = (tasks as any[]).filter(
        (t) => (t.assignedEmployeeId === employeeId || t.employeeId === employeeId)
          && t.status !== 'missed', // hide not-done tasks from the employee's to-do
      );
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
