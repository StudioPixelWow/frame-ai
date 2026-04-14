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

    const { data: inserted, error } = await sb
      .from('projects')
      .insert({ id, data: projectData })
      .select('id, data')
      .single();

    if (error) {
      console.error('[API] POST /api/data/projects supabase error:', error);
      return NextResponse.json(
        { error: error.message, code: (error as any).code ?? null },
        { status: 400 }
      );
    }

    return NextResponse.json(
      rowToProject(inserted as { id: string; data: Record<string, unknown> | null }),
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/projects error:', msg);
    return NextResponse.json(
      { error: `Failed to create project: ${msg}` },
      { status: 400 }
    );
  }
}
