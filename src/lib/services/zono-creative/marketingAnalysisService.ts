/**
 * Marketing DNA Analysis Service — Main Orchestrator
 *
 * Coordinates the full Marketing DNA analysis workflow:
 *   1. Creates a BrandAnalysisJob record
 *   2. Fetches and prioritizes brand assets from Supabase
 *   3. Delegates to the configured AI provider (Gemini / OpenAI / Mock)
 *   4. Maps the MarketingDNAResult to a BrandStyleProfile (preserving manual notes)
 *   5. Upserts the profile and marks the job complete
 *
 * Server-side only — never import in client components.
 */

import {
  brandAssets,
  brandStyleProfiles,
  brandAnalysisJobs,
} from '@/lib/db/collections';
import { getSupabase } from '@/lib/db/store';
import type {
  BrandAsset,
  BrandStyleProfile,
  BrandAnalysisJob,
  MarketingDNAResult,
} from '@/lib/db/schema';
import {
  getMarketingDNAProvider,
  isImageMime,
  IMAGE_LIMITS,
  MAX_TOTAL_IMAGES,
} from './aiMarketingDNAProvider';
import type { MarketingDNAProviderParams } from './aiMarketingDNAProvider';

/* ── Result type ───────────────────────────────────────────────────────── */

export interface AnalyzeMarketingDNAResult {
  success: boolean;
  profile?: BrandStyleProfile;
  job: BrandAnalysisJob;
  error?: string;
}

/* ── Image Helper (exported for providers) ─────────────────────────────── */

/**
 * Download an asset image from Supabase Storage and return as base64.
 * Returns null for non-image assets or download failures.
 */
