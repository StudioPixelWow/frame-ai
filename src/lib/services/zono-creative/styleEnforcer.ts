/**
 * Style Enforcer — Applies brand DNA rules to a DesignJSON
 *
 * Takes a DesignJSON + BrandStyleProfile and enforces brand colors,
 * fonts, spacing, RTL alignment, and CTA styles. Returns a new
 * DesignJSON with brand rules applied.
 *
 * Server-side only.
 */
import type { DesignJSON, DesignElement, BrandStyleProfile, DesignElementStyle } from '@/lib/db/schema';
import { extractStringArray } from './realEstateCreativeConceptEngine';
import { SPACING_PRESETS, DEFAULT_FONTS } from './designSchema';

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Deep-clone a DesignJSON to avoid mutations */
function cloneDesign(design: DesignJSON): DesignJSON {
  return JSON.parse(JSON.stringify(design));
}

/** Extract color strings from JSONB color arrays (may be strings or objects) */
function extractColors(arr: any[]): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return item.hex || item.color || item.value || '';
      }
      return '';
    })
    .filter((c) => c.length > 0);
}

/** Check if a color is forbidden */
function isForbidden(color: string, forbidden: string[]): boolean {
  if (!color || forbidden.length === 0) return false;
  const norm = color.toLowerCase().trim();
  return forbidden.some((f) => f.toLowerCase().trim() === norm);
}

/** Extract font names from preferred typography record */
function extractFonts(typography: Record<string, any>): string[] {
  if (!typography || typeof typography !== 'object') return [];
  const fonts: string[] = [];
  // Try common keys
  for (const key of ['headline', 'body', 'accent', 'primary', 'secondary', 'display']) {
    const val = typography[key];
    if (typeof val === 'string' && val.trim()) fonts.push(val.trim());
    if (typeof val === 'object' && val !== null && val.family) fonts.push(val.family);
  }
  // Also try top-level array shape
  if (Array.isArray(typography)) {
    for (const item of typography) {
      if (typeof item === 'string') fonts.push(item);
      if (typeof item === 'object' && item?.name) fonts.push(item.name);
    }
  }
  return fonts;
}

