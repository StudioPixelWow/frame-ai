/**
 * GET    /api/data/projects/[id] — get one project
 * PUT    /api/data/projects/[id] — partial update
 * DELETE /api/data/projects/[id] — delete one project
 *
 * Storage: Supabase "video_projects" table with FLAT columns + JSONB for wizard_state/render_payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

type ProjectRow = {
  id: string;
  name?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  status?: string | null;
  description?: string | null;
  project_type?: string | null;
  format?: string | null;
  preset?: string | null;
  duration_sec?: number | null;
  segments?: unknown[] | Record<string, unknown> | null;
  source_video_key?: string | null;
  render_output_key?: string | null;
  thumbnail_key?: string | null;
  wizard_state?: Record<string, unknown> | null;
  render_payload?: Record<string, unknown> | null;
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
    clientName: r.client_name ?? '',
    status: r.status ?? 'draft',
    projectStatus: r.status ?? 'not_started',
    description: r.description ?? '',
    projectType: r.project_type ?? 'general',
    format: r.format ?? '9:16',
    preset: r.preset ?? '',
    durationSec: r.duration_sec ?? 0,
    segments: r.segments ?? [],
    sourceVideoKey: r.source_video_key ?? null,
    renderOutputKey: r.render_output_key ?? null,
    thumbnailKey: r.thumbnail_key ?? null,
    wizardState: r.wizard_state ?? null,
    renderPayload: r.render_payload ?? null,
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
    ['clientName', 'client_name'],
    ['status', 'status'],
    ['projectStatus', 'status'],
    ['description', 'description'],
    ['projectType', 'project_type'],
    ['format', 'format'],
    ['preset', 'preset'],
    ['durationSec', 'duration_sec'],
    ['sourceVideoKey', 'source_video_key'],
    ['renderOutputKey', 'render_output_key'],
    ['thumbnailKey', 'thumbnail_key'],
    ['startDate', 'start_date'],
    ['endDate', 'end_date'],
    ['assignedManagerId', 'assigned_manager_id'],
  ];
  for (const [bodyKey, dbKey] of map) {
    if (body[bodyKey] !== undefined) out[dbKey] = body[bodyKey];
  }
  // JSONB fields — deep-clone to avoid reference issues
  if (body.segments !== undefined) out.segments = body.segments ? JSON.parse(JSON.stringify(body.segments)) : null;
  if (body.wizardState !== undefined) out.wizard_state = body.wizardState ? JSON.parse(JSON.stringify(body.wizardState)) : null;
  if (body.renderPayload !== undefined) out.render_payload = body.renderPayload ? JSON.parse(JSON.stringify(body.renderPayload)) : null;
  out.updated_at = new Date().toISOString();
  return out;
}

const SELECT_COLUMNS =
  'id, name, client_id, client_name, status, description, project_type, format, preset, duration_sec, segments, source_video_key, render_output_key, thumbnail_key, wizard_state, render_payload, start_date, end_date, assigned_manager_id, created_at, updated_at';

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
