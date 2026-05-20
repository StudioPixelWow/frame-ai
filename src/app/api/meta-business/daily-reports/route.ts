/**
 * GET /api/meta-business/daily-reports?clientId=xxx&date=YYYY-MM-DD
 *   Fetch daily reports for a client (all dates or specific date)
 *
 * GET /api/meta-business/daily-reports?campaignId=xxx
 *   Fetch daily reports containing a specific campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const campaignId = searchParams.get('campaignId');
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    const sb = getSupabase();

    // Try relational table first
    let query = sb
      .from('app_meta_daily_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[daily-reports] Query failed:', error.message);
      return NextResponse.json([]);
    }

    let reports = (data || []).map((row: any) => row.report_data || row.data || row);

    // If filtering by campaignId, filter in-memory
    if (campaignId) {
      reports = reports.filter((r: any) =>
        r.campaigns?.some((c: any) => c.campaignId === campaignId)
      );
    }

    return NextResponse.json(reports);
  } catch (error) {
    console.error('[daily-reports] GET error:', error);
    return NextResponse.json([]);
  }
}
