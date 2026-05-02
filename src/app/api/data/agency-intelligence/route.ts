/**
 * Agency Intelligence — Main API
 * GET: Full overview (calibration + playbooks + templates + suggestions)
 */

import { NextResponse } from 'next/server';
import { getCalibration } from '@/lib/agency-intelligence/calibration';
import { getPlaybooks } from '@/lib/agency-intelligence/playbooks';
import { getCampaignTemplates, getAdTemplates, getContentTemplates } from '@/lib/agency-intelligence/templates';
import { getSuggestions } from '@/lib/agency-intelligence/learning-loop';

export async function GET() {
  try {
    const [calibration, playbooks, campaignTemplates, adTemplates, contentTemplates, pendingSuggestions] =
      await Promise.all([
        getCalibration(),
        getPlaybooks(),
        getCampaignTemplates(),
        getAdTemplates(),
        getContentTemplates(),
        getSuggestions(undefined, 'pending'),
      ]);

    return NextResponse.json({
      calibration,
      playbooks,
      templates: {
        campaigns: campaignTemplates,
        ads: adTemplates,
        content: contentTemplates,
      },
      pendingSuggestions,
      stats: {
        totalPlaybooks: playbooks.length,
        totalCampaignTemplates: campaignTemplates.length,
        totalAdTemplates: adTemplates.length,
        totalContentTemplates: contentTemplates.length,
        pendingSuggestionsCount: pendingSuggestions.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load agency intelligence' }, { status: 500 });
  }
}
