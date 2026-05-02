/**
 * AI Director Engine — Style Packs
 * Curated style packs for different industries and content types.
 */

import type { StylePackId, StylePack, CaptionAnimationType, SubtitleStyleId } from './types';

/** All available style packs with complete configurations */
export const STYLE_PACKS: Record<StylePackId, StylePack> = {
  premium_real_estate: {
    id: 'premium_real_estate',
    name: 'Premium Real Estate',
    nameHe: 'נדל"ן פרימיום',
    description: 'Cinematic property tours with luxury vibes.',
    descriptionHe: 'סיורי נכס סינמטיים עם אווירה יוקרה.',
    icon: '🏡',
    pacing: 'slow_premium',
    preferredCuts: ['hard_cut', 'match_cut', 'speed_ramp'],
    preferredTransitions: ['slow_cinematic_fade', 'elegant_parallax', 'soft_zoom_dissolve'],
    preferredMotions: ['slow_zoom_in', 'cinematic_pan', 'floating_premium'],
    subtitleStyle: 'luxury_minimal',
    captionAnimation: 'premium_soft',
    ctaTiming: 3,
    recommendedPlatforms: ['Instagram', 'YouTube', 'LinkedIn'],
    maxClipDuration: 15,
    minClipDuration: 2,
  },

  food_social: {
    id: 'food_social',
    name: 'Food Social Media',
    nameHe: 'מזון ברשתות חברתיות',
    description: 'Fast, appetizing reels with playful energy.',
    descriptionHe: 'ריילס מהירים ופיתויים עם אנרגיה שמחה.',
    icon: '🍕',
    pacing: 'fast_social',
    preferredCuts: ['jump_cut', 'punch_in', 'beat_cut'],
    preferredTransitions: ['pop_zoom', 'snap_reveal', 'bounce_reveal'],
    preferredMotions: ['product_hero_push', 'social_punch_zoom', 'handheld_micro'],
    subtitleStyle: 'tiktok_bold',
    captionAnimation: 'kinetic_bounce',
    ctaTiming: 2,
    recommendedPlatforms: ['TikTok', 'Instagram Reels', 'YouTube Shorts'],
    maxClipDuration: 5,
    minClipDuration: 0.5,
  },

  ugc_ad: {
    id: 'ugc_ad',
    name: 'UGC & Authentic Ads',
    nameHe: 'UGC ומודעות אותנטיות',
    description: 'Casual, relatable user-generated content.',
    descriptionHe: 'תוכן קז"א קז"א, קשור ואמין.',
    icon: '👤',
    pacing: 'medium_commercial',
    preferredCuts: ['jump_cut', 'hard_cut', 'beat_cut'],
    preferredTransitions: ['ugc_jump_cut', 'subtitle_punch', 'pause_removal'],
    preferredMotions: ['handheld_micro', 'floating_premium', 'social_punch_zoom'],
    subtitleStyle: 'ugc_captions',
    captionAnimation: 'type_reveal',
    ctaTiming: 2.5,
    recommendedPlatforms: ['Facebook', 'TikTok', 'Instagram'],
    maxClipDuration: 8,
    minClipDuration: 0.8,
  },

  luxury_brand: {
    id: 'luxury_brand',
    name: 'Luxury Brand',
    nameHe: 'ברנד יוקרה',
    description: 'High-end brand storytelling with sophistication.',
    descriptionHe: 'סיפור ברנד משקעי גבוה עם תחכום.',
    icon: '👑',
    pacing: 'slow_premium',
    preferredCuts: ['match_cut', 'speed_ramp', 'impact_cut'],
    preferredTransitions: ['soft_zoom_dissolve', 'curtain_reveal', 'depth_blur'],
    preferredMotions: ['parallax_push', 'cinematic_pan', 'floating_premium'],
    subtitleStyle: 'luxury_minimal',
    captionAnimation: 'premium_soft',
    ctaTiming: 4,
    recommendedPlatforms: ['YouTube', 'Vimeo', 'Instagram'],
    maxClipDuration: 20,
    minClipDuration: 3,
  },

  sales_lead_gen: {
    id: 'sales_lead_gen',
    name: 'Sales & Lead Generation',
    nameHe: 'מכירות וייצור ליד',
    description: 'Conversion-focused ads with clear CTAs.',
    descriptionHe: 'מודעות ממוקדות המרה עם CTAs ברורות.',
    icon: '💼',
    pacing: 'medium_commercial',
    preferredCuts: ['punch_in', 'beat_cut', 'hard_cut'],
    preferredTransitions: ['zoom_snap', 'quick_flash', 'subtitle_punch'],
    preferredMotions: ['product_hero_push', 'social_punch_zoom', 'dramatic_reveal'],
    subtitleStyle: 'sales_cta',
    captionAnimation: 'punch_in',
    ctaTiming: 1.5,
    recommendedPlatforms: ['YouTube', 'Facebook', 'LinkedIn'],
    maxClipDuration: 30,
    minClipDuration: 1,
  },

  event_lifestyle: {
    id: 'event_lifestyle',
    name: 'Event & Lifestyle',
    nameHe: 'אירוע ואורח חיים',
    description: 'Energetic event coverage with lifestyle elements.',
    descriptionHe: 'כיסוי אירוע אנרגטי עם אלמנטים של אורח חיים.',
    icon: '🎉',
    pacing: 'fast_social',
    preferredCuts: ['jump_cut', 'beat_cut', 'punch_in'],
    preferredTransitions: ['whip_pan', 'zoom_snap', 'shake_hit'],
    preferredMotions: ['social_punch_zoom', 'handheld_micro', 'dramatic_reveal'],
    subtitleStyle: 'clean_premium',
    captionAnimation: 'kinetic_bounce',
    ctaTiming: 2,
    recommendedPlatforms: ['Instagram', 'TikTok', 'YouTube'],
    maxClipDuration: 10,
    minClipDuration: 1,
  },
};

