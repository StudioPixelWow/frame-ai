/** GET /api/whatsapp/qr-chats — recent conversations + unread (admin/employee). */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waChats } from '@/lib/whatsapp/qr-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ error: 'not_configured', chats: [] }, { status: 503 });
  const r = await waChats();
  return NextResponse.json(r.data, { status: r.ok ? 200 : (r.status || 502) });
}
