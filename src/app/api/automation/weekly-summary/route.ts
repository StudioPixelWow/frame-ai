/**
 * GET  /api/automation/weekly-summary — Generate summaries for all active clients
 * POST /api/automation/weekly-summary — Generate summary for a single client
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateWeeklySummary,
  generateAllWeeklySummaries,
} from '@/lib/automation/weekly-summary-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  try {
    const summaries = await generateAllWeeklySummaries();
    return NextResponse.json({
      ok: true,
      count: summaries.length,
      summaries,
    });
  } catch (error) {
    console.error('[weekly-summary-api] GET error:', error);
    return NextResponse.json(
      { error: 'שגיאה ביצירת סיכומים שבועיים' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId } = body;

    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json(
        { error: 'חסר clientId' },
        { status: 400 }
      );
    }

    const summary = await generateWeeklySummary(clientId);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error('[weekly-summary-api] POST error:', error);
    return NextResponse.json(
      { error: 'שגיאה ביצירת סיכום שבועי' },
      { status: 500 }
    );
  }
}
