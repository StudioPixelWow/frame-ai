/**
 * Design Scoring Service — Scores each design on 5 dimensions (0-100)
 *
 * Evaluates designs for brand match, readability, mobile readability,
 * visual hierarchy, and conversion potential. Produces a DesignScore
 * with an overall weighted average.
 *
 * Server-side only.
 */
import type { DesignJSON, DesignElement, DesignScore, BrandStyleProfile } from '@/lib/db/schema';

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Extract flat color strings from JSONB color arrays */
function extractColors(arr: any[]): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') return item.toLowerCase().trim();
      if (typeof item === 'object' && item !== null) {
        const val = item.hex || item.color || item.value || '';
        return val.toLowerCase().trim();
      }
      return '';
    })
    .filter((c) => c.length > 0);
}

/** Extract font name strings from typography record */
function extractFontNames(typography: Record<string, any>): string[] {
  if (!typography || typeof typography !== 'object') return [];
  const fonts: string[] = [];
  for (const val of Object.values(typography)) {
    if (typeof val === 'string' && val.trim()) fonts.push(val.trim().toLowerCase());
    if (typeof val === 'object' && val !== null && val.family) {
      fonts.push(val.family.toLowerCase());
    }
  }
  return fonts;
}

/** Get all elements of a specific type */
function elementsOfType(elements: DesignElement[], type: string): DesignElement[] {
  return elements.filter((el) => el.type === type && el.visible !== false);
}

/** Clamp a value to 0-100 */
function clamp(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

/* ── Score: Brand Match ──────────────────────────────────────────────── */

/**
 * How well colors, fonts, and styles match the brand profile (0-100).
 */
function scoreBrandMatch(design: DesignJSON, profile: BrandStyleProfile): number {
  let score = 50; // Base score — neutral if no profile data

  const brandColors = [
    ...extractColors(profile.primaryColors),
    ...extractColors(profile.secondaryColors),
    ...extractColors(profile.accentColors),
  ];
  const forbiddenColors = extractColors(profile.forbiddenColors);
  const brandFonts = extractFontNames(profile.preferredTypography);

  if (brandColors.length === 0 && brandFonts.length === 0) {
    return 50; // No brand data to compare against
  }

  // Check element colors against brand palette
  let colorMatches = 0;
  let colorChecks = 0;
  let forbiddenViolations = 0;

  for (const el of design.elements) {
    if (!el.visible) continue;
    const colors = [el.style.color, el.style.backgroundColor].filter(Boolean) as string[];
    for (const c of colors) {
      const norm = c.toLowerCase().trim();
      if (norm.startsWith('rgba') || norm === 'transparent') continue; // Skip transparent/overlay
      colorChecks++;
      if (brandColors.some((bc) => bc === norm)) colorMatches++;
      if (forbiddenColors.some((fc) => fc === norm)) forbiddenViolations++;
    }
  }

  if (colorChecks > 0) {
    const colorRatio = colorMatches / colorChecks;
    score += colorRatio * 30; // Up to +30 for color matches
  }

  // Forbidden color penalty
  score -= forbiddenViolations * 10;

  // Check fonts against preferred typography
  let fontMatches = 0;
  let fontChecks = 0;

  for (const el of design.elements) {
    if (!el.visible || !el.style.fontFamily) continue;
    fontChecks++;
    const elFont = el.style.fontFamily.toLowerCase();
    if (brandFonts.some((bf) => elFont.includes(bf))) fontMatches++;
  }

  if (fontChecks > 0) {
    const fontRatio = fontMatches / fontChecks;
    score += fontRatio * 20; // Up to +20 for font matches
  }

  // Check if brandDNAApplied flag is set
  if (design.metadata.brandDNAApplied) {
    score += 10;
  }

  return clamp(score);
}

/* ── Score: Readability ──────────────────────────────────────────────── */

/**
 * Text size, contrast, spacing score for desktop viewing (0-100).
 */
function scoreReadability(design: DesignJSON): number {
  let score = 60; // Base
  const textElements = design.elements.filter(
    (el) =>
      el.visible &&
      ['headline', 'subtitle', 'body_text', 'cta_button', 'badge'].includes(el.type)
  );

  if (textElements.length === 0) return 40; // No text = poor readability

  for (const el of textElements) {
    const fontSize = el.style.fontSize || 16;

    // Font size scoring
    switch (el.type) {
      case 'headline':
        if (fontSize >= 36) score += 5;
        else if (fontSize >= 24) score += 2;
        else score -= 5; // Too small
        break;
      case 'subtitle':
        if (fontSize >= 20) score += 3;
        else if (fontSize >= 16) score += 1;
        else score -= 3;
        break;
      case 'body_text':
        if (fontSize >= 14) score += 3;
        else score -= 5; // Body text too small
        break;
      case 'cta_button':
        if (fontSize >= 16) score += 3;
        else score -= 3;
        break;
    }

    // Width scoring — text shouldn't be too narrow or too wide
    if (el.width < 20) score -= 3; // Too narrow
    if (el.width > 95) score -= 2; // Too wide, no breathing room
  }

  // Check for overlapping text elements (rough check via y-position proximity)
  const sorted = textElements.sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].y - (sorted[i - 1].y + sorted[i - 1].height);
    if (gap < 0) score -= 5; // Overlapping
    else if (gap < 2) score -= 2; // Too close
  }

  return clamp(score);
}

