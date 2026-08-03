/**
 * Generation Context Builder
 *
 * Loads all relevant data for a Gantt item and builds a rich context
 * object used for AI visual generation prompt construction.
 *
 * Server-side only.
 */

import { getSupabase } from '@/lib/db/store';
import type {
  ClientGanttItem,
  CreativeDNA,
  BrandStyleProfile,
} from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GenerationContext {
  ganttItem: ClientGanttItem;
  clientName: string;
  businessField: string;
  logoUrl: string | null;
  brandColors: string[];
  creativeDna: CreativeDNA | null;
  brandProfile: BrandStyleProfile | null;
  monthTheme: string;
  campaignTag: string;
  platform: string;
  format: string;
  /** Pre-built prompt context string */
  promptContext: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract entity T from a JSONB row { id, data, ... } */
function rowToEntity<T extends { id: string }>(row: { id: string; data: unknown }): T {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { ...data, id: row.id } as T;
}

/** Format a color array into a human-readable string */
function formatColors(colors: string[]): string {
  if (!colors.length) return 'no specific brand colors defined';
  return colors.join(', ');
}

/** Map platform code to a descriptive label */
function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    twitter: 'Twitter / X',
    website: 'Website',
    email: 'Email marketing',
    whatsapp: 'WhatsApp',
    google_ads: 'Google Ads',
    meta_ads: 'Meta Ads',
    print: 'Print',
  };
  return map[platform] || platform;
}

/** Map format code to a descriptive label */
function formatLabel(format: string): string {
  const map: Record<string, string> = {
    post: 'single image post',
    story: 'vertical story',
    reel: 'short-form video / reel',
    carousel: 'carousel / multi-slide',
    cover: 'cover image',
    ad: 'advertisement creative',
    banner: 'banner',
    thumbnail: 'thumbnail',
    infographic: 'infographic',
    logo: 'logo / brand mark',
  };
  return map[format] || format;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export async function buildGenerationContext(
  ganttItemId: string,
  clientId: string,
): Promise<GenerationContext> {
  const sb = getSupabase();

  // 1. Load the Gantt item (JSONB table)
  const { data: ganttRow, error: ganttErr } = await sb
    .from('app_client_gantt_items')
    .select('id, data')
    .eq('id', ganttItemId)
    .single();

  if (ganttErr || !ganttRow) {
    throw new Error(`Gantt item not found: ${ganttItemId} — ${ganttErr?.message ?? 'no row'}`);
  }
  const ganttItem = rowToEntity<ClientGanttItem>(ganttRow);

  // 2. Load the client (direct-column table)
  const { data: clientRow, error: clientErr } = await sb
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientErr || !clientRow) {
    throw new Error(`Client not found: ${clientId} — ${clientErr?.message ?? 'no row'}`);
  }

  const clientName: string = clientRow.name || '';
  const businessField: string = clientRow.business_field || '';
  const logoUrl: string | null = clientRow.logo_url || null;

  // 3. Load CreativeDNA for this client (JSONB table)
  let creativeDna: CreativeDNA | null = null;
  try {
    const { data: dnaRows } = await sb
      .from('app_creative_dna')
      .select('id, data')
      .limit(500);
    if (dnaRows) {
      const match = dnaRows
        .map((r: any) => rowToEntity<CreativeDNA>(r))
        .find((d) => d.clientId === clientId);
      creativeDna = match ?? null;
    }
  } catch { /* optional — continue without */ }

  // 4. Load BrandStyleProfile for this client (JSONB table)
  let brandProfile: BrandStyleProfile | null = null;
  try {
    const { data: bspRows } = await sb
      .from('app_brand_style_profiles')
      .select('id, data')
      .limit(500);
    if (bspRows) {
      const match = bspRows
        .map((r: any) => rowToEntity<BrandStyleProfile>(r))
        .find((b) => b.clientId === clientId);
      brandProfile = match ?? null;
    }
  } catch { /* optional — continue without */ }

  // 5. Derive brand colors (prefer CreativeDNA palette, fallback to BrandStyleProfile)
  let brandColors: string[] = [];
  if (creativeDna?.colorPalette?.length) {
    brandColors = creativeDna.colorPalette;
  } else if (brandProfile) {
    const primary = (brandProfile.primaryColors || []).map((c: any) => typeof c === 'string' ? c : c.hex || c.color || '').filter(Boolean);
    const secondary = (brandProfile.secondaryColors || []).map((c: any) => typeof c === 'string' ? c : c.hex || c.color || '').filter(Boolean);
    brandColors = [...primary, ...secondary];
  }

  // 6. Build the prompt context string
  const monthTheme = ganttItem.monthTheme || '';
  const campaignTag = ganttItem.campaignTag || '';
  const platform = ganttItem.platform || '';
  const format = ganttItem.format || '';

  const promptContext = buildPromptContext({
    ganttItem,
    clientName,
    businessField,
    brandColors,
    creativeDna,
    brandProfile,
    monthTheme,
    campaignTag,
    platform,
    format,
  });

  return {
    ganttItem,
    clientName,
    businessField,
    logoUrl,
    brandColors,
    creativeDna,
    brandProfile,
    monthTheme,
    campaignTag,
    platform,
    format,
    promptContext,
  };
}

