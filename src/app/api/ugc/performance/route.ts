/**
 * UGC performance loop — track how produced videos perform so the system can
 * learn what works (hook type, format, length, music…).
 *
 * GET  /api/ugc/performance?clientId=  → list records (newest first)
 * POST /api/ugc/performance            → upsert a record (auto on render, or manual metrics)
 *
 * Metrics can be entered manually now; auto-ingestion from Meta/TikTok insights
 * is the next step (documented). Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { ensureTable, getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

const DDL = `
  CREATE TABLE IF NOT EXISTS public.ugc_video_performance (
    id text PRIMARY KEY,
    client_id text,
    business_name text,
    video_url text,
    format text,
    hook text,
    views integer DEFAULT 0,
    likes integer DEFAULT 0,
    shares integer DEFAULT 0,
    comments integer DEFAULT 0,
    leads integer DEFAULT 0,
    spend numeric DEFAULT 0,
    score numeric DEFAULT 0,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS ugc_perf_client ON public.ugc_video_performance(client_id, created_at);`;

const rid = () => `ugcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
// Engagement score = weighted interactions per view (cheap "what works" signal).
const calcScore = (r: any) => {
  const v = Math.max(1, r.views || 0);
  const eng = (r.likes || 0) + (r.shares || 0) * 3 + (r.comments || 0) * 2 + (r.leads || 0) * 5;
  return +((eng / v) * 100).toFixed(2);
};

async function ensure() { try { await ensureTable('ugc_video_performance', DDL); } catch { /* SQL fallback */ } }

export async function GET(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  await ensure();
  const clientId = req.nextUrl.searchParams.get('clientId');
  let q = getSupabase().from('ugc_video_performance').select('*').order('created_at', { ascending: false }).limit(100);
  if (clientId) q = q.eq('client_id', clientId);
  const { data } = await q;
  return NextResponse.json({ records: data || [] });
}

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  await ensure();
  const sb = getSupabase();
  let b: any = {}; try { b = await req.json(); } catch { /* */ }
  const now = new Date().toISOString();
  if (b.id) {
    const patch: any = { updated_at: now };
    for (const k of ['views', 'likes', 'shares', 'comments', 'leads', 'spend', 'notes']) if (b[k] !== undefined) patch[k] = b[k];
    patch.score = calcScore({ ...b });
    await sb.from('ugc_video_performance').update(patch).eq('id', b.id);
    return NextResponse.json({ ok: true, id: b.id, score: patch.score });
  }
  const row = { id: rid(), client_id: b.clientId || null, business_name: b.businessName || '', video_url: b.videoUrl || '', format: b.format || '', hook: b.hook || '', views: 0, likes: 0, shares: 0, comments: 0, leads: 0, spend: 0, score: 0, notes: '', created_at: now, updated_at: now };
  await sb.from('ugc_video_performance').insert(row);
  return NextResponse.json({ ok: true, id: row.id });
}
