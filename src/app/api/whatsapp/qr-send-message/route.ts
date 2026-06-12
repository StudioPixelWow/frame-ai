/** POST /api/whatsapp/qr-send-message — send one message (text/media) (admin/employee).
 *  Body: { phone?|chatId?, message?, mediaUrl? } */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waSendMessage, waSeen } from '@/lib/whatsapp/qr-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ error: 'שירות הוואטסאפ לא מוגדר' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const phone = body.phone ? String(body.phone) : undefined;
  const chatId = body.chatId ? String(body.chatId) : undefined;
  if (!phone && !chatId) return NextResponse.json({ error: 'חסר נמען' }, { status: 400 });
  const message = body.message ? String(body.message) : undefined;
  const mediaUrl = body.mediaUrl ? String(body.mediaUrl) : undefined;
  if (!message && !mediaUrl) return NextResponse.json({ error: 'הודעה ריקה' }, { status: 400 });

  const r = await waSendMessage({ phone, chatId, message, mediaUrl });
  if (!r.ok) {
    const code = r.data?.error;
    return NextResponse.json({ error: code === 'not_connected' ? 'הוואטסאפ לא מחובר' : (code || 'שליחה נכשלה') }, { status: r.status || 502 });
  }
  return NextResponse.json(r.data);
}

// PATCH = mark a conversation as read.
export async function PATCH(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const r = await waSeen({ chatId: body.chatId, phone: body.phone });
  return NextResponse.json(r.data, { status: r.ok ? 200 : (r.status || 502) });
}
