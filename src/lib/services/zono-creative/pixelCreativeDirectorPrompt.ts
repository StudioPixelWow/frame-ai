/**
 * PIXEL Creative Director — Prompt Framework Constants.
 *
 * Stores the Creative Director system prompt, visual strategies,
 * industry anchors, typography rules, and curation lists used
 * by the image-generation pipeline.
 *
 * Server-side only.
 */

/* ── System Prompt ─────────────────────────────────────────────────────── */

export const CREATIVE_DIRECTOR_SYSTEM_PROMPT = `You are an Elite Post-AI Creative Director and Visual Layout Master for high-converting Meta Ads. Your sole job is to translate the Hebrew copy and brand brief into a single, masterful image generation prompt.

CRITICAL DIRECTIVE - NO COPY EDITING: You must integrate the EXACT, COMPLETE Hebrew text provided. You have ZERO permission to omit or summarize words.

ABSOLUTE BLACKLIST — NEVER USE THESE (BANNED FOREVER):
✗ Wooden table / wooden desk as the background — the most overused AI cliché. BANNED.
✗ Wooden door as a visual element. BANNED.
✗ Flat-lay on any table surface (wood, marble, concrete). BANNED.
✗ Semi-transparent dark overlay panels at the bottom for body text. BANNED.
✗ Soft diffused studio lighting — always use a motivated, directional light source. BANNED.
✗ Centered symmetrical compositions — always use asymmetry and rule-of-thirds. BANNED.
✗ Floating text boxes disconnected from the physical scene. BANNED.
✗ Generic phone mockup as the hero with text floating around it. BANNED.

INDUSTRY-AWARE DESIGN — READ THE BRIEF AND MATCH THE WORLD
RULE #1: A viewer with NO TEXT visible must immediately know what industry this ad is from.

DENTAL / ORAL HYGIENE / HYGIENIST: VISUAL ANCHORS:
✓ Macro close-up of a REAL human smile: naturally healthy teeth catching directional light
✓ Dental hygiene tools in their authentic environment
✓ BEFORE/AFTER teeth: macro photography
✓ The HYGIENIST at work: hands in blue nitrile gloves, overhead dental light

PRIVATE BANKING / WEALTH MANAGEMENT / FAMILY OFFICE:
⚠️ "Switzerland" = DESIGN LANGUAGE, not travel photography. Never Alpine mountains.
✓ A HANDSHAKE across a dark walnut desk in a private banking salon
✓ A PORTFOLIO DOCUMENT in a suited hand
✓ TWO GENERATIONS at a banking desk reviewing documents
✓ A SIGNED AGREEMENT on dark leather desk pad
Palette: deep navy (#0D1B2A), charcoal, cream white — SINGLE warm gold accent only.

REAL ESTATE / INVESTMENT — Aerial drone shots, construction site close-ups, architectural blueprints, golden hour aerial views.
FINANCE / LOANS — Bank statement on office chair, hand holding shekel bills, smartphone showing banking app.
HEALTH / CLINIC — Clinical examination table, hand holding test result, medical device in focus.
E-COMMERCE / RETAIL — Product in authentic use context, someone unboxing, phone screen showing checkout.
B2B / SERVICES — Business meeting moment, laptop on actual office desk, contract being signed.

DEFAULT RULE: If the industry doesn't fit a flat-lay, use a PERSON or an ENVIRONMENT.

META-NATIVE VISUAL STRATEGIES (CHOOSE ONE PER AD):
1. PROTAGONIST IN CONTEXT — A real, specific person in their authentic environment. 35mm or 50mm lens, f/1.8-f/2.8.
2. BEFORE / AFTER SPLIT — Two contrasting visual realities divided by a raw torn edge.
3. DOCUMENT / ARTIFACT IN ENVIRONMENT — A real-world artifact in its NATURAL ENVIRONMENT.
4. DATA DRAMA — A single brutal statistic as the dominant visual element.
5. BRUTALIST TYPOGRAPHY — The headline IS the image. Massive letterforms dominate 60%+ of frame.
6. CINEMATIC SCENE — A cinematic moment that tells the story without words first.

SCROLL-STOPPING — THE PRIMARY MISSION:
✓ One dominant visual element that commands the frame.
✓ Hook headline IMPOSSIBLE TO MISS — largest typographic element, maximum contrast.
✓ Emotional truth before information.
✓ Negative space is a weapon.
✓ Accent color appears ONLY on the single most important element.

TYPOGRAPHY — BOLD, READABLE, HIERARCHY:
✓ HEADLINE: Ultra-bold condensed Hebrew (Heebo Black style), minimum 28% of frame height.
✓ BODY: Regular weight, comfortable reading size, generous 1.6x line spacing.
✓ CTA: Bold, full-width button shape, solid fill color, white text.
✓ HIERARCHY: Three levels only — Headline (enormous) → Body (comfortable) → CTA (bold).

TEXT-DOMINANT RULE (when copy is long):
✓ NO half-screen photo + half-screen text. Banned.
✓ Text spreads across THE ENTIRE frame, top to bottom.
✓ Visual is a FULL-BLEED BACKGROUND that reinforces message.
✓ Gradient overlay (60-70% opacity) over background ensures text readability.
✓ Every text element: minimum 7:1 contrast ratio against background.

CRAFT RULES (MANDATORY IN EVERY PROMPT):
• Open with physical, optical terms: "A cinematic portrait photograph shot on 35mm at f/2.0..."
• Always specify: exact lens, aperture, lighting source + direction + color temperature.
• Describe textures with obsessive specificity.
• ONE accent color as structural element.
• OUTPUT: ONE continuous English paragraph. Start with [STRATEGY: ]. End with: --ar 4:5 --style raw`;

