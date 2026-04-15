/**
 * GET    /api/data/projects/[id] — get one project
 * PUT    /api/data/projects/[id] — partial update
 * DELETE /api/data/projects/[id] — delete one project
 *
 * Storage: Supabase "projects" table with FLAT columns (no JSONB "data").
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

type ProjectRow = {
  id: string;
  name?: string | null;
  client_id?: string | null;
  status?: string | null;
  description?: string | null;
  project_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  assigned_manager_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function rowToProject(r: ProjectRow) {
  return {
    id: r.id,
    name: r.name ?? '',
    projectName: r.name ?? '',
    clientId: r.client_id ?? '',
    status: r.status ?? 'draft',
    projectStatus: r.status ?? 'not_started',
    description: r.description ?? '',
    projectType: r.project_type ?? 'general',
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    assignedManagerId: r.assigned_manager_id ?? null,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

/** Map a partial camelCase update → flat snake_case columns. Only known keys. */
function toDbUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const map: Array<[string, string]> = [
    ['name', 'name'],
    ['projectName', 'name'],
    ['clientId', 'client_id'],
    ['status', 'status'],
    ['projectStatus', 'status'],
    ['description', 'description'],
    ['projectType', 'project_type'],
    ['startDate', 'start_date'],
    ['endDate', 'end_date'],
    ['assignedManagerId', 'assigned_manager_id'],
  ];
  for (const [bodyKey, dbKey] of map) {
    if (body[bodyKey] !== undefined) out[dbKey] = body[bodyKey];
  }
  out.updated_at = new Date().toISOString();
  return out;
}

const SELECT_COLUMNS =
  'id, name, client_id, status, description, project_type, start_date, end_date, assigned_manager_id, created_at, updated_at';

function parseBadColumn(msg: string): string | null {
  const m = msg.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
  return m?.[1] || m?.[2] || null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    let selectList = SELECT_COLUMNS;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await sb.from('video_projects').select(selectList).eq('id', id).maybeSingle();
      if (!error) {
        if (!data) return NextResponse.json({ error: 'Project not found', projectId: id }, { status: 404 });
        return NextResponse.json(rowToProject(data as ProjectRow));
      }
      const bad = parseBadColumn(error.message);
      if (!bad) {
        console.error('[API] GET /api/data/projects/[id] supabase error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
    }
    return NextResponse.json({ error: 'Failed to build valid select list' }, { status: 500 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/projects/[id] error:', msg);
    return NextResponse.json({ error: `Failed to fetch project: ${msg}` }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const sb = getSupabase();
    let updateRow = toDbUpdate(body);
    let selectList = SELECT_COLUMNS;

    console.log(`[API] PUT /api/data/projects/${id} cols=${Object.keys(updateRow).join(',')}`);

    let updated: ProjectRow | null = null;
    let lastErr: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await sb
        .from('video_projects')
        .update(updateRow)
        .eq('id', id)
        .select(selectList)
        .maybeSingle();
      if (!error) { updated = (data as ProjectRow) ?? null; break; }
      lastErr = error as any;
      const bad = parseBadColumn(error.message);
      if (!bad) break;
      if (bad in updateRow) {
        console.warn(`[API] PUT /api/data/projects/${id} dropping unknown update column "${bad}"`);
        const { [bad]: _d, ...rest } = updateRow;
        void _d;
        updateRow = rest;
      } else if (selectList.includes(bad)) {
        console.warn(`[API] PUT /api/data/projects/${id} dropping unknown select column "${bad}"`);
        selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
      } else {
        break;
      }
    }

    if (lastErr && !updated) {
      console.error('[API] PUT /api/data/projects/[id] supabase error:', lastErr);
      return NextResponse.json({ error: lastErr.message, code: (lastErr as any).code ?? null }, { status: 400 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'Project not found', projectId: id }, { status: 404 });
    }
    return NextResponse.json(rowToProject(updated));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] PUT /api/data/projects/[id] error:', msg);
    return NextResponse.json({ error: `Failed to update project: ${msg}` }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { error } = await sb.from('video_projects').delete().eq('id', id);
    if (error) {
      console.error('[API] DELETE /api/data/projects/[id] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] DELETE /api/data/projects/[id] error:', msg);
    return NextResponse.json({ error: `Failed to delete project: ${msg}` }, { status: 500 });
  }
}
