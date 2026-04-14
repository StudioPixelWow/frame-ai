/**
 * GET    /api/data/projects/[id] — get one project
 * PUT    /api/data/projects/[id] — update one project (partial merge on the JSONB data)
 * DELETE /api/data/projects/[id] — delete one project
 *
 * Storage: same Supabase "projects" table as the list route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

type ProjectRow = { id: string; data: Record<string, unknown> | null };

function rowToProject(r: ProjectRow) {
  return { ...(r.data ?? {}), id: r.id };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { data, error } = await sb
      .from('projects')
      .select('id, data')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[API] GET /api/data/projects/[id] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Project not found', projectId: id }, { status: 404 });
    }
    return NextResponse.json(rowToProject(data as ProjectRow));
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

    // Load current row so we can merge the partial update into the JSONB blob.
    const { data: current, error: loadErr } = await sb
      .from('projects')
      .select('id, data')
      .eq('id', id)
      .maybeSingle();

    if (loadErr) {
      console.error('[API] PUT /api/data/projects/[id] load error:', loadErr);
      return NextResponse.json({ error: loadErr.message }, { status: 400 });
    }
    if (!current) {
      return NextResponse.json({ error: 'Project not found', projectId: id }, { status: 404 });
    }

    const { id: _ignored, ...rest } = body;
    void _ignored;

    const mergedData = {
      ...((current as ProjectRow).data ?? {}),
      ...rest,
      updatedAt: new Date().toISOString(),
    };

    const { data: updated, error } = await sb
      .from('projects')
      .update({ data: mergedData })
      .eq('id', id)
      .select('id, data')
      .maybeSingle();

    if (error) {
      console.error('[API] PUT /api/data/projects/[id] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'Project not found after update', projectId: id }, { status: 404 });
    }
    return NextResponse.json(rowToProject(updated as ProjectRow));
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
    const { error } = await sb.from('projects').delete().eq('id', id);
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
