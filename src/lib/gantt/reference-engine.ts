/**
 * Reference Engine — generates mock ad-library-style reference previews
 * for Gantt content ideas, based on concept, content type, and client industry.
 *
 * MVP: deterministic mock data using seed hashing.
 * Future: plug in real APIs (Meta Ad Library, Pexels, Unsplash, etc.)
 */

/* ── Types ── */

export interface ReferenceItem {
  id: string;
  /** Placeholder image URL (gradient-based SVG data URI for MVP) */
  imageUrl: string;
  /** Short mock description of the reference ad */
  description: string;
  /** Simulated source label */
  source: string;
  /** Style tag for categorization */
  style: ReferenceStyle;
  /** Mock engagement score 1-100 */
  engagementScore: number;
}

export type ReferenceStyle =
  | 'minimal'
  | 'bold_text'
  | 'lifestyle'
  | 'product_focus'
  | 'testimonial'
  | 'ugc'
  | 'cinematic'
  | 'infographic';

export interface ReferenceQuery {
  ideaTitle: string;
  ideaSummary?: string;
  contentType: string; // GanttItemType
  format: string; // ContentFormat
  platform: string; // ContentPlatform
  clientIndustry?: string; // client.businessField
  clientName?: string;
}

/* ── Style bank ── */

const STYLE_OPTIONS: ReferenceStyle[] = [
  'minimal', 'bold_text', 'lifestyle', 'product_focus',
  'testimonial', 'ugc', 'cinematic', 'infographic',
];

const STYLE_LABELS: Record<ReferenceStyle, string> = {
  minimal: 'מינימליסטי',
  bold_text: 'טקסט בולט',
  lifestyle: 'לייפסטייל',
  product_focus: 'מוצר',
  testimonial: 'עדות לקוח',
  ugc: 'UGC',
  cinematic: 'קולנועי',
  infographic: 'אינפוגרפיקה',
};

/* ── Color palettes per style ── */

