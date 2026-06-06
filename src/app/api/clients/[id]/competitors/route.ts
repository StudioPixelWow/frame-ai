/**
 * GET    /api/clients/[id]/competitors        → competitors + their stored ads
 * POST   /api/clients/[id]/competitors        → add a competitor { name, pageId?, country? }
 * DELETE /api/clients/[id]/competitors?competitorId=…
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { getRequestRole } from '@/lib/auth/api-guard';
import { ensureCompetitorTables, cmpId } from '@/lib/competitors/db';
import { adLibraryDeepLink } from '@/lib/competitors/ad-source';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureCompetitorTables();
    const { id: clientId } = await context.params;
    const sb = getSupabase();
    const { data: competitors } = await sb.from('client_competitors').select('*').eq('client_id', clientId).order('created_at', { ascending: true });
    const comps = (competitors || []) as any[];
    let ads: any[] = [];
    if (comps.length) {
      const { data: adRows } = await sb.from('competitor_ads').select('*').eq('client_id', clientId).order('first_seen', { ascending: false }).limit(500);
      ads = adRows || [];
    }
    const withLinks = comps.map((c) => ({ ...c, deepLink: adLibraryDeepLink({ name: c.name, pageId: c.page_id, country: c.country }) }));
    return NextResponse.json({ competitors: withLinks, ads });
  } catch (e) {
    return NextResponse.json({ competitors: [], ads: [], error: e instanceof Error ? e.message : 'failed' });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  try {
    await ensureCompetitorTables();
    const { id: clientId } = await context.params;
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: 'שם המתחרה נדרש' }, { status: 400 });
    const sb = getSupabase();
    const row = {
      id: cmpId(), client_id: clientId, name: body.name.trim(),
      page_id: body.pageId?.trim() || null, country: body.country || 'IL',
      notes: body.notes || null, created_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from('client_competitors').insert(row).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ competitor: { ...data, deepLink: adLibraryDeepLink({ name: row.name, pageId: row.page_id || undefined, country: row.country }) } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  try {
    await ensureCompetitorTables();
    const { id: clientId } = await context.params;
    const competitorId = req.nextUrl.searchParams.get('competitorId');
    if (!competitorId) return NextResponse.json({ error: 'competitorId נדרש' }, { status: 400 });
    const sb = getSupabase();
    await sb.from('competitor_ads').delete().eq('competitor_id', competitorId);
    await sb.from('client_competitors').delete().eq('id', competitorId).eq('client_id', clientId);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
