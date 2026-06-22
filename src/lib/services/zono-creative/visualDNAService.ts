/**
 * Visual DNA Service — Converts Brand DNA into Visual DNA
 *
 * Transforms brand style profile data (colors, typography, positioning, scores)
 * into actionable visual generation parameters (photography style, lighting,
 * composition, environments, materials, camera angles).
 *
 * Applies industry-specific defaults and learning weight adjustments.
 *
 * Server-side only.
 */
import type { VisualDNA, VisualLearningWeights, BrandStyleProfile } from '@/lib/db/schema';

/* ── Industry Detection ────────────────────────────────────────────── */

interface IndustryDefaults {
  photographyStyle: string;
  lightingStyle: string;
  compositionStyle: string;
  backgroundStyle: string;
  preferredEnvironments: string[];
  preferredMaterials: string[];
  preferredCameraAngles: string[];
  moodKeywords: string[];
}

const INDUSTRY_DEFAULTS: Record<string, IndustryDefaults> = {
  real_estate: {
    photographyStyle: 'architectural photography, real estate editorial, premium interiors',
    lightingStyle: 'golden hour natural light, bright airy interiors, dramatic sunset silhouettes',
    compositionStyle: 'wide-angle with depth, symmetrical architectural, leading lines',
    backgroundStyle: 'cityscapes, premium buildings, lush neighborhoods',
    preferredEnvironments: ['luxury apartments', 'modern penthouses', 'garden terraces', 'skyline views', 'premium lobbies'],
    preferredMaterials: ['marble', 'glass', 'polished concrete', 'natural wood', 'brushed metal'],
    preferredCameraAngles: ['eye-level wide', 'aerial drone', 'low-angle dramatic', 'straight-on facade'],
    moodKeywords: ['luxurious', 'aspirational', 'spacious', 'premium', 'exclusive'],
  },
  restaurant: {
    photographyStyle: 'food photography, warm atmospheric, lifestyle dining',
    lightingStyle: 'warm ambient candlelight, soft overhead, moody restaurant lighting',
    compositionStyle: 'close-up overhead, 45-degree angle, environmental with depth of field',
    backgroundStyle: 'restaurant interiors, rustic textures, warm toned surfaces',
    preferredEnvironments: ['dining tables', 'kitchen prep areas', 'bar counter', 'outdoor seating', 'cozy interiors'],
    preferredMaterials: ['ceramic plates', 'natural wood tables', 'linen napkins', 'copper cookware', 'fresh herbs'],
    preferredCameraAngles: ['overhead flat-lay', '45-degree hero', 'close-up macro', 'environmental wide'],
    moodKeywords: ['appetizing', 'warm', 'inviting', 'authentic', 'artisanal'],
  },
  finance: {
    photographyStyle: 'corporate professional, trust imagery, clean modern office',
    lightingStyle: 'clean studio lighting, bright neutral, professional soft box',
    compositionStyle: 'centered clean, rule of thirds, negative space focus',
    backgroundStyle: 'clean gradients, modern offices, abstract geometric',
    preferredEnvironments: ['modern offices', 'boardrooms', 'city financial district', 'clean abstract'],
    preferredMaterials: ['glass', 'polished steel', 'premium leather', 'clean white surfaces'],
    preferredCameraAngles: ['eye-level straight', 'slightly elevated', 'medium close-up'],
    moodKeywords: ['trustworthy', 'professional', 'stable', 'growth', 'secure'],
  },
  medical: {
    photographyStyle: 'clean clinical, warm healthcare, professional medical',
    lightingStyle: 'soft diffused natural, bright clean, calming blue-white',
    compositionStyle: 'clean centered, plenty of white space, gentle compositions',
    backgroundStyle: 'clean white, soft blue gradients, clinical environments',
    preferredEnvironments: ['modern clinics', 'clean treatment rooms', 'nature scenes', 'calming spaces'],
    preferredMaterials: ['white surfaces', 'glass', 'natural elements', 'soft textiles'],
    preferredCameraAngles: ['eye-level warm', 'medium shot', 'gentle close-up'],
    moodKeywords: ['caring', 'trustworthy', 'clean', 'professional', 'calming'],
  },
  tech: {
    photographyStyle: 'modern minimal tech, clean product, futuristic',
    lightingStyle: 'cool blue-white studio, neon accent, clean backlit',
    compositionStyle: 'minimal centered, geometric grids, asymmetric modern',
    backgroundStyle: 'dark gradients, abstract tech patterns, clean white',
    preferredEnvironments: ['modern workspaces', 'abstract digital', 'clean desks', 'futuristic spaces'],
    preferredMaterials: ['aluminum', 'glass screens', 'matte black', 'LED accents', 'carbon fiber'],
    preferredCameraAngles: ['slightly elevated', 'close-up product', 'isometric', 'eye-level clean'],
    moodKeywords: ['innovative', 'modern', 'clean', 'cutting-edge', 'minimal'],
  },
};

