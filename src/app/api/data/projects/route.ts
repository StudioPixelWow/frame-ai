/**
 * GET  /api/data/projects — list all projects
 * POST /api/data/projects — create a new project
 *
 * Storage: Supabase "projects" table with FLAT columns (no JSONB "data").
 *
 * Expected columns (DB owns the schema; code adapts to it):
 *   id, name, client_id, client_name, status, description,
 *   project_type, format, preset, duration_sec, segments,
 *   source_video_key, render_output_key, thumbnail_key,
 *   wizard_state (JSONB), render_payload (JSONB),
 *   start_date, end_date, assigned_manager_id,
 *   created_at, updated_at
 *
 * Any column that doesn't exist is automatically dropped and the request
 * retried, so partial DB schemas still accept the write.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `prj_${ts}_${rand}`;
}

/* ── Row → API object (snake_case → camelCase) ────────────────────────── */

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
  segments?: number | null;
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
    projectName: r.name ?? '', // alias for business-project UIs
    clientId: r.client_id ?? '',
    clientName: r.client_name ?? '',
    status: r.status ?? 'draft',
    projectStatus: r.status ?? 'not_started', // alias
    description: r.description ?? '',
    projectType: r.project_type ?? 'general',
    format: r.format ?? '9:16',
    preset: r.preset ?? '',
    durationSec: r.duration_sec ?? 0,
    segments: r.segments ?? 0,
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

/* ── Incoming body (camelCase, either shape) → flat DB columns ────────── */

export function toDbInsert(body: Record<string, unknown>, id: string, now: string): Record<string, unknown> {
  return {
    id,
    name: (body.name ?? body.projectName ?? '') as string,
    client_id: (body.clientId ?? null) as string | null,
    client_name: (body.clientName ?? '') as string,
    status: (body.status ?? body.projectStatus ?? 'draft') as string,
    description: (body.description ?? '') as string,
    project_type: (body.projectType ?? null) as string | null,
    format: (body.format ?? null) as string | null,
    preset: (body.preset ?? null) as string | null,
    duration_sec: (body.durationSec ?? null) as number | null,
    segments: (body.segments ?? null) as number | null,
    source_video_key: (body.sourceVideoKey ?? null) as string | null,
    render_output_key: (body.renderOutputKey ?? null) as string | null,
    thumbnail_key: (body.thumbnailKey ?? null) as string | null,
    wizard_state: body.wizardState ? JSON.parse(JSON.stringify(body.wizardState)) : null,
    render_payload: body.renderPayload ? JSON.parse(JSON.stringify(body.renderPayload)) : null,
    start_date: (body.startDate ?? null) as string | null,
    end_date: (body.endDate ?? null) as string | null,
    assigned_manager_id: (body.assignedManagerId ?? null) as string | null,
    created_at: now,
    updated_at: now,
  };
}

/* ── Column lists ─────────────────────────────────────────────────────── */

const SELECT_COLUMNS =
  'id, name, client_id, client_name, status, description, project_type, format, preset, duration_sec, segments, source_video_key, render_output_key, thumbnail_key, wizard_state, render_payload, start_date, end_date, assigned_manager_id, created_at, updated_at';

/* ── GET ──────────────────────────────────────────────────────────────── */

export async function GET() {
  try {
    const sb = getSupabase();

    // Try full select; on unknown-column error, progressively drop the column.
    let selectList = SELECT_COLUMNS;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: rows, error } = await sb.from('video_projects').select(selectList).order('id');
      if (!error) {
        const projects = (rows ?? []).map((r) => rowToProject(r as ProjectRow));
        return NextResponse.json(projects);
      }
      const m = error.message.match(/column .*?\.?['"]?([a-z_]+)['"]? does not exist|Could not find the '([^']+)' column/i);
      const bad = m?.[1] || m?.[2];
      if (!bad) {
        console.error('[API] GET /api/data/projects supabase error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      console.warn(`[API] GET /api/data/projects dropping unknown column "${bad}" from select. Add it via: ALTER TABLE video_projects ADD COLUMN ${bad} ${bad.endsWith('_state') || bad.endsWith('_payload') ? 'JSONB' : bad.endsWith('_sec') || bad === 'segments' ? 'INTEGER' : 'TEXT'};`);
      selectList = selectList
        .split(',')
        .map((s) => s.trim())
        .filter((c) => c !== bad)
        .join(', ');
    }
    return NextResponse.json({ error: 'Failed to build a valid select list' }, { status: 500 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/projects error:', msg);
    return NextResponse.json({ error: `Failed to fetch projects: ${msg}` }, { status: 500 });
  }
}

/* ── POST ─────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const now = new Date().toISOString();
    const id = generateId();

    let insertRow = toDbInsert(body, id, now);
    let selectList = SELECT_COLUMNS;

    console.log(`[API] POST /api/data/projects inserting id=${id} cols=${Object.keys(insertRow).join(',')}`);

    // Auto-drop unknown columns on the insert OR the select-back and retry.
    let inserted: ProjectRow | null = null;
    let lastErr: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await sb
        .from('video_projects')
        .insert(insertRow)
        .select(selectList)
        .single();

      if (!error) { inserted = data as ProjectRow; break; }

      lastErr = error as any;
      const m = error.message.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
      const bad = m?.[1] || m?.[2];
      if (!bad) break;

      if (bad in insertRow) {
        console.warn(`[API] POST /api/data/projects dropping unknown insert column "${bad}"`);
        const { [bad]: _d, ...rest } = insertRow;
        void _d;
        insertRow = rest;
      } else if (selectList.includes(bad)) {
        console.warn(`[API] POST /api/data/projects dropping unknown select column "${bad}"`);
        selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
      } else {
        break;
      }
    }

    if (!inserted) {
      const code = (lastErr as any)?.code ?? null;
      console.error('[API] POST /api/data/projects insert error:', lastErr);
      return NextResponse.json(
        { error: lastErr?.message ?? 'Insert failed', code },
        { status: 500 }
      );
    }

    // Verify by reading back.
    const { data: verify, error: verifyErr } = await sb
      .from('video_projects')
      .select(selectList)
      .eq('id', id)
      .maybeSingle();

    if (verifyErr || !verify) {
      console.error('[API] POST /api/data/projects verify failed', verifyErr);
      return NextResponse.json(
        { error: verifyErr?.message ?? 'Project not persisted', projectId: id },
        { status: 500 }
      );
    }

    console.log(`[API] POST /api/data/projects ✅ persisted id=${id}`);
    return NextResponse.json(rowToProject(verify as ProjectRow), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/projects fatal:', msg);
    return NextResponse.json({ error: `Failed to create project: ${msg}` }, { status: 500 });
  }
}
