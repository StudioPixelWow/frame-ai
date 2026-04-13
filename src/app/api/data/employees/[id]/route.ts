/**
 * GET /api/data/employees/[id] - Get a single employee
 * PUT /api/data/employees/[id] - Update an employee
 * DELETE /api/data/employees/[id] - Delete an employee
 */

import { NextRequest, NextResponse } from 'next/server';
import { employees } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const employee = employees.getById(params.id);
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const body = await req.json();
    const updated = employees.update(params.id, body);
    if (!updated) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const deleted = employees.delete(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}
