/** POST /api/quality/check { text, clientName?, context?, brandNotes? } → QC result */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

import { ensureSeeded } from '@/lib/db/seed';
import { runQualityCheck } from '@/lib/quality/qc-engine';

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    if (!body?.text?.trim()) return NextResponse.json({ error: 'אין תוכן לבדיקה' }, { status: 400 });
    const result = await runQualityCheck(String(body.text), { clientName: body.clientName, context: body.context, brandNotes: body.brandNotes });
    return NextResponse.json({ success: true, result });
  } catch (e) {
    return NextResponse.json({ error: 'בדיקת האיכות נכשלה' }, { status: 400 });
  }
}