const STYLE_PALETTES: Record<ReferenceStyle, string[][]> = {
  minimal: [['#f8f9fa', '#e9ecef'], ['#fff5f5', '#ffe3e3'], ['#f0fdf4', '#dcfce7']],
  bold_text: [['#1a1a2e', '#16213e'], ['#0f0c29', '#302b63'], ['#1b1b2f', '#162447']],
  lifestyle: [['#ffecd2', '#fcb69f'], ['#a1c4fd', '#c2e9fb'], ['#fbc2eb', '#a6c1ee']],
  product_focus: [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe']],
  testimonial: [['#fdfcfb', '#e2d1c3'], ['#f5f7fa', '#c3cfe2'], ['#e0c3fc', '#8ec5fc']],
  ugc: [['#ffeaa7', '#fdcb6e'], ['#fab1a0', '#e17055'], ['#81ecec', '#00cec9']],
  cinematic: [['#0c0c0c', '#1a1a2e'], ['#141e30', '#243b55'], ['#0f2027', '#203a43']],
  infographic: [['#00b4db', '#0083b0'], ['#f857a6', '#ff5858'], ['#43e97b', '#38f9d7']],
};

/* ── Description templates ── */

const DESCRIPTION_TEMPLATES: Record<ReferenceStyle, string[]> = {
  minimal: [
    'עיצוב נקי עם מרחב לבן — מסר אחד חד',
    'גישה מינימליסטית עם טיפוגרפיה דקה',
    'רקע בהיר, אלמנט מרכזי אחד בלבד',
  ],
  bold_text: [
    'כותרת ענקית על רקע כהה — תופס עין מיידית',
    'טקסט בולט עם קונטרסט גבוה',
    'הודעה חזקה — 3 מילים שמספרות הכל',
  ],
  lifestyle: [
    'צילום אווירה — אנשים בסיטואציה אמיתית',
    'תמונה חמה ואורגנית — מרגיש אותנטי',
    'רגע יומיומי שמייצר הזדהות',
  ],
  product_focus: [
    'מוצר בפוקוס עם רקע גרדיאנט',
    'צילום תקריב מקצועי — פרטים ואיכות',
    'הצגת מוצר עם הנעה לפעולה ברורה',
  ],
  testimonial: [
    'ציטוט לקוח עם תמונה — אמינות ברמה גבוהה',
    'סיפור הצלחה קצר + תמונת פרופיל',
    'חוות דעת אמיתית בעיצוב אלגנטי',
  ],
  ugc: [
    'תוכן משתמש אותנטי — אורגני ומרגש',
    'ויראלי ומרגיש ספונטני',
    'סגנון "צולם בטלפון" — אמין ונגיש',
  ],
  cinematic: [
    'פריים קולנועי — תאורה דרמטית',
    'יחס צדדים רחב, אווירה עמוקה',
    'סיפור ויזואלי בפריים אחד',
  ],
  infographic: [
    'נתון מפתיע + ויזואליזציה ברורה',
    'גרף או תרשים בסגנון מעוצב',
    '3 עובדות בעיצוב נקי — שיתוף גבוה',
  ],
};

/* ── Deterministic seed hash ── */

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

/* ── SVG placeholder generator ── */

function generatePlaceholderSVG(
  style: ReferenceStyle,
  seed: number,
  index: number,
  label: string,
): string {
  const palettes = STYLE_PALETTES[style];
  const paletteIndex = Math.floor(seededRandom(seed, index * 7) * palettes.length);
  const [c1, c2] = palettes[paletteIndex];

  const angle = Math.floor(seededRandom(seed, index * 3) * 360);
  const styleLabel = STYLE_LABELS[style];

  // Add geometric shapes for visual interest
  const shapes: string[] = [];
  const shapeCount = 1 + Math.floor(seededRandom(seed, index * 11) * 3);
  for (let s = 0; s < shapeCount; s++) {
    const cx = 40 + Math.floor(seededRandom(seed, index * 13 + s) * 120);
    const cy = 30 + Math.floor(seededRandom(seed, index * 17 + s) * 100);
    const r = 10 + Math.floor(seededRandom(seed, index * 19 + s) * 30);
    const opacity = 0.1 + seededRandom(seed, index * 23 + s) * 0.2;
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" opacity="${opacity}"/>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
    <defs><linearGradient id="g${index}" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="200" height="160" rx="8" fill="url(#g${index})"/>
    ${shapes.join('')}
    <text x="100" y="90" text-anchor="middle" font-size="11" font-weight="600" fill="white" opacity="0.85" font-family="Arial, sans-serif">${styleLabel}</text>
    <text x="100" y="108" text-anchor="middle" font-size="8" fill="white" opacity="0.5" font-family="Arial, sans-serif">Ad Reference</text>
  </svg>`;

  return `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(svg))) : Buffer.from(svg).toString('base64')}`;
}

/* ── Source labels ── */

const SOURCE_LABELS = [
  'Meta Ad Library',
  'TikTok Creative Center',
  'Pinterest Ads',
  'Google Display',
  'Ads Inspiration',
  'Creative Bank',
];

/* ── Main generator ── */

/**
 * Generate reference items for a Gantt content idea.
 * Deterministic: same idea always produces same references.
 * Returns 3–6 items based on available context.
 */
export function generateReferences(query: ReferenceQuery): ReferenceItem[] {
  const seedStr = `${query.ideaTitle}|${query.contentType}|${query.format}|${query.platform}|${query.clientIndustry || ''}`;
  const seed = simpleHash(seedStr);

  // Determine count: 4–6 based on how much context we have
  let count = 4;
  if (query.ideaSummary && query.ideaSummary.length > 20) count++;
  if (query.clientIndustry) count++;
  count = Math.min(count, 6);

  // Pick styles based on content type + seed
  const styleWeights = getStyleWeights(query.contentType, query.format);
  const selectedStyles = pickStyles(styleWeights, count, seed);

  const references: ReferenceItem[] = [];

  for (let i = 0; i < count; i++) {
    const style = selectedStyles[i];
    const descTemplates = DESCRIPTION_TEMPLATES[style];
    const descIndex = Math.floor(seededRandom(seed, i * 31) * descTemplates.length);

    const sourceIndex = Math.floor(seededRandom(seed, i * 37) * SOURCE_LABELS.length);
    const engagementScore = 40 + Math.floor(seededRandom(seed, i * 41) * 55);

    references.push({
      id: `ref_${seed}_${i}`,
      imageUrl: generatePlaceholderSVG(style, seed, i, query.ideaTitle),
      description: descTemplates[descIndex],
      source: SOURCE_LABELS[sourceIndex],
      style,
      engagementScore,
    });
  }

  return references;
}

/**
 * Get style labels map (for UI display)
 */
export function getStyleLabel(style: ReferenceStyle): string {
  return STYLE_LABELS[style] || style;
}

/* ── Internal helpers ── */

function getStyleWeights(contentType: string, format: string): Record<ReferenceStyle, number> {
  const weights: Record<ReferenceStyle, number> = {
    minimal: 1, bold_text: 1, lifestyle: 1, product_focus: 1,
    testimonial: 1, ugc: 1, cinematic: 1, infographic: 1,
  };

  // Boost styles based on content type
  if (contentType === 'reel' || format === 'reel' || format === 'video') {
    weights.cinematic += 3;
    weights.ugc += 2;
    weights.lifestyle += 2;
  }
  if (contentType === 'carousel' || format === 'carousel') {
    weights.infographic += 3;
    weights.product_focus += 2;
    weights.testimonial += 1;
  }
  if (contentType === 'story' || format === 'story') {
    weights.bold_text += 3;
    weights.ugc += 2;
    weights.minimal += 1;
  }
  if (contentType === 'social_post' || format === 'image') {
    weights.lifestyle += 2;
    weights.product_focus += 2;
    weights.bold_text += 1;
  }

  return weights;
}

function pickStyles(
  weights: Record<ReferenceStyle, number>,
  count: number,
  seed: number,
): ReferenceStyle[] {
  // Weighted random selection without replacement
  const pool = STYLE_OPTIONS.slice();
  const totalWeight = pool.reduce((s, st) => s + (weights[st] || 1), 0);
  const selected: ReferenceStyle[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const r = seededRandom(seed, i * 53) * pool.reduce((s, st) => s + (weights[st] || 1), 0);
    let cumulative = 0;
    let picked = pool[0];
    for (const st of pool) {
      cumulative += weights[st] || 1;
      if (r < cumulative) { picked = st; break; }
    }
    selected.push(picked);
    pool.splice(pool.indexOf(picked), 1);
  }

  return selected;
}
