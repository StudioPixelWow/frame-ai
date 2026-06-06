/**
 * GET    /api/ugc/projects/[id]  → single project
 * PUT    /api/ugc/projects/[id]  → update (e.g. edited script / status)
 * DELETE /api/ugc/projects/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { ensureUgcTables } from '@/lib/ugc/ugc-db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureUgcTables();
    const { id } = await context.params;
    const sb = getSupabase();
    const { data, error } = await sb.from('ugc_projects').select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ project: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureUgcTables();
    const { id } = await context.params;
    const body = await req.json();
    const sb = getSupabase();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [k, dbk] of [['status', 'status'], ['resultJson', 'result_json'], ['briefJson', 'brief_json'], ['style', 'style']] as const) {
      if (body[k] !== undefined) patch[dbk] = body[k];
    }
    const { data, error } = await sb.from('ugc_projects').update(patch).eq('id', id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureUgcTables();
    const { id } = await context.params;
    const sb = getSupabase();
    await sb.from('ugc_projects').delete().eq('id', id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
