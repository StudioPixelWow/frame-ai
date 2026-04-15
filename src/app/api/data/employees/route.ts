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

function toInsert(body: Record<string, unknown>, id: string, now: string): Record<string, unknown> {
  return {
    id,
    name: (body.name ?? '') as string,
    role_id: nullIfEmpty(body.roleId),
    role: (body.role ?? '') as string,
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

export async function GET() {
  try {
    const sb = getSupabase();
    let selectList = SELECT_COLUMNS;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: rows, error } = await sb.from(TABLE).select(selectList).order('id');
      if (!error) return NextResponse.json((rows ?? []).map((r) => rowToEmployee(r as Row)));
      const bad = parseBadColumn(error.message);
      if (!bad) {
        console.error('[API] GET /api/data/employees supabase error:', error);
        return NextResponse.json({ error: error.message, code: (error as any).code ?? null }, { status: 500 });
      }
      selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
    }
    return NextResponse.json({ error: 'Failed to build valid select list' }, { status: 500 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/employees error:', msg);
    return NextResponse.json({ error: `Failed to fetch employees: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
