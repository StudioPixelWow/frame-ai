/**
 * GET  /api/data/projects — list all projects
 * POST /api/data/projects — create a new project
 *
 * Storage: Supabase "projects" table. Simple schema: id + JSONB data blob.
 * Because projects carry very nested state (wizardState, renderPayload, etc.)
 * we keep the DB schema minimal and store everything except id in `data`.
 *
 * Required one-time DDL (run in Supabase SQL editor):
 *   CREATE TABLE IF NOT EXISTS projects (
 *     id   TEXT PRIMARY KEY,
 *     data JSONB NOT NULL DEFAULT '{}'::jsonb
 *   );
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `prj_${ts}_${rand}`;
}

function rowToProject(r: { id: string; data: Record<string, unknown> | null }) {
  return { ...(r.data ?? {}), id: r.id };
}

export async function GET() {
  try {
    const sb = getSupabase();
    const { data: rows, error } = await sb
      .from('projects')
      .select('id, data')
      .order('id');

    if (error) {
      console.error('[API] GET /api/data/projects supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const projects = (rows ?? []).map(rowToProject);
    return NextResponse.json(projects);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/projects error:', msg);
    return NextResponse.json(
      { error: `Failed to fetch projects: ${msg}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const now = new Date().toISOString();
    const id = generateId();

    // Strip any client-supplied id — we always assign one server-side so the
    // frontend and server agree on the value we'll route to.
    const { id: _ignored, ...rest } = body;
    void _ignored;

    const projectData = {
      ...rest,
      createdAt: now,
      updatedAt: now,
    };

    console.log(`[API] POST /api/data/projects inserting id=${id}`);

    // Step 1: insert
    const { data: inserted, error: insertErr } = await sb
      .from('projects')
      .insert({ id, data: projectData })
      .select('id, data')
      .single();

    if (insertErr) {
      console.error('[API] POST /api/data/projects insert error:', insertErr);
      const code = (insertErr as any).code ?? null;
      const hint =
        code === '42P01'
          ? 'Run: CREATE TABLE IF NOT EXISTS projects ( id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT \'{}\'::jsonb );'
          : code === '42501'
          ? 'Service role is blocked by RLS. Disable RLS or add policy.'
          : null;
      return NextResponse.json({ error: insertErr.message, code, hint }, { status: 500 });
    }

    if (!inserted) {
      console.error('[API] POST /api/data/projects insert returned no row');
      return NextResponse.json(
        { error: 'Insert returned no row — check RLS or table existence' },
        { status: 500 }
      );
    }

    // Step 2: verify by reading it back in a separate query. If it isn't
    // there we return a real failure instead of a false success.
    const { data: verify, error: verifyErr } = await sb
      .from('projects')
      .select('id, data')
      .eq('id', id)
      .maybeSingle();

    if (verifyErr) {
      console.error('[API] POST /api/data/projects verify error:', verifyErr);
      return NextResponse.json(
        { error: `Verification read failed: ${verifyErr.message}` },
        { status: 500 }
      );
    }
    if (!verify) {
      console.error('[API] POST /api/data/projects verify: row missing after insert', { id });
      return NextResponse.json(
        { error: 'Project was not persisted (verify read returned null)', projectId: id },
        { status: 500 }
      );
    }

    console.log(`[API] POST /api/data/projects ✅ persisted id=${id}`);
    return NextResponse.json(
      rowToProject(verify as { id: string; data: Record<string, unknown> | null }),
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/projects fatal:', msg);
    return NextResponse.json(
      { error: `Failed to create project: ${msg}` },
      { status: 500 }
    );
  }
}
