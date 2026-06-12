/** GET /api/whatsapp/qr-batch/[id] — poll a broadcast's progress (admin/employee only). */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waBatch } from '@/lib/whatsapp/qr-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const { id } = await ctx.params;
  const r = await waBatch(id);
  return NextResponse.json(r.data, { status: r.ok ? 200 : (r.status || 502) });
}
