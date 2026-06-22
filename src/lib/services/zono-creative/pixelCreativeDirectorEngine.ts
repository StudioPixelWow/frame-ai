/** PIXEL Creative Director — Main Engine.
 * Generates creative direction using the proven prompt framework.
 * Server-side only.
 */

import { BrandStyleProfile } from '@/lib/db/schema';
import { generateWithAI } from '@/lib/ai/openai-client';
import {
  CREATIVE_DIRECTOR_SYSTEM_PROMPT,
  VISUAL_STRATEGIES,
  INDUSTRY_VISUAL_ANCHORS,
  ABSOLUTE_BLACKLIST,
  SCROLL_STOP_RULES,
  TYPOGRAPHY_RULES,
} from './pixelCreativeDirectorPrompt';
import {
  buildCreativeDirectorBrief,
  buildBriefFromBrandProfile,
  BriefBuilderParams,
} from './pixelPromptBriefBuilder';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface CreativeDirectorInput {
  clientId: string;
  brandProfile?: BrandStyleProfile | null;
  industry: string;
  headline: string;
  subHeadline?: string;
  bullets?: string[];
  authorityLine?: string;
  cta: string;
  campaignType?: string;
  designType?: string;
  platform?: string;
  format?: string;
  additionalContext?: Record<string, any>;
}

export interface CreativeDirectorOutput {
  internalPrompt: string;
  selectedStrategy: string;
  visualHook: string;
  scrollStopReason: string;
  industryAnchor: string;
  layoutRecommendation: string;
  typographyRecommendation: string;
  creativeDirectorMetadata: Record<string, any>;
  scores: {
    scrollStopScore: number;
    creativeDirectorScore: number;
    antiAiScore: number;
    rtlReadabilityScore: number;
    contrastScore: number;
    brandDnaMatchScore: number;
  };
}

// ---------------------------------------------------------------------------
// Strategy Selection
// ---------------------------------------------------------------------------

/**
 * Select the best visual strategy based on industry, concept type, and brand
 * profile. Uses deterministic rules — no AI call.
 *
 * סדר העדיפויות: סוג קונספט → תעשייה → פרופיל מותג → ברירת מחדל
 */
