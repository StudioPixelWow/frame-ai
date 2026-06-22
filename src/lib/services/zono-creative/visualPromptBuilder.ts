/**
 * Visual Prompt Builder — Builds image generation prompts from Visual DNA
 *
 * Constructs detailed prompts for AI image generation providers by combining
 * Visual DNA parameters, asset type templates, concept context, and
 * variation directions. Also builds negative prompts.
 *
 * ALL prompt content is in English (for the AI model, not the user).
 *
 * Server-side only.
 */
import type { VisualAssetType, VisualDNA, VisualLearningWeights } from '@/lib/db/schema';

/* ── Asset Type Templates ──────────────────────────────────────────── */

interface AssetTypeTemplate {
  subjectPrefix: string;
  styleHints: string;
  compositionHints: string;
  qualityMarkers: string;
}

const ASSET_TEMPLATES: Record<VisualAssetType, AssetTypeTemplate> = {
  hero_image: {
    subjectPrefix: 'A dramatic wide-format hero image',
    styleHints: 'cinematic, high-impact, brand-aligned, editorial quality',
    compositionHints: 'wide composition with clear focal point, suitable for text overlay on one side, dramatic scale',
    qualityMarkers: 'ultra high resolution, professional photography, 8K quality',
  },
  advertising_visual: {
    subjectPrefix: 'A professional advertising visual',
    styleHints: 'clean, product-focused, conversion-oriented, attention-grabbing',
    compositionHints: 'clean composition with clear subject, generous space for text and CTA, eye-catching layout',
    qualityMarkers: 'commercial quality, studio photography, sharp details',
  },
  background: {
    subjectPrefix: 'A subtle elegant background image',
    styleHints: 'non-distracting, ambient, supports text overlay, atmospheric',
    compositionHints: 'soft focus or blur, even lighting across frame, no strong focal elements, texture-forward',
    qualityMarkers: 'high resolution, smooth gradients, professional quality',
  },
  project_render: {
    subjectPrefix: 'A premium architectural visualization render',
    styleHints: 'photorealistic architectural rendering, premium real estate, aspirational',
    compositionHints: 'architectural perspective with depth, clear building form, professional composition',
    qualityMarkers: 'photorealistic 3D rendering, V-Ray quality, architectural visualization',
  },
  lifestyle_imagery: {
    subjectPrefix: 'An authentic aspirational lifestyle photograph',
    styleHints: 'authentic, aspirational, people in natural context, emotionally engaging',
    compositionHints: 'natural candid composition, environmental context, people interacting naturally',
    qualityMarkers: 'professional lifestyle photography, natural lighting, editorial quality',
  },
  scene_extension: {
    subjectPrefix: 'An extended scene continuation',
    styleHints: 'seamless extension, matching style and lighting, consistent perspective',
    compositionHints: 'continuation of existing scene, matching horizon line, consistent color palette',
    qualityMarkers: 'photorealistic, seamless blending, consistent quality',
  },
  image_variation: {
    subjectPrefix: 'A creative variation of the reference image',
    styleHints: 'similar theme, different perspective or mood, brand-aligned variation',
    compositionHints: 'alternative composition maintaining brand identity, fresh angle on same concept',
    qualityMarkers: 'professional quality, consistent with reference style',
  },
  image_improvement: {
    subjectPrefix: 'An enhanced improved version',
    styleHints: 'higher quality, better lighting, more professional finish',
    compositionHints: 'improved framing, better visual balance, enhanced details',
    qualityMarkers: 'enhanced resolution, professional retouching quality',
  },
  image_upscale: {
    subjectPrefix: 'A high-resolution upscaled image',
    styleHints: 'sharp details, enhanced clarity, preserved style',
    compositionHints: 'maintained original composition with enhanced detail',
    qualityMarkers: 'ultra-high resolution, sharp, pixel-perfect',
  },
  image_cleanup: {
    subjectPrefix: 'A clean professional image',
    styleHints: 'clean, distraction-free, polished',
    compositionHints: 'clean background, removed distractions, polished finish',
    qualityMarkers: 'professional retouching, clean finish',
  },
  object_replacement: {
    subjectPrefix: 'A scene with replaced elements',
    styleHints: 'seamlessly integrated, matching lighting and perspective',
    compositionHints: 'natural placement, consistent shadows and reflections',
    qualityMarkers: 'photorealistic compositing, seamless integration',
  },
  brand_visual: {
    subjectPrefix: 'A brand-aligned visual asset',
    styleHints: 'on-brand, professional, versatile marketing visual',
    compositionHints: 'flexible composition suitable for multiple uses, brand-consistent framing',
    qualityMarkers: 'professional commercial photography, brand quality',
  },
};

