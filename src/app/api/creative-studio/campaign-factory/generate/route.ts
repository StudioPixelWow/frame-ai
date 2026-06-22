import { NextRequest, NextResponse } from 'next/server';
import { generateCampaignPackage } from '@/lib/services/zono-creative/campaignPackageGenerator';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const {
      clientId,
      title,
      objective,
      campaignType,
      industry,
      targetAudience,
      offer,
      mainMessage,
    } = await req.json();

    if (!clientId) {
      return NextResponse.json({ error: 'clientId required' }, { status: 400 });
    }

    const result = await generateCampaignPackage({
      clientId,
      title: title || '',
      objective: objective || '',
      campaignType: campaignType || 'custom',
      industry: industry || '',
      targetAudience: targetAudience || '',
      offer: offer || '',
      mainMessage: mainMessage || '',
    });

    return NextResponse.json({
      success: result.success,
      campaign: result.campaign,
      assets: result.assets,
      copySet: result.copySet,
      error: result.error,
    });
  } catch (err: any) {
    console.error('[creative-studio/campaign-factory/generate] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Campaign generation failed' },
      { status: 500 },
    );
  }
}
