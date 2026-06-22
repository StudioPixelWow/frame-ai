/**
 * Campaign Package Generator — Main orchestrator for PIXEL Campaign Factory
 *
 * Generates a complete campaign package:
 *  1. Load brand profile for client
 *  2. Build Campaign DNA from brand profile + params
 *  3. Create campaign record in DB (status: 'generating')
 *  4. Generate campaign copy via AI
 *  5. Save copy set to DB
 *  6. Define asset manifest (which assets to generate)
 *  7. Create asset records for each asset in manifest
 *  8. Update campaign record: status='ready'
 *  9. Return result
 *
 * Server-side only.
 */
import type {
  CampaignFactoryCampaign,
  CampaignFactoryAsset,
  CampaignCopySet,
  CampaignFactoryType,
  CampaignAssetFormat,
  CampaignDNA,
  BrandStyleProfile,
} from '@/lib/db/schema';
import {
  campaignFactoryCampaigns,
  campaignFactoryAssets,
  campaignCopySets,
  brandStyleProfiles,
} from '@/lib/db/collections';
import { buildCampaignDNA } from './campaignDNAService';
import { generateCampaignCopy } from './campaignCopyService';
import { getStandardAssetManifest, getAssetIntelligence } from './campaignIntelligenceService';
import { generateCreativeDirection } from './pixelCreativeDirectorEngine';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface GenerateCampaignParams {
  clientId: string;
  title: string;
  objective: string;
  campaignType: CampaignFactoryType;
  industry: string;
  targetAudience: string;
  offer: string;
  mainMessage: string;
}

export interface GenerateCampaignResult {
  success: boolean;
  campaign: CampaignFactoryCampaign | null;
  assets: CampaignFactoryAsset[];
  copySet: CampaignCopySet | null;
  error?: string;
}

/* ── Asset Dimensions per Format ──────────────────────────────────────── */

const ASSET_DIMENSIONS: Record<CampaignAssetFormat, { width: number; height: number }> = {
  feed_post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  carousel: { width: 1080, height: 1350 },
  reel_cover: { width: 1080, height: 1920 },
  banner: { width: 1200, height: 628 },
  website_hero: { width: 1920, height: 600 },
  email_header: { width: 600, height: 200 },
  google_display: { width: 300, height: 250 },
  property_story: { width: 1080, height: 1920 },
  property_carousel: { width: 1080, height: 1350 },
  seller_recruitment: { width: 1080, height: 1350 },
  buyer_recruitment: { width: 1080, height: 1350 },
  project_awareness: { width: 1080, height: 1350 },
  neighborhood_content: { width: 1080, height: 1350 },
  developer_asset: { width: 1080, height: 1350 },
};

/* ── Asset Format Hebrew Titles ──────────────────────────────────────── */

const ASSET_FORMAT_TITLES: Record<CampaignAssetFormat, string> = {
  feed_post: 'פוסט פיד',
  story: 'סטורי',
  carousel: 'קרוסלה',
  reel_cover: 'כיסוי ריל',
  banner: 'באנר',
  website_hero: 'גיבור אתר',
  email_header: 'כותרת אימייל',
  google_display: 'מודעת גוגל',
  property_story: 'סטורי נכס',
  property_carousel: 'קרוסלת נכס',
  seller_recruitment: 'גיוס מוכרים',
  buyer_recruitment: 'גיוס קונים',
  project_awareness: 'מודעות פרויקט',
  neighborhood_content: 'תוכן שכונתי',
  developer_asset: 'נכס יזם',
};

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** Load the active brand style profile for a client. */
async function loadBrandProfile(clientId: string): Promise<BrandStyleProfile | null> {
  try {
    const profiles = await brandStyleProfiles.queryAsync(
      (p) => p.clientId === clientId && p.profileStatus === 'active',
    );
    return profiles.length > 0 ? profiles[0] : null;
  } catch {
    return null;
  }
}

