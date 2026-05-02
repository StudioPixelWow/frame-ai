/**
 * Video Editor Engine — Main Export
 * Complete premium AI video editing engine API.
 */

// ═══════════════════════════════════════════════════════════════
// CUT PRESETS
// ═══════════════════════════════════════════════════════════════

export { CUT_PRESETS, getCutPreset } from './cuts';

export type { CutPreset } from './types';

// ═══════════════════════════════════════════════════════════════
// TRANSITION PRESETS
// ═══════════════════════════════════════════════════════════════

export {
  TRANSITION_PRESETS,
  TRANSITION_CATEGORY_LABELS,
  getTransitionsByCategory,
  getTransitionPreset,
} from './transitions';

export type { TransitionPreset } from './types';

// ═══════════════════════════════════════════════════════════════
// MOTION EFFECTS
// ═══════════════════════════════════════════════════════════════

export { MOTION_PRESETS, MOTION_INTENSITY_MULTIPLIERS, getMotionPreset } from './motion';

export type { MotionPreset, MotionEffect } from './types';

// ═══════════════════════════════════════════════════════════════
// BEAT SYNC & RHYTHM
// ═══════════════════════════════════════════════════════════════

export {
  BPM_PRESETS,
  generateBeatMarkers,
  createBeatSyncConfig,
  snapToNearestBeat,
  suggestCutPoints,
} from './beat-sync';

export type { BeatMarker, BeatSyncConfig } from './types';

// ═══════════════════════════════════════════════════════════════
// AI DIRECTOR & STYLE PACKS
// ═══════════════════════════════════════════════════════════════

export { STYLE_PACKS, getStylePack, recommendStylePack } from './ai-director';

export type { StylePack } from './types';

// ═══════════════════════════════════════════════════════════════
// CAPTIONS & SUBTITLES
// ═══════════════════════════════════════════════════════════════

export {
  CAPTION_ANIMATIONS,
  SUBTITLE_STYLES,
  getCaptionAnimation,
  getSubtitleStyle,
} from './captions';

export type { CaptionAnimationPreset, SubtitleStylePreset, CaptionEntry } from './types';

// ═══════════════════════════════════════════════════════════════
// AUTO-EDIT ENGINE
// ═══════════════════════════════════════════════════════════════

export { generateAutoEdit } from './auto-edit';

export type { AIEditDraft } from './types';

// ═══════════════════════════════════════════════════════════════
// SAFETY & ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════

export { DEFAULT_SAFETY_CONFIG, validateEditSafety } from './safety';

export type { SafetyConfig, SafetyReport, SafetyWarning } from './types';

// ═══════════════════════════════════════════════════════════════
// CORE TYPES (Re-exported for convenience)
// ═══════════════════════════════════════════════════════════════

export type {
  CutType,
  TransitionCategory,
  TransitionType,
  MotionEffectType,
  EffectIntensity,
  PacingMode,
  StylePackId,
  CaptionAnimationType,
  SubtitleStyleId,
  TimelineState,
  Easing,
  Clip,
  Transition,
  VideoEditProject,
} from './types';