const DEFAULT_INDUSTRY: IndustryDefaults = {
  photographyStyle: 'professional commercial photography, versatile editorial',
  lightingStyle: 'natural soft lighting, professional studio setup',
  compositionStyle: 'balanced rule of thirds, clean framing',
  backgroundStyle: 'clean neutral, subtle gradient, contextual',
  preferredEnvironments: ['modern commercial spaces', 'clean studios', 'natural outdoor', 'urban settings'],
  preferredMaterials: ['natural textures', 'clean surfaces', 'modern finishes'],
  preferredCameraAngles: ['eye-level', 'slightly elevated', 'medium shot'],
  moodKeywords: ['professional', 'clean', 'modern', 'approachable'],
};

/** Detect industry from client data and brand profile */
function detectIndustry(brandProfile: Partial<BrandStyleProfile>, clientIndustry?: string): string {
  // Explicit industry parameter takes priority
  if (clientIndustry) {
    const normalized = clientIndustry.toLowerCase().trim();
    if (normalized.includes('real estate') || normalized.includes('נדל"ן') || normalized.includes('realestate')) return 'real_estate';
    if (normalized.includes('restaurant') || normalized.includes('food') || normalized.includes('מסעדה') || normalized.includes('אוכל')) return 'restaurant';
    if (normalized.includes('finance') || normalized.includes('bank') || normalized.includes('פיננסים') || normalized.includes('בנק')) return 'finance';
    if (normalized.includes('medical') || normalized.includes('health') || normalized.includes('רפואה') || normalized.includes('בריאות')) return 'medical';
    if (normalized.includes('tech') || normalized.includes('software') || normalized.includes('הייטק') || normalized.includes('טכנולוגיה')) return 'tech';
  }

  // Infer from brand profile positioning
  const positioning = (brandProfile.realEstatePositioning || '').toLowerCase();
  if (positioning.length > 5) return 'real_estate';

  return 'default';
}

/** Extract flat color strings from JSONB color arrays */
function extractColorStrings(arr: unknown[]): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return String(obj.hex || obj.color || obj.value || '').trim();
      }
      return '';
    })
    .filter((c) => c.length > 0);
}

/* ── Main Export ────────────────────────────────────────────────────── */

/**
 * Extract Visual DNA from a brand style profile, industry context, and learning weights.
 *
 * @param brandProfile - The brand style profile (from DB or partial)
 * @param clientIndustry - Optional industry string (e.g. "real_estate", "restaurant")
 * @param learningWeights - Optional learning weights from feedback loop
 * @returns Complete VisualDNA object
 */
