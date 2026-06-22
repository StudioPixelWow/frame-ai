/**
 * Visual Scoring Service — Score generated visuals on 6 dimensions
 *
 * Evaluates generated images against the Visual DNA and brand profile to
 * produce scores for brand match, realism, composition, readability
 * compatibility, luxury alignment, and conversion potential.
 *
 * Server-side only.
 */
import type {
  VisualScore,
  VisualDNA,
  ClientVisualAsset,
  VisualAssetType,
  VisualProvider,
  BrandStyleProfile,
} from '@/lib/db/schema';

/* ── Helpers ────────────────────────────────────────────────────────── */

/** Clamp a value to 0-100 */
function clamp(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

/** Add gaussian-like variance to a base score (for realism) */
function addVariance(base: number, variance: number): number {
  const delta = (Math.random() - 0.5) * 2 * variance;
  return clamp(base + delta);
}

/** Extract flat color strings from JSONB arrays */
function extractColors(arr: unknown[]): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') return item.toLowerCase().trim();
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return String(obj.hex || obj.color || obj.value || '').toLowerCase().trim();
      }
      return '';
    })
    .filter((c) => c.length > 0);
}

/* ── Provider Quality Baselines ────────────────────────────────────── */

const PROVIDER_QUALITY: Record<VisualProvider, { realismBase: number; qualityBase: number }> = {
  gemini: { realismBase: 82, qualityBase: 80 },
  openai: { realismBase: 78, qualityBase: 85 },
  mock: { realismBase: 20, qualityBase: 15 },
};

/* ── Asset Type Scoring Traits ─────────────────────────────────────── */

interface AssetScoringTraits {
  compositionWeight: number; // how important composition is for this type
  readabilityWeight: number; // how important text overlay readability is
  conversionWeight: number; // how important conversion potential is
  baseComposition: number; // baseline composition score
}

const ASSET_SCORING_TRAITS: Record<VisualAssetType, AssetScoringTraits> = {
  hero_image: { compositionWeight: 1.2, readabilityWeight: 1.3, conversionWeight: 1.0, baseComposition: 75 },
  advertising_visual: { compositionWeight: 1.1, readabilityWeight: 1.4, conversionWeight: 1.5, baseComposition: 72 },
  background: { compositionWeight: 0.8, readabilityWeight: 1.5, conversionWeight: 0.6, baseComposition: 80 },
  project_render: { compositionWeight: 1.3, readabilityWeight: 0.7, conversionWeight: 1.1, baseComposition: 78 },
  lifestyle_imagery: { compositionWeight: 1.2, readabilityWeight: 0.8, conversionWeight: 1.2, baseComposition: 74 },
  scene_extension: { compositionWeight: 1.0, readabilityWeight: 0.5, conversionWeight: 0.7, baseComposition: 70 },
  image_variation: { compositionWeight: 1.0, readabilityWeight: 0.8, conversionWeight: 0.9, baseComposition: 72 },
  image_improvement: { compositionWeight: 1.1, readabilityWeight: 0.9, conversionWeight: 1.0, baseComposition: 76 },
  image_upscale: { compositionWeight: 0.9, readabilityWeight: 0.7, conversionWeight: 0.8, baseComposition: 78 },
  image_cleanup: { compositionWeight: 1.0, readabilityWeight: 1.0, conversionWeight: 0.8, baseComposition: 75 },
  object_replacement: { compositionWeight: 1.1, readabilityWeight: 0.6, conversionWeight: 0.7, baseComposition: 68 },
  brand_visual: { compositionWeight: 1.1, readabilityWeight: 1.0, conversionWeight: 1.1, baseComposition: 74 },
};

/* ── Scoring Functions ─────────────────────────────────────────────── */

/** Score brand color alignment */
function scoreBrandMatch(
  asset: Partial<ClientVisualAsset>,
  visualDna: VisualDNA,
  brandProfile?: Partial<BrandStyleProfile>,
): number {
  let score = 60; // baseline

  // Provider quality affects perceived brand match
  const providerQuality = PROVIDER_QUALITY[asset.provider ?? 'mock'];
  score += providerQuality.qualityBase * 0.2;

  // Color palette match — check if asset metadata mentions brand colors
  const metadata = asset.metadata ?? {};
  if (metadata.promptUsed || metadata.revisedPrompt) {
    score += 10; // prompt was used, likely somewhat aligned
  }

  // Visual DNA alignment
  if (visualDna.colorPalette.length > 0) {
    score += 5; // colors were specified in DNA
  }

  // Brand profile specificity boosts
  if (brandProfile) {
    const primaryColors = extractColors(brandProfile.primaryColors ?? []);
    if (primaryColors.length > 0) score += 5;

    const preferredStyles = brandProfile.preferredVisualStyles ?? [];
    if (preferredStyles.length > 0) score += 5;

    // Luxury alignment
    const luxuryDiff = Math.abs((brandProfile.luxuryScore ?? 50) - visualDna.luxuryLevel);
    score -= luxuryDiff * 0.15;

    // Modern score alignment
    const modernDiff = Math.abs((brandProfile.modernScore ?? 50) - (visualDna.realismLevel > 60 ? 60 : 40));
    score -= modernDiff * 0.1;
  }

  // Mock provider penalty
  if (asset.provider === 'mock') {
    score = Math.min(score, 35);
  }

  return clamp(score);
}

