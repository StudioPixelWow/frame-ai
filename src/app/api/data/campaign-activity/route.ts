/**
 * GET /api/data/campaign-activity?campaignId=xxx&limit=20
 *
 * Returns activity log entries for a campaign, sorted newest first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCampaignActivityEntries } from '@/lib/optimization/activity-log';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get('campaignId');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    const entries = await getCampaignActivityEntries(campaignId, limit);
    return NextResponse.json({ entries, total: entries.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
