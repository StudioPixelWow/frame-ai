/**
 * GET /api/cron/whatsapp-qr-weekly-digest
 *
 * Weekly client progress digest over the QR WhatsApp service. For each eligible
 * client (has a phone), builds a personalized Hebrew progress update from their
 * gantt items (done this week + upcoming) and sends it via the QR microservice
 * with a throttle between recipients.
 *
 * Auth: Vercel cron (Bearer CRON_SECRET) OR an admin (manual trigger from UI).
 * Query: ?dryRun=1 returns previews without sending. ?type=marketing filters.
 *        ?intervalSeconds=30 overrides the per-recipient delay.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { clientGanttItems } from '@/lib/db';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waStatus, waSendBatch } from '@/lib/whatsapp/qr-service';
import { buildWeeklyDigest } from '@/lib/whatsapp/digest';
import type { ClientGanttItem } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Auth: cron secret OR admin role.
  const auth = req.headers.get('authorization');
  const isCron = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = getRequestRole(req) === 'admin';
  if (!isCron && !isAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  const typeFilter = req.nextUrl.searchParams.get('type') || '';
  const intervalSeconds = Math.max(10, Math.min(300, Number(req.nextUrl.searchParams.get('intervalSeconds')) || 30));

  if (!whatsappConfigured()) return NextResponse.json({ skipped: 'whatsapp_not_configured' });
  if (!dryRun) {
    const st = await waStatus();
    if (!(st.ok && (st.data?.connected || st.data?.state === 'ready'))) {
      return NextResponse.json({ skipped: 'not_connected', state: st.data?.state || 'unknown' });
    }
  }

  // Load clients with a phone (+ optional type filter).
  const sb = getSupabase();
  const { data: rows } = await sb.from('clients').select('*');
  let clients = (rows || []).filter((c: any) => (c.phone || '').trim());
  if (typeFilter) clients = clients.filter((c: any) => (c.client_type || 'other') === typeFilter);
  if (clients.length === 0) return NextResponse.json({ sent: 0, note: 'no clients with phone' });

  const allItems = (await clientGanttItems.getAllAsync()) as ClientGanttItem[];
  const byClient = new Map<string, ClientGanttItem[]>();
  for (const it of allItems) {
    const arr = byClient.get(it.clientId) || [];
    arr.push(it); byClient.set(it.clientId, arr);
  }

  const agencyName = process.env.AGENCY_NAME || 'PIXEL';
  const recipients = clients.map((c: any) => {
    const digest = buildWeeklyDigest(c.name || '', byClient.get(c.id) || [], { agencyName });
    return { phone: String(c.phone), name: String(c.name || ''), message: digest.message, mediaUrl: digest.mediaUrl };
  });

  if (dryRun) {
    return NextResponse.json({ dryRun: true, count: recipients.length, previews: recipients.slice(0, 5) });
  }

  const r = await waSendBatch({ recipients, intervalSeconds });
  if (!r.ok) return NextResponse.json({ error: r.data?.error || 'send_failed', detail: r.data }, { status: r.status || 502 });
  return NextResponse.json({ ok: true, jobId: r.data?.jobId, recipients: recipients.length, intervalSeconds });
}
