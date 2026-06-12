/** POST /api/whatsapp/qr-send — start a QR-service broadcast (admin/employee only).
 *  Body: { recipients:[{phone,name}], message, mediaUrl?, intervalSeconds } */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waSendBatch } from '@/lib/whatsapp/qr-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ error: 'שירות הוואטסאפ (QR) לא מוגדר — הגדר WHATSAPP_SERVICE_URL / SECRET' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const recipients = Array.isArray(body.recipients)
    ? body.recipients.filter((r: any) => r && r.phone).map((r: any) => ({ phone: String(r.phone), name: String(r.name || '') }))
    : [];
  if (recipients.length === 0) return NextResponse.json({ error: 'לא נבחרו נמענים עם מספר טלפון' }, { status: 400 });
  const message = String(body.message || '');
  const mediaUrl = body.mediaUrl ? String(body.mediaUrl) : undefined;
  if (!message && !mediaUrl) return NextResponse.json({ error: 'הודעה ריקה' }, { status: 400 });
  const intervalSeconds = Math.max(5, Math.min(600, Number(body.intervalSeconds) || 60));

  const r = await waSendBatch({ recipients, message, mediaUrl, intervalSeconds });
  if (!r.ok) {
    const code = r.data?.error;
    const msg = code === 'not_connected' ? 'הוואטסאפ לא מחובר — סרוק QR קודם.' : (code || 'שליחה נכשלה');
    return NextResponse.json({ error: msg, detail: r.data }, { status: r.status || 502 });
  }
  return NextResponse.json(r.data);
}