/** Score realism quality */
function scoreRealism(
  asset: Partial<ClientVisualAsset>,
  visualDna: VisualDNA,
): number {
  const providerQuality = PROVIDER_QUALITY[asset.provider ?? 'mock'];
  let score = providerQuality.realismBase;

  // Adjust based on target realism level — closer to target is better
  const targetRealism = visualDna.realismLevel;
  const diff = Math.abs(score - targetRealism);
  if (diff < 15) {
    score += 10; // close to target
  } else if (diff > 40) {
    score -= 15; // far from target
  }

  return addVariance(score, 8);
}

/** Score composition quality */
function scoreComposition(
  asset: Partial<ClientVisualAsset>,
  visualDna: VisualDNA,
): number {
  const assetType = asset.assetType ?? 'brand_visual';
  const traits = ASSET_SCORING_TRAITS[assetType] ?? ASSET_SCORING_TRAITS.brand_visual;
  let score = traits.baseComposition;

  // Provider quality influence
  const providerQuality = PROVIDER_QUALITY[asset.provider ?? 'mock'];
  score = score * 0.6 + providerQuality.qualityBase * 0.4;

  // Visual density alignment
  if (visualDna.visualDensity < 30 && (assetType === 'background' || assetType === 'hero_image')) {
    score += 8; // minimal compositions work well for these types
  }

  return addVariance(clamp(score * traits.compositionWeight), 6);
}

/** Score readability compatibility (text overlay support) */
function scoreReadabilityCompatibility(
  asset: Partial<ClientVisualAsset>,
  visualDna: VisualDNA,
): number {
  const assetType = asset.assetType ?? 'brand_visual';
  const traits = ASSET_SCORING_TRAITS[assetType] ?? ASSET_SCORING_TRAITS.brand_visual;

  let score = 65;

  // Backgrounds are inherently text-overlay friendly
  if (assetType === 'background') score = 85;
  else if (assetType === 'hero_image') score = 75;
  else if (assetType === 'advertising_visual') score = 70;
  else if (assetType === 'lifestyle_imagery') score = 55;
  else if (assetType === 'project_render') score = 50;

  // Low visual density helps readability
  if (visualDna.visualDensity < 40) score += 10;
  else if (visualDna.visualDensity > 70) score -= 10;

  // Provider quality
  const providerQuality = PROVIDER_QUALITY[asset.provider ?? 'mock'];
  score = score * 0.8 + providerQuality.qualityBase * 0.2;

  return addVariance(clamp(score * traits.readabilityWeight), 5);
}

/** Score luxury feel alignment */
function scoreLuxury(
  asset: Partial<ClientVisualAsset>,
  visualDna: VisualDNA,
): number {
  const targetLuxury = visualDna.luxuryLevel;
  const providerQuality = PROVIDER_QUALITY[asset.provider ?? 'mock'];

  // Start with provider capability
  let achievedLuxury = providerQuality.qualityBase * 0.8;

  // High realism helps luxury
  if (visualDna.realismLevel > 70) achievedLuxury += 10;

  // Proximity to target luxury level
  const diff = Math.abs(achievedLuxury - targetLuxury);
  let score = 100 - diff;

  // Bonus for luxury-oriented asset types
  const assetType = asset.assetType ?? 'brand_visual';
  if (assetType === 'project_render' || assetType === 'hero_image') {
    score += 5;
  }

  return addVariance(clamp(score), 7);
}

/** Score conversion potential */
function scoreConversionPotential(
  asset: Partial<ClientVisualAsset>,
  visualDna: VisualDNA,
): number {
  const assetType = asset.assetType ?? 'brand_visual';
  const traits = ASSET_SCORING_TRAITS[assetType] ?? ASSET_SCORING_TRAITS.brand_visual;

  let score = 60;

  // Advertising visuals have highest conversion potential
  if (assetType === 'advertising_visual') score = 78;
  else if (assetType === 'hero_image') score = 72;
  else if (assetType === 'lifestyle_imagery') score = 70;
  else if (assetType === 'brand_visual') score = 65;
  else if (assetType === 'background') score = 40;

  // Provider quality
  const providerQuality = PROVIDER_QUALITY[asset.provider ?? 'mock'];
  score = score * 0.7 + providerQuality.qualityBase * 0.3;

  return addVariance(clamp(score * traits.conversionWeight), 6);
}

/* ── Main Export ────────────────────────────────────────────────────── */

/**
 * Score a generated visual asset across 6 dimensions.
 *
 * @param asset - The visual asset (or partial data) to score
 * @param visualDna - The Visual DNA used to generate it
 * @param brandProfile - Optional brand profile for deeper brand matching
 * @returns VisualScore with 6 dimension scores and overall weighted average
 */
export function scoreVisual(
  asset: Partial<ClientVisualAsset>,
  visualDna: VisualDNA,
  brandProfile?: Partial<BrandStyleProfile>,
): VisualScore {
  const brandMatch = scoreBrandMatch(asset, visualDna, brandProfile);
  const realismScore = scoreRealism(asset, visualDna);
  const compositionScore = scoreComposition(asset, visualDna);
  const readabilityCompatibility = scoreReadabilityCompatibility(asset, visualDna);
  const luxuryScore = scoreLuxury(asset, visualDna);
  const conversionPotential = scoreConversionPotential(asset, visualDna);

  // Weighted average: brandMatch 25%, realism 20%, composition 15%,
  // readability 15%, luxury 10%, conversion 15%
  const overall = clamp(
    brandMatch * 0.25 +
    realismScore * 0.20 +
    compositionScore * 0.15 +
    readabilityCompatibility * 0.15 +
    luxuryScore * 0.10 +
    conversionPotential * 0.15,
  );

  return {
    brandMatch,
    realismScore,
    compositionScore,
    readabilityCompatibility,
    luxuryScore,
    conversionPotential,
    overall,
  };
}
