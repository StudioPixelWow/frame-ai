/** GET /api/whatsapp/qr-chats — recent conversations + unread (admin/employee). */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waChats } from '@/lib/whatsapp/qr-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  // Always answer 200 so the dashboard poller / global notifier don't flood the
  // browser console with 409/503 network errors when the WhatsApp service isn't
  // ready. The `state` field tells clients whether real data is available.
  if (!whatsappConfigured()) return NextResponse.json({ configured: false, state: 'not_configured', chats: [], totalUnread: 0 });
  const r = await waChats();
  if (!r.ok) return NextResponse.json({ configured: true, state: 'unavailable', chats: [], totalUnread: 0 });
  return NextResponse.json({ configured: true, state: 'ok', ...(r.data || {}) });
}
