/**
 * GET  /api/data/employees — list all employees (source of truth for FK'd ids)
 * POST /api/data/employees — create a new employee
 *
 * Storage: Supabase "employees" table with FLAT columns.
 * Expected schema:
 *   id, name, role_id, role, email, phone, avatar_url,
 *   salary, status, skills (jsonb or text[]), tasks_count, workload,
 *   join_date, notes, created_at, updated_at
 *
 * Unknown columns are auto-dropped and the request retried so partial
 * schemas still succeed. The id returned by POST is exactly the value
 * that other tables' foreign keys (e.g. business_projects.assigned_manager_id)
 * must reference.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole } from '@/lib/auth/api-guard';

const TABLE = 'employees';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `emp_${ts}_${rand}`;
}

function nullIfEmpty(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

// Row shape is intentionally open — the real Supabase schema may use
// first_name/last_name/full_name instead of name, etc. We map defensively.
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

  // app_role is the RBAC role ('admin' | 'employee' | 'client').
  // Separate from `role` which is the job title (e.g. "מעצב", "מפתח").
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

function toInsert(body: Record<string, unknown>, id: string, now: string): Record<string, unknown> {
  return {
    id,
    name: (body.name ?? '') as string,
    role_id: nullIfEmpty(body.roleId),
    role: (body.role ?? '') as string,
    app_role: (body.appRole ?? 'employee') as string,
    email: (body.email ?? '') as string,
    phone: (body.phone ?? '') as string,
    avatar_url: (body.avatarUrl ?? '') as string,
    salary: typeof body.salary === 'number' ? body.salary : 0,
    status: (body.status ?? 'offline') as string,
    skills: Array.isArray(body.skills) ? body.skills : [],
    tasks_count: typeof body.tasksCount === 'number' ? body.tasksCount : 0,
    workload: typeof body.workload === 'number' ? body.workload : 0,
    join_date: nullIfEmpty(body.joinDate),
    notes: (body.notes ?? '') as string,
    created_at: now,
    updated_at: now,
  };
}

const SELECT_COLUMNS =
  'id, name, role_id, role, email, phone, avatar_url, salary, status, skills, tasks_count, workload, join_date, notes, created_at, updated_at';

function parseBadColumn(msg: string): string | null {
  const m = msg.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
  return m?.[1] || m?.[2] || null;
}

export async function GET(req: NextRequest) {
  // Only admin and employee can list employees
  const getErr = requireRole(req, 'admin', 'employee');
  if (getErr) return getErr;

  try {
    const sb = getSupabase();
    // Select all columns so we get whatever the real schema has
    // (first_name/last_name/full_name, etc.) and map defensively below.
    const { data: rows, error } = await sb.from(TABLE).select('*').order('id');
    if (error) {
      console.error('[API] GET /api/data/employees supabase error:', error);
      return NextResponse.json({ error: error.message, code: (error as any).code ?? null }, { status: 500 });
    }
    console.log(`[API] GET /api/data/employees returned ${(rows ?? []).length} rows`);
    return NextResponse.json((rows ?? []).map((r) => rowToEmployee(r as Row)));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/employees error:', msg);
    return NextResponse.json({ error: `Failed to fetch employees: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Only admin can create employees
  const postErr = requireRole(req, 'admin');
  if (postErr) return postErr;

  try {
    const sb = getSupabase();
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const now = new Date().toISOString();
    const id = generateId();
    let insertRow = toInsert(body, id, now);
    let selectList = SELECT_COLUMNS;

    console.log(`[API] POST /api/data/employees inserting id=${id}`);

    let inserted: Row | null = null;
    let lastErr: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 12; attempt++) {
      const { data, error } = await sb.from(TABLE).insert(insertRow).select(selectList).single();
      if (!error) { inserted = data as Row; break; }
      lastErr = error as any;
      const bad = parseBadColumn(error.message);
      if (!bad) break;
      if (bad in insertRow) {
        const { [bad]: _d, ...rest } = insertRow; void _d;
        insertRow = rest;
      } else if (selectList.includes(bad)) {
        selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
      } else break;
    }

    if (!inserted) {
      const code = (lastErr as any)?.code ?? null;
      const hint = code === '42P01'
        ? `Run: CREATE TABLE IF NOT EXISTS ${TABLE} (id TEXT PRIMARY KEY, name TEXT, role TEXT, email TEXT, phone TEXT, status TEXT, skills JSONB, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ);`
        : null;
      console.error('[API] POST /api/data/employees insert error:', lastErr);
      return NextResponse.json({ error: lastErr?.message ?? 'Insert failed', code, hint }, { status: 500 });
    }

    // Verification read-back so we know the FK target exists.
    const { data: verify, error: verifyErr } = await sb.from(TABLE).select(selectList).eq('id', id).maybeSingle();
    if (verifyErr || !verify) {
      console.error('[API] POST /api/data/employees verify failed', verifyErr);
      return NextResponse.json({ error: verifyErr?.message ?? 'Not persisted', employeeId: id }, { status: 500 });
    }

    console.log(`[API] POST /api/data/employees ✅ persisted id=${id}`);
    return NextResponse.json(rowToEmployee(verify as Row), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/employees fatal:', msg);
    return NextResponse.json({ error: `Failed to create employee: ${msg}` }, { status: 500 });
  }
}