/* ── Score: Mobile Readability ───────────────────────────────────────── */

/**
 * Same as readability but with stricter thresholds for mobile screens (0-100).
 */
function scoreMobileReadability(design: DesignJSON): number {
  let score = 55; // Base
  const textElements = design.elements.filter(
    (el) =>
      el.visible &&
      ['headline', 'subtitle', 'body_text', 'cta_button'].includes(el.type)
  );

  if (textElements.length === 0) return 35;

  for (const el of textElements) {
    const fontSize = el.style.fontSize || 16;

    // Mobile needs larger relative font sizes
    switch (el.type) {
      case 'headline':
        if (fontSize >= 32) score += 5;
        else if (fontSize >= 24) score += 2;
        else score -= 8; // Too small for mobile
        break;
      case 'subtitle':
        if (fontSize >= 18) score += 3;
        else score -= 5;
        break;
      case 'body_text':
        if (fontSize >= 16) score += 3;
        else score -= 8; // Critical for mobile
        break;
      case 'cta_button':
        // CTA must be tappable on mobile
        if (fontSize >= 18 && el.height >= 7) score += 5;
        else if (fontSize >= 14 && el.height >= 5) score += 2;
        else score -= 5;
        // Width matters for tappability
        if (el.width >= 40) score += 3;
        else score -= 3;
        break;
    }
  }

  // Penalty for too many text elements on mobile
  if (textElements.length > 6) score -= (textElements.length - 6) * 3;

  // Bonus for vertical/story format (better for mobile)
  if (design.metadata.designType === 'story' || design.metadata.designType === 'reel_cover') {
    score += 5;
  }

  return clamp(score);
}

/* ── Score: Visual Hierarchy ─────────────────────────────────────────── */

/**
 * Proper z-index ordering, headline prominence, CTA visibility (0-100).
 */
