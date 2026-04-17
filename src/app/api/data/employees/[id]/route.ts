/**
 * GET    /api/data/employees/[id] — get one employee
 * PUT    /api/data/employees/[id] — partial update
 * DELETE /api/data/employees/[id] — delete an employee
 *
 * Storage: Supabase "employees" table (same source of truth as the list route).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole, getRequestRole, getRequestEmployeeId } from '@/lib/auth/api-guard';

const TABLE = 'employees';

type Row = Record<string, unknown> & { id: string };

function pickString(r: Row, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return '';
}
function pickNumber(r: Row, ...keys: string[]): number {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number') return v;
  }
  return 0;
}

function rowToEmployee(r: Row) {
  const first = pickString(r, 'first_name', 'firstName');
  const last = pickString(r, 'last_name', 'lastName');
  const combined = [first, last].filter(Boolean).join(' ');
  const name = pickString(r, 'name', 'full_name', 'fullName', 'display_name') || combined;
  const appRole = pickString(r, 'app_role', 'appRole') || 'employee';
  return {
    id: r.id,
    name,
    firstName: first,
    lastName: last,
    roleId: pickString(r, 'role_id', 'roleId'),
    role: pickString(r, 'role', 'title', 'position'),
    appRole,
    email: pickString(r, 'email'),
    phone: pickString(r, 'phone', 'phone_number'),
    avatarUrl: pickString(r, 'avatar_url', 'avatarUrl', 'photo_url'),
    salary: pickNumber(r, 'salary'),
    status: pickString(r, 'status', 'employment_status') || 'offline',
    skills: Array.isArray(r.skills) ? r.skills : [],
    tasksCount: pickNumber(r, 'tasks_count', 'tasksCount'),
    workload: pickNumber(r, 'workload'),
    joinDate: pickString(r, 'join_date', 'joinDate', 'hired_at', 'start_date'),
    notes: pickString(r, 'notes'),
    createdAt: pickString(r, 'created_at', 'createdAt'),
    updatedAt: pickString(r, 'updated_at', 'updatedAt'),
  };
}

function nullIfEmpty(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function toUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const nullable = new Set(['role_id', 'join_date']);
  const map: Array<[string, string]> = [
    ['name', 'name'],
    ['roleId', 'role_id'],
    ['role', 'role'],
    ['appRole', 'app_role'],
    ['email', 'email'],
    ['phone', 'phone'],
    ['avatarUrl', 'avatar_url'],
    ['salary', 'salary'],
    ['status', 'status'],
    ['skills', 'skills'],
    ['tasksCount', 'tasks_count'],
    ['workload', 'workload'],
    ['joinDate', 'join_date'],
    ['notes', 'notes'],
  ];
  for (const [k, dbKey] of map) {
    if (body[k] !== undefined) out[dbKey] = nullable.has(dbKey) ? nullIfEmpty(body[k]) : body[k];
  }
  out.updated_at = new Date().toISOString();
  return out;
}

const SELECT_COLUMNS =
  'id, name, role_id, role, email, phone, avatar_url, salary, status, skills, tasks_count, workload, join_date, notes, created_at, updated_at';

function parseBadColumn(msg: string): string | null {
  const m = msg.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
  return m?.[1] || m?.[2] || null;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Only admin and employee can view employee details
  const getErr = requireRole(req, 'admin', 'employee');
  if (getErr) return getErr;

  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Employee not found', employeeId: id }, { status: 404 });
    return NextResponse.json(rowToEmployee(data as Row));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch employee: ${msg}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Admin can update any employee. Employee can only update themselves (not appRole/salary).
  const role = getRequestRole(req);
  if (role === 'client') {
    return NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 });
  }
  try {
    const { id } = await context.params;

    // Employee can only edit their own record
    if (role === 'employee') {
      const empId = getRequestEmployeeId(req);
      if (empId !== id) {
        return NextResponse.json({ error: 'אין הרשאה לערוך עובד אחר' }, { status: 403 });
      }
    }

    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    // Employees cannot change their own appRole or salary — strip those fields
    if (role === 'employee') {
      delete body.appRole;
      delete body.salary;
    }

    const sb = getSupabase();
    let updateRow = toUpdate(body);
    let selectList = SELECT_COLUMNS;

    let updated: Row | null = null;
    let lastErr: { message: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const { data, error } = await sb.from(TABLE).update(updateRow).eq('id', id).select(selectList).maybeSingle();
      if (!error) { updated = (data as Row) ?? null; break; }
      lastErr = error as any;
      const bad = parseBadColumn(error.message);
      if (!bad) break;
      if (bad in updateRow) { const { [bad]: _d, ...rest } = updateRow; void _d; updateRow = rest; }
      else if (selectList.includes(bad)) selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
      else break;
    }

    if (lastErr && !updated) return NextResponse.json({ error: lastErr.message }, { status: 400 });
    if (!updated) return NextResponse.json({ error: 'Employee not found', employeeId: id }, { status: 404 });
    return NextResponse.json(rowToEmployee(updated));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to update: ${msg}` }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Only admin can delete employees
  const delErr = requireRole(req, 'admin');
  if (delErr) return delErr;
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { error } = await sb.from(TABLE).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to delete: ${msg}` }, { status: 500 });
  }
}
