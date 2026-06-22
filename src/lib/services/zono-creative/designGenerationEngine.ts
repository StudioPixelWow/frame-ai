/**
 * Design Generation Engine — Main orchestrator for the PIXEL Design System
 *
 * Generates complete design sets with multiple variants. AI decides
 * structure/composition/messaging, the system renders results as HTML previews.
 *
 * Flow:
 *  1. Load concept (if conceptId provided)
 *  2. Load brand profile for entity
 *  3. Load brand assets for entity
 *  4. Build AI prompt — ask GPT-4.1 for 4-8 design structure decisions
 *  5. Parse AI response into structured layout decisions
 *  6. For each variant: assemble design using layout templates + components
 *  7. Apply style enforcement from brand DNA
 *  8. Score each variant
 *  9. Generate HTML preview for each variant
 * 10. Save DesignSet to DB
 * 11. Save each DesignVariant to DB
 * 12. Return result
 *
 * Server-side only.
 */
import {
  brandStyleProfiles,
  brandAssets,
  creativeConcepts,
  designSets,
  designVariants,
} from '@/lib/db/collections';
import type {
  DesignSet,
  DesignVariant,
  DesignJSON,
  DesignCanvas,
  DesignElement,
  DesignLayoutType,
  DesignOutputType,
  DesignScore,
  BrandStyleProfile,
  BrandAsset,
  CreativeConcept,
} from '@/lib/db/schema';
import { generateWithAI } from '@/lib/ai/openai-client';
import {
  OUTPUT_TYPE_CONFIGS,
  LAYOUT_TYPE_LABELS,
  DEFAULT_PALETTES,
  DEFAULT_BACKGROUND_COLOR,
  DESIGN_JSON_VERSION,
} from './designSchema';
import { getLayoutTemplate, getLayoutsForOutputType, assembleDesign } from './layoutGenerationService';
import { enforceStyle } from './styleEnforcer';
import { scoreDesign } from './designScoringService';
import { renderDesignToHtml } from './designPreviewRenderer';
import { extractStringArray, extractRecordString } from './realEstateCreativeConceptEngine';
import { generateCreativeDirection, selectBestStrategy } from './pixelCreativeDirectorEngine';

/* ── Interfaces ──────────────────────────────────────────────────────── */

export interface GenerateDesignSetsParams {
  entityType: string;
  entityId: string;
  entityName: string;
  conceptId: string | null;
  designType: DesignOutputType;
}

export interface GenerateDesignSetsResult {
  success: boolean;
  designSet?: DesignSet;
  variants?: DesignVariant[];
  variantCount: number;
  error?: string;
}

/** Raw AI response shape for a single design variant decision */
interface RawDesignDecision {
  layout_type: string;
  headline: string;
  subtitle: string;
  cta_text: string;
  visual_description: string;
  color_mood: string;
  target_audience: string;
  badge_text?: string;
  features?: string[];
  price?: string;
  offer_description?: string;
  variant_name?: string;
}

/* ── Mock Detection ──────────────────────────────────────────────────── */

function isMockMode(): boolean {
  const provider = process.env.ZONO_MARKETING_ANALYSIS_PROVIDER;
  if (provider === 'mock') return true;
  // Also mock if no OpenAI key
  const apiKey = process.env.OPENAI_API_KEY;
  return !apiKey || apiKey.length < 10;
}

/* ── Data Loading ────────────────────────────────────────────────────── */

async function loadConcept(conceptId: string): Promise<CreativeConcept | null> {
  try {
    return await creativeConcepts.getByIdAsync(conceptId);
  } catch (err) {
    console.error(`[DesignEngine] Failed to load concept ${conceptId}:`, err);
    return null;
  }
}

async function loadBrandProfile(entityId: string): Promise<BrandStyleProfile | null> {
  try {
    const profiles = await brandStyleProfiles.queryAsync(
      (p: BrandStyleProfile) => p.entityId === entityId && p.profileStatus === 'active'
    );
    if (profiles.length > 0) return profiles[0];
    // Fallback: any profile for this entity
    const allProfiles = await brandStyleProfiles.queryAsync(
      (p: BrandStyleProfile) => p.entityId === entityId
    );
    return allProfiles.length > 0 ? allProfiles[0] : null;
  } catch (err) {
    console.error(`[DesignEngine] Failed to load brand profile for entity ${entityId}:`, err);
    return null;
  }
}