/**
 * Get a style pack by ID.
 * @param id - The style pack ID
 * @returns The style pack configuration
 */
export function getStylePack(id: StylePackId): StylePack {
  return STYLE_PACKS[id];
}

/**
 * Recommend a style pack based on project type and industry.
 * Uses keyword matching to suggest the best pack.
 *
 * @param projectType - Type of project (e.g., "ad", "tour", "vlog")
 * @param industry - Industry or category (e.g., "real estate", "food", "luxury")
 * @returns Recommended StylePackId
 */
export function recommendStylePack(projectType: string, industry: string): StylePackId {
  const typeLC = projectType.toLowerCase();
  const industryLC = industry.toLowerCase();
  const combined = `${typeLC} ${industryLC}`.toLowerCase();

  // Real Estate matching
  if (
    industryLC.includes('real estate') ||
    industryLC.includes('property') ||
    industryLC.includes('realestate') ||
    typeLC.includes('tour')
  ) {
    return 'premium_real_estate';
  }

  // Food matching
  if (
    industryLC.includes('food') ||
    industryLC.includes('restaurant') ||
    industryLC.includes('cafe') ||
    industryLC.includes('cooking') ||
    industryLC.includes('recipe')
  ) {
    return 'food_social';
  }

  // Luxury matching
  if (
    industryLC.includes('luxury') ||
    industryLC.includes('high-end') ||
    industryLC.includes('premium brand') ||
    industryLC.includes('jewelry') ||
    industryLC.includes('fashion') ||
    industryLC.includes('designer')
  ) {
    return 'luxury_brand';
  }

  // UGC/Authentic matching
  if (
    industryLC.includes('ugc') ||
    industryLC.includes('authentic') ||
    industryLC.includes('testimonial') ||
    typeLC.includes('ugc') ||
    typeLC.includes('user-generated')
  ) {
    return 'ugc_ad';
  }

  // Sales/Lead Gen matching
  if (
    industryLC.includes('b2b') ||
    industryLC.includes('sales') ||
    industryLC.includes('lead') ||
    typeLC.includes('conversion') ||
    typeLC.includes('webinar')
  ) {
    return 'sales_lead_gen';
  }

  // Event/Lifestyle matching
  if (
    industryLC.includes('event') ||
    industryLC.includes('wedding') ||
    industryLC.includes('lifestyle') ||
    industryLC.includes('travel') ||
    industryLC.includes('music')
  ) {
    return 'event_lifestyle';
  }

  // Default fallback
  return 'clean_premium' in STYLE_PACKS ? 'premium_real_estate' : 'food_social';
}
