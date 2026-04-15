/**
 * GET    /api/data/employees/[id] — get one employee
 * PUT    /api/data/employees/[id] — partial update
 * DELETE /api/data/employees/[id] — delete an employee
 *
 * Storage: Supabase "employees" table (same source of truth as the list route).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'employees';

type Row = {
  id: string;
  name?: string | null;
  role_id?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  salary?: number | null;
  status?: string | null;
  skills?: unknown;
  tasks_count?: number | null;
  workload?: number | null;
  join_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function rowToEmployee(r: Row) {
  return {
    id: r.id,
    name: r.name ?? '',
    roleId: r.role_id ?? '',
    role: r.role ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    avatarUrl: r.avatar_url ?? '',
    salary: typeof r.salary === 'number' ? r.salary : 0,
    status: r.status ?? 'offline',
    skills: Array.isArray(r.skills) ? r.skills : [],
    tasksCount: typeof r.tasks_count === 'number' ? r.tasks_count : 0,
    workload: typeof r.workload === 'number' ? r.workload : 0,
    joinDate: r.join_date ?? '',
    notes: r.notes ?? '',
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
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

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    let selectList = SELECT_COLUMNS;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await sb.from(TABLE).select(selectList).eq('id', id).maybeSingle();
      if (!error) {
        if (!data) return NextResponse.json({ error: 'Employee not found', employeeId: id }, { status: 404 });
        return NextResponse.json(rowToEmployee(data as Row));
      }
      const bad = parseBadColumn(error.message);
      if (!bad) return NextResponse.json({ error: error.message }, { status: 500 });
      selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
    }
    return NextResponse.json({ error: 'Failed to build select list' }, { status: 500 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch employee: ${msg}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

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

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
