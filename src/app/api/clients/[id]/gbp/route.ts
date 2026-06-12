/** Google Business Profile per-client connection + manual post (admin/employee).
 *  GET    → connection status
 *  POST   → publish an AI post now { type?, topic? }
 *  DELETE → disconnect */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { loadGbpConnection, setGbpStatus } from '@/lib/seo/gbp-store';
import { getClientById } from '@/lib/db/client-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const { id } = await ctx.params;
  const conn = await loadGbpConnection(id);
  return NextResponse.json({
    connected: !!conn && conn.status === 'connected',
    locationId: conn?.locationId || '',
    businessName: conn?.businessName || '',
    hasLocation: !!conn?.locationId,
    connectedAt: conn?.connectedAt || '',
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const { id } = await ctx.params;
  const conn = await loadGbpConnection(id);
  if (!conn || conn.status !== 'connected') return NextResponse.json({ error: 'GBP לא מחובר' }, { status: 400 });
  if (!conn.locationId) return NextResponse.json({ error: 'לא נמצא מיקום עסקי (location) — ייתכן שנדרש אישור Google Business Profile API' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const type = (body.type as 'OFFER' | 'EVENT' | 'UPDATE') || 'UPDATE';
  const client = await getClientById(id);
  const businessName = (client as any)?.name || '';
  const topic = body.topic ? String(body.topic) : `עדכון על ${businessName || 'העסק'} — שירותים וערך ללקוח`;

  const { hydrateConnection, generateGBPPost, createPost } = await import('@/lib/seo/gbp-service');
  await hydrateConnection(id);
  const gen = await generateGBPPost(id, type, topic, businessName);
  if (!gen.post) return NextResponse.json({ error: gen.error || 'יצירת הפוסט נכשלה' }, { status: 502 });
  const res = await createPost(conn.locationId, gen.post, id);
  if (!res.success) return NextResponse.json({ error: res.error || 'הפרסום נכשל' }, { status: 502 });
  return NextResponse.json({ success: true, postId: res.postId, post: gen.post });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const { id } = await ctx.params;
  await setGbpStatus(id, 'disconnected');
  return NextResponse.json({ success: true });
}
