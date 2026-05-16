/**
 * GET /api/seo/backlinks — Get backlink campaigns for a client
 * POST /api/seo/backlinks — Create new outreach campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCampaignsForClient,
  getTargetsForCampaign,
  createCampaign,
} from '@/lib/seo/backlink-engine';
import type { CampaignType } from '@/lib/seo/backlink-engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const campaignId = searchParams.get('campaignId');

    if (!clientId) {
      return NextResponse.json({ error: 'נדרש clientId' }, { status: 400 });
    }

    // If campaignId provided, return targets for that campaign
    if (campaignId) {
      const targets = await getTargetsForCampaign(campaignId);
      return NextResponse.json({ success: true, targets });
    }

    // Otherwise return all campaigns for the client
    const campaigns = await getCampaignsForClient(clientId);
    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    console.error('[Backlinks API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, name, type, niche, keywords } = body;

    if (!clientId || !name || !niche) {
      return NextResponse.json(
        { error: 'נדרשים clientId, name ו-niche' },
        { status: 400 }
      );
    }

    const validTypes: CampaignType[] = ['guest_post', 'pr', 'broken_link', 'resource', 'directory'];
    const campaignType: CampaignType = validTypes.includes(type) ? type : 'resource';

    const campaign = await createCampaign(
      clientId,
      name,
      campaignType,
      niche,
      keywords || []
    );

    return NextResponse.json({
      success: true,
      message: `קמפיין "${name}" נוצר בהצלחה עם ${campaign.totalProspects} יעדים`,
      campaign,
    }, { status: 201 });
  } catch (error) {
    console.error('[Backlinks API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה ביצירת קמפיין' },
      { status: 500 }
    );
  }
}
