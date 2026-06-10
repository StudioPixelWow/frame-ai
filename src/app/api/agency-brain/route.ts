/**
 * GET  /api/agency-brain        → snapshot + daily brief
 * POST /api/agency-brain {question} → grounded answer (ask the data)
 */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

import { ensureSeeded } from '@/lib/db/seed';
import { buildAgencySnapshot } from '@/lib/agency-brain/snapshot';
import { buildDailyBrief, answerAgencyQuestion } from '@/lib/agency-brain/engine';
import { buildClientRisk } from '@/lib/agency-brain/risk';

export async function GET() {
  ensureSeeded();
  try {
    const snap = await buildAgencySnapshot();
    const [brief, risk] = await Promise.all([buildDailyBrief(snap), buildClientRisk()]);
    return NextResponse.json({ success: true, snapshot: snap, brief, risk });
  } catch (e) {
    console.error('[agency-brain GET]', e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, error: 'שגיאה' }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const { question } = await req.json();
    if (!question?.trim()) return NextResponse.json({ error: 'הקלד שאלה' }, { status: 400 });
    const snap = await buildAgencySnapshot();
    const answer = await answerAgencyQuestion(String(question).trim(), snap);
    return NextResponse.json({ success: true, answer });
  } catch (e) {
    return NextResponse.json({ error: 'שגיאה בעיבוד השאלה' }, { status: 400 });
  }
}