export function selectBestStrategy(
  industry: string,
  conceptType?: string,
  brandProfile?: BrandStyleProfile | null,
): string {
  // --- concept-type overrides ---
  if (conceptType) {
    const ct = conceptType.toLowerCase();
    if (ct === 'before-after') return 'before-after-split';
    if (ct === 'data' || ct === 'statistics') return 'data-drama';
    if (ct === 'typography' || ct === 'text-heavy') return 'brutalist-typography';
  }

  // --- industry-based selection ---
  const ind = industry.toLowerCase();

  // בריאות ושיניים — דמות בהקשר מקצועי
  if (ind.includes('dental') || ind.includes('health')) return 'protagonist-in-context';

  // בנקאות ופיננסים — מסמך / artifact
  if (ind.includes('banking') || ind.includes('finance')) return 'document-artifact';

  // נדל"ן — סצנה קולנועית
  if (ind.includes('real-estate')) return 'cinematic-scene';

  // איקומרס — דמות בהקשר
  if (ind.includes('ecommerce')) return 'protagonist-in-context';

  // B2B — מסמך / artifact
  if (ind.includes('b2b')) return 'document-artifact';

  // --- brand profile luxury override ---
  if (brandProfile && brandProfile.luxuryScore > 70) return 'cinematic-scene';

  // ברירת מחדל
  return 'protagonist-in-context';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find the matching industry anchor strings, or return a generic fallback. */
function resolveIndustryAnchor(industry: string): string {
  const ind = industry.toLowerCase();

  for (const key of Object.keys(INDUSTRY_VISUAL_ANCHORS)) {
    if (ind.includes(key)) {
      return INDUSTRY_VISUAL_ANCHORS[key].join('; ');
    }
  }

  // ברירת מחדל — אנקור גנרי
  return 'Clean professional environment with natural light and authentic textures';
}

/** Map a strategy id to a layout recommendation. */
function layoutForStrategy(strategyId: string): string {
  const map: Record<string, string> = {
    'protagonist-in-context': 'Asymmetric thirds — subject off-center, text anchored to opposite third',
    'before-after-split': 'Vertical split — left panel "before", right panel "after", divider at 50%',
    'document-artifact': 'Layered document stack — angled paper / screen with text overlay on solid margin',
    'data-drama': 'Full-bleed stat hero — oversized number anchored top-left, supporting visual bottom-right',
    'brutalist-typography': 'Text-dominant — type fills 70%+ of frame, minimal imagery, strong negative space',
    'cinematic-scene': 'Wide cinematic crop — 2.35:1 implied ratio inside 4:5, letterbox breathing room',
  };
  return map[strategyId] ?? map['protagonist-in-context'];
}

/** Build a typography recommendation string from the shared rules. */
function buildTypographyRecommendation(): string {
  const h = TYPOGRAPHY_RULES.headline;
  const b = TYPOGRAPHY_RULES.body;
  const c = TYPOGRAPHY_RULES.cta;

  return [
    `Headline: ${h.weight}, ${h.style}, min ${h.minFrameHeight} frame height`,
    `Body: ${b.weight}, line-spacing ${b.lineSpacing}`,
    `CTA: ${c.weight}, ${c.shape}, fill ${c.fillColor}, text ${c.textColor}`,
    `Hierarchy: ${TYPOGRAPHY_RULES.hierarchy.levels} levels — ${TYPOGRAPHY_RULES.hierarchy.order.join(' → ')}`,
  ].join('. ');
}

/**
 * Extract the first meaningful sentence from a block of text. Falls back to a
 * generated hook if nothing suitable is found.
 */
function extractVisualHook(text: string, strategyName: string): string {
  // Try to grab the first sentence (ends with period, exclamation, or newline)
  const match = text.match(/^(.+?[.!])\s/);
  if (match) return match[1].trim();

  // Fallback — generate a hook from the strategy
  const strategy = VISUAL_STRATEGIES.find((s) => s.id === strategyName);
  return strategy
    ? `${strategy.name} — ${strategy.description}`
    : 'A bold visual composition designed to stop the scroll';
}

/** Extract `[STRATEGY: ...]` from AI response, if present. */
function extractStrategyFromResponse(text: string): string | null {
  const match = text.match(/\[STRATEGY:\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Calculate deterministic quality scores based on the generated prompt. */
function calculateScores(
  prompt: string,
  brandProfile?: BrandStyleProfile | null,
  industry?: string,
): CreativeDirectorOutput['scores'] {
  const lc = prompt.toLowerCase();

  // --- scrollStopScore ---
  let scrollStopScore = 70;
  if (lc.includes('dominant') || lc.includes('commands')) scrollStopScore += 10;
  if (lc.includes('contrast')) scrollStopScore += 5;
  if (lc.includes('negative space')) scrollStopScore += 5;
  const strategyMatch = extractStrategyFromResponse(prompt);
  if (
    strategyMatch &&
    (strategyMatch === 'brutalist-typography' || strategyMatch === 'data-drama')
  ) {
    scrollStopScore += 10;
  }

  // --- creativeDirectorScore ---
  let creativeDirectorScore = 75;
  for (const blacklistItem of ABSOLUTE_BLACKLIST) {
    if (!lc.includes(blacklistItem.toLowerCase())) {
      creativeDirectorScore += 5;
    }
  }
  creativeDirectorScore = Math.min(creativeDirectorScore, 95);

  // --- antiAiScore ---
  let antiAiScore = 65;
  const hasBlacklistViolation = ABSOLUTE_BLACKLIST.some((item) =>
    lc.includes(item.toLowerCase()),
  );
  if (!hasBlacklistViolation) antiAiScore += 10;
  if (/\bf\/?\d+(\.\d+)?/.test(lc) || lc.includes('aperture') || lc.includes('lens'))
    antiAiScore += 5;
  if (
    lc.includes('lighting') ||
    lc.includes('rim light') ||
    lc.includes('golden hour') ||
    lc.includes('directional light')
  )
    antiAiScore += 5;
  if (lc.includes('texture') || lc.includes('grain') || lc.includes('film grain'))
    antiAiScore += 5;
  if (lc.includes('rtl') || lc.includes('right-to-left')) antiAiScore += 10;

  // --- rtlReadabilityScore ---
  let rtlReadabilityScore = 80;
  if (lc.includes('rtl') || lc.includes('hebrew') || lc.includes('עברית'))
    rtlReadabilityScore += 10;
  if (lc.includes('heebo')) rtlReadabilityScore += 5;

  // --- contrastScore ---
  let contrastScore = 75;
  if (lc.includes('contrast ratio')) contrastScore += 10;
  if (lc.includes('gradient overlay') || lc.includes('gradient')) contrastScore += 5;
  if (lc.includes('readability') || lc.includes('legibility')) contrastScore += 5;

  // --- brandDnaMatchScore ---
  let brandDnaMatchScore = 70;
  if (brandProfile) brandDnaMatchScore += 10;
  if (industry) {
    const ind = industry.toLowerCase();
    const hasAnchor = Object.keys(INDUSTRY_VISUAL_ANCHORS).some((key) =>
      ind.includes(key),
    );
    if (hasAnchor) brandDnaMatchScore += 5;
  }
  if (lc.includes('accent') || lc.includes('accent color')) brandDnaMatchScore += 10;

  return {
    scrollStopScore,
    creativeDirectorScore,
    antiAiScore,
    rtlReadabilityScore,
    contrastScore,
    brandDnaMatchScore,
  };
}

// ---------------------------------------------------------------------------
// Mock Fallback
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic creative direction when the AI provider is
 * unavailable. Uses the same strategy selection and industry anchors so the
 * output structure is identical.
 *
 * תוצאה דטרמיניסטית — ללא קריאה ל-AI
 */
export function generateCreativeDirectionMock(
  input: CreativeDirectorInput,
): CreativeDirectorOutput {
  const strategy = selectBestStrategy(
    input.industry,
    input.campaignType,
    input.brandProfile,
  );

  const strategyObj = VISUAL_STRATEGIES.find((s) => s.id === strategy);
  const strategyName = strategyObj?.name ?? strategy;
  const anchor = resolveIndustryAnchor(input.industry);

  // Build a mock prompt that follows the proven format
  const mockPrompt = [
    `[STRATEGY: ${strategy}]`,
    `A cinematic photograph shot on 35mm at f/2.0,`,
    anchor,
    `featuring bold Hebrew typography (Heebo Black) with the headline "${input.headline}".`,
    `RTL layout — text anchored right, dominant visual left.`,
    `High contrast, film grain texture, directional rim light from top-right.`,
    `Accent color from brand palette highlights the CTA: "${input.cta}".`,
    `--ar 4:5 --style raw`,
  ].join(' ');

  const scores: CreativeDirectorOutput['scores'] = {
    scrollStopScore: 75,
    creativeDirectorScore: 80,
    antiAiScore: 78,
    rtlReadabilityScore: 85,
    contrastScore: 78,
    brandDnaMatchScore: input.brandProfile ? 82 : 72,
  };

  return {
    internalPrompt: mockPrompt,
    selectedStrategy: strategyName,
    visualHook: `${strategyName} — cinematic 35mm composition with dominant Hebrew typography`,
    scrollStopReason:
      'Strong visual contrast and bold typography create an immediate focal point that interrupts the feed',
    industryAnchor: anchor,
    layoutRecommendation: layoutForStrategy(strategy),
    typographyRecommendation: buildTypographyRecommendation(),
    creativeDirectorMetadata: {
      timestamp: new Date().toISOString(),
      model: 'mock',
      isMock: true,
      strategyId: strategy,
      industry: input.industry,
      clientId: input.clientId,
    },
    scores,
  };
}

// ---------------------------------------------------------------------------
// Main Engine
// ---------------------------------------------------------------------------

/**
 * Generate a full creative direction for a design prompt.
 *
 * The function builds a Hebrew brief, selects the best visual strategy, calls
 * the AI model, and returns a structured output with scores. Falls back to a
 * deterministic mock when the AI provider is unavailable.
 *
 * @param input — all the information needed to generate creative direction
 * @returns structured creative direction with prompt, strategy, and scores
 */
export async function generateCreativeDirection(
  input: CreativeDirectorInput,
): Promise<CreativeDirectorOutput> {
  // 1. Extract brand color & text color (defaults if profile is missing)
  const primaryBrandColor =
    input.brandProfile?.primaryColors?.[0]?.hex ?? '#000000';
  const textColor =
    input.brandProfile?.preferredTypography?.textColor ?? '#FFFFFF';

  // 2. Build the Hebrew brief — בניית הבריף בעברית
  const briefParams: BriefBuilderParams = {
    clientName: input.brandProfile?.entityName ?? input.clientId,
    industry: input.industry,
    primaryBrandColor,
    textColor,
    font: input.brandProfile?.preferredTypography?.fontFamily,
    format: input.format,
    headline: input.headline,
    subHeadline: input.subHeadline,
    bullets: input.bullets,
    authorityLine: input.authorityLine,
    cta: input.cta,
    additionalContext: input.additionalContext,
  };

  let brief = buildCreativeDirectorBrief(briefParams);

  // 3. Determine the best visual strategy — בחירת אסטרטגיה ויזואלית
  const selectedStrategyId = selectBestStrategy(
    input.industry,
    input.campaignType,
    input.brandProfile,
  );
  const strategyObj = VISUAL_STRATEGIES.find((s) => s.id === selectedStrategyId);
  const strategyName = strategyObj?.name ?? selectedStrategyId;

  // 4. Append strategy hint to the brief — הוספת רמז אסטרטגי לבריף
  brief += `\n\nאסטרטגיה מומלצת: ${strategyName}`;

  // 5. Call AI — קריאה למודל
  const aiResult = await generateWithAI(CREATIVE_DIRECTOR_SYSTEM_PROMPT, brief, {
    temperature: 0.8,
    maxTokens: 2000,
  });

  // 6. Fallback on AI failure — נפילה לתוצאה דטרמיניסטית
  if (!aiResult.success || !aiResult.data) {
    return generateCreativeDirectionMock(input);
  }

  // 7. Parse the AI response
  const rawResponse =
    typeof aiResult.data === 'string' ? aiResult.data : String(aiResult.data);

  const extractedStrategy =
    extractStrategyFromResponse(rawResponse) ?? strategyName;

  const visualHook = extractVisualHook(rawResponse, selectedStrategyId);

  const scrollStopReason = rawResponse.toLowerCase().includes('scroll')
    ? 'AI-directed composition engineered to break scroll patterns through visual tension and typographic dominance'
    : 'Bold visual hierarchy with strong contrast creates an unavoidable focal point in the feed';

  const industryAnchor = resolveIndustryAnchor(input.industry);

  const layoutRecommendation = layoutForStrategy(selectedStrategyId);

  const typographyRecommendation = buildTypographyRecommendation();

  // 8. Calculate scores — חישוב ציונים דטרמיניסטי
  const scores = calculateScores(rawResponse, input.brandProfile, input.industry);

  // 9. Return structured output
  return {
    internalPrompt: rawResponse,
    selectedStrategy: extractedStrategy,
    visualHook,
    scrollStopReason,
    industryAnchor,
    layoutRecommendation,
    typographyRecommendation,
    creativeDirectorMetadata: {
      timestamp: new Date().toISOString(),
      model: 'openai',
      isMock: false,
      strategyId: selectedStrategyId,
      strategyName: extractedStrategy,
      industry: input.industry,
      clientId: input.clientId,
      platform: input.platform,
      format: input.format,
      designType: input.designType,
      hasBrandProfile: !!input.brandProfile,
    },
    scores,
  };
}