/* ── Absolute Blacklist ────────────────────────────────────────────────── */

export const ABSOLUTE_BLACKLIST: string[] = [
  'Wooden table / wooden desk as the background',
  'Wooden door as a visual element',
  'Flat-lay on any table surface (wood, marble, concrete)',
  'Semi-transparent dark overlay panels at the bottom for body text',
  'Soft diffused studio lighting',
  'Centered symmetrical compositions',
  'Floating text boxes disconnected from the physical scene',
  'Generic phone mockup as the hero with text floating around it',
];

/* ── Visual Strategies ─────────────────────────────────────────────────── */

export interface VisualStrategy {
  id: string;
  name: string;
  /** שם האסטרטגיה בעברית */
  nameHe: string;
  description: string;
}

export const VISUAL_STRATEGIES: VisualStrategy[] = [
  { id: 'protagonist-in-context', name: 'Protagonist in Context', nameHe: 'גיבור בהקשר', description: 'A real, specific person in their authentic environment. 35mm or 50mm lens, f/1.8-f/2.8.' },
  { id: 'before-after-split', name: 'Before / After Split', nameHe: 'לפני / אחרי', description: 'Two contrasting visual realities divided by a raw torn edge.' },
  { id: 'document-artifact', name: 'Document / Artifact in Environment', nameHe: 'מסמך / אובייקט בסביבה', description: 'A real-world artifact in its NATURAL ENVIRONMENT.' },
  { id: 'data-drama', name: 'Data Drama', nameHe: 'דרמה של נתונים', description: 'A single brutal statistic as the dominant visual element.' },
  { id: 'brutalist-typography', name: 'Brutalist Typography', nameHe: 'טיפוגרפיה ברוטליסטית', description: 'The headline IS the image. Massive letterforms dominate 60%+ of frame.' },
  { id: 'cinematic-scene', name: 'Cinematic Scene', nameHe: 'סצנה קולנועית', description: 'A cinematic moment that tells the story without words first.' },
];

/* ── Industry Visual Anchors ───────────────────────────────────────────── */

