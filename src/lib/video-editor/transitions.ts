/**
 * Transition Presets Engine
 * Premium AI video editor transition types organized by category.
 */

import type { TransitionType, TransitionPreset, TransitionCategory } from './types';

/** Transition category display labels */
export const TRANSITION_CATEGORY_LABELS: Record<
  TransitionCategory,
  { name: string; nameHe: string }
> = {
  clean_premium: { name: 'Clean & Premium', nameHe: 'נקי ופרימיום' },
  social_fast: { name: 'Social & Fast', nameHe: 'חברתי ומהיר' },
  luxury: { name: 'Luxury', nameHe: 'יוקרה' },
  food_retail: { name: 'Food & Retail', nameHe: 'מזון וקמעונאות' },
  ugc: { name: 'UGC & Authentic', nameHe: 'UGC ואותנטי' },
};

/** All transition presets organized by category */
export const TRANSITION_PRESETS: TransitionPreset[] = [
  // ═══════════════════════════════════════════════════════════════
  // CLEAN & PREMIUM (5)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'fade',
    name: 'Fade',
    nameHe: 'דהיות',
    category: 'clean_premium',
    duration: 300,
    easing: 'ease_in_out',
    behavior: 'Alpha fade from 100% to 0% to 100%',
    cssPreview: 'trans-fade',
    recommendedUseCase: 'Scene changes, pauses between thoughts',
    recommendedUseCaseHe: 'שינויי סצנה, הפסקות בין רעיונות',
    icon: '⚫',
    notes: 'Universal, works with all content',
    isHeavy: false,
  },

  {
    id: 'crossfade',
    name: 'Crossfade',
    nameHe: 'חציית דהיות',
    category: 'clean_premium',
    duration: 250,
    easing: 'ease_in_out',
    behavior: 'Simultaneous fade out + fade in',
    cssPreview: 'trans-crossfade',
    recommendedUseCase: 'Smooth transitions between similar shots',
    recommendedUseCaseHe: 'מעברים חלקים בין צילומים דומים',
    icon: '◀️',
    notes: 'Most elegant for premium content',
    isHeavy: false,
  },

  {
    id: 'soft_dissolve',
    name: 'Soft Dissolve',
    nameHe: 'התמזגות רכה',
    category: 'clean_premium',
    duration: 400,
    easing: 'ease_in_out',
    behavior: 'Slow, subtle blend between clips with slight blur',
    cssPreview: 'trans-soft-dissolve',
    recommendedUseCase: 'Luxury products, real estate, emotional moments',
    recommendedUseCaseHe: 'מוצרי יוקרה, נדל"ן, רגעים אמוציונליים',
    icon: '✨',
    notes: 'High-end feel, perfect for branded content',
    isHeavy: false,
  },

  {
    id: 'subtle_slide',
    name: 'Subtle Slide',
    nameHe: 'שקופית עדינה',
    category: 'clean_premium',
    duration: 350,
    easing: 'ease_out',
    behavior: 'Horizontal slide in one direction with fade',
    cssPreview: 'trans-subtle-slide',
    recommendedUseCase: 'Product reveals, storytelling transitions',
    recommendedUseCaseHe: 'חשיפת מוצר, מעברי סיפור',
    icon: '→',
    notes: 'Minimal motion for professional feel',
    isHeavy: false,
  },

  {
    id: 'light_wipe',
    name: 'Light Wipe',
    nameHe: 'מחיקה קלה',
    category: 'clean_premium',
    duration: 300,
    easing: 'ease_in_out',
    behavior: 'Soft directional wipe with transparency',
    cssPreview: 'trans-light-wipe',
    recommendedUseCase: 'Section breaks, premium presentations',
    recommendedUseCaseHe: 'הפסקות סעיף, מצגות פרימיום',
    icon: '◨',
    notes: 'Works well for corporate content',
    isHeavy: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // SOCIAL & FAST (6)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'whip_pan',
    name: 'Whip Pan',
    nameHe: 'סיבוב מהיר',
    category: 'social_fast',
    duration: 150,
    easing: 'ease_out',
    behavior: 'Fast diagonal motion blur pan',
    cssPreview: 'trans-whip-pan',
    recommendedUseCase: 'TikTok, Reels, fast-paced transitions',
    recommendedUseCaseHe: 'טיקטוק, Reels, מעברים מהירים',
    icon: '💨',
    notes: 'High energy, very popular on social',
    isHeavy: false,
  },

  {
    id: 'zoom_snap',
    name: 'Zoom Snap',
    nameHe: 'זום קצר',
    category: 'social_fast',
    duration: 200,
    easing: 'snap',
    behavior: 'Rapid zoom in with snap timing',
    cssPreview: 'trans-zoom-snap',
    recommendedUseCase: 'Reactions, emphasis, viral content',
    recommendedUseCaseHe: 'תגובות, הדגשה, תוכן וירלי',
    icon: '🔍',
    notes: 'Dramatic effect, use sparingly',
    isHeavy: true,
  },

  {
    id: 'blur_swipe',
    name: 'Blur Swipe',
    nameHe: 'טשטוש טאטא',
    category: 'social_fast',
    duration: 180,
    easing: 'ease_in_out',
    behavior: 'Motion blur swipe direction',
    cssPreview: 'trans-blur-swipe',
    recommendedUseCase: 'Quick cuts, action sequences, sports content',
    recommendedUseCaseHe: 'חיתוכים מהירים, סדרות פעולה, תוכן ספורט',
    icon: '≈',
    notes: 'Creates sense of speed and motion',
    isHeavy: false,
  },

  {
    id: 'quick_flash',
    name: 'Quick Flash',
    nameHe: 'הבהוב מהיר',
    category: 'social_fast',
    duration: 100,
    easing: 'snap',
    behavior: 'White flash burst transition',
    cssPreview: 'trans-quick-flash',
    recommendedUseCase: 'Dramatic reveals, jokes, emphasis',
    recommendedUseCaseHe: 'חשיפות דרמטיות, בדיחות, הדגשה',
    icon: '⚡',
    notes: 'Use with caution - can cause motion sickness',
    isHeavy: true,
  },

  {
    id: 'shake_hit',
    name: 'Shake Hit',
    nameHe: 'רעדה הכה',
    category: 'social_fast',
    duration: 250,
    easing: 'bounce',
    behavior: 'Impact shake with bounce easing',
    cssPreview: 'trans-shake-hit',
    recommendedUseCase: 'Action impacts, comedy hits, beat drops',
    recommendedUseCaseHe: 'פגעי פעולה, היטים קומיים, drop קצב',
    icon: '💥',
    notes: 'Paired with sound effects for maximum impact',
    isHeavy: true,
  },

  {
    id: 'speed_push',
    name: 'Speed Push',
    nameHe: 'דחיפה מהירה',
    category: 'social_fast',
    duration: 220,
    easing: 'ease_in',
    behavior: 'Accelerating push outward motion',
    cssPreview: 'trans-speed-push',
    recommendedUseCase: 'Climactic moments, viral pacing, energy peaks',
    recommendedUseCaseHe: 'רגעים קלימקסיים, קצב וירלי, שיאי אנרגיה',
    icon: '→️',
    notes: 'Best with beat-synced audio',
    isHeavy: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // LUXURY (5)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'slow_cinematic_fade',
    name: 'Slow Cinematic Fade',
    nameHe: 'דהיות סינמטית איטית',
    category: 'luxury',
    duration: 800,
    easing: 'ease_in_out',
    behavior: 'Extended, elegant fade with subtle color shift',
    cssPreview: 'trans-slow-cinematic',
    recommendedUseCase: 'Premium real estate, luxury brands, cinematic',
    recommendedUseCaseHe: 'נדל"ן פרימיום, ברנדים יוקרה, סינמטי',
    icon: '🎬',
    notes: 'High-end production aesthetic',
    isHeavy: false,
  },

  {
    id: 'elegant_parallax',
    name: 'Elegant Parallax',
    nameHe: 'פרלקס אלגנטי',
    category: 'luxury',
    duration: 700,
    easing: 'ease_in_out',
    behavior: 'Layered depth shift with parallax motion',
    cssPreview: 'trans-elegant-parallax',
    recommendedUseCase: 'Luxury products, jewelry, fashion collections',
    recommendedUseCaseHe: 'מוצרי יוקרה, תכשיטים, אוספי אופנה',
    icon: '📐',
    notes: 'Creates 3D depth perception',
    isHeavy: false,
  },

  {
    id: 'soft_zoom_dissolve',
    name: 'Soft Zoom Dissolve',
    nameHe: 'התמזגות זום רכה',
    category: 'luxury',
    duration: 600,
    easing: 'ease_in_out',
    behavior: 'Smooth zoom combined with dissolve blend',
    cssPreview: 'trans-soft-zoom-dissolve',
    recommendedUseCase: 'Premium visuals, luxury lifestyle, hotel/resort',
    recommendedUseCaseHe: 'ויזואלים פרימיום, אורח חיים יוקרה, מלון/אתר נופש',
    icon: '🌟',
    notes: 'Sophisticated and graceful',
    isHeavy: false,
  },

  {
    id: 'curtain_reveal',
    name: 'Curtain Reveal',
    nameHe: 'חשיפת וילון',
    category: 'luxury',
    duration: 750,
    easing: 'ease_out',
    behavior: 'Symmetrical curtain parts revealing scene',
    cssPreview: 'trans-curtain-reveal',
    recommendedUseCase: 'Product launches, exclusive reveals, dramatic moments',
    recommendedUseCaseHe: 'השקות מוצר, חשיפות בלעדיות, רגעים דרמטיים',
    icon: '🎭',
    notes: 'Creates sense of exclusivity and anticipation',
    isHeavy: false,
  },

  {
    id: 'depth_blur',
    name: 'Depth Blur',
    nameHe: 'טשטוש עומק',
    category: 'luxury',
    duration: 500,
    easing: 'ease_in_out',
    behavior: 'Blur transition with depth of field shift',
    cssPreview: 'trans-depth-blur',
    recommendedUseCase: 'Fashion, beauty, high-end photography',
    recommendedUseCaseHe: 'אופנה, יופי, צילום משקעי גבוה',
    icon: '🔲',
    notes: 'Professional photography aesthetic',
    isHeavy: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // FOOD & RETAIL (5)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'pop_zoom',
    name: 'Pop Zoom',
    nameHe: 'זום קופץ',
    category: 'food_retail',
    duration: 300,
    easing: 'spring',
    behavior: 'Playful spring zoom with bounce',
    cssPreview: 'trans-pop-zoom',
    recommendedUseCase: 'Food content, product discovery, fun unboxing',
    recommendedUseCaseHe: 'תוכן מזון, גילוי מוצר, פתיחת קופסה재미있는',
    icon: '🍕',
    notes: 'Fun and appetizing for food content',
    isHeavy: false,
  },

  {
    id: 'snap_reveal',
    name: 'Snap Reveal',
    nameHe: 'חשיפה קצרה',
    category: 'food_retail',
    duration: 250,
    easing: 'snap',
    behavior: 'Quick magnetic snap to reveal product',
    cssPreview: 'trans-snap-reveal',
    recommendedUseCase: 'Product reveals, price reveals, deals',
    recommendedUseCaseHe: 'חשיפות מוצר, חשיפות מחיר, עסקאות',
    icon: '⚙️',
    notes: 'Magnetic, satisfying feeling',
    isHeavy: false,
  },

  {
    id: 'object_wipe',
    name: 'Object Wipe',
    nameHe: 'מחיקת אובייקט',
    category: 'food_retail',
    duration: 400,
    easing: 'ease_in_out',
    behavior: 'Product-shaped wipe across screen',
    cssPreview: 'trans-object-wipe',
    recommendedUseCase: 'Product showcases, retail collections, recipe steps',
    recommendedUseCaseHe: 'הצגות מוצר, אוספי קמעונאות, שלבי מתכון',
    icon: '🛍️',
    notes: 'Branded feel with product silhouette',
    isHeavy: false,
  },

  {
    id: 'bounce_reveal',
    name: 'Bounce Reveal',
    nameHe: 'חשיפה קפיצה',
    category: 'food_retail',
    duration: 450,
    easing: 'bounce',
    behavior: 'Bouncy scale up reveal with momentum',
    cssPreview: 'trans-bounce-reveal',
    recommendedUseCase: 'Food content, playful promos, ingredient reveals',
    recommendedUseCaseHe: 'תוכן מזון, פרומו שמחה, חשיפות מרכיבים',
    icon: '🎈',
    notes: 'Energetic and engaging',
    isHeavy: false,
  },

  {
    id: 'fast_product_punch',
    name: 'Fast Product Punch',
    nameHe: 'פאנץ\' מוצר מהיר',
    category: 'food_retail',
    duration: 200,
    easing: 'ease_out',
    behavior: 'Sharp quick cut with scale emphasis',
    cssPreview: 'trans-fast-product-punch',
    recommendedUseCase: 'Retail ads, sales momentum, quick cuts',
    recommendedUseCaseHe: 'מודעות קמעונאות, מומנטום מכירות, חיתוכים מהירים',
    icon: '🎯',
    notes: 'Direct and impactful',
    isHeavy: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // UGC & AUTHENTIC (5)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'ugc_jump_cut',
    name: 'UGC Jump Cut',
    nameHe: 'קפיצה UGC',
    category: 'ugc',
    duration: 0,
    easing: 'linear',
    behavior: 'Instant hard cut, no transition effect',
    cssPreview: 'trans-ugc-jump-cut',
    recommendedUseCase: 'Raw authentic content, TikTok, casual vlogs',
    recommendedUseCaseHe: 'תוכן אותנטי גולמי, טיקטוק, וידאו ביומן קז"א',
    icon: '✂️',
    notes: 'Most authentic feel for UGC',
    isHeavy: false,
  },

  {
    id: 'subtitle_punch',
    name: 'Subtitle Punch',
    nameHe: 'פאנץ\' כתובית',
    category: 'ugc',
    duration: 150,
    easing: 'snap',
    behavior: 'Quick cut with text emphasis pop-in',
    cssPreview: 'trans-subtitle-punch',
    recommendedUseCase: 'Educational content, explanations, emphasis',
    recommendedUseCaseHe: 'תוכן חינוכי, הסברים, הדגשה',
    icon: '📝',
    notes: 'Pairs perfectly with captions',
    isHeavy: false,
  },

  {
    id: 'zoom_emphasis',
    name: 'Zoom Emphasis',
    nameHe: 'הדגשת זום',
    category: 'ugc',
    duration: 250,
    easing: 'ease_out',
    behavior: 'Quick zoom with subtle scale shift',
    cssPreview: 'trans-zoom-emphasis',
    recommendedUseCase: 'Reaction moments, important points, visual punch',
    recommendedUseCaseHe: 'רגעי תגובה, נקודות חשובות, כוח ויזואלי',
    icon: '📍',
    notes: 'Effective for emphasizing key moments',
    isHeavy: false,
  },

  {
    id: 'reaction_cut',
    name: 'Reaction Cut',
    nameHe: 'חיתוך תגובה',
    category: 'ugc',
    duration: 100,
    easing: 'linear',
    behavior: 'Instant cut with no fade, optimized for reaction videos',
    cssPreview: 'trans-reaction-cut',
    recommendedUseCase: 'Reaction videos, Q&A, casual content',
    recommendedUseCaseHe: 'וידאו תגובה, שאלות ותשובות, תוכן קז"א',
    icon: '😮',
    notes: 'Direct and immediate',
    isHeavy: false,
  },

  {
    id: 'pause_removal',
    name: 'Pause Removal',
    nameHe: 'הסרת הפסקה',
    category: 'ugc',
    duration: 50,
    easing: 'linear',
    behavior: 'Minimal transition for seamless speech edit',
    cssPreview: 'trans-pause-removal',
    recommendedUseCase: 'Interview cleanup, UM/AH removal, flow improvement',
    recommendedUseCaseHe: 'ניקוי ראיון, הסרת UM/AH, שיפור זרימה',
    icon: '🔗',
    notes: 'Nearly invisible, preserves authenticity',
    isHeavy: false,
  },
];

/**
 * Get transitions by category
 * @param category - The transition category to filter by
 * @returns Array of transition presets in that category
 */
export function getTransitionsByCategory(
  category: TransitionCategory
): TransitionPreset[] {
  return TRANSITION_PRESETS.filter((t) => t.category === category);
}

/**
 * Get a single transition preset by ID
 * @param type - The transition type to retrieve
 * @returns The transition preset, or undefined if not found
 */
export function getTransitionPreset(type: TransitionType): TransitionPreset | undefined {
  return TRANSITION_PRESETS.find((t) => t.id === type);
}