async function loadBrandAssets(entityId: string): Promise<BrandAsset[]> {
  try {
    const assets = await brandAssets.queryAsync(
      (a: BrandAsset) => (a as any).entityId === entityId || a.clientId === entityId
    );
    return assets;
  } catch (err) {
    console.error(`[DesignEngine] Failed to load brand assets for entity ${entityId}:`, err);
    return [];
  }
}

/* ── AI Prompt Builder ───────────────────────────────────────────────── */

function buildDesignSystemPrompt(): string {
  const layoutOptions = Object.entries(LAYOUT_TYPE_LABELS)
    .map(([key, label]) => `"${key}" (${label})`)
    .join(', ');

  return `אתה מעצב גרפי מומחה לנדל"ן ושיווק דיגיטלי בישראל.
תפקידך — לייצר 4-8 גרסאות עיצוב שונות לקריאייטיב שיווקי.

כל גרסה צריכה לכלול:
- layout_type: אחד מהבאים — ${layoutOptions}
- headline: כותרת ראשית (עברית, קצרה וחזקה, עד 8 מילים)
- subtitle: כותרת משנה (עברית, תומכת בכותרת)
- cta_text: טקסט כפתור פעולה (עברית, עד 4 מילים)
- visual_description: תיאור הוויזואל המומלץ (בעברית)
- color_mood: מצב רוח של הצבעים (למשל: "חם יוקרתי", "מודרני קליל", "כהה דרמטי")
- target_audience: קהל יעד (בעברית)
- badge_text: טקסט תג/סטיקר אופציונלי (עד 3 מילים)
- features: רשימת 3-5 יתרונות (מערך מחרוזות בעברית)
- price: מחיר לתצוגה (אופציונלי)
- offer_description: תיאור הצעה (אופציונלי)
- variant_name: שם ייחודי לגרסה בעברית

חשוב:
- כל גרסה חייבת להיות שונה מהותית — לא רק שינוי טקסט
- גיוון בין layout types שונים
- כותרות חזקות שמושכות תשומת לב
- CTA ברור שמעודד פעולה
- התאם לקהל יעד ישראלי

החזר JSON בפורמט:
{ "variants": [ { layout_type, headline, subtitle, cta_text, visual_description, color_mood, target_audience, badge_text, features, price, offer_description, variant_name } ] }`;
}