// ---------------------------------------------------------------------------
// Prompt context assembly
// ---------------------------------------------------------------------------

function buildPromptContext(ctx: {
  ganttItem: ClientGanttItem;
  clientName: string;
  businessField: string;
  brandColors: string[];
  creativeDna: CreativeDNA | null;
  brandProfile: BrandStyleProfile | null;
  monthTheme: string;
  campaignTag: string;
  platform: string;
  format: string;
}): string {
  const { ganttItem, clientName, businessField, brandColors, creativeDna, brandProfile, monthTheme, campaignTag, platform, format } = ctx;
  const parts: string[] = [];

  // -- Core content description --
  parts.push(`Create a professional visual for "${ganttItem.title}".`);

  if (ganttItem.ideaSummary) {
    parts.push(`Concept: ${ganttItem.ideaSummary}`);
  }
  if (ganttItem.visualConcept) {
    parts.push(`Visual direction: ${ganttItem.visualConcept}`);
  }
  if (ganttItem.graphicText) {
    parts.push(`Text to include on the graphic: "${ganttItem.graphicText}"`);
  }

  // -- Client & business context --
  parts.push(`Client: ${clientName || 'Unknown'}, industry: ${businessField || 'general business'}.`);

  // -- Platform & format --
  if (platform) {
    parts.push(`Platform: ${platformLabel(platform)}, format: ${formatLabel(format || 'post')}.`);
  }

  // -- Brand colors --
  if (brandColors.length) {
    parts.push(`Brand color palette: ${formatColors(brandColors)}. Incorporate these colors naturally.`);
  }

  // -- Month theme & campaign --
  if (monthTheme) {
    parts.push(`Monthly theme: ${monthTheme}.`);
  }
  if (campaignTag) {
    parts.push(`Campaign: ${campaignTag}.`);
  }
  if (ganttItem.holidayTag) {
    parts.push(`Holiday / occasion: ${ganttItem.holidayTag}.`);
  }

  // -- CreativeDNA style guidance --
  if (creativeDna) {
    const dnaHints: string[] = [];
    if (creativeDna.visualStyle) dnaHints.push(`visual style: ${creativeDna.visualStyle}`);
    if (creativeDna.photographyStyle) dnaHints.push(`photography style: ${creativeDna.photographyStyle}`);
    if (creativeDna.graphicStyle) dnaHints.push(`graphic style: ${creativeDna.graphicStyle}`);
    if (creativeDna.toneOfVoice) dnaHints.push(`tone: ${creativeDna.toneOfVoice}`);
    if (creativeDna.audienceStyle) dnaHints.push(`audience style: ${creativeDna.audienceStyle}`);
    if (dnaHints.length) {
      parts.push(`Creative DNA — ${dnaHints.join('; ')}.`);
    }
    if (creativeDna.doNotUsePatterns?.length) {
      parts.push(`Avoid these patterns: ${creativeDna.doNotUsePatterns.join(', ')}.`);
    }
  }

  // -- BrandStyleProfile guidance --
  if (brandProfile) {
    const bspHints: string[] = [];
    if (brandProfile.visualPersonality) bspHints.push(`visual personality: ${brandProfile.visualPersonality}`);
    if (brandProfile.brandSummary) bspHints.push(`brand summary: ${brandProfile.brandSummary}`);
    if (brandProfile.preferredVisualStyles?.length) {
      bspHints.push(`preferred visual styles: ${brandProfile.preferredVisualStyles.map((s: any) => typeof s === 'string' ? s : s.name || JSON.stringify(s)).join(', ')}`);
    }
    if (brandProfile.preferredImageStyles?.length) {
      bspHints.push(`preferred image styles: ${brandProfile.preferredImageStyles.map((s: any) => typeof s === 'string' ? s : s.name || JSON.stringify(s)).join(', ')}`);
    }
    if (bspHints.length) {
      parts.push(`Brand style profile — ${bspHints.join('; ')}.`);
    }
    if (brandProfile.avoidRules?.length) {
      parts.push(`Brand avoid rules: ${brandProfile.avoidRules.map((r: any) => typeof r === 'string' ? r : r.rule || JSON.stringify(r)).join('; ')}.`);
    }
    if (brandProfile.forbiddenColors?.length) {
      const forbidden = brandProfile.forbiddenColors.map((c: any) => typeof c === 'string' ? c : c.hex || c.color || '').filter(Boolean);
      if (forbidden.length) {
        parts.push(`Do NOT use these colors: ${forbidden.join(', ')}.`);
      }
    }
  }

  // -- Quality instructions --
  parts.push('The image should be high quality, clean, modern, and suitable for professional social media marketing.');

  return parts.join('\n');
}
