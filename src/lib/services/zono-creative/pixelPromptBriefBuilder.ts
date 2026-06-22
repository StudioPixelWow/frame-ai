/**
 * PIXEL Creative Director — Brief Builder
 *
 * Constructs the Hebrew brand brief for the Creative Director prompt.
 * Server-side only.
 */
import { BrandStyleProfile } from '@/lib/db/schema';

/* ── ממשק פרמטרים לבניית הבריף ────────────────────────────────────── */

export interface BriefBuilderParams {
  clientName: string;
  industry: string;
  primaryBrandColor: string;
  textColor: string;
  font?: string;
  format?: string;
  headline: string;
  subHeadline?: string;
  bullets?: string[];
  authorityLine?: string;
  cta: string;
  additionalContext?: Record<string, any>;
}

/* ── בניית בריף עברי למנהל הקריאייטיב ─────────────────────────────── */

/**
 * Builds a Hebrew-formatted creative director brief string from explicit params.
 *
 * The output is a structured Hebrew prompt that the Creative Director AI
 * uses to generate Facebook ad graphics.
 */
export function buildCreativeDirectorBrief(params: BriefBuilderParams): string {
  const {
    clientName,
    industry,
    primaryBrandColor,
    textColor,
    font = 'Heebo',
    format = 'Meta Feed 4:5',
    headline,
    subHeadline,
    bullets,
    authorityLine,
    cta,
    additionalContext,
  } = params;

  // ── כותרת פתיחה
  const lines: string[] = [
    'אני צריך פרמפט לגרפיקת פרסום בפייסבוק.',
    '',
    'פרטי מותג:',
    `חברה: ${clientName}`,
    `תעשייה: ${industry}`,
    `צבע מותג ראשי: ${primaryBrandColor}`,
    `צבע טקסט/פונט: ${textColor}`,
    `פונט: ${font} עברית RTL`,
    `פורמט: ${format}`,
    '',
    'הקופי המלא:',
    `כותרת: ${headline}`,
  ];

  // ── תת-כותרת (אופציונלי)
  if (subHeadline) {
    lines.push(`תת-כותרת: ${subHeadline}`);
  }

  // ── נקודות (אופציונלי — מדלגים אם ריק)
  if (bullets && bullets.length > 0) {
    lines.push('נקודות:');
    for (const bullet of bullets) {
      lines.push(`• ${bullet}`);
    }
  }

  // ── שורת סמכות (אופציונלי)
  if (authorityLine) {
    lines.push(`שורת סמכות: ${authorityLine}`);
  }

  // ── קריאה לפעולה
  lines.push(`CTA: ${cta}`);

  // ── הקשר נוסף (אם סופק)
  if (additionalContext && Object.keys(additionalContext).length > 0) {
    lines.push('');
    lines.push('הקשר נוסף:');
    for (const [key, value] of Object.entries(additionalContext)) {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

/* ── בניית בריף מתוך פרופיל מותג קיים ──────────────────────────────── */

/**
 * Extracts brief parameters from a BrandStyleProfile and copy object,
 * then builds the Hebrew creative director brief.
 *
 * Provides sensible defaults for missing profile fields.
 */
export function buildBriefFromBrandProfile(
  profile: BrandStyleProfile,
  copy: {
    headline: string;
    subHeadline?: string;
    bullets?: string[];
    authorityLine?: string;
    cta: string;
  },
  format?: string,
): string {
  // ── חילוץ פרמטרים מהפרופיל
  const clientName = profile.entityName || 'Unknown Client';
  const industry = profile.realEstatePositioning || 'general';
  const primaryBrandColor =
    profile.primaryColors?.[0]?.hex || profile.primaryColors?.[0] || '#000000';
  const textColor =
    profile.preferredTypography?.textColor || '#FFFFFF';
  const font =
    profile.preferredTypography?.fontFamily || 'Heebo';

  const briefParams: BriefBuilderParams = {
    clientName,
    industry,
    primaryBrandColor,
    textColor,
    font,
    format: format || 'Meta Feed 4:5',
    headline: copy.headline,
    subHeadline: copy.subHeadline,
    bullets: copy.bullets,
    authorityLine: copy.authorityLine,
    cta: copy.cta,
  };

  return buildCreativeDirectorBrief(briefParams);
}