function buildDesignUserPrompt(
  params: GenerateDesignSetsParams,
  profile: BrandStyleProfile | null,
  concept: CreativeConcept | null,
  assets: BrandAsset[]
): string {
  const outputConfig = OUTPUT_TYPE_CONFIGS[params.designType];
  const lines: string[] = [];

  lines.push(`סוג פלט: ${outputConfig.labelHe} (${outputConfig.width}x${outputConfig.height})`);
  lines.push(`סוג ישות: ${params.entityType}`);
  lines.push(`שם ישות: ${params.entityName}`);

  if (concept) {
    lines.push('');
    lines.push('── קונספט שיווקי ──');
    lines.push(`כותרת: ${concept.title}`);
    lines.push(`תיאור: ${concept.description}`);
    lines.push(`זווית שיווקית: ${concept.marketingAngle}`);
    lines.push(`טריגר רגשי: ${concept.emotionalTrigger}`);
    lines.push(`הוק ויזואלי: ${concept.visualHook}`);
    lines.push(`הוק קופי: ${concept.copyHook}`);
    if (concept.recommendedLayout) lines.push(`פריסה מומלצת: ${concept.recommendedLayout}`);
    if (concept.recommendedCtaStyle) lines.push(`סגנון CTA מומלץ: ${concept.recommendedCtaStyle}`);
    if (concept.recommendedAudience) lines.push(`קהל מומלץ: ${concept.recommendedAudience}`);
  }

  if (profile) {
    lines.push('');
    lines.push('── DNA מותגי ──');
    if (profile.brandSummary) lines.push(`סיכום מותג: ${profile.brandSummary}`);
    if (profile.visualPersonality) lines.push(`אישיות ויזואלית: ${profile.visualPersonality}`);
    if (profile.copywritingTone) lines.push(`טון קופי: ${profile.copywritingTone}`);
    if (profile.realEstatePositioning) lines.push(`מיצוב נדל"ני: ${profile.realEstatePositioning}`);

    const colors = extractStringArray(profile.primaryColors);
    if (colors.length > 0) lines.push(`צבעים ראשיים: ${colors.join(', ')}`);
    const audiences = extractStringArray(profile.targetAudiences);
    if (audiences.length > 0) lines.push(`קהלי יעד: ${audiences.join(', ')}`);
    const angles = extractStringArray(profile.preferredCampaignAngles);
    if (angles.length > 0) lines.push(`זוויות מועדפות: ${angles.join(', ')}`);
    const rejectedAngles = extractStringArray(profile.rejectedCampaignAngles);
    if (rejectedAngles.length > 0) lines.push(`זוויות שנדחו: ${rejectedAngles.join(', ')}`);
    const preferredLayouts = extractStringArray(profile.preferredLayouts);
    if (preferredLayouts.length > 0) lines.push(`פריסות מועדפות: ${preferredLayouts.join(', ')}`);

    // Scores
    const scores: string[] = [];
    if (profile.luxuryScore) scores.push(`יוקרה: ${profile.luxuryScore}`);
    if (profile.modernScore) scores.push(`מודרניות: ${profile.modernScore}`);
    if (profile.salesAggressivenessScore) scores.push(`אגרסיביות מכירתית: ${profile.salesAggressivenessScore}`);
    if (profile.urgencyScore) scores.push(`דחיפות: ${profile.urgencyScore}`);
    if (profile.visualDensityScore) scores.push(`צפיפות ויזואלית: ${profile.visualDensityScore}`);
    if (scores.length > 0) lines.push(`ציוני DNA: ${scores.join(', ')}`);
  }

  if (assets.length > 0) {
    lines.push('');
    lines.push(`── נכסי מותג (${assets.length} נכסים) ──`);
    const logos = assets.filter((a) => a.assetType === 'logo');
    if (logos.length > 0) lines.push(`לוגואים: ${logos.length}`);
    const photos = assets.filter((a) => a.assetType === 'photo' || a.assetType === 'property_photo' || a.assetType === 'project_render');
    if (photos.length > 0) lines.push(`תמונות: ${photos.length}`);
  }

  lines.push('');
  lines.push('צור 4-8 גרסאות עיצוב מגוונות. כל גרסה עם layout_type שונה ככל האפשר.');

  return lines.join('\n');
}

/* ── AI Response Parser ──────────────────────────────────────────────── */

const VALID_LAYOUT_TYPES = new Set(Object.keys(LAYOUT_TYPE_LABELS));

function isValidLayoutType(type: string): type is DesignLayoutType {
  return VALID_LAYOUT_TYPES.has(type);
}

function parseDesignDecisions(data: unknown): RawDesignDecision[] {
  let parsed: any = data;

  // If data is a string, try to parse as JSON
  if (typeof parsed === 'string') {
    let cleaned = parsed.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    parsed = JSON.parse(cleaned);
  }

  // Extract variants array
  let variants: any[];
  if (Array.isArray(parsed)) {
    variants = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.variants)) {
    variants = parsed.variants;
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.designs)) {
    variants = parsed.designs;
  } else {
    throw new Error('תגובת AI לא מכילה מערך גרסאות');
  }

  // Validate and filter
  return variants
    .filter((v: any) => v && typeof v === 'object' && v.headline && v.layout_type)
    .map((v: any) => ({
      layout_type: v.layout_type,
      headline: v.headline || '',
      subtitle: v.subtitle || '',
      cta_text: v.cta_text || 'צור קשר',
      visual_description: v.visual_description || '',
      color_mood: v.color_mood || '',
      target_audience: v.target_audience || '',
      badge_text: v.badge_text || undefined,
      features: Array.isArray(v.features) ? v.features : undefined,
      price: v.price || undefined,
      offer_description: v.offer_description || undefined,
      variant_name: v.variant_name || `גרסה ${Math.random().toString(36).slice(2, 6)}`,
    }));
}

