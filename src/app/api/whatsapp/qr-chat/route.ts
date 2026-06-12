/** GET /api/whatsapp/qr-chat?chatId=…|phone=… — message history (admin/employee). */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waChatMessages } from '@/lib/whatsapp/qr-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ error: 'not_configured', messages: [] }, { status: 503 });
  const chatId = req.nextUrl.searchParams.get('chatId') || undefined;
  const phone = req.nextUrl.searchParams.get('phone') || undefined;
  if (!chatId && !phone) return NextResponse.json({ error: 'missing_target', messages: [] }, { status: 400 });
  const r = await waChatMessages({ chatId, phone });
  return NextResponse.json(r.data, { status: r.ok ? 200 : (r.status || 502) });
}
