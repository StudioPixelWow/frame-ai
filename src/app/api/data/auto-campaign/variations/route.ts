/**
 * POST /api/data/auto-campaign/variations — Generate auto-variations for an ad
 *
 * Body: { adId, findingId }
 *
 * Returns 3 variation options without creating ads.
 * The UI can then create drafts from selected variations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ads, autoCampaignFindings } from '@/lib/db';
import { generateAutoVariations } from '@/lib/optimization/auto-variations';

export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role') || 'admin';
    if (role === 'client') {
      return NextResponse.json({ error: 'לקוחות לא יכולים ליצור וריאציות' }, { status: 403 });
    }

    const body = await req.json();
    const { adId, findingId } = body as { adId: string; findingId: string };

    if (!adId) {
      return NextResponse.json({ error: 'adId is required' }, { status: 400 });
    }

    const ad = await ads.getByIdAsync(adId);
    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }

    // Try to load the finding for context — fallback to a generic one
    let finding = findingId
      ? await autoCampaignFindings.getByIdAsync(findingId)
      : null;

    if (!finding) {
      // Create a synthetic finding for ad-hoc variation generation
      finding = {
        id: findingId || `synthetic_${Date.now()}`,
        runId: 'manual',
        clientId: '',
        campaignId: ad.campaignId,
        campaignName: '',
        adSetId: ad.adSetId,
        adSetName: null,
        adId: ad.id,
        adName: ad.name,
        type: 'creative_fatigue',
        severity: 'medium',
        confidence: 70,
        reason: 'Manual variation request',
        expectedImpact: 'New creative variations',
        suggestedAction: 'create_variation',
        actionCreated: false,
        actionId: null,
        metadata: {},
        createdAt: new Date().toISOString(),
      };
    }

    const variationSet = generateAutoVariations(ad, finding);

    return NextResponse.json({
      variationSet,
      ad: { id: ad.id, name: ad.name, primaryText: ad.primaryText, headline: ad.headline, ctaType: ad.ctaType },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