/* ── Design Assembly ─────────────────────────────────────────────────── */

function buildCanvas(
  designType: DesignOutputType,
  colorMood: string
): DesignCanvas {
  const config = OUTPUT_TYPE_CONFIGS[designType];
  // Pick background color from mood
  let bgColor = DEFAULT_BACKGROUND_COLOR;
  const moodLower = (colorMood || '').toLowerCase();
  if (moodLower.includes('כהה') || moodLower.includes('דרמטי') || moodLower.includes('dark')) {
    bgColor = '#1A1A2E';
  } else if (moodLower.includes('יוקר') || moodLower.includes('luxury') || moodLower.includes('זהב')) {
    bgColor = '#1C1C1E';
  } else if (moodLower.includes('חם') || moodLower.includes('warm')) {
    bgColor = '#2D3436';
  }

  return {
    width: config.width,
    height: config.height,
    backgroundColor: bgColor,
  };
}

function buildContentMap(
  decision: RawDesignDecision,
  assets: BrandAsset[]
): Record<string, any> {
  // Find logo from assets
  const logo = assets.find((a) => a.assetType === 'logo');
  // Find hero image from assets
  const heroImage = assets.find(
    (a) => a.assetType === 'photo' || a.assetType === 'property_photo' || a.assetType === 'project_render'
  );

  return {
    headline: decision.headline,
    subtitle: decision.subtitle,
    ctaText: decision.cta_text,
    heroImage: heroImage?.fileUrl || heroImage?.thumbnailUrl || '',
    logoUrl: logo?.fileUrl || logo?.thumbnailUrl || '',
    badgeText: decision.badge_text || undefined,
    features: decision.features || undefined,
    price: decision.price || undefined,
    offerDescription: decision.offer_description || undefined,
    bodyText: decision.visual_description || undefined,
    // Fallback colors for shapes
    shapeBgColor: 'rgba(0,0,0,0.85)',
    shapeAccentColor: 'rgba(233,69,96,0.15)',
  };
}

function assembleVariantDesign(
  decision: RawDesignDecision,
  designType: DesignOutputType,
  assets: BrandAsset[],
  conceptId: string | null,
  entityType: string,
  entityId: string
): DesignJSON {
  const layoutType: DesignLayoutType = isValidLayoutType(decision.layout_type)
    ? decision.layout_type
    : 'editorial';

  const canvas = buildCanvas(designType, decision.color_mood);
  const template = getLayoutTemplate(layoutType);
  const content = buildContentMap(decision, assets);
  const elements = assembleDesign(template, canvas, content);

  return {
    version: DESIGN_JSON_VERSION,
    canvas,
    elements,
    metadata: {
      layoutType,
      designType,
      brandDNAApplied: false,
      generatedBy: 'design-generation-engine',
      conceptId: conceptId || undefined,
      entityType,
      entityId,
    },
  };
}

/* ── Mock Variant Generator ──────────────────────────────────────────── */