/* ── Prompt Segment Builders ───────────────────────────────────────── */

/** Build lighting description from Visual DNA */
function buildLightingSegment(dna: VisualDNA): string {
  const parts = [dna.lightingStyle];
  if (dna.luxuryLevel > 75) {
    parts.push('dramatic premium lighting with rich shadows and highlights');
  } else if (dna.luxuryLevel > 50) {
    parts.push('professional soft studio lighting');
  }
  return parts.join(', ');
}

/** Build environment/setting description */
function buildEnvironmentSegment(dna: VisualDNA, assetType: VisualAssetType): string {
  if (assetType === 'background') {
    return `ambient background environment, ${dna.backgroundStyle}`;
  }
  const envs = dna.preferredEnvironments.slice(0, 3).join(' or ');
  return `set in ${envs}`;
}

/** Build materials/textures description */
function buildMaterialsSegment(dna: VisualDNA): string {
  if (dna.preferredMaterials.length === 0) return '';
  return `featuring ${dna.preferredMaterials.slice(0, 4).join(', ')}`;
}

/** Build camera angle/shot description */
function buildCameraSegment(dna: VisualDNA, assetType: VisualAssetType): string {
  // Override camera for specific asset types
  if (assetType === 'background') return 'slightly defocused, atmospheric depth';
  if (assetType === 'project_render') return 'architectural perspective, professional exterior shot';

  const angle = dna.preferredCameraAngles[0] ?? 'eye-level';
  return `shot from ${angle} angle`;
}

/** Build color instruction */
function buildColorSegment(dna: VisualDNA): string {
  if (dna.colorPalette.length === 0) return '';
  const colorList = dna.colorPalette.slice(0, 5).join(', ');
  return `color palette incorporating tones of ${colorList}`;
}

/** Build style descriptor from mood keywords */
function buildStyleSegment(dna: VisualDNA): string {
  const moods = dna.moodKeywords.slice(0, 6).join(', ');
  return moods ? `overall mood: ${moods}` : '';
}

/** Build realism instruction */
function buildRealismSegment(dna: VisualDNA): string {
  if (dna.realismLevel > 80) return 'photorealistic, indistinguishable from real photography';
  if (dna.realismLevel > 60) return 'highly realistic with professional photography feel';
  if (dna.realismLevel > 40) return 'semi-realistic, professional quality';
  return 'stylized, artistic interpretation';
}

/* ── Variation Direction Handlers ──────────────────────────────────── */

interface VariationModifier {
  promptAddition: string;
  negativeAddition: string;
}

const VARIATION_MODIFIERS: Record<string, VariationModifier> = {
  more_luxury: {
    promptAddition: 'extremely premium, high-end luxury feel, opulent materials, exclusive atmosphere',
    negativeAddition: 'cheap, low-quality, budget, plain',
  },
  more_modern: {
    promptAddition: 'ultra-modern, contemporary design, cutting-edge aesthetics, sleek lines',
    negativeAddition: 'dated, old-fashioned, vintage, retro, traditional',
  },
  more_realistic: {
    promptAddition: 'extremely photorealistic, indistinguishable from a real photograph, natural imperfections',
    negativeAddition: 'artificial, CGI, rendered, digital art, illustration',
  },
  less_ai: {
    promptAddition: 'natural photograph, genuine photo, authentic captured moment, no AI artifacts',
    negativeAddition: 'AI-generated, artificial, overly smooth, uncanny, AI artifacts, plastic skin',
  },
  different_lighting: {
    promptAddition: 'dramatically different lighting mood, alternative time of day, creative light source',
    negativeAddition: '',
  },
  different_background: {
    promptAddition: 'completely different background environment, alternative setting and location',
    negativeAddition: '',
  },
  more_dramatic: {
    promptAddition: 'dramatic contrast, bold visual impact, striking composition, powerful atmosphere',
    negativeAddition: 'flat, boring, plain, mundane',
  },
  warmer_tones: {
    promptAddition: 'warm golden tones, sunset colors, warm amber lighting, cozy atmosphere',
    negativeAddition: 'cold, blue, clinical, sterile',
  },
  cooler_tones: {
    promptAddition: 'cool blue tones, crisp clean lighting, modern fresh atmosphere',
    negativeAddition: 'warm, yellow, orange, sepia',
  },
  more_minimal: {
    promptAddition: 'extremely minimal, clean negative space, simple elegant, less is more',
    negativeAddition: 'busy, cluttered, complex, dense, decorative',
  },
  more_vibrant: {
    promptAddition: 'vibrant saturated colors, bold color palette, energetic visual impact',
    negativeAddition: 'muted, desaturated, dull, grayscale',
  },
};

/* ── Main Export ────────────────────────────────────────────────────── */