export function extractVisualDNA(
  brandProfile: Partial<BrandStyleProfile>,
  clientIndustry?: string,
  learningWeights?: VisualLearningWeights | null,
): VisualDNA {
  const industry = detectIndustry(brandProfile, clientIndustry);
  const defaults = INDUSTRY_DEFAULTS[industry] ?? DEFAULT_INDUSTRY;

  // Build color palette from brand profile
  const primaryColors = extractColorStrings(brandProfile.primaryColors ?? []);
  const secondaryColors = extractColorStrings(brandProfile.secondaryColors ?? []);
  const accentColors = extractColorStrings(brandProfile.accentColors ?? []);
  const colorPalette = [...primaryColors, ...secondaryColors, ...accentColors];
  if (colorPalette.length === 0) {
    colorPalette.push('#1a1a2e', '#e94560', '#0f3460');
  }

  // Extract visual style preferences from brand profile
  const preferredStyles = (brandProfile.preferredVisualStyles ?? []).map((s: any) =>
    typeof s === 'string' ? s : s?.name ?? '',
  ).filter(Boolean);
  const rejectedStyles = (brandProfile.rejectedVisualStyles ?? []).map((s: any) =>
    typeof s === 'string' ? s : s?.name ?? '',
  ).filter(Boolean);

  // Extract image style preferences
  const preferredImageStyles = (brandProfile.preferredImageStyles ?? []).map((s: any) =>
    typeof s === 'string' ? s : s?.name ?? '',
  ).filter(Boolean);

  // Build photography style: combine brand visual personality + industry default + image styles
  let photographyStyle = defaults.photographyStyle;
  if (brandProfile.visualPersonality) {
    photographyStyle = `${brandProfile.visualPersonality}, ${defaults.photographyStyle}`;
  }
  if (preferredImageStyles.length > 0) {
    photographyStyle += `, ${preferredImageStyles.join(', ')}`;
  }

  // Mood keywords from brand + defaults
  const moodKeywords = [...defaults.moodKeywords];
  if (preferredStyles.length > 0) {
    moodKeywords.push(...preferredStyles.slice(0, 5));
  }

  // Avoid keywords from rejected styles + brand rules
  const avoidKeywords = [...rejectedStyles];
  const avoidRules = (brandProfile.avoidRules ?? []).map((r: any) =>
    typeof r === 'string' ? r : r?.description ?? '',
  ).filter(Boolean);
  avoidKeywords.push(...avoidRules);

  // Scores from brand profile
  const luxuryLevel = brandProfile.luxuryScore ?? 50;
  const visualDensity = brandProfile.visualDensityScore ?? 50;
  const modernScore = brandProfile.modernScore ?? 50;

  // Realism level: higher luxury = higher realism, lower AI-generated feel
  const aiGeneratedScore = brandProfile.aiGeneratedScore ?? 30;
  const realismLevel = Math.max(0, Math.min(100, 100 - aiGeneratedScore));

  // Adjust lighting based on luxury + modern scores
  let lightingStyle = defaults.lightingStyle;
  if (luxuryLevel > 70) {
    lightingStyle = `premium dramatic lighting, ${lightingStyle}`;
  } else if (modernScore > 70) {
    lightingStyle = `clean modern lighting, ${lightingStyle}`;
  }

  // Adjust composition based on minimalism
  let compositionStyle = defaults.compositionStyle;
  const minimalismScore = brandProfile.minimalismScore ?? 50;
  if (minimalismScore > 70) {
    compositionStyle = `minimal clean composition, generous negative space, ${compositionStyle}`;
  } else if (visualDensity > 70) {
    compositionStyle = `rich detailed composition, layered elements, ${compositionStyle}`;
  }

  // Build base VisualDNA
  const visualDna: VisualDNA = {
    photographyStyle,
    lightingStyle,
    compositionStyle,
    realismLevel,
    luxuryLevel,
    visualDensity,
    backgroundStyle: defaults.backgroundStyle,
    preferredEnvironments: [...defaults.preferredEnvironments],
    preferredMaterials: [...defaults.preferredMaterials],
    preferredCameraAngles: [...defaults.preferredCameraAngles],
    colorPalette,
    moodKeywords,
    avoidKeywords,
    industryContext: industry === 'default' ? 'general commercial' : industry.replace('_', ' '),
  };

  // Apply learning weights — boost approved patterns, dampen rejected ones
  if (learningWeights) {
    // Add approved styles to mood keywords
    if (learningWeights.approvedStyles.length > 0) {
      visualDna.moodKeywords.push(...learningWeights.approvedStyles.slice(0, 5));
    }

    // Add favorite patterns to photography style
    if (learningWeights.favoritePatterns.length > 0) {
      visualDna.photographyStyle += `, ${learningWeights.favoritePatterns.slice(0, 3).join(', ')}`;
    }

    // Add rejected styles to avoid keywords
    if (learningWeights.rejectedStyles.length > 0) {
      visualDna.avoidKeywords.push(...learningWeights.rejectedStyles);
    }

    // Adjust realism based on style preferences
    const stylePrefs = learningWeights.stylePreferences;
    if (stylePrefs.realism && stylePrefs.realism > 0) {
      visualDna.realismLevel = Math.min(100, visualDna.realismLevel + stylePrefs.realism * 5);
    }
    if (stylePrefs.luxury && stylePrefs.luxury > 0) {
      visualDna.luxuryLevel = Math.min(100, visualDna.luxuryLevel + stylePrefs.luxury * 5);
    }
  }

  // Deduplicate arrays
  visualDna.moodKeywords = [...new Set(visualDna.moodKeywords)];
  visualDna.avoidKeywords = [...new Set(visualDna.avoidKeywords)];
  visualDna.colorPalette = [...new Set(visualDna.colorPalette)];

  return visualDna;
}
