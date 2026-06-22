/**
 * Visual Generation Engine — Main orchestrator for PIXEL Visual Generation
 *
 * Ties together all visual generation services:
 *  1. Load brand profile for the client
 *  2. Load creative concept (if provided)
 *  3. Load learning weights (feedback history)
 *  4. Extract Visual DNA from brand profile + industry
 *  5. Build generation prompt from Visual DNA + concept + variations
 *  6. Apply learning weights to the prompt
 *  7. Call the visual generation provider
 *  8. Upload generated images to Supabase Storage
 *  9. Score each generated visual
 * 10. Create ClientVisualAsset records
 * 11. Update the generation job record
 *
 * Server-side only.
 */
import type {
  ClientVisualAsset,
  ClientVisualGenerationJob,
  VisualAssetType,
  VisualProvider,
  BrandStyleProfile,
  CreativeConcept,
  VisualDNA,
} from '@/lib/db/schema';
import {
  clientVisualAssets,
  clientVisualGenerationJobs,
  brandStyleProfiles,
  creativeConcepts,
} from '@/lib/db/collections';
import { getSupabase } from '@/lib/db/store';
import { getVisualProvider } from './visualGenerationProvider';
import { extractVisualDNA } from './visualDNAService';
import { buildVisualPrompt } from './visualPromptBuilder';
import { scoreVisual } from './visualScoringService';
import { getClientLearningWeights, applyLearningToPrompt } from './visualLearningService';
import { generateCreativeDirection } from './pixelCreativeDirectorEngine';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface GenerateVisualsParams {
  clientId: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  assetType: VisualAssetType;
  conceptId?: string;
  designSetId?: string;
  variationOf?: string;
  variationDirection?: string;
  count?: number; // default 4
}

export interface GenerateVisualsResult {
  success: boolean;
  assets: ClientVisualAsset[];
  jobId: string;
  provider: string;
  error?: string;
}

/* ── Dimension Defaults ────────────────────────────────────────────── */

/** Default dimensions per asset type */
const ASSET_DIMENSIONS: Record<VisualAssetType, { width: number; height: number }> = {
  hero_image: { width: 1920, height: 1080 },
  advertising_visual: { width: 1080, height: 1350 },
  background: { width: 1920, height: 1080 },
  project_render: { width: 1920, height: 1080 },
  lifestyle_imagery: { width: 1080, height: 1350 },
  scene_extension: { width: 1920, height: 1080 },
  image_variation: { width: 1080, height: 1080 },
  image_improvement: { width: 1080, height: 1080 },
  image_upscale: { width: 2048, height: 2048 },
  image_cleanup: { width: 1080, height: 1080 },
  object_replacement: { width: 1080, height: 1080 },
  brand_visual: { width: 1080, height: 1080 },
};

/* ── Helper: Hebrew asset type labels ──────────────────────────────── */

const ASSET_TYPE_LABELS: Record<VisualAssetType, string> = {
  hero_image: 'תמונת גיבור',
  advertising_visual: 'ויזואל פרסומי',
  background: 'רקע',
  project_render: 'הדמיית פרויקט',
  lifestyle_imagery: 'תמונת לייפסטייל',
  scene_extension: 'הרחבת סצנה',
  image_variation: 'וריאציית תמונה',
  image_improvement: 'שיפור תמונה',
  image_upscale: 'הגדלת תמונה',
  image_cleanup: 'ניקוי תמונה',
  object_replacement: 'החלפת אובייקט',
  brand_visual: 'ויזואל מותגי',
};

/* ── Helper: Upload to Supabase Storage ────────────────────────────── */

const STORAGE_BUCKET = 'generated-visual-assets';

async function uploadToStorage(
  imageUrl: string,
  clientId: string,
  assetType: VisualAssetType,
  index: number,
): Promise<string | null> {
  try {
    // Skip upload for data URLs that are SVGs (mock provider)
    if (imageUrl.startsWith('data:image/svg+xml')) {
      return null; // store data URL directly for mocks
    }

    let buffer: Buffer;
    let contentType = 'image/png';

    if (imageUrl.startsWith('data:')) {
      // Base64 data URL
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) return null;
      contentType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      // Remote URL — fetch and re-upload
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get('content-type') ?? 'image/png';
    }

    const timestamp = Date.now();
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `${clientId}/${assetType}/${timestamp}_${index}.${ext}`;

    const sb = getSupabase();
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, buffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      console.warn(`[visualGenerationEngine] Storage upload failed for ${path}:`, error.message);
      return null;
    }

    // Get public URL
    const { data: urlData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return urlData?.publicUrl ?? null;
  } catch (err) {
    console.warn('[visualGenerationEngine] Storage upload error:', err);
    return null;
  }
}

/* ── Helper: Load Brand Profile ────────────────────────────────────── */

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

/* ── Helper: Load Creative Concept ─────────────────────────────────── */

