/**
 * UGC Branded Video Composition — Type Definitions
 * Types for the premium cinematic branded ad engine.
 */

import type { Format } from './types';

// ─── Visual Style System ───────────────────────────────────────────
export type VisualStyleId =
  | 'cinematic-dark'
  | 'clean-minimal'
  | 'bold-energy'
  | 'luxury-gold'
  | 'neon-glow'
  | 'organic-warm'
  | 'corporate-pro'
  | 'social-pop';

export interface VisualStyleDef {
  id: VisualStyleId;
  label: string;         // Hebrew
  labelEn: string;       // English fallback
  description: string;   // Hebrew
  bgGradient: string[];  // CSS gradient stops
  accentColor: string;
  textColor: string;
  overlayOpacity: number;
  fontFamily: string;
  motionIntensity: number; // 0-1
  filmGrain: boolean;
  vignette: boolean;
  colorGrading: 'warm' | 'cool' | 'neutral' | 'vivid' | 'moody';
}

export const VISUAL_STYLES: Record<VisualStyleId, VisualStyleDef> = {
  'cinematic-dark': {
    id: 'cinematic-dark',
    label: 'קולנועי כהה',
    labelEn: 'Cinematic Dark',
    description: 'מראה קולנועי עם טונים כהים, עמקות צבע עשירה ואווירה דרמטית',
    bgGradient: ['#0a0a0f', '#1a1a2e', '#16213e'],
    accentColor: '#e2b55a',
    textColor: '#f5f5f5',
    overlayOpacity: 0.6,
    fontFamily: 'Assistant',
    motionIntensity: 0.7,
    filmGrain: true,
    vignette: true,
    colorGrading: 'moody',
  },
  'clean-minimal': {
    id: 'clean-minimal',
    label: 'נקי ומינימלי',
    labelEn: 'Clean Minimal',
    description: 'עיצוב נקי ומודרני עם רקעים בהירים ושפה עיצובית מינימליסטית',
    bgGradient: ['#fafafa', '#f0f0f0', '#e8e8e8'],
    accentColor: '#2563eb',
    textColor: '#1a1a1a',
    overlayOpacity: 0.15,
    fontFamily: 'Assistant',
    motionIntensity: 0.3,
    filmGrain: false,
    vignette: false,
    colorGrading: 'neutral',
  },
  'bold-energy': {
    id: 'bold-energy',
    label: 'אנרגטי ונועז',
    labelEn: 'Bold Energy',
    description: 'צבעים חזקים, תנועה אגרסיבית ואנרגיה גבוהה — מושלם למכירות',
    bgGradient: ['#ff0844', '#ffb199', '#ff6a00'],
    accentColor: '#ffffff',
    textColor: '#ffffff',
    overlayOpacity: 0.4,
    fontFamily: 'Assistant',
    motionIntensity: 1.0,
    filmGrain: false,
    vignette: false,
    colorGrading: 'vivid',
  },
  'luxury-gold': {
    id: 'luxury-gold',
    label: 'יוקרתי זהוב',
    labelEn: 'Luxury Gold',
    description: 'זהב, שחור עמוק ואלמנטים יוקרתיים — לפרימיום ובראנדים יוקרתיים',
    bgGradient: ['#0c0c0c', '#1a1a1a', '#2d2006'],
    accentColor: '#d4af37',
    textColor: '#f5e6c8',
    overlayOpacity: 0.5,
    fontFamily: 'Assistant',
    motionIntensity: 0.5,
    filmGrain: true,
    vignette: true,
    colorGrading: 'warm',
  },
  'neon-glow': {
    id: 'neon-glow',
    label: 'ניאון זוהר',
    labelEn: 'Neon Glow',
    description: 'ניאון חזק על רקע כהה — טכנולוגי, צעיר ומגניב',
    bgGradient: ['#0f0f23', '#1a0a2e', '#0d1117'],
    accentColor: '#00f5d4',
    textColor: '#e0e0ff',
    overlayOpacity: 0.45,
    fontFamily: 'Assistant',
    motionIntensity: 0.8,
    filmGrain: false,
    vignette: true,
    colorGrading: 'cool',
  },
  'organic-warm': {
    id: 'organic-warm',
    label: 'אורגני וחם',
    labelEn: 'Organic Warm',
    description: 'טונים חמים וטבעיים — מושלם לבריאות, מזון ואורח חיים',
    bgGradient: ['#fef3e2', '#fde8c9', '#f5deb3'],
    accentColor: '#c0692b',
    textColor: '#3d2914',
    overlayOpacity: 0.2,
    fontFamily: 'Assistant',
    motionIntensity: 0.4,
    filmGrain: false,
    vignette: false,
    colorGrading: 'warm',
  },
  'corporate-pro': {
    id: 'corporate-pro',
    label: 'עסקי מקצועי',
    labelEn: 'Corporate Pro',
    description: 'מראה מקצועי וסמכותי — עבור B2B, פיננסים ושירותים',
    bgGradient: ['#0f172a', '#1e293b', '#334155'],
    accentColor: '#3b82f6',
    textColor: '#f1f5f9',
    overlayOpacity: 0.35,
    fontFamily: 'Assistant',
    motionIntensity: 0.4,
    filmGrain: false,
    vignette: false,
    colorGrading: 'cool',
  },
  'social-pop': {
    id: 'social-pop',
    label: 'סושיאל פופ',
    labelEn: 'Social Pop',
    description: 'צבעוני, שובב ומושך — מושלם לאינסטגרם, טיקטוק וריילס',
    bgGradient: ['#667eea', '#764ba2', '#f093fb'],
    accentColor: '#fbbf24',
    textColor: '#ffffff',
    overlayOpacity: 0.3,
    fontFamily: 'Assistant',
    motionIntensity: 0.9,
    filmGrain: false,
    vignette: false,
    colorGrading: 'vivid',
  },
};

