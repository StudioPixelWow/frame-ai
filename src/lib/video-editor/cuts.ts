/**
 * Cut Presets Engine
 * Premium AI video editor cut types and configurations.
 */

import type { CutType, CutPreset, Easing } from './types';

/** All cut type presets with comprehensive configurations */
export const CUT_PRESETS: Record<CutType, CutPreset> = {
  hard_cut: {
    id: 'hard_cut',
    name: 'Hard Cut',
    nameHe: 'חיתוך קשה',
    description: 'Instant cut with no transition. Clean, direct, and sharp.',
    descriptionHe: 'חיתוך מיידי ללא מעבר. ישיר וחד.',
    duration: 0,
    easing: 'linear',
    previewClass: 'cut-hard',
    recommended: ['fast-paced videos', 'action sequences', 'comedy timing', 'social media'],
  },

  match_cut: {
    id: 'match_cut',
    name: 'Match Cut',
    nameHe: 'חיתוך התאמה',
    description: 'Cut between similar shapes or movements for visual continuity.',
    descriptionHe: 'חיתוך בין צורות דומות או תנועות לרציפות ויזואלית.',
    duration: 150,
    easing: 'ease_in_out',
    previewClass: 'cut-match',
    recommended: ['product showcases', 'storytelling', 'creative transitions', 'luxury content'],
  },

  punch_in: {
    id: 'punch_in',
    name: 'Punch In',
    nameHe: 'פאנץ\' פנימה',
    description: 'Quick zoom-in cut for emphasis and impact.',
    descriptionHe: 'זום מהיר פנימה לשם הדגשה והשפעה.',
    duration: 200,
    easing: 'ease_out',
    previewClass: 'cut-punch-in',
    recommended: ['product launches', 'reels', 'reactions', 'emphasis moments'],
  },

  speed_ramp: {
    id: 'speed_ramp',
    name: 'Speed Ramp',
    nameHe: 'קפיצת מהירות',
    description: 'Accelerate or decelerate playback into the cut for dynamic energy.',
    descriptionHe: 'האצה או האטה של ההשמעה לתוך החיתוך לאנרגיה דינמית.',
    duration: 300,
    easing: 'ease_in',
    previewClass: 'cut-speed-ramp',
    recommended: ['action reels', 'slow-motion reveals', 'viral moments', 'dramatic shifts'],
  },

  jump_cut: {
    id: 'jump_cut',
    name: 'Jump Cut',
    nameHe: 'קפיצה חד',
    description: 'Same subject, different position. Creates fast-forward effect.',
    descriptionHe: 'אותו נושא, מקום שונה. יוצר אפקט הצעד מהיר.',
    duration: 50,
    easing: 'linear',
    previewClass: 'cut-jump',
    recommended: ['UGC content', 'personal vlogs', 'Q&A videos', 'testimonials'],
  },

  beat_cut: {
    id: 'beat_cut',
    name: 'Beat Cut',
    nameHe: 'חיתוך קצב',
    description: 'Cut synchronized to audio beat or rhythm.',
    descriptionHe: 'חיתוך מסונכרן לקצב או קצב אודיו.',
    duration: 100,
    easing: 'snap',
    previewClass: 'cut-beat',
    recommended: ['music videos', 'trending audio', 'rhythm-based edits', 'viral marketing'],
  },

  impact_cut: {
    id: 'impact_cut',
    name: 'Impact Cut',
    nameHe: 'חיתוך השפעה',
    description: 'Cut with visual impact combined with motion and sound.',
    descriptionHe: 'חיתוך עם השפעה חזותית בשילוב עם תנועה וקול.',
    duration: 250,
    easing: 'ease_out',
    previewClass: 'cut-impact',
    recommended: ['high-energy ads', 'product reveals', 'dramatic moments', 'event highlights'],
  },
};

/**
 * Get a single cut preset by type.
 * @param type - The cut type to retrieve
 * @returns The cut preset configuration
 */
export function getCutPreset(type: CutType): CutPreset {
  return CUT_PRESETS[type];
}
