/**
 * Brand Intelligence Service
 *
 * Gathers ALL brand intelligence data for a given client from Supabase.
 * Aggregates brand style profiles, creative DNA, brand assets, creative
 * feedback, and past creative briefs into a single unified object that
 * can be injected into the Creative Director prompt.
 *
 * Server-side only.
 */

import { getSupabase } from '@/lib/db/store';
import type {
  BrandStyleProfile,
  CreativeDNA,
  BrandAsset,
  CreativeFeedback,
  CreativeBrief,
} from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract entity T from a JSONB row { id, data, ... } */
function rowToEntity<T extends { id: string }>(row: { id: string; data: unknown }): T {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { ...data, id: row.id } as T;
}

/** Safely extract a string value from an opaque color entry */
function colorToHex(c: unknown): string {
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object') {
    const obj = c as Record<string, unknown>;
    return String(obj.hex || obj.color || obj.value || '');
  }
  return '';
}

/** Safely coerce an array-like value into a string array */
function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((v) => (typeof v === 'string' ? v : typeof v === 'object' && v ? (v as any).name || (v as any).label || JSON.stringify(v) : String(v)))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BrandIntelligence {
  // Colors
  primaryColors: string[];
  secondaryColors: string[];
  accentColors: string[];
  forbiddenColors: string[];

  // Typography
  preferredTypography: Record<string, any> | null;
  forbiddenTypography: Record<string, any> | null;

  // Visual style
  visualPersonality: string;
  preferredVisualStyles: string[];
  rejectedVisualStyles: string[];
  preferredImageStyles: string[];
  rejectedImageStyles: string[];

  // Layout
  preferredLayouts: any[];
  rejectedLayouts: any[];

  // Brand assets
  logoUrl: string | null;
  brandBookUrl: string | null;
  approvedReferenceUrls: string[];
  rejectedReferenceUrls: string[];
  productImageUrls: string[];

  // Creative DNA
  toneOfVoice: string;
  photographyStyle: string;
  graphicStyle: string;
  doNotUsePatterns: string[];

  // Feedback
  likedStyles: string[];
  dislikedStyles: string[];

  // Brand rules summary (human-readable)
  brandRulesSummary: string;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function gatherBrandIntelligence(clientId: string): Promise<BrandIntelligence> {
  const sb = getSupabase();

  // ── 1. BrandStyleProfile ──────────────────────────────────────────────
  let brandProfile: BrandStyleProfile | null = null;
  try {
    const { data: rows } = await sb
      .from('app_brand_style_profiles')
      .select('id, data')
      .limit(500);
    if (rows) {
      const match = rows
        .map((r: any) => rowToEntity<BrandStyleProfile>(r))
        .find((b) => b.clientId === clientId);
      brandProfile = match ?? null;
    }
  } catch { /* optional — continue without */ }

  // ── 2. CreativeDNA ────────────────────────────────────────────────────
  let creativeDna: CreativeDNA | null = null;
  try {
    const { data: rows } = await sb
      .from('app_creative_dna')
      .select('id, data')
      .limit(500);
    if (rows) {
      const match = rows
        .map((r: any) => rowToEntity<CreativeDNA>(r))
        .find((d) => d.clientId === clientId);
      creativeDna = match ?? null;
    }
  } catch { /* optional — continue without */ }

  // ── 3a. Client record — logo_url lives on the clients table directly ──
  let clientLogoUrl: string | null = null;
  try {
    const { data: clientRow } = await sb
      .from('clients')
      .select('logo_url')
      .eq('id', clientId)
      .single();
    if (clientRow?.logo_url) {
      clientLogoUrl = clientRow.logo_url;
      console.log(`[brand-intel] Found logo_url on clients table: ${clientLogoUrl}`);
    }
  } catch { /* optional */ }

  // ── 3b. ClientFiles (Brand Kit tab) — brand assets saved here ────────
  let brandKitFileUrls: string[] = [];
  try {
    const { data: rows } = await sb
      .from('app_client_files')
      .select('id, data')
      .limit(500);
    if (rows) {
      const clientFiles = rows
        .map((r: any) => rowToEntity<{ id: string; clientId: string; category: string; fileUrl: string; fileName: string }>(r))
        .filter((f) => f.clientId === clientId && f.category === 'brand_asset');
      brandKitFileUrls = clientFiles.map((f) => f.fileUrl).filter(Boolean);
      if (brandKitFileUrls.length) {
        console.log(`[brand-intel] Found ${brandKitFileUrls.length} brand_asset files in app_client_files`);
      }
    }
  } catch { /* optional */ }

  // ── 3c. BrandAssets (Creative Studio table) — secondary source ───────
  let brandAssets: BrandAsset[] = [];
  try {
    const { data: rows } = await sb
      .from('app_brand_assets')
      .select('id, data')
      .limit(500);
    if (rows) {
      brandAssets = rows
        .map((r: any) => rowToEntity<BrandAsset>(r))
        .filter((a) => a.clientId === clientId);
    }
  } catch { /* optional — continue without */ }

  // ── 4. CreativeFeedback ───────────────────────────────────────────────
  let feedbackItems: CreativeFeedback[] = [];
  try {
    const { data: rows } = await sb
      .from('app_creative_feedback')
      .select('id, data')
      .limit(500);
    if (rows) {
      feedbackItems = rows
        .map((r: any) => rowToEntity<CreativeFeedback>(r))
        .filter((f) => f.clientId === clientId);
    }
  } catch { /* optional — continue without */ }

  // ── 5. CreativeBriefs ─────────────────────────────────────────────────
  let briefs: CreativeBrief[] = [];
  try {
    const { data: rows } = await sb
      .from('app_creative_briefs')
      .select('id, data')
      .limit(500);
    if (rows) {
      briefs = rows
        .map((r: any) => rowToEntity<CreativeBrief>(r))
        .filter((b) => b.clientId === clientId);
    }
  } catch { /* optional — continue without */ }

  // ── Derive colors ─────────────────────────────────────────────────────
  const primaryColors = (brandProfile?.primaryColors || []).map(colorToHex).filter(Boolean);
  const secondaryColors = (brandProfile?.secondaryColors || []).map(colorToHex).filter(Boolean);
  const accentColors = (brandProfile?.accentColors || []).map(colorToHex).filter(Boolean);
  const forbiddenColors = (brandProfile?.forbiddenColors || []).map(colorToHex).filter(Boolean);

  // ── Typography ────────────────────────────────────────────────────────
  const preferredTypography = brandProfile?.preferredTypography || null;
  const forbiddenTypography = brandProfile?.forbiddenTypography || null;

  // ── Visual style ──────────────────────────────────────────────────────
  const visualPersonality = brandProfile?.visualPersonality || '';
  const preferredVisualStyles = toStringArray(brandProfile?.preferredVisualStyles);
  const rejectedVisualStyles = toStringArray(brandProfile?.rejectedVisualStyles);
  const preferredImageStyles = toStringArray(brandProfile?.preferredImageStyles);
  const rejectedImageStyles = toStringArray(brandProfile?.rejectedImageStyles);

  // ── Layouts ───────────────────────────────────────────────────────────
  const preferredLayouts = brandProfile?.preferredLayouts || [];
  const rejectedLayouts = brandProfile?.rejectedLayouts || [];

  // ── Brand assets — merge from Brand Kit (clients + client_files) AND Creative Studio (brand_assets) ──
  // Priority: clients.logo_url > app_brand_assets logo
  const logoAsset = brandAssets.find((a) => a.assetType === 'logo');
  const logoUrl = clientLogoUrl || logoAsset?.fileUrl || null;

  const brandBookAsset = brandAssets.find((a) => a.assetType === 'brand_guideline');
  const brandBookUrl = brandBookAsset?.fileUrl || null;

  // Approved references: Brand Kit files + Creative Studio approved refs
  const creativeStudioApproved = brandAssets
    .filter((a) => a.isApprovedReference)
    .map((a) => a.fileUrl)
    .filter(Boolean);
  // All Brand Kit assets are considered approved references for the visual generator
  const approvedReferenceUrls = [...brandKitFileUrls, ...creativeStudioApproved];

  const rejectedReferenceUrls = brandAssets
    .filter((a) => a.isRejectedReference)
    .map((a) => a.fileUrl)
    .filter(Boolean);

  const productImageTypes: string[] = ['photo', 'property_photo', 'project_render'];
  const productImageUrls = brandAssets
    .filter((a) => productImageTypes.includes(a.assetType))
    .map((a) => a.fileUrl)
    .filter(Boolean);

  console.log(`[brand-intel] Final: logoUrl=${logoUrl ? 'YES' : 'NO'}, approvedRefs=${approvedReferenceUrls.length}, productImages=${productImageUrls.length}`);

  // ── Creative DNA ──────────────────────────────────────────────────────
  const toneOfVoice = creativeDna?.toneOfVoice || '';
  const photographyStyle = creativeDna?.photographyStyle || '';
  const graphicStyle = creativeDna?.graphicStyle || '';
  const doNotUsePatterns = creativeDna?.doNotUsePatterns || [];

  // ── Feedback ──────────────────────────────────────────────────────────
  const positiveFeedbackTypes = new Set<string>(['liked', 'approved', 'save_as_client_style']);
  const negativeFeedbackTypes = new Set<string>(['disliked', 'rejected', 'wrong_colors', 'wrong_font', 'wrong_style', 'too_busy', 'too_empty']);

  const likedStyles = feedbackItems
    .filter((f) => positiveFeedbackTypes.has(f.feedbackType))
    .map((f) => f.feedbackValue || f.feedbackNote)
    .filter(Boolean);

  const dislikedStyles = feedbackItems
    .filter((f) => negativeFeedbackTypes.has(f.feedbackType))
    .map((f) => f.feedbackValue || f.feedbackNote)
    .filter(Boolean);

  // ── Build brand rules summary ─────────────────────────────────────────
  const brandRulesSummary = buildBrandRulesSummary({
    primaryColors,
    secondaryColors,
    accentColors,
    forbiddenColors,
    preferredTypography,
    forbiddenTypography,
    visualPersonality,
    preferredVisualStyles,
    rejectedVisualStyles,
    preferredImageStyles,
    rejectedImageStyles,
    preferredLayouts,
    rejectedLayouts,
    toneOfVoice,
    photographyStyle,
    graphicStyle,
    doNotUsePatterns,
    likedStyles,
    dislikedStyles,
    avoidRules: brandProfile?.avoidRules || [],
    brandRules: brandProfile?.brandRules || [],
    briefs,
  });

  return {
    primaryColors,
    secondaryColors,
    accentColors,
    forbiddenColors,
    preferredTypography,
    forbiddenTypography,
    visualPersonality,
    preferredVisualStyles,
    rejectedVisualStyles,
    preferredImageStyles,
    rejectedImageStyles,
    preferredLayouts,
    rejectedLayouts,
    logoUrl,
    brandBookUrl,
    approvedReferenceUrls,
    rejectedReferenceUrls,
    productImageUrls,
    toneOfVoice,
    photographyStyle,
    graphicStyle,
    doNotUsePatterns,
    likedStyles,
    dislikedStyles,
    brandRulesSummary,
  };
}

// ---------------------------------------------------------------------------
// Brand rules summary builder
// ---------------------------------------------------------------------------

function buildBrandRulesSummary(ctx: {
  primaryColors: string[];
  secondaryColors: string[];
  accentColors: string[];
  forbiddenColors: string[];
  preferredTypography: Record<string, any> | null;
  forbiddenTypography: Record<string, any> | null;
  visualPersonality: string;
  preferredVisualStyles: string[];
  rejectedVisualStyles: string[];
  preferredImageStyles: string[];
  rejectedImageStyles: string[];
  preferredLayouts: any[];
  rejectedLayouts: any[];
  toneOfVoice: string;
  photographyStyle: string;
  graphicStyle: string;
  doNotUsePatterns: string[];
  likedStyles: string[];
  dislikedStyles: string[];
  avoidRules: any[];
  brandRules: any[];
  briefs: CreativeBrief[];
}): string {
  const lines: string[] = [];

  // Colors
  if (ctx.primaryColors.length) {
    lines.push(`Primary brand colors: ${ctx.primaryColors.join(', ')}.`);
  }
  if (ctx.secondaryColors.length) {
    lines.push(`Secondary colors: ${ctx.secondaryColors.join(', ')}.`);
  }
  if (ctx.accentColors.length) {
    lines.push(`Accent colors: ${ctx.accentColors.join(', ')}.`);
  }
  if (ctx.forbiddenColors.length) {
    lines.push(`FORBIDDEN colors (never use): ${ctx.forbiddenColors.join(', ')}.`);
  }

  // Typography
  if (ctx.preferredTypography && Object.keys(ctx.preferredTypography).length) {
    lines.push(`Preferred typography: ${JSON.stringify(ctx.preferredTypography)}.`);
  }
  if (ctx.forbiddenTypography && Object.keys(ctx.forbiddenTypography).length) {
    lines.push(`Forbidden typography: ${JSON.stringify(ctx.forbiddenTypography)}.`);
  }

  // Visual personality & styles
  if (ctx.visualPersonality) {
    lines.push(`Visual personality: ${ctx.visualPersonality}.`);
  }
  if (ctx.preferredVisualStyles.length) {
    lines.push(`Preferred visual styles: ${ctx.preferredVisualStyles.join(', ')}.`);
  }
  if (ctx.rejectedVisualStyles.length) {
    lines.push(`Rejected visual styles (avoid): ${ctx.rejectedVisualStyles.join(', ')}.`);
  }
  if (ctx.preferredImageStyles.length) {
    lines.push(`Preferred image styles: ${ctx.preferredImageStyles.join(', ')}.`);
  }
  if (ctx.rejectedImageStyles.length) {
    lines.push(`Rejected image styles (avoid): ${ctx.rejectedImageStyles.join(', ')}.`);
  }

  // Layouts
  if (ctx.preferredLayouts.length) {
    lines.push(`Preferred layouts: ${toStringArray(ctx.preferredLayouts).join(', ')}.`);
  }
  if (ctx.rejectedLayouts.length) {
    lines.push(`Rejected layouts (avoid): ${toStringArray(ctx.rejectedLayouts).join(', ')}.`);
  }

  // Creative DNA
  if (ctx.toneOfVoice) {
    lines.push(`Tone of voice: ${ctx.toneOfVoice}.`);
  }
  if (ctx.photographyStyle) {
    lines.push(`Photography style: ${ctx.photographyStyle}.`);
  }
  if (ctx.graphicStyle) {
    lines.push(`Graphic style: ${ctx.graphicStyle}.`);
  }
  if (ctx.doNotUsePatterns.length) {
    lines.push(`Do-not-use patterns: ${ctx.doNotUsePatterns.join('; ')}.`);
  }

  // Brand rules and avoid rules
  if (ctx.brandRules.length) {
    const rules = toStringArray(ctx.brandRules);
    if (rules.length) {
      lines.push(`Brand rules: ${rules.join('; ')}.`);
    }
  }
  if (ctx.avoidRules.length) {
    const rules = ctx.avoidRules.map((r: any) => (typeof r === 'string' ? r : r.rule || JSON.stringify(r)));
    lines.push(`Avoid rules: ${rules.join('; ')}.`);
  }

  // Feedback
  if (ctx.likedStyles.length) {
    lines.push(`Client liked styles: ${ctx.likedStyles.join('; ')}.`);
  }
  if (ctx.dislikedStyles.length) {
    lines.push(`Client disliked styles (avoid): ${ctx.dislikedStyles.join('; ')}.`);
  }

  // Past briefs context
  if (ctx.briefs.length) {
    const briefSummaries = ctx.briefs.slice(0, 5).map((b) => {
      const parts: string[] = [];
      if (b.title) parts.push(b.title);
      if (b.objective) parts.push(`objective: ${b.objective}`);
      if (b.platform) parts.push(`platform: ${b.platform}`);
      return parts.join(' — ');
    }).filter(Boolean);
    if (briefSummaries.length) {
      lines.push(`Past creative briefs: ${briefSummaries.join(' | ')}.`);
    }
  }

  if (!lines.length) {
    return 'No brand intelligence data available for this client.';
  }

  return lines.join('\n');
}