export async function getAssetImageBase64(
  asset: BrandAsset,
): Promise<{ base64: string; mimeType: string } | null> {
  if (!asset.filePath || !isImageMime(asset.fileMimeType)) {
    return null;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from('project-files')
      .download(asset.filePath);

    if (error || !data) {
      console.warn(
        `[MarketingDNA] Failed to download asset ${asset.id} from storage:`,
        error?.message ?? 'no data returned',
      );
      return null;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return {
      base64: buffer.toString('base64'),
      mimeType: asset.fileMimeType,
    };
  } catch (err) {
    console.warn(
      `[MarketingDNA] Error downloading asset ${asset.id}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/* ── Asset Prioritization ──────────────────────────────────────────────── */

/**
 * Prioritize assets based on type and approval status.
 * Respects per-category limits and the global MAX_TOTAL_IMAGES cap.
 */
function prioritizeAssets(
  allAssets: BrandAsset[],
  approvedAssets: BrandAsset[],
  rejectedAssets: BrandAsset[],
): BrandAsset[] {
  const selected = new Set<string>();
  const result: BrandAsset[] = [];

  function addAssets(source: BrandAsset[], limit: number): void {
    let count = 0;
    for (const asset of source) {
      if (count >= limit) break;
      if (selected.has(asset.id)) continue;
      if (result.length >= MAX_TOTAL_IMAGES) break;
      selected.add(asset.id);
      result.push(asset);
      count++;
    }
  }

  // Priority 1: Approved references (up to 5)
  addAssets(approvedAssets, IMAGE_LIMITS.approved);

  // Priority 2: Rejected references (up to 3)
  addAssets(rejectedAssets, IMAGE_LIMITS.rejected);

  // Priority 3: Property/project images (up to 4)
  const propertyAssets = allAssets.filter((a) =>
    ['property_photo', 'project_render', 'floor_plan'].includes(a.assetType),
  );
  addAssets(propertyAssets, IMAGE_LIMITS.property);

  // Priority 4: Logos and brand guidelines (up to 2)
  const logoAssets = allAssets.filter((a) =>
    ['logo', 'brand_guideline'].includes(a.assetType),
  );
  addAssets(logoAssets, IMAGE_LIMITS.logos);

  // Priority 5: Brochures and website screenshots (up to 2)
  const brochureAssets = allAssets.filter((a) =>
    ['brochure', 'website_screenshot'].includes(a.assetType),
  );
  addAssets(brochureAssets, IMAGE_LIMITS.brochures);

  // Priority 6: Neighborhood references and competitor (up to 2)
  const neighborhoodAssets = allAssets.filter((a) =>
    ['neighborhood_reference', 'competitor'].includes(a.assetType),
  );
  addAssets(neighborhoodAssets, IMAGE_LIMITS.neighborhood);

  return result;
}

/* ── DNA Result → BrandStyleProfile Mapping ────────────────────────────── */

/**
 * Map a MarketingDNAResult (snake_case) to BrandStyleProfile fields (camelCase).
 * Preserves manual notes from an existing profile if provided.
 */
function mapDNAResultToProfile(
  dna: MarketingDNAResult,
  entityType: string,
  entityId: string,
  entityName: string,
  providerName: string,
  existingProfile: BrandStyleProfile | null,
): Omit<BrandStyleProfile, 'id'> {
  const now = new Date().toISOString();

  return {
    clientId: entityId,
    entityType,
    entityId,
    entityName,
    profileStatus: 'active',

    // Core Brand DNA
    brandSummary: dna.dna_summary,
    visualPersonality: dna.visual_personality,
    copywritingTone: dna.copywriting_tone,
    realEstatePositioning: dna.real_estate_positioning,

    // Color palettes
    primaryColors: dna.primary_colors,
    secondaryColors: dna.secondary_colors,
    accentColors: dna.accent_colors,
    forbiddenColors: dna.forbidden_colors,

    // Typography
    preferredTypography: dna.preferred_typography,
    forbiddenTypography: dna.forbidden_typography,

    // Layouts
    preferredLayouts: dna.preferred_layouts,
    rejectedLayouts: dna.rejected_layouts,

    // Visual / Image / Icon styles
    preferredVisualStyles: dna.preferred_visual_styles,
    rejectedVisualStyles: dna.rejected_visual_styles,
    preferredImageStyles: dna.preferred_image_styles,
    rejectedImageStyles: dna.rejected_image_styles,
    preferredIconStyles: [],
    rejectedIconStyles: [],

    // Campaign angles
    preferredCampaignAngles: dna.preferred_campaign_angles,
    rejectedCampaignAngles: dna.rejected_campaign_angles,

    // CTA styles
    preferredCtaStyles: dna.preferred_cta_styles,
    whatsappCtaStyle: dna.whatsapp_cta_style,

    // Target audiences
    targetAudiences: dna.target_audiences,

    // Real estate marketing styles
    propertyMarketingStyle: dna.property_marketing_style,
    projectMarketingStyle: dna.project_marketing_style,
    agentMarketingStyle: dna.agent_marketing_style,
    sellerRecruitmentStyle: dna.seller_recruitment_style,
    buyerRecruitmentStyle: dna.buyer_recruitment_style,
    neighborhoodStorytellingStyle: dna.neighborhood_storytelling_style,

    // Rules & patterns
    brandRules: dna.brand_rules,
    avoidRules: dna.avoid_rules,
    approvedPatterns: dna.approved_patterns,
    rejectedPatterns: dna.rejected_patterns,

    // Scores (0-100)
    luxuryScore: dna.luxury_score,
    minimalismScore: 50, // Not in MarketingDNAResult — default neutral
    modernScore: dna.modern_score,
    salesAggressivenessScore: dna.sales_aggressiveness_score,
    visualDensityScore: dna.visual_density_score,
    aiGeneratedScore: dna.ai_generated_score,
    urgencyScore: dna.urgency_score,
    investmentFocusScore: dna.investment_focus_score,
    lifestyleFocusScore: dna.lifestyle_focus_score,
    sellerFocusScore: dna.seller_focus_score,
    buyerFocusScore: dna.buyer_focus_score,

    // Confidence & meta
    aiConfidenceScore: dna.ai_confidence_score,
    lastAnalyzedAt: now,
    analysisProvider: providerName,

    // Preserve manual notes from existing profile
    clientNotes: existingProfile?.clientNotes ?? '',
    talNotes: existingProfile?.talNotes ?? '',
    agentNotes: existingProfile?.agentNotes ?? '',
    officeNotes: existingProfile?.officeNotes ?? '',
    sellerNotes: existingProfile?.sellerNotes ?? '',
    zonoNotes: existingProfile?.zonoNotes ?? '',

    createdAt: existingProfile?.createdAt ?? now,
    updatedAt: now,
  };
}

/* ── Main Entry Point ──────────────────────────────────────────────────── */

/**
 * Run a full Marketing DNA analysis for a given entity.
 *
 * @param entityType  One of: agent, office, property, project, seller_recruitment, buyer_recruitment, neighborhood_authority
 * @param entityId    Unique entity identifier (used as clientId in brand_assets)
 * @param entityName  Human-readable name for prompts and display
 */
export async function analyzeMarketingDNA(
  entityType: string,
  entityId: string,
  entityName: string,
): Promise<AnalyzeMarketingDNAResult> {
  const now = new Date().toISOString();

  // ── Step 1: Create analysis job ─────────────────────────────────────
  let job: BrandAnalysisJob;
  try {
    job = await brandAnalysisJobs.createAsync({
      clientId: entityId,
      entityType,
      entityId,
      status: 'processing',
      jobType: 'marketing_dna_analysis',
      provider: getMarketingDNAProvider().name,
      inputAssetIds: [],
      resultProfileId: null,
      errorMessage: '',
      startedAt: now,
      finishedAt: null,
      createdAt: now,
    } as Omit<BrandAnalysisJob, 'id'>);
  } catch (err) {
    console.error('[MarketingDNA] Failed to create analysis job:', err);
    // Create a temporary job object so we can still proceed
    job = {
      id: `temp-${Date.now()}`,
      clientId: entityId,
      entityType,
      entityId,
      status: 'processing',
      jobType: 'marketing_dna_analysis',
      inputAssetIds: [],
      resultProfileId: null,
      errorMessage: '',
      startedAt: now,
      finishedAt: null,
      createdAt: now,
    };
  }

  try {
    // ── Step 2: Fetch all brand assets for this entity ────────────────
    const allAssets = await brandAssets.queryAsync(
      (a: BrandAsset) => a.clientId === entityId,
    );

    // ── Step 3: Separate approved and rejected ────────────────────────
    const approvedAssets = allAssets.filter((a) => a.isApprovedReference);
    const rejectedAssets = allAssets.filter((a) => a.isRejectedReference);

    // ── Step 4: Prioritize assets ─────────────────────────────────────
    const prioritizedAssets = prioritizeAssets(allAssets, approvedAssets, rejectedAssets);

    // Update job with actual asset IDs
    try {
      await brandAnalysisJobs.updateAsync(job.id, {
        inputAssetIds: prioritizedAssets.map((a) => a.id),
        assetCount: prioritizedAssets.length,
      } as Partial<BrandAnalysisJob>);
    } catch {
      // Non-fatal
    }

    console.log(
      `[MarketingDNA] Starting analysis for entity=${entityId} type=${entityType} ` +
      `total=${allAssets.length} prioritized=${prioritizedAssets.length} ` +
      `approved=${approvedAssets.length} rejected=${rejectedAssets.length}`,
    );

    // ── Step 5: Get provider and run analysis ─────────────────────────
    const provider = getMarketingDNAProvider();

    const providerParams: MarketingDNAProviderParams = {
      assets: prioritizedAssets,
      entityType,
      entityId,
      entityName,
      approvedAssets,
      rejectedAssets,
    };

    const dnaResult = await provider.analyze(providerParams);

    // ── Step 6: Find existing profile (preserve manual notes) ─────────
    let existingProfile: BrandStyleProfile | null = null;
    try {
      const profiles = await brandStyleProfiles.queryAsync(
        (p: BrandStyleProfile) =>
          p.entityId === entityId || p.clientId === entityId,
      );
      existingProfile = profiles[0] ?? null;
    } catch {
      // Table may not exist or query may fail — proceed with null
    }

    // ── Step 7: Map DNA result to profile and upsert ──────────────────
    const profileData = mapDNAResultToProfile(
      dnaResult,
      entityType,
      entityId,
      entityName,
      provider.name,
      existingProfile,
    );

    let profile: BrandStyleProfile;
    if (existingProfile) {
      const updated = await brandStyleProfiles.updateAsync(
        existingProfile.id,
        profileData as Partial<BrandStyleProfile>,
      );
      if (!updated) {
        throw new Error('עדכון פרופיל שיווקי נכשל');
      }
      profile = updated;
    } else {
      profile = await brandStyleProfiles.createAsync(profileData);
    }

    // ── Step 8: Mark job as completed ─────────────────────────────────
    try {
      await brandAnalysisJobs.updateAsync(job.id, {
        status: 'completed',
        resultProfileId: profile.id,
        finishedAt: new Date().toISOString(),
      } as Partial<BrandAnalysisJob>);
      // Update local reference
      job = {
        ...job,
        status: 'completed',
        resultProfileId: profile.id,
        finishedAt: new Date().toISOString(),
      };
    } catch {
      // Non-fatal — the profile was saved successfully
    }

    console.log(
      `[MarketingDNA] Analysis complete. entity=${entityId} type=${entityType} ` +
      `provider=${provider.name} profileId=${profile.id} ` +
      `confidence=${dnaResult.ai_confidence_score}`,
    );

    return {
      success: true,
      profile,
      job,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    console.error(
      `[MarketingDNA] Analysis failed for entity=${entityId}:`,
      errMsg,
    );

    // ── Mark job as failed ────────────────────────────────────────────
    try {
      await brandAnalysisJobs.updateAsync(job.id, {
        status: 'failed',
        errorMessage: errMsg,
        finishedAt: new Date().toISOString(),
      } as Partial<BrandAnalysisJob>);
      job = {
        ...job,
        status: 'failed',
        errorMessage: errMsg,
        finishedAt: new Date().toISOString(),
      };
    } catch {
      // Non-fatal
    }

    return {
      success: false,
      job,
      error: errMsg,
    };
  }
}