/** Extract primary brand colors from a brand style profile. */
function extractBrandColors(profile: BrandStyleProfile | null): string[] {
  if (!profile) return [];
  const colors: string[] = [];
  if (profile.primaryColors && Array.isArray(profile.primaryColors)) {
    for (const c of profile.primaryColors) {
      if (typeof c === 'string') {
        colors.push(c);
      } else if (c && typeof c === 'object' && typeof c.hex === 'string') {
        colors.push(c.hex);
      } else if (c && typeof c === 'object' && typeof c.value === 'string') {
        colors.push(c.value);
      }
    }
  }
  return colors;
}

/** Pick copy for an asset from the generated copy set, rotating through available options. */
function pickAssetCopy(
  copySet: Omit<CampaignCopySet, 'id' | 'campaignId' | 'clientId'>,
  format: CampaignAssetFormat,
  index: number,
): {
  headline: string;
  subHeadline: string;
  bodyText: string;
  cta: string;
  caption: string;
  hashtags: string[];
} {
  const headlines = copySet.headlines ?? [];
  const subHeadlines = copySet.subHeadlines ?? [];
  const ctaVariations = copySet.ctaVariations ?? [];
  const socialCaptions = copySet.socialCaptions ?? [];
  const storyCaptions = copySet.storyCaptions ?? [];
  const carouselSlidesCopy = copySet.carouselSlidesCopy ?? [];
  const bannerCopy = copySet.bannerCopy ?? [];
  const websiteHeroCopy = copySet.websiteHeroCopy ?? [];
  const emailSubjectIdeas = copySet.emailSubjectIdeas ?? [];

  // Rotate through headline/sub/CTA options
  const headline = headlines[index % headlines.length] ?? '';
  const subHeadline = subHeadlines[index % subHeadlines.length] ?? '';
  const cta = ctaVariations[index % ctaVariations.length] ?? '';

  // Format-specific body text and caption
  let bodyText = '';
  let caption = '';

  switch (format) {
    case 'feed_post':
      caption = socialCaptions[index % socialCaptions.length] ?? '';
      bodyText = caption;
      break;
    case 'story':
    case 'property_story':
      caption = storyCaptions[index % storyCaptions.length] ?? '';
      bodyText = caption;
      break;
    case 'carousel':
    case 'property_carousel':
      bodyText = carouselSlidesCopy[index % carouselSlidesCopy.length] ?? '';
      caption = socialCaptions[0] ?? '';
      break;
    case 'reel_cover':
      caption = storyCaptions[index % storyCaptions.length] ?? '';
      bodyText = headline;
      break;
    case 'banner':
      bodyText = bannerCopy[index % bannerCopy.length] ?? '';
      caption = '';
      break;
    case 'website_hero':
      bodyText = websiteHeroCopy[index % websiteHeroCopy.length] ?? '';
      caption = '';
      break;
    case 'email_header':
      bodyText = emailSubjectIdeas[index % emailSubjectIdeas.length] ?? '';
      caption = '';
      break;
    case 'google_display':
      bodyText = `${headline} | ${cta}`;
      caption = '';
      break;
    default:
      caption = socialCaptions[index % socialCaptions.length] ?? '';
      bodyText = caption;
      break;
  }

  return {
    headline,
    subHeadline,
    bodyText,
    cta,
    caption,
    hashtags: [],
  };
}

/* ── Main Export ──────────────────────────────────────────────────────── */

/**
 * Generate a complete campaign package.
 *
 * Pipeline: brand profile → Campaign DNA → campaign record → copy → assets → update status
 */
