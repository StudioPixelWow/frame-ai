/** GET /api/whatsapp/qr-media?chatId=…&msgId=… — download a message's media (admin/employee). */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waMessageMedia } from '@/lib/whatsapp/qr-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const chatId = req.nextUrl.searchParams.get('chatId');
  const msgId = req.nextUrl.searchParams.get('msgId');
  if (!chatId || !msgId) return NextResponse.json({ error: 'missing' }, { status: 400 });
  const r = await waMessageMedia(chatId, msgId);
  return NextResponse.json(r.data, { status: r.ok ? 200 : (r.status || 502) });
}
