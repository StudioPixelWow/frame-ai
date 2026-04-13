/**
 * GET /api/data/employees - Get all employees
 * POST /api/data/employees - Create a new employee
 */

import { NextRequest, NextResponse } from 'next/server';
import { employees } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(employees.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = employees.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 400 }
    );
  }
}
