/**
 * Motion Effects Presets Engine
 * Premium AI video editor motion effect configurations.
 */

import type { MotionEffectType, MotionPreset, EffectIntensity } from './types';

/** Intensity multipliers for scaling motion effects */
export const MOTION_INTENSITY_MULTIPLIERS: Record<EffectIntensity, number> = {
  subtle: 0.5,
  medium: 1.0,
  strong: 1.5,
};

/** All motion effect presets */
export const MOTION_PRESETS: Record<MotionEffectType, MotionPreset> = {
  slow_zoom_in: {
    id: 'slow_zoom_in',
    name: 'Slow Zoom In',
    nameHe: 'זום איטי פנימה',
    description: 'Gentle, cinematic zoom from 80% to 120% scale.',
    scale: [0.8, 1.2],
    position: [0, 0],
    easing: 'ease_in_out',
    durationBehavior: 'full',
    defaultIntensity: 'medium',
    icon: '🔍',
  },

  slow_zoom_out: {
    id: 'slow_zoom_out',
    name: 'Slow Zoom Out',
    nameHe: 'זום איטי החוצה',
    description: 'Elegant pullback revealing context, from 120% to 80% scale.',
    scale: [1.2, 0.8],
    position: [0, 0],
    easing: 'ease_in_out',
    durationBehavior: 'full',
    defaultIntensity: 'medium',
    icon: '📐',
  },

  parallax_push: {
    id: 'parallax_push',
    name: 'Parallax Push',
    nameHe: 'דחיפה פרלקס',
    description: 'Layered 3D push effect with slight position offset.',
    scale: [0.95, 1.05],
    position: [-5, -2],
    easing: 'ease_out',
    durationBehavior: 'full',
    defaultIntensity: 'subtle',
    icon: '3️⃣',
  },

  handheld_micro: {
    id: 'handheld_micro',
    name: 'Handheld Micro Motion',
    nameHe: 'תנועת מיקרו יד מחזיקה',
    description: 'Subtle organic shake for authentic handheld feel.',
    scale: [0.99, 1.01],
    position: [-1, -1],
    easing: 'bounce',
    durationBehavior: 'full',
    defaultIntensity: 'subtle',
    icon: '📹',
  },

  product_hero_push: {
    id: 'product_hero_push',
    name: 'Product Hero Push',
    nameHe: 'דחיפת גיבור מוצר',
    description: 'Forward push emphasis perfect for product reveals.',
    scale: [1.0, 1.15],
    position: [0, -10],
    easing: 'ease_out',
    durationBehavior: 'start',
    defaultIntensity: 'medium',
    icon: '🎯',
  },

  cinematic_pan: {
    id: 'cinematic_pan',
    name: 'Cinematic Pan',
    nameHe: 'סט סינמטי',
    description: 'Smooth horizontal or vertical pan across the frame.',
    scale: [1.0, 1.0],
    position: [10, 5],
    easing: 'ease_in_out',
    durationBehavior: 'full',
    defaultIntensity: 'medium',
    icon: '🎬',
  },

  social_punch_zoom: {
    id: 'social_punch_zoom',
    name: 'Social Punch Zoom',
    nameHe: 'פאנץ\' זום חברתי',
    description: 'Quick dramatic zoom in for emphasis and engagement.',
    scale: [1.0, 1.3],
    position: [-5, -5],
    easing: 'ease_out',
    durationBehavior: 'start',
    defaultIntensity: 'strong',
    icon: '💥',
  },

  floating_premium: {
    id: 'floating_premium',
    name: 'Floating Premium',
    nameHe: 'צפיפה פרימיום',
    description: 'Subtle floating motion with gentle bounce for luxury feel.',
    scale: [0.98, 1.02],
    position: [0, -3],
    easing: 'spring',
    durationBehavior: 'full',
    defaultIntensity: 'subtle',
    icon: '✨',
  },

  smooth_slide: {
    id: 'smooth_slide',
    name: 'Smooth Slide',
    nameHe: 'שקופית חלקה',
    description: 'Linear horizontal pan for transitional movement.',
    scale: [1.0, 1.0],
    position: [20, 0],
    easing: 'linear',
    durationBehavior: 'full',
    defaultIntensity: 'medium',
    icon: '➡️',
  },

  dramatic_reveal: {
    id: 'dramatic_reveal',
    name: 'Dramatic Reveal',
    nameHe: 'חשיפה דרמטית',
    description: 'Fast push-in with scale emphasis for impact moments.',
    scale: [0.7, 1.0],
    position: [10, 10],
    easing: 'ease_out',
    durationBehavior: 'start',
    defaultIntensity: 'strong',
    icon: '🎭',
  },
};

/**
 * Get a single motion preset by type.
 * @param type - The motion effect type to retrieve
 * @returns The motion preset configuration
 */
export function getMotionPreset(type: MotionEffectType): MotionPreset {
  return MOTION_PRESETS[type];
}
