/**
 * GET  /api/data/business-projects — list all business projects
 * POST /api/data/business-projects — create a new business project
 *
 * Storage: Supabase "business_projects" table with FLAT columns.
 * Expected schema:
 *   id, project_name, client_id, project_type, description,
 *   agreement_signed, project_status, start_date, end_date,
 *   assigned_manager_id, created_at, updated_at
 *
 * Unknown columns are auto-dropped and the request is retried, so partial
 * schemas still succeed. The id returned by POST is the id that the GET
 * route (and the detail page) will find.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'business_projects';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `bpr_${ts}_${rand}`;
}

type Row = {
  id: string;
  project_name?: string | null;
  client_id?: string | null;
  project_type?: string | null;
  description?: string | null;
  agreement_signed?: boolean | null;
  project_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  assigned_manager_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function rowToProject(r: Row) {
  return {
    id: r.id,
    projectName: r.project_name ?? '',
    clientId: r.client_id ?? '',
    projectType: r.project_type ?? 'general',
    description: r.description ?? '',
    agreementSigned: r.agreement_signed ?? false,
    projectStatus: r.project_status ?? 'not_started',
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    assignedManagerId: r.assigned_manager_id ?? null,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

function toInsert(body: Record<string, unknown>, id: string, now: string): Record<string, unknown> {
  return {
    id,
    project_name: (body.projectName ?? body.name ?? '') as string,
    client_id: (body.clientId ?? null) as string | null,
    project_type: (body.projectType ?? null) as string | null,
    description: (body.description ?? '') as string,
    agreement_signed: (body.agreementSigned ?? false) as boolean,
    project_status: (body.projectStatus ?? body.status ?? 'not_started') as string,
    start_date: (body.startDate ?? null) as string | null,
    end_date: (body.endDate ?? null) as string | null,
    assigned_manager_id: (body.assignedManagerId ?? null) as string | null,
    created_at: now,
    updated_at: now,
  };
}

const SELECT_COLUMNS =
  'id, project_name, client_id, project_type, description, agreement_signed, project_status, start_date, end_date, assigned_manager_id, created_at, updated_at';

function parseBadColumn(msg: string): string | null {
  const m = msg.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
  return m?.[1] || m?.[2] || null;
}

export async function GET() {
  try {
    const sb = getSupabase();
    let selectList = SELECT_COLUMNS;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: rows, error } = await sb.from(TABLE).select(selectList).order('id');
      if (!error) {
        return NextResponse.json((rows ?? []).map((r) => rowToProject(r as Row)));
      }
      const bad = parseBadColumn(error.message);
      if (!bad) {
        console.error('[API] GET /api/data/business-projects supabase error:', error);
        return NextResponse.json({ error: error.message, code: (error as any).code ?? null }, { status: 500 });
      }
      selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
    }
    return NextResponse.json({ error: 'Failed to build valid select list' }, { status: 500 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/business-projects error:', msg);
    return NextResponse.json({ error: `Failed to fetch business projects: ${msg}` }, { status: 500 });
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

    console.log(`[API] POST /api/data/business-projects inserting id=${id} cols=${Object.keys(insertRow).join(',')}`);

    let inserted: Row | null = null;
    let lastErr: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const { data, error } = await sb.from(TABLE).insert(insertRow).select(selectList).single();
      if (!error) { inserted = data as Row; break; }
      lastErr = error as any;
      const bad = parseBadColumn(error.message);
      if (!bad) break;
      if (bad in insertRow) {
        console.warn(`[API] POST /api/data/business-projects dropping unknown insert column "${bad}"`);
        const { [bad]: _d, ...rest } = insertRow;
        void _d;
        insertRow = rest;
      } else if (selectList.includes(bad)) {
        console.warn(`[API] POST /api/data/business-projects dropping unknown select column "${bad}"`);
        selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
      } else {
        break;
      }
    }

    if (!inserted) {
      const code = (lastErr as any)?.code ?? null;
      const hint =
        code === '42P01'
          ? `Run: CREATE TABLE IF NOT EXISTS ${TABLE} ( id TEXT PRIMARY KEY, project_name TEXT, client_id TEXT, project_type TEXT, description TEXT, agreement_signed BOOLEAN, project_status TEXT, start_date DATE, end_date DATE, assigned_manager_id TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ );`
          : null;
      console.error('[API] POST /api/data/business-projects insert error:', lastErr);
      return NextResponse.json({ error: lastErr?.message ?? 'Insert failed', code, hint }, { status: 500 });
    }

    // Verify read-back so we guarantee the detail page will find it.
    const { data: verify, error: verifyErr } = await sb.from(TABLE).select(selectList).eq('id', id).maybeSingle();
    if (verifyErr || !verify) {
      console.error('[API] POST /api/data/business-projects verify failed', verifyErr);
      return NextResponse.json({ error: verifyErr?.message ?? 'Not persisted', projectId: id }, { status: 500 });
    }

    console.log(`[API] POST /api/data/business-projects ✅ persisted id=${id}`);
    return NextResponse.json(rowToProject(verify as Row), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/business-projects fatal:', msg);
    return NextResponse.json({ error: `Failed to create business project: ${msg}` }, { status: 500 });
  }
}