export async function generateCampaignPackage(
  params: GenerateCampaignParams,
): Promise<GenerateCampaignResult> {
  const {
    clientId,
    title,
    objective,
    campaignType,
    industry,
    targetAudience,
    offer,
    mainMessage,
  } = params;

  const now = new Date().toISOString();

  try {
    // ── Step 1: Load brand profile ──
    const brandProfile = await loadBrandProfile(clientId);
    const brandColors = extractBrandColors(brandProfile);
    const brandStyleType = brandProfile?.visualPersonality ?? undefined;

    // ── Step 2: Build Campaign DNA ──
    const campaignDna = buildCampaignDNA({
      campaignType,
      objective,
      targetAudience,
      offer,
      mainMessage,
      industry,
      brandColors,
      brandStyleType,
    });

    // ── Step 3: Creative Director Enrichment ──
    let cdData: any = null;
    try {
      const cdInput = {
        clientName: title,
        industry: industry || '',
        campaignGoal: objective || '',
        targetAudience: targetAudience || '',
        copyText: mainMessage || '',
        brandProfile: brandProfile || undefined,
      };
      const cdResult = await generateCreativeDirection(cdInput);
      if (cdResult && cdResult.success) {
        cdData = cdResult;
        console.log(`[campaignPackageGenerator] Creative Director enrichment applied — strategy: "${cdData.strategy}", score: ${cdData.scores?.overall ?? 'N/A'}`);
      }
    } catch (cdError) {
      console.warn('[campaignPackageGenerator] Creative Director enrichment failed (non-blocking):', cdError);
    }

    // ── Step 4: Create campaign record (status: 'generating') ──
    let campaign: CampaignFactoryCampaign;
    try {
      campaign = await campaignFactoryCampaigns.createAsync({
        clientId,
        title,
        objective,
        campaignType,
        industry,
        targetAudience,
        offer,
        mainMessage,
        status: 'generating',
        brandProfileId: brandProfile?.id ?? null,
        campaignDna,
        totalAssets: 0,
        approvedAssets: 0,
        completionPercent: 0,
        generationMetadata: {
          hasBrandProfile: !!brandProfile,
          brandColors,
          startedAt: now,
        },
        ...(cdData ? {
          internalPrompt: cdData.rawOutput || '',
          creativeStrategy: cdData.strategy || '',
          visualHook: cdData.scrollStopElement || '',
          scrollStopReason: cdData.scrollStopElement || '',
          industryAnchor: cdData.industryAnchor || '',
          layoutRecommendation: cdData.typographyRules || '',
          typographyRecommendation: cdData.typographyRules || '',
          creativeDirectorMetadata: {
            isMock: cdData.isMock,
            avoidList: cdData.avoidList,
            generatedAt: now,
          },
          scrollStopScore: cdData.scores?.scrollStop ?? 0,
          creativeDirectorScore: cdData.scores?.overall ?? 0,
        } : {}),
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      } as Omit<CampaignFactoryCampaign, 'id'>);
    } catch (err) {
      return {
        success: false,
        campaign: null,
        assets: [],
        copySet: null,
        error: `שגיאה ביצירת רשומת קמפיין: ${err instanceof Error ? err.message : 'Unknown'}`,
      };
    }

    // ── Step 5: Generate campaign copy ──
    let clientName = title; // Fallback; ideally fetch from client record
    if (brandProfile?.entityName) {
      clientName = brandProfile.entityName;
    }

    const copySeedData = await generateCampaignCopy({
      campaignType,
      campaignDna,
      title,
      objective,
      targetAudience,
      offer,
      mainMessage,
      industry,
      clientName,
      brandStyleType,
    });

    // ── Step 6: Save copy set to DB ──
    let savedCopySet: CampaignCopySet;
    try {
      savedCopySet = await campaignCopySets.createAsync({
        campaignId: campaign.id,
        clientId,
        ...copySeedData,
      } as Omit<CampaignCopySet, 'id'>);
    } catch (err) {
      console.warn('[campaignPackageGenerator] Failed to save copy set:', err);
      // Create a synthetic copy set so the pipeline can continue
      savedCopySet = {
        id: `temp-copy-${Date.now()}`,
        campaignId: campaign.id,
        clientId,
        ...copySeedData,
      };
    }

    // ── Step 7: Define asset manifest ──
    const manifest = getStandardAssetManifest(campaignType, industry);

    // ── Step 8: Create asset records ──
    const assets: CampaignFactoryAsset[] = [];
    let globalSortOrder = 0;

    for (const manifestEntry of manifest) {
      for (let i = 0; i < manifestEntry.count; i++) {
        const format = manifestEntry.format;
        const dimensions = ASSET_DIMENSIONS[format] ?? { width: 1080, height: 1350 };
        const formatTitle = ASSET_FORMAT_TITLES[format] ?? format;
        const assetTitle = manifestEntry.count > 1
          ? `${formatTitle} ${i + 1}`
          : formatTitle;

        const copy = pickAssetCopy(copySeedData, format, i);
        const intelligenceNote = getAssetIntelligence(format, campaignType, campaignDna, i);

        try {
          const asset = await campaignFactoryAssets.createAsync({
            campaignId: campaign.id,
            clientId,
            format,
            title: assetTitle,
            purpose: manifestEntry.purpose,
            intelligenceNote,
            designSetId: null,
            visualAssetId: null,
            imageUrl: null,
            thumbnailUrl: null,
            copy,
            dimensions,
            status: 'pending',
            isApproved: false,
            isRejected: false,
            sortOrder: globalSortOrder,
            metadata: {
              campaignDnaSnapshot: campaignDna,
              manifestPurpose: manifestEntry.purpose,
            },
            ...(cdData ? {
              internalPrompt: cdData.rawOutput || '',
              creativeStrategy: cdData.strategy || '',
              creativeDirectorMetadata: {
                isMock: cdData.isMock,
                avoidList: cdData.avoidList,
                generatedAt: now,
              },
              creativeDirectorScore: cdData.scores?.overall ?? 0,
            } : {}),
            createdAt: now,
            updatedAt: now,
          } as Omit<CampaignFactoryAsset, 'id'>);

          assets.push(asset);
        } catch (err) {
          console.warn(`[campaignPackageGenerator] Failed to create asset ${assetTitle}:`, err);
          // Create a synthetic asset so the pipeline can continue
          assets.push({
            id: `temp-asset-${Date.now()}-${globalSortOrder}`,
            campaignId: campaign.id,
            clientId,
            format,
            title: assetTitle,
            purpose: manifestEntry.purpose,
            intelligenceNote,
            designSetId: null,
            visualAssetId: null,
            imageUrl: null,
            thumbnailUrl: null,
            copy,
            dimensions,
            status: 'pending',
            isApproved: false,
            isRejected: false,
            sortOrder: globalSortOrder,
            metadata: {},
            createdAt: now,
            updatedAt: now,
          });
        }

        globalSortOrder++;
      }
    }

    // ── Step 9: Update campaign record ──
    try {
      const updatedCampaign = await campaignFactoryCampaigns.updateAsync(campaign.id, {
        status: 'ready',
        totalAssets: assets.length,
        completionPercent: 100,
        generationMetadata: {
          ...campaign.generationMetadata,
          completedAt: new Date().toISOString(),
          totalAssetsGenerated: assets.length,
          copySetId: savedCopySet.id,
          manifestEntries: manifest.length,
        },
        updatedAt: new Date().toISOString(),
      } as Partial<CampaignFactoryCampaign>);

      if (updatedCampaign) {
        campaign = updatedCampaign;
      }
    } catch (err) {
      console.warn('[campaignPackageGenerator] Failed to update campaign status:', err);
      // Update local campaign object even if DB update fails
      campaign = {
        ...campaign,
        status: 'ready',
        totalAssets: assets.length,
        completionPercent: 100,
      };
    }

    // ── Step 10: Return result ──
    console.log(
      `[campaignPackageGenerator] Campaign "${title}" generated: ${assets.length} assets, copy set ${savedCopySet.id}`,
    );

    return {
      success: true,
      campaign,
      assets,
      copySet: savedCopySet,
    };
  } catch (err) {
    console.error('[campaignPackageGenerator] Unexpected error:', err);
    return {
      success: false,
      campaign: null,
      assets: [],
      copySet: null,
      error: `שגיאה לא צפויה ביצירת חבילת קמפיין: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}
