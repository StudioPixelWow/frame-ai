/**
 * Mock Marketing DNA Provider
 *
 * Generates a reasonable low-confidence Marketing DNA result using only
 * asset metadata (tags, descriptions, types, approval status). Used when
 * no Vision AI API key is configured, or as the default fallback.
 *
 * Never crashes — always returns a valid MarketingDNAResult.
 * All scores default to 50 (neutral) unless metadata suggests otherwise.
 * ai_confidence_score is set to 15-25 (low) since no images are analyzed.
 *
 * Server-side only.
 */

import type { BrandAsset, MarketingDNAResult } from '@/lib/db/schema';
import type {
  MarketingDNAProvider,
  MarketingDNAProviderParams,
} from './aiMarketingDNAProvider';
import { ENTITY_TYPE_LABELS } from './aiMarketingDNAProvider';

/* ── Color Detection ───────────────────────────────────────────────────── */

/** Common color keywords to detect in Hebrew and English tags/descriptions */
const COLOR_KEYWORDS: Record<string, string> = {
  // Hebrew
  'שחור': '#000000',
  'לבן': '#FFFFFF',
  'אדום': '#E53935',
  'כחול': '#1E88E5',
  'ירוק': '#43A047',
  'צהוב': '#FDD835',
  'כתום': '#FB8C00',
  'סגול': '#8E24AA',
  'ורוד': '#D81B60',
  'זהב': '#FFD700',
  'כסף': '#C0C0C0',
  'אפור': '#9E9E9E',
  'חום': '#795548',
  'תכלת': '#29B6F6',
  'בז\'': '#F5F5DC',
  'קרם': '#FFFDD0',
  'נייבי': '#1A237E',
  'בורדו': '#800020',
  'טורקיז': '#00BCD4',
  // English
  'black': '#000000',
  'white': '#FFFFFF',
  'red': '#E53935',
  'blue': '#1E88E5',
  'green': '#43A047',
  'yellow': '#FDD835',
  'orange': '#FB8C00',
  'purple': '#8E24AA',
  'pink': '#D81B60',
  'gold': '#FFD700',
  'silver': '#C0C0C0',
  'gray': '#9E9E9E',
  'grey': '#9E9E9E',
  'navy': '#1A237E',
  'burgundy': '#800020',
  'teal': '#00BCD4',
  'beige': '#F5F5DC',
  'cream': '#FFFDD0',
};

/** Style keyword signals for scoring adjustments */
const STYLE_SIGNALS = {
  luxury: ['יוקרה', 'פרימיום', 'luxury', 'premium', 'exclusive', 'אקסקלוסיבי', 'בוטיק', 'boutique', 'זהב', 'gold'],
  modern: ['מודרני', 'modern', 'עכשווי', 'contemporary', 'מינימליסטי', 'minimalist', 'נקי', 'clean'],
  aggressive: ['מבצע', 'sale', 'הנחה', 'discount', 'אחרון', 'last', 'מהיום', 'today', 'עכשיו', 'now', 'דחוף', 'urgent'],
  dense: ['עמוס', 'busy', 'full', 'מלא', 'עשיר', 'rich', 'מורכב', 'complex'],
  minimal: ['מינימלי', 'minimal', 'נקי', 'clean', 'פשוט', 'simple', 'ריק', 'empty', 'spacious'],
  investment: ['השקעה', 'investment', 'תשואה', 'roi', 'yield', 'עליית ערך', 'appreciation'],
  lifestyle: ['חיים', 'lifestyle', 'משפחה', 'family', 'איכות חיים', 'quality of life'],
} as const;

/* ── Provider Implementation ───────────────────────────────────────────── */

