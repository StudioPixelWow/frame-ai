/**
 * GET /api/data/optimization/[clientId]
 *
 * Returns AI-like optimization recommendations for a client's campaigns.
 * Uses rules-based analysis of synced performance data.
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-guard';
import { createClient } from '@supabase/supabase-js';
import { analyzeClient } from '@/lib/optimization/engine';
import type { Campaign, AdSet, Ad } from '@/lib/db/schema';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export async function GET(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  const { clientId } = await context.params;

  try {
    // Fetch campaigns for this client
    const { data: campaigns, error: cmpErr } = await supabase
      .from('app_campaigns')
      .select('*')
      .eq('client_id', clientId);

    if (cmpErr) {
      return NextResponse.json({ error: cmpErr.message }, { status: 500 });
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ recommendations: [], message: 'אין קמפיינים ללקוח זה' });
    }

    const campaignIds = campaigns.map((c: Record<string, unknown>) => c.id as string);

    // Fetch ad sets for these campaigns
    const { data: adSets, error: asErr } = await supabase
      .from('app_ad_sets')
      .select('*')
      .in('campaign_id', campaignIds);

    if (asErr) {
      return NextResponse.json({ error: asErr.message }, { status: 500 });
    }

    // Fetch ads for these campaigns
    const { data: ads, error: adsErr } = await supabase
      .from('app_ads')
      .select('*')
      .in('campaign_id', campaignIds);

    if (adsErr) {
      return NextResponse.json({ error: adsErr.message }, { status: 500 });
    }

    // Map DB snake_case to camelCase (matching schema interfaces)
    const mappedCampaigns = (campaigns || []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      clientId: c.client_id as string,
      clientName: (c.client_name as string) || '',
      campaignName: (c.campaign_name as string) || '',
      campaignType: (c.campaign_type as string) || 'custom',
      objective: (c.objective as string) || '',
      platform: (c.platform as string) || 'facebook',
      status: (c.status as string) || 'draft',
      startDate: (c.start_date as string) || null,
      endDate: (c.end_date as string) || null,
      budget: (c.budget as number) || 0,
      caption: (c.caption as string) || '',
      mediaType: (c.media_type as string) || 'image',
      linkedVideoProjectId: (c.linked_video_project_id as string) || null,
      linkedClientFileId: (c.linked_client_file_id as string) || null,
      externalMediaUrl: (c.external_media_url as string) || '',
      notes: (c.notes as string) || '',
      adAccountId: (c.ad_account_id as string) || '',
      leadFormIds: (c.lead_form_ids as string[]) || [],
      metaCampaignId: (c.meta_campaign_id as string) || '',
      metaSyncSource: ((c.meta_sync_source as string) || 'local') as 'local' | 'meta_sync',
      lastSyncedAt: (c.last_synced_at as string) || null,
      createdAt: (c.created_at as string) || '',
      updatedAt: (c.updated_at as string) || '',
    })) as unknown as Campaign[];

    const mappedAdSets = (adSets || []).map((as: Record<string, unknown>) => ({
      id: as.id as string,
      campaignId: as.campaign_id as string,
      name: (as.name as string) || '',
      status: ((as.status as string) || 'draft') as 'active' | 'paused' | 'draft' | 'archived',
      ageMin: (as.age_min as number) || null,
      ageMax: (as.age_max as number) || null,
      genders: (as.genders as string[]) || [],
      geoLocations: (as.geo_locations as string[]) || [],
      interests: (as.interests as string[]) || [],
      customAudiences: (as.custom_audiences as string[]) || [],
      excludedAudiences: (as.excluded_audiences as string[]) || [],
      placements: (as.placements as string[]) || [],
      dailyBudget: (as.daily_budget as number) || null,
      lifetimeBudget: (as.lifetime_budget as number) || null,
      startDate: (as.start_date as string) || null,
      endDate: (as.end_date as string) || null,
      metaAdSetId: (as.meta_ad_set_id as string) || '',
      lastSyncedAt: (as.last_synced_at as string) || null,
      createdAt: (as.created_at as string) || '',
      updatedAt: (as.updated_at as string) || '',
    })) as unknown as AdSet[];

    const mappedAds = (ads || []).map((a: Record<string, unknown>) => ({
      id: a.id as string,
      adSetId: (a.ad_set_id as string) || '',
      campaignId: (a.campaign_id as string) || '',
      name: (a.name as string) || '',
      status: ((a.status as string) || 'draft') as 'active' | 'paused' | 'draft' | 'archived',
      creativeType: ((a.creative_type as string) || 'image') as 'image' | 'video' | 'carousel' | 'text',
      mediaUrl: (a.media_url as string) || '',
      thumbnailUrl: (a.thumbnail_url as string) || null,
      primaryText: (a.primary_text as string) || '',
      headline: (a.headline as string) || '',
      description: (a.description as string) || '',
      ctaType: (a.cta_type as string) || '',
      ctaLink: (a.cta_link as string) || '',
      linkedVideoProjectId: (a.linked_video_project_id as string) || null,
      linkedClientFileId: (a.linked_client_file_id as string) || null,
      impressions: (a.impressions as number) || 0,
      clicks: (a.clicks as number) || 0,
      spend: (a.spend as number) || 0,
      leads: (a.leads as number) || 0,
      conversions: (a.conversions as number) || 0,
      ctr: (a.ctr as number) || 0,
      cpl: (a.cpl as number) || 0,
      cpc: (a.cpc as number) || 0,
      roas: (a.roas as number) || 0,
      reach: (a.reach as number) || 0,
      frequency: (a.frequency as number) || 0,
      cpm: (a.cpm as number) || 0,
      metaAdId: (a.meta_ad_id as string) || '',
      lastSyncedAt: (a.last_synced_at as string) || null,
      notes: (a.notes as string) || '',
      createdAt: (a.created_at as string) || '',
      updatedAt: (a.updated_at as string) || '',
    })) as unknown as Ad[];

    const recommendations = analyzeClient({
      campaigns: mappedCampaigns,
      adSets: mappedAdSets,
      ads: mappedAds,
    });

    return NextResponse.json({
      recommendations,
      totalCampaigns: mappedCampaigns.length,
      totalAdSets: mappedAdSets.length,
      totalAds: mappedAds.length,
      hasPerformanceData: mappedAds.some(a => a.impressions > 0 || a.spend > 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[optimization] Error for client ${clientId}:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