function generateMockDecisions(
  params: GenerateDesignSetsParams,
  profile: BrandStyleProfile | null,
  concept: CreativeConcept | null
): RawDesignDecision[] {
  const entityName = params.entityName || 'נכס לדוגמה';
  const isProperty = params.entityType === 'property';
  const isProject = params.entityType === 'project';
  const isAgent = params.entityType === 'agent';

  // Build 4 deterministic mock variants with different layouts
  const mocks: RawDesignDecision[] = [
    {
      layout_type: 'luxury',
      headline: isAgent ? `${entityName} — מומחיות ללא פשרות` : `${entityName} — חיים של יוקרה`,
      subtitle: isAgent
        ? 'ניסיון. מקצועיות. תוצאות.'
        : 'גלו את הפרויקט שישנה את חייכם',
      cta_text: isAgent ? 'קבעו פגישה' : 'לפרטים נוספים',
      visual_description: 'תמונה מרשימה של הנכס בתאורת ערב יוקרתית',
      color_mood: 'כהה יוקרתי עם נגיעות זהב',
      target_audience: 'משפחות מבוססות, קהל פרימיום',
      badge_text: 'בלעדי',
      features: ['עיצוב אדריכלי', 'נוף פנורמי', 'חניה כפולה', 'מרפסת שמש'],
      variant_name: 'יוקרה קלאסית',
    },
    {
      layout_type: 'sales',
      headline: isProject
        ? `הזדמנות אחרונה — ${entityName}`
        : isProperty
        ? `מחיר מיוחד — ${entityName}`
        : `אל תפספסו — ${entityName}`,
      subtitle: 'מחירי השקה לזמן מוגבל בלבד',
      cta_text: 'לרכישה עכשיו',
      visual_description: 'קומפוזיציה מכירתית עם דגש על מחיר ודחיפות',
      color_mood: 'חם ואנרגטי',
      target_audience: 'משקיעים, רוכשי דירה ראשונה',
      badge_text: 'מבצע!',
      features: ['מימון מלא', 'ללא מס רכישה', 'תשואה גבוהה', 'מיקום מרכזי', 'מפרט יוקרתי'],
      price: isProperty ? '2,450,000' : undefined,
      offer_description: 'מחירי השקה — עד 15% הנחה',
      variant_name: 'מכירתי אגרסיבי',
    },
    {
      layout_type: 'hero_image',
      headline: isAgent
        ? `${entityName} — הסוכן שלכם`
        : `ברוכים הבאים ל${entityName}`,
      subtitle: 'מקום שבו חלומות הופכים למציאות',
      cta_text: 'גלו עוד',
      visual_description: 'תמונת גיבור מלאה עם שכבת טקסט אלגנטית',
      color_mood: 'מודרני קליל',
      target_audience: 'זוגות צעירים, משפחות',
      variant_name: 'תמונה דומיננטית',
    },
    {
      layout_type: 'real_estate_premium',
      headline: isProject
        ? `פרויקט ${entityName} — מגורים ברמה אחרת`
        : `${entityName} — הבית הבא שלכם`,
      subtitle: 'דירות מעוצבות במיקום מושלם',
      cta_text: 'תאמו סיור',
      visual_description: 'תצוגת נכס עם פרטי מחיר וסוכן',
      color_mood: 'מקצועי ונקי',
      target_audience: 'קהל רחב',
      badge_text: 'חדש!',
      features: ['3-5 חדרים', 'מרפסת גדולה', 'חניה', 'מחסן'],
      price: isProperty ? '1,890,000' : undefined,
      variant_name: 'נדל"ן פרימיום',
    },
  ];

  // If concept exists, adapt the first mock to it
  if (concept) {
    mocks[0].headline = concept.copyHook || mocks[0].headline;
    mocks[0].target_audience = concept.recommendedAudience || mocks[0].target_audience;
    if (concept.recommendedLayout && isValidLayoutType(concept.recommendedLayout)) {
      mocks[0].layout_type = concept.recommendedLayout;
    }
  }

  return mocks;
}

/* ── DB Persistence ──────────────────────────────────────────────────── */