// ─── Strict 5-Scene Cinematic Structure ────────────────────────────
// ENFORCED: Every generated video follows exactly this scene order.
// Scene proportions scale to any duration (15s / 30s / 45s / 60s).
//
//  Scene 1 — HOOK        (20% of duration) : Attention-grabbing opening, bold text, dynamic motion
//  Scene 2 — PROBLEM     (20% of duration) : Pain point / relatable situation, sharp delivery
//  Scene 3 — SOLUTION    (20% of duration) : Product/service intro, visual emphasis, subtle logo
//  Scene 4 — PRODUCT     (20% of duration) : Strong product presence, hero shot, benefits overlay
//  Scene 5 — CTA         (20% of duration) : Clear CTA, text overlay, logo lockup, ad closing feel

export type SceneType =
  | 'hook'
  | 'problem'
  | 'solution'
  | 'product_highlight'
  | 'cta';

/** The mandatory scene order — must always be exactly these 5 in this order */
export const MANDATORY_SCENE_ORDER: SceneType[] = [
  'hook',
  'problem',
  'solution',
  'product_highlight',
  'cta',
];

/** Proportion of total duration each scene gets (must sum to 1.0) */
export const SCENE_PROPORTIONS: Record<SceneType, number> = {
  hook: 0.20,
  problem: 0.20,
  solution: 0.20,
  product_highlight: 0.20,
  cta: 0.20,
};

/** Duration presets in seconds */
export type DurationPreset = 15 | 30 | 45 | 60;
export const DURATION_PRESETS: { value: DurationPreset; label: string }[] = [
  { value: 15, label: '15 שניות' },
  { value: 30, label: '30 שניות' },
  { value: 45, label: '45 שניות' },
  { value: 60, label: '60 שניות' },
];

/** Per-scene enforced visual rules */
export interface SceneVisualRules {
  avatarScale: number;
  avatarPosition: 'center' | 'left' | 'right' | 'bottom-left' | 'bottom-right';
  showLogo: boolean;        // relative to whether logo is uploaded
  showProduct: boolean;     // relative to whether product image is uploaded
  transition: 'cut' | 'fade' | 'slide' | 'zoom' | 'blur';
  motionPreset: 'static' | 'slow-zoom' | 'drift' | 'pulse' | 'parallax' | 'zoom-out' | 'shake';
  bgGradientAngle: number;  // Different per scene to break monotony
  overlayRequired: boolean;  // Scene MUST have a text overlay
  bgIntensity: number;
}