/** Check if a font is forbidden */
function isFontForbidden(font: string, forbiddenTypography: Record<string, any>): boolean {
  if (!font || !forbiddenTypography) return false;
  const forbidden = extractFonts(forbiddenTypography);
  const normFont = font.toLowerCase().replace(/['"]/g, '').trim();
  return forbidden.some((f) => f.toLowerCase().replace(/['"]/g, '').trim() === normFont);
}

/** Get spacing density level from visualDensityScore (0-100) */
function getDensityLevel(score: number): 'tight' | 'normal' | 'spacious' {
  if (score >= 70) return 'tight';
  if (score <= 30) return 'spacious';
  return 'normal';
}

/* ── Main Enforcer ───────────────────────────────────────────────────── */

/**
 * Enforce brand style rules on a DesignJSON.
 *
 * Rules applied:
 * 1. Replace colors with brand palette
 * 2. Replace fonts with preferred typography
 * 3. Block forbidden colors and fonts
 * 4. Adjust spacing based on visualDensityScore
 * 5. Adjust luxury level based on luxuryScore
 * 6. Force RTL text alignment
 * 7. Apply preferred CTA styles
 * 8. Mark brandDNAApplied = true
 */
export function enforceStyle(design: DesignJSON, profile: BrandStyleProfile): DesignJSON {
  const result = cloneDesign(design);

  // Extract brand palette
  const primaryColors = extractColors(profile.primaryColors);
  const secondaryColors = extractColors(profile.secondaryColors);
  const accentColors = extractColors(profile.accentColors);
  const forbiddenColors = extractColors(profile.forbiddenColors);
  const preferredFonts = extractFonts(profile.preferredTypography);
  const ctaStyles = extractStringArray(profile.preferredCtaStyles);

  // Primary fallbacks
  const primaryColor = primaryColors[0] || '#1A1A2E';
  const secondaryColor = secondaryColors[0] || '#16213E';
  const accentColor = accentColors[0] || '#E94560';

  // Determine spacing from visual density
  const densityLevel = getDensityLevel(profile.visualDensityScore ?? 50);
  const spacing = SPACING_PRESETS[densityLevel];

  // Determine font stack
  const headlineFont = preferredFonts[0]
    ? `'${preferredFonts[0]}', ${DEFAULT_FONTS.headline}`
    : DEFAULT_FONTS.headline;
  const bodyFont = preferredFonts[1] || preferredFonts[0]
    ? `'${preferredFonts[1] || preferredFonts[0]}', ${DEFAULT_FONTS.body}`
    : DEFAULT_FONTS.body;

  // ── 1. Enforce canvas background ──
  if (result.canvas.backgroundColor) {
    if (isForbidden(result.canvas.backgroundColor, forbiddenColors)) {
      result.canvas.backgroundColor = secondaryColor;
    }
  }

  // ── Process each element ──
  for (const element of result.elements) {
    enforceElementStyle(element, {
      primaryColor,
      secondaryColor,
      accentColor,
      forbiddenColors,
      headlineFont,
      bodyFont,
      spacing,
      luxuryScore: profile.luxuryScore ?? 50,
      ctaStyles,
      forbiddenTypography: profile.forbiddenTypography,
    });
  }

  // ── 8. Mark brand DNA applied ──
  result.metadata.brandDNAApplied = true;

  return result;
}

/* ── Element-Level Enforcement ───────────────────────────────────────── */

interface EnforceContext {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  forbiddenColors: string[];
  headlineFont: string;
  bodyFont: string;
  spacing: typeof SPACING_PRESETS['normal'];
  luxuryScore: number;
  ctaStyles: string[];
  forbiddenTypography: Record<string, any>;
}

function enforceElementStyle(element: DesignElement, ctx: EnforceContext): void {
  const style = element.style;

  // ── 2. Apply brand colors by element type ──
  switch (element.type) {
    case 'headline':
      style.color = ctx.primaryColor;
      style.fontFamily = ctx.headlineFont;
      style.fontWeight = '700';
      break;

    case 'subtitle':
      style.color = ctx.primaryColor;
      style.fontFamily = ctx.bodyFont;
      style.fontWeight = '400';
      // Lighter variant for subtitle
      style.opacity = 0.85;
      break;

    case 'body_text':
      style.fontFamily = ctx.bodyFont;
      break;

    case 'cta_button':
      // Accent color for CTA background
      style.backgroundColor = ctx.accentColor;
      style.color = '#FFFFFF';
      style.fontFamily = ctx.headlineFont;
      // ── 7. Apply preferred CTA styles ──
      applyCTAStyles(style, ctx.ctaStyles, ctx.luxuryScore);
      break;

    case 'badge':
      style.backgroundColor = ctx.accentColor;
      style.color = '#FFFFFF';
      style.fontFamily = ctx.bodyFont;
      break;

    case 'offer_block':
      style.fontFamily = ctx.headlineFont;
      break;

    case 'statistic_block':
      style.color = ctx.accentColor;
      style.fontFamily = ctx.headlineFont;
      break;

    case 'contact_block':
    case 'feature_list':
    case 'testimonial_block':
    case 'property_highlights':
    case 'agent_block':
    case 'project_details':
      style.fontFamily = ctx.bodyFont;
      break;

    case 'shape':
      // Use secondary/accent for decorative shapes
      if (style.backgroundColor && !style.backgroundColor.includes('rgba')) {
        style.backgroundColor = ctx.secondaryColor;
      }
      break;
  }

  // ── 3. Block forbidden colors ──
  if (style.color && isForbidden(style.color, ctx.forbiddenColors)) {
    style.color = ctx.primaryColor;
  }
  if (style.backgroundColor && isForbidden(style.backgroundColor, ctx.forbiddenColors)) {
    style.backgroundColor = ctx.secondaryColor;
  }

  // ── 3. Block forbidden fonts ──
  if (style.fontFamily && isFontForbidden(style.fontFamily, ctx.forbiddenTypography)) {
    style.fontFamily = ctx.bodyFont;
  }

  // ── 4. Adjust spacing based on density ──
  if (style.padding !== undefined) {
    style.padding = ctx.spacing.paddingBase;
  }

  // ── 5. Luxury adjustments ──
  if (ctx.luxuryScore >= 75) {
    // Higher luxury → more letter-spacing (via font weight subtlety), softer corners
    if (element.type === 'cta_button') {
      style.borderRadius = 4; // Luxury prefers subtle rounding
    }
    if (element.type === 'headline') {
      style.fontWeight = '600'; // Slightly lighter for elegance
    }
  }

  // ── 6. Force RTL alignment ──
  if (style.textAlign !== 'center') {
    style.textAlign = 'right';
  }
}

/* ── CTA Style Application ───────────────────────────────────────────── */

function applyCTAStyles(
  style: DesignElementStyle,
  ctaStyles: string[],
  luxuryScore: number
): void {
  if (ctaStyles.length === 0) return;

  // Parse CTA style preferences
  const styleLower = ctaStyles.map((s) => s.toLowerCase());

  if (styleLower.some((s) => s.includes('rounded') || s.includes('עגול'))) {
    style.borderRadius = 24;
  } else if (styleLower.some((s) => s.includes('sharp') || s.includes('חד'))) {
    style.borderRadius = 0;
  } else if (styleLower.some((s) => s.includes('pill') || s.includes('כדור'))) {
    style.borderRadius = 999;
  }

  if (styleLower.some((s) => s.includes('outline') || s.includes('מסגרת'))) {
    style.backgroundColor = 'transparent';
    style.border = `2px solid ${style.color || '#FFFFFF'}`;
  }

  if (styleLower.some((s) => s.includes('bold') || s.includes('בולט'))) {
    style.fontWeight = '800';
    style.fontSize = (style.fontSize || 22) + 4;
  }

  // Luxury CTAs are more subtle
  if (luxuryScore >= 80) {
    style.fontWeight = '500';
    if (!style.border) {
      style.border = `1px solid rgba(255,255,255,0.3)`;
    }
  }
}