/**
 * Build a complete image generation prompt from Visual DNA and context.
 *
 * @returns Object with `prompt` (positive) and `negativePrompt` (negative)
 */
export function buildVisualPrompt(params: {
  visualDna: VisualDNA;
  assetType: VisualAssetType;
  conceptTitle?: string;
  conceptDescription?: string;
  entityName?: string;
  entityType?: string;
  variationDirection?: string;
  learningWeights?: VisualLearningWeights | null;
}): { prompt: string; negativePrompt: string } {
  const {
    visualDna,
    assetType,
    conceptTitle,
    conceptDescription,
    entityName,
    entityType,
    variationDirection,
    learningWeights,
  } = params;

  const template = ASSET_TEMPLATES[assetType] ?? ASSET_TEMPLATES.brand_visual;

  // ── Build positive prompt segments ──
  const segments: string[] = [];

  // 1. Subject line from template + concept
  let subjectLine = template.subjectPrefix;
  if (conceptTitle) {
    subjectLine += ` representing "${conceptTitle}"`;
  }
  if (entityName && entityType) {
    subjectLine += ` for ${entityType} "${entityName}"`;
  }
  segments.push(subjectLine);

  // 2. Concept description context
  if (conceptDescription) {
    // Truncate to keep prompt manageable
    const truncated = conceptDescription.length > 200
      ? conceptDescription.slice(0, 200) + '...'
      : conceptDescription;
    segments.push(`concept: ${truncated}`);
  }

  // 3. Photography/visual style
  segments.push(visualDna.photographyStyle);

  // 4. Style hints from template
  segments.push(template.styleHints);

  // 5. Lighting
  segments.push(buildLightingSegment(visualDna));

  // 6. Composition
  segments.push(template.compositionHints);

  // 7. Environment
  segments.push(buildEnvironmentSegment(visualDna, assetType));

  // 8. Materials
  const materialsSegment = buildMaterialsSegment(visualDna);
  if (materialsSegment) segments.push(materialsSegment);

  // 9. Camera angle
  segments.push(buildCameraSegment(visualDna, assetType));

  // 10. Color palette
  const colorSegment = buildColorSegment(visualDna);
  if (colorSegment) segments.push(colorSegment);

  // 11. Mood/style
  const styleSegment = buildStyleSegment(visualDna);
  if (styleSegment) segments.push(styleSegment);

  // 12. Realism level
  segments.push(buildRealismSegment(visualDna));

  // 13. Quality markers
  segments.push(template.qualityMarkers);

  // 14. Industry context
  if (visualDna.industryContext && visualDna.industryContext !== 'general commercial') {
    segments.push(`industry context: ${visualDna.industryContext}`);
  }

  // ── Apply variation direction ──
  const negativeSegments: string[] = [];

  if (variationDirection && VARIATION_MODIFIERS[variationDirection]) {
    const modifier = VARIATION_MODIFIERS[variationDirection];
    if (modifier.promptAddition) {
      segments.push(modifier.promptAddition);
    }
    if (modifier.negativeAddition) {
      negativeSegments.push(modifier.negativeAddition);
    }
  }

  // ── Build negative prompt ──

  // Base negatives — always avoid
  negativeSegments.push(
    'watermark, text overlay, logo, signature, border, frame',
    'blurry, out of focus, low quality, pixelated, grainy',
    'distorted, deformed, disfigured, malformed',
    'cartoon, anime, sketch, drawing, painting (unless specifically requested)',
  );

  // Add avoid keywords from Visual DNA
  if (visualDna.avoidKeywords.length > 0) {
    negativeSegments.push(visualDna.avoidKeywords.join(', '));
  }

  // Add rejected styles from learning weights
  if (learningWeights?.rejectedStyles && learningWeights.rejectedStyles.length > 0) {
    negativeSegments.push(learningWeights.rejectedStyles.join(', '));
  }

  // ── Apply learning weight emphasis ──
  if (learningWeights) {
    if (learningWeights.approvedStyles.length > 0) {
      const emphasis = learningWeights.approvedStyles.slice(0, 3).join(', ');
      segments.push(`emphasize: ${emphasis}`);
    }
    if (learningWeights.favoritePatterns.length > 0) {
      const favorites = learningWeights.favoritePatterns.slice(0, 3).join(', ');
      segments.push(`strongly preferred: ${favorites}`);
    }
  }

  // ── Assemble final prompts ──
  const prompt = segments
    .filter((s) => s.trim().length > 0)
    .join('. ')
    .replace(/\.\./g, '.')
    .trim();

  const negativePrompt = negativeSegments
    .filter((s) => s.trim().length > 0)
    .join(', ')
    .trim();

  return { prompt, negativePrompt };
}