async function saveDesignSet(
  params: GenerateDesignSetsParams,
  profile: BrandStyleProfile | null,
  layoutType: DesignLayoutType,
  variantCount: number,
  provider: 'openai' | 'mock',
  cdData?: any
): Promise<DesignSet> {
  const now = new Date().toISOString();

  const setData: Omit<DesignSet, 'id'> = {
    clientId: params.entityId,
    entityType: params.entityType,
    entityId: params.entityId,
    brandProfileId: profile?.id || null,
    conceptId: params.conceptId,
    conceptTitle: '',
    title: `סט עיצובים — ${params.entityName}`,
    description: `${variantCount} גרסאות עיצוב שנוצרו אוטומטית`,
    status: 'ready',
    designType: params.designType,
    layoutType,
    thumbnailUrl: null,
    totalVariants: variantCount,
    createdBy: 'design-engine',
    generationMetadata: {
      provider,
      generatedAt: now,
      entityName: params.entityName,
      designType: params.designType,
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
      creativeDirectorScore: cdData.scores?.overall ?? 0,
      scrollStopScore: cdData.scores?.scrollStop ?? 0,
      antiAiScore: cdData.scores?.antiAiLook ?? 0,
      rtlReadabilityScore: cdData.scores?.rtlReadability ?? 0,
      contrastScore: cdData.scores?.contrastClarity ?? 0,
      brandDnaMatchScore: cdData.scores?.brandDnaMatch ?? 0,
    } : {}),
    createdAt: now,
    updatedAt: now,
  };

  return await designSets.createAsync(setData as DesignSet);
}

async function saveDesignVariant(
  designSetId: string,
  variantIndex: number,
  variantName: string,
  design: DesignJSON,
  previewHtml: string,
  scores: DesignScore,
  layoutType: DesignLayoutType
): Promise<DesignVariant> {
  const now = new Date().toISOString();
  const config = OUTPUT_TYPE_CONFIGS[design.metadata.designType];

  const variantData: Omit<DesignVariant, 'id'> = {
    designSetId,
    variantName,
    variantIndex,
    designJson: design,
    previewHtml,
    width: config.width,
    height: config.height,
    layoutType,
    scores,
    isFavorite: false,
    isApproved: false,
    isRejected: false,
    approvalNotes: '',
    createdAt: now,
    updatedAt: now,
  };

  return await designVariants.createAsync(variantData as DesignVariant);
}

/* ── Main Engine ─────────────────────────────────────────────────────── */

/**
 * Generate a complete design set with multiple variants.
 *
 * Orchestrates the full pipeline: AI generation, layout assembly,
 * style enforcement, scoring, preview rendering, and DB persistence.
 */