async function loadConcept(conceptId: string): Promise<CreativeConcept | null> {
  try {
    return await creativeConcepts.getByIdAsync(conceptId);
  } catch {
    return null;
  }
}

/* ── Helper: Detect Industry from Client ───────────────────────────── */

async function detectClientIndustry(clientId: string): Promise<string | undefined> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('clients')
      .select('business_field, client_type')
      .eq('id', clientId)
      .maybeSingle();

    if (data) {
      const row = data as Record<string, unknown>;
      return (row.business_field as string) || (row.client_type as string) || undefined;
    }
  } catch {
    // Client table may use different structure
  }
  return undefined;
}

/* ── Main Export ────────────────────────────────────────────────────── */

/**
 * Generate visual assets for a client.
 *
 * Full pipeline: brand profile -> Visual DNA -> prompt -> provider -> upload -> score -> save
 */
export async function generateVisualAssets(
  params: GenerateVisualsParams,
): Promise<GenerateVisualsResult> {
  const {
    clientId,
    entityType,
    entityId,
    entityName,
    assetType,
    conceptId,
    designSetId,
    variationOf,
    variationDirection,
    count = 4,
  } = params;

  const provider = getVisualProvider();
  const now = new Date().toISOString();

  // ── Step 1: Create job record ──
  let job: ClientVisualGenerationJob;
  try {
    job = await clientVisualGenerationJobs.createAsync({
      clientId,
      provider: provider.provider,
      status: 'processing',
      assetType,
      inputData: {
        conceptId,
        designSetId,
        brandProfileId: undefined,
        visualDna: undefined,
        variationOf,
        variationDirection,
        entityType,
        entityId,
        entityName,
      },
      resultCount: 0,
      generatedAssetIds: [],
      errorMessage: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
    } as Omit<ClientVisualGenerationJob, 'id'>);
  } catch (err) {
    return {
      success: false,
      assets: [],
      jobId: '',
      provider: provider.provider,
      error: `שגיאה ביצירת משימת יצירה: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }

  try {
    // ── Step 2: Load brand profile ──
    const brandProfile = await loadBrandProfile(clientId);

    // Update job with brand profile ID
    if (brandProfile) {
      job.inputData.brandProfileId = brandProfile.id;
    }

    // ── Step 3: Load creative concept ──
    let concept: CreativeConcept | null = null;
    if (conceptId) {
      concept = await loadConcept(conceptId);
    }

    // ── Step 4: Load learning weights ──
    const learningWeights = await getClientLearningWeights(clientId);

    // ── Step 5: Extract Visual DNA ──
    const clientIndustry = await detectClientIndustry(clientId);
    const visualDna: VisualDNA = extractVisualDNA(
      brandProfile ?? {},
      clientIndustry,
      learningWeights,
    );

    // Store Visual DNA snapshot in job
    job.inputData.visualDna = visualDna;

    // ── Step 6: Build prompt ──
    const { prompt, negativePrompt } = buildVisualPrompt({
      visualDna,
      assetType,
      conceptTitle: concept?.title,
      conceptDescription: concept?.description,
      entityName,
      entityType,
      variationDirection,
      learningWeights,
    });

    // ── Step 7: Apply learning weights to prompt ──
    const finalPrompt = learningWeights
      ? applyLearningToPrompt(prompt, learningWeights)
      : prompt;

    // ── Step 8: Call provider ──
    const dimensions = ASSET_DIMENSIONS[assetType] ?? { width: 1080, height: 1080 };
    const available = await provider.isAvailable();

    if (!available) {
      await clientVisualGenerationJobs.updateAsync(job.id, {
        status: 'failed',
        errorMessage: `ספק ${provider.provider} לא זמין — בדוק מפתח API`,
        finishedAt: new Date().toISOString(),
      } as Partial<ClientVisualGenerationJob>);

      return {
        success: false,
        assets: [],
        jobId: job.id,
        provider: provider.provider,
        error: `ספק ${provider.provider} לא זמין — בדוק מפתח API`,
      };
    }

    const generationResult = await provider.generate({
      prompt: finalPrompt,
      negativePrompt,
      width: dimensions.width,
      height: dimensions.height,
      assetType,
      count: Math.min(Math.max(count, 1), 4),
    });

    if (!generationResult.success || generationResult.images.length === 0) {
      await clientVisualGenerationJobs.updateAsync(job.id, {
        status: 'failed',
        errorMessage: generationResult.error ?? 'לא הצליח ליצור תמונות',
        finishedAt: new Date().toISOString(),
      } as Partial<ClientVisualGenerationJob>);

      return {
        success: false,
        assets: [],
        jobId: job.id,
        provider: provider.provider,
        error: generationResult.error ?? 'לא הצליח ליצור תמונות',
      };
    }

    // ── Step 9: Creative Director Enrichment ──
    let cdData: any = null;
    try {
      const cdInput = {
        clientName: entityName || '',
        industry: clientIndustry || '',
        campaignGoal: concept?.marketingAngle || 'brand_awareness',
        targetAudience: concept?.recommendedAudience || '',
        copyText: concept?.copyHook || '',
        format: assetType,
        brandProfile: brandProfile || undefined,
      };
      const cdResult = await generateCreativeDirection(cdInput);
      if (cdResult && cdResult.success) {
        cdData = cdResult;
        console.log(`[visualGenerationEngine] Creative Director enrichment applied — strategy: "${cdData.strategy}", score: ${cdData.scores?.overall ?? 'N/A'}`);
      }
    } catch (cdError) {
      console.warn('[visualGenerationEngine] Creative Director enrichment failed (non-blocking):', cdError);
    }

    // ── Step 10-11: Process each generated image ──
    const assets: ClientVisualAsset[] = [];
    const generatedAssetIds: string[] = [];
    const label = ASSET_TYPE_LABELS[assetType] ?? assetType;

    for (let i = 0; i < generationResult.images.length; i++) {
      const image = generationResult.images[i];

      // 9a. Upload to Supabase Storage (skip for mock — store data URL)
      let finalUrl = image.url;
      if (provider.provider !== 'mock') {
        const storageUrl = await uploadToStorage(image.url, clientId, assetType, i);
        if (storageUrl) {
          finalUrl = storageUrl;
        }
        // If upload fails, keep the original URL (remote URL or base64)
      }

      // 9b. Score the visual
      const partialAsset: Partial<ClientVisualAsset> = {
        clientId,
        assetType,
        provider: provider.provider,
        metadata: {
          ...image.metadata,
          promptUsed: finalPrompt.slice(0, 500),
          negativePrompt: negativePrompt.slice(0, 300),
          lightingStyle: visualDna.lightingStyle,
          compositionStyle: visualDna.compositionStyle,
          variationDirection,
        },
      };

      const scores = scoreVisual(partialAsset, visualDna, brandProfile ?? undefined);

      // 10c. Create ClientVisualAsset record
      try {
        const asset = await clientVisualAssets.createAsync({
          clientId,
          brandProfileId: brandProfile?.id ?? null,
          conceptId: conceptId ?? null,
          designSetId: designSetId ?? null,
          assetType,
          title: `${label} #${i + 1}`,
          generationReason: concept
            ? `יצירה לקונספט: ${concept.title}`
            : `יצירת ${label}`,
          provider: provider.provider,
          promptVersion: 'v1.0',
          visualDnaSnapshot: visualDna,
          imageUrl: finalUrl,
          thumbnailUrl: null,
          metadata: {
            ...image.metadata,
            promptUsed: finalPrompt.slice(0, 500),
            negativePrompt: negativePrompt.slice(0, 300),
            originalWidth: image.width,
            originalHeight: image.height,
            variationOf: variationOf ?? null,
            variationDirection: variationDirection ?? null,
          },
          scores,
          status: 'generated',
          isApproved: false,
          isRejected: false,
          isFavorite: false,
          variationOf: variationOf ?? null,
          ...(cdData ? {
            internalPrompt: cdData.rawOutput || '',
            creativeStrategy: cdData.strategy || '',
            visualHook: cdData.scrollStopElement || '',
            scrollStopReason: cdData.scrollStopElement || '',
            industryAnchor: cdData.industryAnchor || '',
            creativeDirectorMetadata: {
              isMock: cdData.isMock,
              avoidList: cdData.avoidList,
              generatedAt: new Date().toISOString(),
            },
            scrollStopScore: cdData.scores?.scrollStop ?? 0,
            creativeDirectorScore: cdData.scores?.overall ?? 0,
            antiAiScore: cdData.scores?.antiAiLook ?? 0,
          } : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Omit<ClientVisualAsset, 'id'>);

        assets.push(asset);
        generatedAssetIds.push(asset.id);
      } catch (err) {
        console.error(`[visualGenerationEngine] Failed to save asset ${i}:`, err);
      }
    }

    // ── Step 12: Update job record ──
    await clientVisualGenerationJobs.updateAsync(job.id, {
      status: 'completed',
      resultCount: assets.length,
      generatedAssetIds,
      finishedAt: new Date().toISOString(),
    } as Partial<ClientVisualGenerationJob>);

    return {
      success: true,
      assets,
      jobId: job.id,
      provider: provider.provider,
    };
  } catch (err) {
    // Global error handler — update job as failed
    const errorMsg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    try {
      await clientVisualGenerationJobs.updateAsync(job.id, {
        status: 'failed',
        errorMessage: errorMsg,
        finishedAt: new Date().toISOString(),
      } as Partial<ClientVisualGenerationJob>);
    } catch {
      // Swallow secondary error
    }

    return {
      success: false,
      assets: [],
      jobId: job.id,
      provider: provider.provider,
      error: errorMsg,
    };
  }
}
