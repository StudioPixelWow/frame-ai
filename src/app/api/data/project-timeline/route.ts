/**
 * GET  /api/data/project-timeline?projectId=xxx — list timeline events for a project
 * POST /api/data/project-timeline              — insert a timeline event
 *
 * Table: business_project_timeline
 *   id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
 *   project_id  TEXT NOT NULL
 *   action_type TEXT NOT NULL
 *   description TEXT NOT NULL DEFAULT ''
 *   created_at  TIMESTAMPTZ DEFAULT now()
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'business_project_timeline';

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_timeline_project ON ${TABLE}(project_id);
`;

type Row = Record<string, unknown> & { id: string };

function rowToEvent(r: Row) {
  return {
    id: r.id,
    projectId: (r.project_id as string) ?? '',
    actionType: (r.action_type as string) ?? '',
    description: (r.description as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
  };
}

/* ── Table bootstrap ─────────────────────────────────────────── */

let _tableReady = false;

async function ensureTable(sb: ReturnType<typeof getSupabase>): Promise<boolean> {
  if (_tableReady) return true;

  // 1. Try exec_sql RPC
  try {
    const { error } = await sb.rpc('exec_sql', { query: TABLE_DDL });
    if (!error) { _tableReady = true; return true; }
  } catch { /* rpc not available */ }

  // 2. Probe SELECT
  const { error: probeErr } = await sb.from(TABLE).select('id').limit(1);
  if (!probeErr) { _tableReady = true; return true; }

  const code = (probeErr as any)?.code ?? '';
  if (code === '42P01' || probeErr.message?.includes('does not exist')) {
    console.error(
      `[project-timeline] ❌ Table "${TABLE}" does not exist!\n` +
      `Run this SQL in Supabase Dashboard → SQL Editor:\n\n${TABLE_DDL}`
    );
  }
  return false;
}

/* ── GET ─────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase();
    const tableOk = await ensureTable(sb);
    if (!tableOk) return NextResponse.json([]);

    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId') || url.searchParams.get('project_id');

    let q = sb.from(TABLE).select('*').order('created_at', { ascending: false });
    if (projectId) q = q.eq('project_id', projectId);

    const { data: rows, error } = await q;
    if (error) {
      console.error('[project-timeline] GET error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((rows ?? []).map((r: Record<string, unknown>) => rowToEvent(r as Row)));
  } catch (err: any) {
    console.error('[project-timeline] GET fatal:', err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

/* ── POST ────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();
    const tableOk = await ensureTable(sb);
    if (!tableOk) {
      return NextResponse.json(
        { error: `Table "${TABLE}" does not exist. Check server logs for DDL.` },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { projectId, actionType, description } = body;

    if (!projectId || !actionType) {
      return NextResponse.json({ error: 'projectId and actionType are required' }, { status: 400 });
    }

    const insertRow: Record<string, unknown> = {
      project_id: projectId,
      action_type: actionType,
      description: description || '',
    };

    const { data, error } = await sb.from(TABLE).insert(insertRow).select('*').single();
    if (error) {
      console.error('[project-timeline] POST error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(rowToEvent(data as Row), { status: 201 });
  } catch (err: any) {
    console.error('[project-timeline] POST fatal:', err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

/* ── Helper: fire-and-forget timeline insert (for use by other routes) ── */

export async function insertTimelineEvent(
  projectId: string,
  actionType: string,
  description: string,
): Promise<void> {
  try {
    const sb = getSupabase();
    const tableOk = await ensureTable(sb);
    if (!tableOk) return;

    await sb.from(TABLE).insert({
      project_id: projectId,
      action_type: actionType,
      description,
    });
  } catch (err: any) {
    console.warn('[project-timeline] insertTimelineEvent failed:', err?.message);
  }
}
