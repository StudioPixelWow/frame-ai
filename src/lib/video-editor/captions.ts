/**
 * Caption & Subtitle Presets Engine
 * Caption animations and subtitle style configurations.
 */

import type {
  CaptionAnimationType,
  SubtitleStyleId,
  CaptionAnimationPreset,
  SubtitleStylePreset,
} from './types';

/** All caption animation presets */
export const CAPTION_ANIMATIONS: Record<CaptionAnimationType, CaptionAnimationPreset> = {
  fade_up: {
    id: 'fade_up',
    name: 'Fade Up',
    nameHe: 'דהיות למעלה',
    description: 'Text fades in while moving upward.',
    cssClass: 'caption-fade-up',
    duration: 400,
    easing: 'ease_out',
    icon: '⬆️',
  },

  punch_in: {
    id: 'punch_in',
    name: 'Punch In',
    nameHe: 'פאנץ\' פנימה',
    description: 'Quick, energetic scale-in entrance.',
    cssClass: 'caption-punch-in',
    duration: 250,
    easing: 'snap',
    icon: '💥',
  },

  type_reveal: {
    id: 'type_reveal',
    name: 'Type Reveal',
    nameHe: 'חשיפת הקלדה',
    description: 'Characters appear one by one like typing.',
    cssClass: 'caption-type-reveal',
    duration: 800,
    easing: 'linear',
    icon: '⌨️',
  },

  kinetic_bounce: {
    id: 'kinetic_bounce',
    name: 'Kinetic Bounce',
    nameHe: 'קפיצה קינטית',
    description: 'Playful bounce entrance with kinetic energy.',
    cssClass: 'caption-kinetic-bounce',
    duration: 600,
    easing: 'bounce',
    icon: '🎈',
  },

  slide_reveal: {
    id: 'slide_reveal',
    name: 'Slide Reveal',
    nameHe: 'חשיפת שקופית',
    description: 'Text slides in from the side with fade.',
    cssClass: 'caption-slide-reveal',
    duration: 500,
    easing: 'ease_out',
    icon: '➡️',
  },

  premium_soft: {
    id: 'premium_soft',
    name: 'Premium Soft',
    nameHe: 'רך פרימיום',
    description: 'Elegant, subtle fade for luxury content.',
    cssClass: 'caption-premium-soft',
    duration: 700,
    easing: 'ease_in_out',
    icon: '✨',
  },

  highlight_pop: {
    id: 'highlight_pop',
    name: 'Highlight Pop',
    nameHe: 'הדגשת קפיצה',
    description: 'Background highlight appears with text.',
    cssClass: 'caption-highlight-pop',
    duration: 350,
    easing: 'spring',
    icon: '🎯',
  },
};

/** All subtitle style presets */
export const SUBTITLE_STYLES: Record<SubtitleStyleId, SubtitleStylePreset> = {
  clean_premium: {
    id: 'clean_premium',
    name: 'Clean Premium',
    nameHe: 'נקי פרימיום',
    fontFamily: 'Inter, sans-serif',
    fontSize: 32,
    fontWeight: 500,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 8,
    padding: '12px 20px',
    textTransform: 'none',
    maxWordsPerLine: 8,
    position: 'bottom',
  },

  tiktok_bold: {
    id: 'tiktok_bold',
    name: 'TikTok Bold',
    nameHe: 'טיקטוק בולד',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
    fontSize: 40,
    fontWeight: 700,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 0,
    padding: '16px 24px',
    textTransform: 'none',
    maxWordsPerLine: 6,
    position: 'center',
  },

  ugc_captions: {
    id: 'ugc_captions',
    name: 'UGC Captions',
    nameHe: 'כתוביות UGC',
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: 28,
    fontWeight: 600,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 4,
    padding: '10px 16px',
    textTransform: 'none',
    maxWordsPerLine: 10,
    position: 'bottom',
  },

  luxury_minimal: {
    id: 'luxury_minimal',
    name: 'Luxury Minimal',
    nameHe: 'יוקרה מינימלית',
    fontFamily: 'Playfair Display, serif',
    fontSize: 36,
    fontWeight: 400,
    color: '#F5F5F5',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 0,
    padding: '8px 16px',
    textTransform: 'none',
    maxWordsPerLine: 7,
    position: 'bottom',
  },

  sales_cta: {
    id: 'sales_cta',
    name: 'Sales CTA',
    nameHe: 'CTA מכירות',
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 38,
    fontWeight: 700,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 102, 204, 0.8)',
    borderRadius: 12,
    padding: '14px 28px',
    textTransform: 'uppercase',
    maxWordsPerLine: 5,
    position: 'bottom',
  },
};

/**
 * Get a caption animation preset by ID.
 * @param id - The caption animation type
 * @returns The caption animation preset
 */
export function getCaptionAnimation(id: CaptionAnimationType): CaptionAnimationPreset {
  return CAPTION_ANIMATIONS[id];
}

/**
 * Get a subtitle style preset by ID.
 * @param id - The subtitle style ID
 * @returns The subtitle style preset
 */
export function getSubtitleStyle(id: SubtitleStyleId): SubtitleStylePreset {
  return SUBTITLE_STYLES[id];
}