/** Enforced visual rules per scene type — guarantees visual variety */
export const SCENE_VISUAL_RULES: Record<SceneType, SceneVisualRules> = {
  hook: {
    avatarScale: 0.85,
    avatarPosition: 'center',
    showLogo: false,
    showProduct: false,
    transition: 'zoom',          // Bold zoom entry
    motionPreset: 'pulse',       // Energetic pulsing
    bgGradientAngle: 135,
    overlayRequired: true,       // Must have attention text
    bgIntensity: 0.35,
  },
  problem: {
    avatarScale: 0.70,
    avatarPosition: 'right',
    showLogo: false,
    showProduct: false,
    transition: 'slide',         // Slide in from different direction
    motionPreset: 'slow-zoom',
    bgGradientAngle: 225,        // Different angle than hook
    overlayRequired: true,
    bgIntensity: 0.45,
  },
  solution: {
    avatarScale: 0.60,
    avatarPosition: 'left',
    showLogo: true,              // Subtle logo appears
    showProduct: true,           // Product enters
    transition: 'blur',          // Dreamy reveal
    motionPreset: 'drift',
    bgGradientAngle: 45,
    overlayRequired: true,
    bgIntensity: 0.50,
  },
  product_highlight: {
    avatarScale: 0.40,
    avatarPosition: 'bottom-right',
    showLogo: false,
    showProduct: true,           // Product is hero
    transition: 'zoom',          // Dramatic zoom into product
    motionPreset: 'parallax',
    bgGradientAngle: 315,
    overlayRequired: true,       // Benefits / features text
    bgIntensity: 0.60,
  },
  cta: {
    avatarScale: 0,              // No avatar — brand end card
    avatarPosition: 'center',
    showLogo: true,              // Strong logo lockup
    showProduct: false,
    transition: 'fade',          // Clean fade to end
    motionPreset: 'static',
    bgGradientAngle: 180,
    overlayRequired: true,       // CTA text required
    bgIntensity: 0.80,
  },
};

export interface SceneBeat {
  id: string;
  type: SceneType;
  startSec: number;
  endSec: number;
  text: string;           // The spoken text for this beat
  overlay?: string;       // Short text overlay (headline / tagline)
  showLogo: boolean;
  showProduct: boolean;
  bgIntensity: number;    // 0-1 how prominent the background is vs avatar
  avatarScale: number;    // 0-1 how large the avatar is (0 = hidden)
  avatarPosition: 'center' | 'left' | 'right' | 'bottom-left' | 'bottom-right';
  transition: 'cut' | 'fade' | 'slide' | 'zoom' | 'blur';
  motionPreset: 'static' | 'slow-zoom' | 'drift' | 'pulse' | 'parallax' | 'zoom-out' | 'shake';
  bgGradientAngle?: number;  // Per-scene gradient rotation
}

// ─── UGC Composition Props ─────────────────────────────────────────
export interface UGCCompositionProps {
  // Source video (HeyGen avatar output)
  avatarVideoUrl: string;
  durationSec: number;
  format: Format | string;

  // Visual style
  visualStyle: VisualStyleId;

  // Scenes (from AI script analysis)
  scenes: SceneBeat[];

  // Brand assets
  logoUrl: string | null;
  productImageUrl: string | null;
  brandName: string;
  tagline: string;

  // Music
  musicUrl: string | null;
  musicVolume: number; // 0-100

  // Platform target
  platform: 'instagram-reels' | 'tiktok' | 'youtube-shorts' | 'facebook' | 'linkedin' | 'generic';

  // Advanced
  ctaText: string;
  ctaUrl: string;
  watermarkEnabled: boolean;
}

// Default props for the composition
export const defaultUGCProps: UGCCompositionProps = {
  avatarVideoUrl: '',
  durationSec: 30,
  format: '9:16',
  visualStyle: 'cinematic-dark',
  scenes: [],
  logoUrl: null,
  productImageUrl: null,
  brandName: '',
  tagline: '',
  musicUrl: null,
  musicVolume: 20,
  platform: 'generic',
  ctaText: '',
  ctaUrl: '',
  watermarkEnabled: false,
};

// ─── Script-to-Scene AI Output ─────────────────────────────────────
export interface ScriptAnalysis {
  scenes: SceneBeat[];
  totalDurationSec: number;
  suggestedStyle: VisualStyleId;
  musicMood: string;
}

// ─── Post-Composition Validation ───────────────────────────────────
export interface VideoValidationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}

