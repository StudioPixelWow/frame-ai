/**
 * GET  /api/clients/[id]/caption-style  → { style: {...} | null }
 * PUT  /api/clients/[id]/caption-style  → save the client's default caption style
 *
 * Stores a per-client caption-style preset on the server so a whole batch of
 * videos for the same client keeps one consistent caption design — shared
 * across devices/users (unlike the previous localStorage-only approach).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, ensureTable } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

const TABLE = 'app_client_caption_styles';
const DDL = `
  CREATE TABLE IF NOT EXISTS public.${TABLE} (
    client_id  text PRIMARY KEY,
    style      jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz DEFAULT now()
  );
`;

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ style: null });
    await ensureTable(TABLE, DDL);
    const sb = getSupabase();
    const { data, error } = await sb.from(TABLE).select('style').eq('client_id', id).maybeSingle();
    if (error) {
      console.warn('[caption-style] GET error:', error.message);
      return NextResponse.json({ style: null });
    }
    return NextResponse.json({ style: (data as any)?.style ?? null });
  } catch (e) {
    console.error('[caption-style] GET threw:', e);
    return NextResponse.json({ style: null });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: 'missing client id' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    // Accept either { style: {...} } or the raw style object.
    const style = (body && typeof body === 'object' && 'style' in body) ? (body as any).style : body;
    if (!style || typeof style !== 'object') {
      return NextResponse.json({ error: 'invalid style' }, { status: 400 });
    }
    await ensureTable(TABLE, DDL);
    const sb = getSupabase();
    const { error } = await sb
      .from(TABLE)
      .upsert({ client_id: id, style, updated_at: new Date().toISOString() }, { onConflict: 'client_id' });
    if (error) {
      console.error('[caption-style] PUT error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[caption-style] PUT threw:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