/** עוגנים ויזואליים לפי תעשייה — כל תעשייה מקבלת רשימת אלמנטים ויזואליים ייחודיים */
export const INDUSTRY_VISUAL_ANCHORS: Record<string, string[]> = {
  /** רפואת שיניים / היגיינה */
  'dental': [
    'Macro close-up of a REAL human smile: naturally healthy teeth catching directional light',
    'Dental hygiene tools in their authentic environment',
    'BEFORE/AFTER teeth: macro photography',
    'The HYGIENIST at work: hands in blue nitrile gloves, overhead dental light',
  ],
  /** בנקאות פרטית / ניהול עושר */
  'banking': [
    'A HANDSHAKE across a dark walnut desk in a private banking salon',
    'A PORTFOLIO DOCUMENT in a suited hand',
    'TWO GENERATIONS at a banking desk reviewing documents',
    'A SIGNED AGREEMENT on dark leather desk pad',
  ],
  /** נדל"ן / השקעות */
  'real-estate': [
    'Aerial drone shots',
    'Construction site close-ups',
    'Architectural blueprints',
    'Golden hour aerial views',
  ],
  /** פיננסים / הלוואות */
  'finance': [
    'Bank statement on office chair',
    'Hand holding shekel bills',
    'Smartphone showing banking app',
  ],
  /** בריאות / מרפאה */
  'health': [
    'Clinical examination table',
    'Hand holding test result',
    'Medical device in focus',
  ],
  /** מסחר אלקטרוני / קמעונאות */
  'ecommerce': [
    'Product in authentic use context',
    'Someone unboxing',
    'Phone screen showing checkout',
  ],
  /** B2B / שירותים */
  'b2b': [
    'Business meeting moment',
    'Laptop on actual office desk',
    'Contract being signed',
  ],
};

/* ── PIXEL Avoid List ──────────────────────────────────────────────────── */

export const PIXEL_AVOID_LIST: string[] = [
  'Stock photo aesthetic',
  'Overly polished corporate look',
  'White background product shots',
  'Generic lifestyle imagery',
  'Clip art or cartoon elements',
  'Watermarked images',
  'Low-resolution textures',
  'Overused gradient backgrounds',
  'Template-looking layouts',
  'AI-obvious generated faces',
];

/* ── PIXEL Prefer List ─────────────────────────────────────────────────── */

export const PIXEL_PREFER_LIST: string[] = [
  'Authentic environmental context',
  'Directional motivated lighting',
  'Asymmetric rule-of-thirds composition',
  'Hebrew RTL-first typography layout',
  'Bold typographic hierarchy',
  'Single accent color strategy',
  'Cinematic depth of field',
  'Textural specificity',
  'Industry-specific visual anchors',
  'Scroll-stopping dominant element',
];

/* ── Typography Rules ──────────────────────────────────────────────────── */

export interface TypographyRules {
  headline: { weight: string; style: string; minFrameHeight: string };
  body: { weight: string; lineSpacing: string };
  cta: { weight: string; shape: string; fillColor: string; textColor: string };
  hierarchy: { levels: number; order: string[] };
  textDominantRule: {
    noHalfScreenSplit: boolean;
    textSpread: string;
    backgroundType: string;
    gradientOpacity: string;
    minContrastRatio: string;
  };
}

export const TYPOGRAPHY_RULES: TypographyRules = {
  headline: {
    weight: 'Ultra-bold condensed',
    style: 'Heebo Black',
    minFrameHeight: '28%',
  },
  body: {
    weight: 'Regular',
    lineSpacing: '1.6x',
  },
  cta: {
    weight: 'Bold',
    shape: 'full-width button',
    fillColor: 'solid fill',
    textColor: 'white',
  },
  hierarchy: {
    levels: 3,
    order: ['Headline (enormous)', 'Body (comfortable)', 'CTA (bold)'],
  },
  textDominantRule: {
    noHalfScreenSplit: true,
    textSpread: 'entire frame, top to bottom',
    backgroundType: 'full-bleed background',
    gradientOpacity: '60-70%',
    minContrastRatio: '7:1',
  },
};

/* ── Scroll-Stop Rules ─────────────────────────────────────────────────── */

export interface ScrollStopRules {
  dominantVisualElement: boolean;
  hookHeadline: string;
  emotionalTruth: string;
  negativeSpace: string;
  accentColorRule: string;
}

export const SCROLL_STOP_RULES: ScrollStopRules = {
  dominantVisualElement: true,
  hookHeadline: 'IMPOSSIBLE TO MISS — largest typographic element, maximum contrast',
  emotionalTruth: 'Emotional truth before information',
  negativeSpace: 'Negative space is a weapon',
  accentColorRule: 'Accent color appears ONLY on the single most important element',
};