/** Validate that a set of scenes meets the strict cinematic structure requirements */
export function validateSceneStructure(
  scenes: SceneBeat[],
  totalDurationSec: number,
  hasLogo: boolean,
  hasProductImage: boolean,
): VideoValidationResult {
  const checks: VideoValidationResult['checks'] = [];

  // 1. Exactly 5 scenes
  checks.push({
    name: 'scene_count',
    passed: scenes.length === 5,
    detail: `Expected 5 scenes, got ${scenes.length}`,
  });

  // 2. Scene order matches mandatory order
  const actualOrder = scenes.map(s => s.type);
  const orderMatch = MANDATORY_SCENE_ORDER.every((t, i) => actualOrder[i] === t);
  checks.push({
    name: 'scene_order',
    passed: orderMatch,
    detail: orderMatch ? 'Correct order' : `Expected ${MANDATORY_SCENE_ORDER.join('→')}, got ${actualOrder.join('→')}`,
  });

  // 3. Timing covers full duration with no gaps
  if (scenes.length > 0) {
    const startsAt0 = Math.abs(scenes[0].startSec) < 0.1;
    const endsAtDuration = Math.abs(scenes[scenes.length - 1].endSec - totalDurationSec) < 0.5;
    checks.push({
      name: 'timing_coverage',
      passed: startsAt0 && endsAtDuration,
      detail: `Start: ${scenes[0].startSec}s, End: ${scenes[scenes.length - 1].endSec}s (expected 0-${totalDurationSec})`,
    });
  }

  // 4. Product shown in solution + product_highlight scenes
  if (hasProductImage) {
    const solutionScene = scenes.find(s => s.type === 'solution');
    const productScene = scenes.find(s => s.type === 'product_highlight');
    const productShown = (solutionScene?.showProduct || false) && (productScene?.showProduct || false);
    checks.push({
      name: 'product_visible',
      passed: productShown,
      detail: productShown ? 'Product shown in solution + product_highlight' : 'Product missing from required scenes',
    });
  }

  // 5. CTA exists and has no avatar (end card)
  const ctaScene = scenes.find(s => s.type === 'cta');
  checks.push({
    name: 'cta_end_card',
    passed: !!ctaScene && ctaScene.avatarScale === 0,
    detail: ctaScene ? `CTA avatarScale: ${ctaScene.avatarScale}` : 'No CTA scene found',
  });

  // 6. Logo shown in CTA if available
  if (hasLogo) {
    checks.push({
      name: 'logo_in_cta',
      passed: !!ctaScene?.showLogo,
      detail: ctaScene?.showLogo ? 'Logo in CTA' : 'Logo missing from CTA',
    });
  }

  // 7. Hook is dynamic (not static preset)
  const hookScene = scenes.find(s => s.type === 'hook');
  const hookDynamic = !!hookScene && hookScene.motionPreset !== 'static';
  checks.push({
    name: 'hook_dynamic',
    passed: hookDynamic,
    detail: hookDynamic ? `Hook motion: ${hookScene?.motionPreset}` : 'Hook is static — must be dynamic',
  });

  // 8. Visual variety: avatarPosition varies across scenes
  const positions = scenes.filter(s => s.avatarScale > 0).map(s => s.avatarPosition);
  const uniquePositions = new Set(positions).size;
  checks.push({
    name: 'position_variety',
    passed: uniquePositions >= 3,
    detail: `${uniquePositions} unique avatar positions (need 3+)`,
  });

  // 9. Transitions vary
  const transitions = scenes.map(s => s.transition);
  const uniqueTransitions = new Set(transitions).size;
  checks.push({
    name: 'transition_variety',
    passed: uniqueTransitions >= 3,
    detail: `${uniqueTransitions} unique transitions (need 3+)`,
  });

  // 10. No scene has static motion + no overlay (= dead air)
  const deadAirScenes = scenes.filter(s => s.motionPreset === 'static' && !s.overlay && s.type !== 'cta');
  checks.push({
    name: 'no_dead_air',
    passed: deadAirScenes.length === 0,
    detail: deadAirScenes.length === 0 ? 'No dead air' : `${deadAirScenes.length} scene(s) with no motion and no overlay`,
  });

  return {
    passed: checks.every(c => c.passed),
    checks,
  };
}

/** Build enforced 5-scene structure from a duration, applying mandatory visual rules */
export function buildEnforcedScenes(
  totalDurationSec: number,
  hasLogo: boolean,
  hasProductImage: boolean,
  overlays?: Partial<Record<SceneType, string>>,
): SceneBeat[] {
  let cursor = 0;
  return MANDATORY_SCENE_ORDER.map((type, i) => {
    const proportion = SCENE_PROPORTIONS[type];
    const dur = Math.round(totalDurationSec * proportion * 10) / 10;
    const rules = SCENE_VISUAL_RULES[type];
    const startSec = cursor;
    cursor += dur;
    // Snap last scene end to exact duration
    const endSec = i === MANDATORY_SCENE_ORDER.length - 1 ? totalDurationSec : cursor;
    return {
      id: `scene_${i}`,
      type,
      startSec,
      endSec,
      text: '',
      overlay: overlays?.[type] || '',
      showLogo: rules.showLogo && hasLogo,
      showProduct: rules.showProduct && hasProductImage,
      bgIntensity: rules.bgIntensity,
      avatarScale: rules.avatarScale,
      avatarPosition: rules.avatarPosition,
      transition: rules.transition,
      motionPreset: rules.motionPreset,
      bgGradientAngle: rules.bgGradientAngle,
    };
  });
}