export async function generateDesignSets(
  params: GenerateDesignSetsParams
): Promise<GenerateDesignSetsResult> {
  console.log(`[DesignEngine] Starting design generation for entity "${params.entityName}" (${params.entityType})`);
  console.log(`[DesignEngine] Output type: ${params.designType}, Concept: ${params.conceptId || 'none'}`);

  try {
    // ── 1. Load concept (if provided) ──
    let concept: CreativeConcept | null = null;
    if (params.conceptId) {
      concept = await loadConcept(params.conceptId);
      if (concept) {
        console.log(`[DesignEngine] Loaded concept: "${concept.title}"`);
      }
    }

    // ── 2. Load brand profile ──
    const profile = await loadBrandProfile(params.entityId);
    if (profile) {
      console.log(`[DesignEngine] Loaded brand profile: ${profile.id} (status: ${profile.profileStatus})`);
    } else {
      console.log('[DesignEngine] No brand profile found — using defaults');
    }

    // ── 3. Load brand assets ──
    const assets = await loadBrandAssets(params.entityId);
    console.log(`[DesignEngine] Loaded ${assets.length} brand assets`);

    // ── 4+5. Get design decisions (AI or mock) ──
    let decisions: RawDesignDecision[];
    let provider: 'openai' | 'mock';

    if (isMockMode()) {
      console.log('[DesignEngine] Using mock mode');
      decisions = generateMockDecisions(params, profile, concept);
      provider = 'mock';
    } else {
      console.log('[DesignEngine] Calling AI for design decisions...');
      const systemPrompt = buildDesignSystemPrompt();
      const userPrompt = buildDesignUserPrompt(params, profile, concept, assets);

      const aiResult = await generateWithAI(systemPrompt, userPrompt, {
        temperature: 0.8,
        maxTokens: 4000,
      });

      if (!aiResult.success || !aiResult.data) {
        console.error(`[DesignEngine] AI call failed: ${aiResult.error}`);
        // Fallback to mock on AI failure
        console.log('[DesignEngine] Falling back to mock mode');
        decisions = generateMockDecisions(params, profile, concept);
        provider = 'mock';
      } else {
        try {
          decisions = parseDesignDecisions(aiResult.data);
          provider = 'openai';
          console.log(`[DesignEngine] Parsed ${decisions.length} design decisions from AI`);
        } catch (parseErr) {
          console.error('[DesignEngine] Failed to parse AI response:', parseErr);
          decisions = generateMockDecisions(params, profile, concept);
          provider = 'mock';
        }
      }
    }

    if (decisions.length === 0) {
      return { success: false, variantCount: 0, error: 'לא נוצרו גרסאות עיצוב' };
    }

    // Limit to 8 variants max
    if (decisions.length > 8) {
      decisions = decisions.slice(0, 8);
    }

    // ── 6-9. Assemble, enforce, score, and render each variant ──
    const assembledVariants: Array<{
      design: DesignJSON;
      previewHtml: string;
      scores: DesignScore;
      layoutType: DesignLayoutType;
      variantName: string;
    }> = [];

    for (let i = 0; i < decisions.length; i++) {
      const decision = decisions[i];

      // 6. Assemble design
      let design = assembleVariantDesign(
        decision,
        params.designType,
        assets,
        params.conceptId,
        params.entityType,
        params.entityId
      );

      const layoutType = design.metadata.layoutType;

      // 7. Apply style enforcement
      if (profile) {
        design = enforceStyle(design, profile);
      }

      // 8. Score
      const scores = scoreDesign(design, profile);

      // 9. Generate HTML preview
      const previewHtml = renderDesignToHtml(design);

      assembledVariants.push({
        design,
        previewHtml,
        scores,
        layoutType,
        variantName: decision.variant_name || `גרסה ${i + 1}`,
      });

      console.log(
        `[DesignEngine] Variant ${i + 1}/${decisions.length}: "${decision.variant_name}" (${layoutType}) — overall score: ${scores.overall}`
      );
    }

    // ── 10. Creative Director Enrichment ──
    let cdData: any = null;
    try {
      const cdInput = {
        clientName: params.entityName || '',
        industry: profile?.realEstatePositioning || params.entityType || '',
        campaignGoal: concept?.marketingAngle || 'brand_awareness',
        targetAudience: concept?.recommendedAudience || '',
        copyText: concept?.copyHook || '',
        brandProfile: profile || undefined,
      };
      const cdResult = await generateCreativeDirection(cdInput);
      if (cdResult && cdResult.success) {
        cdData = cdResult;
        console.log(`[DesignEngine] Creative Director enrichment applied — strategy: "${cdData.strategy}", score: ${cdData.scores?.overall ?? 'N/A'}`);
      }
    } catch (cdError) {
      console.warn('[DesignEngine] Creative Director enrichment failed (non-blocking):', cdError);
    }

    // ── 11. Save DesignSet ──
    const primaryLayout = assembledVariants[0].layoutType;
    const savedSet = await saveDesignSet(
      params,
      profile,
      primaryLayout,
      assembledVariants.length,
      provider,
      cdData
    );
    console.log(`[DesignEngine] Saved design set: ${savedSet.id}`);

    // ── 12. Save each DesignVariant ──
    const savedVariants: DesignVariant[] = [];
    for (let i = 0; i < assembledVariants.length; i++) {
      const v = assembledVariants[i];
      const saved = await saveDesignVariant(
        savedSet.id,
        i,
        v.variantName,
        v.design,
        v.previewHtml,
        v.scores,
        v.layoutType
      );
      savedVariants.push(saved);
      console.log(`[DesignEngine] Saved variant: ${saved.id} (${v.variantName})`);
    }

    // ── 13. Return result ──
    console.log(`[DesignEngine] Generation complete — ${savedVariants.length} variants created`);

    return {
      success: true,
      designSet: savedSet,
      variants: savedVariants,
      variantCount: savedVariants.length,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[DesignEngine] Fatal error:`, err);
    return {
      success: false,
      variantCount: 0,
      error: `שגיאה ביצירת עיצובים: ${errMsg}`,
    };
  }
}