function scoreVisualHierarchy(design: DesignJSON): number {
  let score = 50; // Base
  const elements = design.elements.filter((el) => el.visible);

  if (elements.length === 0) return 20;

  // Check headline exists and is prominent
  const headlines = elementsOfType(elements, 'headline');
  if (headlines.length > 0) {
    score += 10;
    const h = headlines[0];
    // Headline should be high z-index
    if (h.zIndex >= 8) score += 5;
    // Headline should have a significant size
    if (h.width >= 50 && h.height >= 8) score += 5;
    // Headline font should be bold
    if (h.style.fontWeight === '700' || h.style.fontWeight === '800') score += 3;
  } else {
    score -= 15; // No headline is bad hierarchy
  }

  // Check CTA exists and is clearly visible
  const ctas = elementsOfType(elements, 'cta_button');
  if (ctas.length > 0) {
    score += 8;
    const cta = ctas[0];
    // CTA should have high z-index
    if (cta.zIndex >= 12) score += 3;
    // CTA should have distinct background color
    if (cta.style.backgroundColor && cta.style.backgroundColor !== 'transparent') score += 3;
  }

  // Check z-index layering makes sense:
  // images < overlays < text < CTA < logo
  const zGroups: Record<string, number[]> = {};
  for (const el of elements) {
    const group = el.type;
    if (!zGroups[group]) zGroups[group] = [];
    zGroups[group].push(el.zIndex);
  }

  const avgZ = (group: string): number => {
    const vals = zGroups[group];
    if (!vals || vals.length === 0) return -1;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const imageZ = avgZ('image');
  const textZ = Math.max(avgZ('headline'), avgZ('subtitle'), avgZ('body_text'));
  const ctaZ = avgZ('cta_button');
  const logoZ = avgZ('logo');

  // Text should be above images
  if (imageZ >= 0 && textZ >= 0 && textZ > imageZ) score += 5;
  // CTA should be above text
  if (ctaZ >= 0 && textZ >= 0 && ctaZ >= textZ) score += 3;
  // Logo should be topmost
  if (logoZ >= 0 && logoZ >= textZ) score += 2;

  return clamp(score);
}

/* ── Score: Conversion Potential ─────────────────────────────────────── */

/**
 * Has CTA, urgency elements, clear messaging (0-100).
 */
function scoreConversionPotential(design: DesignJSON): number {
  let score = 30; // Base
  const elements = design.elements.filter((el) => el.visible);

  // CTA presence is critical
  const ctas = elementsOfType(elements, 'cta_button');
  if (ctas.length > 0) {
    score += 20;
    // CTA text quality
    const ctaText = ctas[0].props?.text || '';
    if (ctaText.length > 0 && ctaText.length <= 30) score += 5; // Concise CTA
    // Prominent position (lower third of design)
    if (ctas[0].y >= 65) score += 5;
  }

  // Headline presence
  if (elementsOfType(elements, 'headline').length > 0) score += 10;

  // Badge / urgency elements
  const badges = elementsOfType(elements, 'badge');
  if (badges.length > 0) {
    score += 8;
    // Check for urgency keywords
    const badgeText = (badges[0].props?.text || '').toLowerCase();
    const urgencyWords = ['חדש', 'מוגבל', 'אחרון', 'הזדמנות', 'בלעדי', 'מבצע', 'הנחה', 'hot'];
    if (urgencyWords.some((w) => badgeText.includes(w))) score += 5;
  }

  // Offer block
  if (elementsOfType(elements, 'offer_block').length > 0) score += 8;

  // Contact info for lead generation
  if (elementsOfType(elements, 'contact_block').length > 0) score += 5;

  // Agent block for trust
  if (elementsOfType(elements, 'agent_block').length > 0) score += 5;

  // Feature list for value proposition
  if (elementsOfType(elements, 'feature_list').length > 0) score += 5;

  // Testimonial for social proof
  if (elementsOfType(elements, 'testimonial_block').length > 0) score += 4;

  return clamp(score);
}

/* ── Main Scoring Function ───────────────────────────────────────────── */

/**
 * Score a design on 5 dimensions, returning a DesignScore.
 *
 * Weights:
 *  - brandMatch: 25%
 *  - readability: 20%
 *  - mobileReadability: 15%
 *  - visualHierarchy: 20%
 *  - conversionPotential: 20%
 */
export function scoreDesign(
  design: DesignJSON,
  profile: BrandStyleProfile | null
): DesignScore {
  const brandMatch = profile
    ? scoreBrandMatch(design, profile)
    : 50; // Neutral if no profile
  const readability = scoreReadability(design);
  const mobileReadability = scoreMobileReadability(design);
  const visualHierarchy = scoreVisualHierarchy(design);
  const conversionPotential = scoreConversionPotential(design);

  const overall = clamp(
    Math.round(
      brandMatch * 0.25 +
      readability * 0.20 +
      mobileReadability * 0.15 +
      visualHierarchy * 0.20 +
      conversionPotential * 0.20
    )
  );

  return {
    brandMatch,
    readability,
    mobileReadability,
    visualHierarchy,
    conversionPotential,
    overall,
  };
}