async function analyze(params: MarketingDNAProviderParams): Promise<MarketingDNAResult> {
  const { assets, entityType, entityName, approvedAssets, rejectedAssets } = params;

  try {
    // ── Collect all text signals from metadata ────────────────────────
    const allText = collectAllText(assets);
    const approvedText = collectAllText(approvedAssets);
    const rejectedText = collectAllText(rejectedAssets);

    // ── Detect colors ─────────────────────────────────────────────────
    const detectedColors = detectColors(allText);
    const approvedColors = detectColors(approvedText);

    // ── Detect style signals for scoring ──────────────────────────────
    const scores = detectScores(allText, approvedText, rejectedText);

    // ── Extract patterns from approved vs rejected ────────────────────
    const approvedTags = extractTags(approvedAssets);
    const rejectedTags = extractTags(rejectedAssets);

    // ── Determine asset type distribution ─────────────────────────────
    const typeDistribution = assets.reduce<Record<string, number>>((acc, a) => {
      acc[a.assetType] = (acc[a.assetType] ?? 0) + 1;
      return acc;
    }, {});

    // ── Build entity-aware context ────────────────────────────────────
    const entityLabel = ENTITY_TYPE_LABELS[entityType] || entityType;

    // ── Compute confidence ────────────────────────────────────────────
    // Low confidence: 15-25 since we only read metadata, no image analysis
    const hasApproved = approvedAssets.length > 0;
    const hasRejected = rejectedAssets.length > 0;
    const hasTags = approvedTags.length > 0 || rejectedTags.length > 0;
    const confidence = 15 + (hasApproved ? 4 : 0) + (hasRejected ? 3 : 0) + (hasTags ? 3 : 0);

    const result: MarketingDNAResult = {
      dna_summary: buildMockSummary(entityLabel, entityName, assets.length, approvedAssets.length, rejectedAssets.length),
      visual_personality: assets.length > 0
        ? `פרופיל ראשוני מבוסס מטא-דאטה של ${assets.length} נכסים (ללא ניתוח תמונה)`
        : 'אין נכסים זמינים לניתוח',
      copywriting_tone: hasTags
        ? `טון כתיבה משוער על סמך תגיות: ${approvedTags.slice(0, 3).join(', ') || 'לא זוהה'}`
        : 'נדרש ניתוח מעמיק יותר לקביעת טון כתיבה',
      real_estate_positioning: `${entityLabel} — ${entityName}. מיצוב ראשוני מבוסס מטא-דאטה בלבד.`,

      primary_colors: approvedColors.slice(0, 3),
      secondary_colors: detectedColors.filter((c) => !approvedColors.includes(c)).slice(0, 3),
      accent_colors: [],
      forbidden_colors: [],

      preferred_typography: {},
      forbidden_typography: {},

      preferred_layouts: [],
      rejected_layouts: [],
      preferred_visual_styles: approvedTags.slice(0, 5),
      rejected_visual_styles: rejectedTags.slice(0, 5),
      preferred_image_styles: [],
      rejected_image_styles: [],
      preferred_campaign_angles: [],
      rejected_campaign_angles: [],
      preferred_cta_styles: [],
      whatsapp_cta_style: {},

      target_audiences: [],

      property_marketing_style: entityType === 'property' ? { note: 'דרוש ניתוח ויזואלי מעמיק' } : {},
      project_marketing_style: entityType === 'project' ? { note: 'דרוש ניתוח ויזואלי מעמיק' } : {},
      agent_marketing_style: entityType === 'agent' ? { note: 'דרוש ניתוח ויזואלי מעמיק' } : {},
      seller_recruitment_style: entityType === 'seller_recruitment' ? { note: 'דרוש ניתוח ויזואלי מעמיק' } : {},
      buyer_recruitment_style: entityType === 'buyer_recruitment' ? { note: 'דרוש ניתוח ויזואלי מעמיק' } : {},
      neighborhood_storytelling_style: entityType === 'neighborhood_authority' ? { note: 'דרוש ניתוח ויזואלי מעמיק' } : {},

      brand_rules: approvedTags.length > 0
        ? [`תגיות מועדפות: ${approvedTags.slice(0, 5).join(', ')}`]
        : [],
      avoid_rules: rejectedTags.length > 0
        ? [`תגיות שנדחו: ${rejectedTags.slice(0, 5).join(', ')}`]
        : [],
      approved_patterns: approvedTags.slice(0, 10),
      rejected_patterns: rejectedTags.slice(0, 10),

      luxury_score: scores.luxury,
      urgency_score: scores.aggressive,
      modern_score: scores.modern,
      sales_aggressiveness_score: scores.aggressive,
      investment_focus_score: scores.investment,
      lifestyle_focus_score: scores.lifestyle,
      seller_focus_score: entityType === 'seller_recruitment' ? 65 : 50,
      buyer_focus_score: entityType === 'buyer_recruitment' ? 65 : 50,
      visual_density_score: scores.dense,
      ai_generated_score: 50,
      ai_confidence_score: Math.min(25, confidence),
    };

    console.log(
      `[MockDNA] Generated mock DNA for entity=${params.entityId} type=${entityType} ` +
      `assets=${assets.length} confidence=${result.ai_confidence_score}`,
    );

    return result;
  } catch (err) {
    // Never crash — return safe defaults
    console.error(
      '[MockDNA] Error during mock analysis, returning safe defaults:',
      err instanceof Error ? err.message : String(err),
    );
    return buildSafeDefaults(entityType, entityName);
  }
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function collectAllText(assets: BrandAsset[]): string {
  return assets
    .map((a) =>
      [a.title, a.description, ...(a.tags ?? []), a.aiSummary]
        .filter(Boolean)
        .join(' '),
    )
    .join(' ')
    .toLowerCase();
}

function detectColors(text: string): string[] {
  const found: string[] = [];
  for (const [keyword, hex] of Object.entries(COLOR_KEYWORDS)) {
    if (text.includes(keyword.toLowerCase()) && !found.includes(hex)) {
      found.push(hex);
    }
  }
  return found;
}

function extractTags(assets: BrandAsset[]): string[] {
  const freq: Record<string, number> = {};
  for (const asset of assets) {
    for (const tag of asset.tags ?? []) {
      freq[tag] = (freq[tag] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .map(([tag]) => tag);
}

function detectScores(
  allText: string,
  approvedText: string,
  rejectedText: string,
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [signal, keywords] of Object.entries(STYLE_SIGNALS)) {
    let count = 0;
    for (const kw of keywords) {
      if (allText.includes(kw.toLowerCase())) count++;
      if (approvedText.includes(kw.toLowerCase())) count++; // double-weight approved
    }
    // Base is 50, adjust by keyword hits (up to +/- 20)
    scores[signal] = Math.max(30, Math.min(70, 50 + count * 4));
  }
  return scores;
}

function buildMockSummary(
  entityLabel: string,
  entityName: string,
  totalAssets: number,
  approvedCount: number,
  rejectedCount: number,
): string {
  if (totalAssets === 0) {
    return `פרופיל ראשוני עבור ${entityLabel} "${entityName}". אין נכסי מותג זמינים לניתוח — יש להעלות נכסים לקבלת ניתוח DNA שיווקי מדויק.`;
  }
  return (
    `פרופיל DNA שיווקי ראשוני עבור ${entityLabel} "${entityName}". ` +
    `מבוסס על מטא-דאטה של ${totalAssets} נכסים ` +
    `(${approvedCount} מאושרים, ${rejectedCount} נדחו). ` +
    `ניתוח זה מוגבל — לא בוצע ניתוח ויזואלי של תמונות. ` +
    `מומלץ להפעיל ספק Vision AI (Gemini/OpenAI) לקבלת תוצאות מדויקות יותר.`
  );
}

function buildSafeDefaults(entityType: string, entityName: string): MarketingDNAResult {
  const entityLabel = ENTITY_TYPE_LABELS[entityType] || entityType;
  return {
    dna_summary: `פרופיל ברירת מחדל עבור ${entityLabel} "${entityName}". לא ניתן לנתח — אנא בדקו את הגדרות המערכת.`,
    visual_personality: '',
    copywriting_tone: '',
    real_estate_positioning: '',
    primary_colors: [],
    secondary_colors: [],
    accent_colors: [],
    forbidden_colors: [],
    preferred_typography: {},
    forbidden_typography: {},
    preferred_layouts: [],
    rejected_layouts: [],
    preferred_visual_styles: [],
    rejected_visual_styles: [],
    preferred_image_styles: [],
    rejected_image_styles: [],
    preferred_campaign_angles: [],
    rejected_campaign_angles: [],
    preferred_cta_styles: [],
    whatsapp_cta_style: {},
    target_audiences: [],
    property_marketing_style: {},
    project_marketing_style: {},
    agent_marketing_style: {},
    seller_recruitment_style: {},
    buyer_recruitment_style: {},
    neighborhood_storytelling_style: {},
    brand_rules: [],
    avoid_rules: [],
    approved_patterns: [],
    rejected_patterns: [],
    luxury_score: 50,
    urgency_score: 50,
    modern_score: 50,
    sales_aggressiveness_score: 50,
    investment_focus_score: 50,
    lifestyle_focus_score: 50,
    seller_focus_score: 50,
    buyer_focus_score: 50,
    visual_density_score: 50,
    ai_generated_score: 50,
    ai_confidence_score: 15,
  };
}

/* ── Export ─────────────────────────────────────────────────────────────── */

export const mockMarketingDNAProvider: MarketingDNAProvider = {
  name: 'mock',
  analyze,
};
