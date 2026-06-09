/**
 * RTM Broadcast API
 * GET  /api/rtm-broadcast            → list eligible publishing clients
 * POST /api/rtm-broadcast            → apply RTM to ONE client (called in a loop
 *                                       from the UI so progress is shown one-by-one)
 *   body: { clientId, topic, date, platform?, format?, notes? }
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { ensureSeeded } from '@/lib/db/seed';
import { listPublishingClients, applyRtmToClient } from '@/lib/rtm/engine';

export async function GET() {
  ensureSeeded();
  try {
    const clients = await listPublishingClients();
    return NextResponse.json({ success: true, clients });
  } catch (error) {
    console.error('[rtm-broadcast GET] error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, clients: [], error: 'שגיאה בטעינת לקוחות' }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const { clientId, topic, date } = body || {};
    if (!clientId || !topic || !date) {
      return NextResponse.json({ success: false, error: 'חסרים שדות חובה (לקוח / נושא / תאריך)' }, { status: 400 });
    }
    const result = await applyRtmToClient({
      clientId,
      topic: String(topic),
      date: String(date),
      platform: body.platform,
      format: body.format,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'שגיאה לא צפויה';
    console.error('[rtm-broadcast POST] error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
