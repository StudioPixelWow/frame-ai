/**
 * Video Editor — Complete Type System
 * Premium AI video editing layer types.
 */

/* ═══════════════════════════════════════════════════════════════════════
   CORE ENUMS & LITERALS
   ═══════════════════════════════════════════════════════════════════════ */

export type CutType =
  | 'hard_cut'
  | 'match_cut'
  | 'punch_in'
  | 'speed_ramp'
  | 'jump_cut'
  | 'beat_cut'
  | 'impact_cut';

export type TransitionCategory =
  | 'clean_premium'
  | 'social_fast'
  | 'luxury'
  | 'food_retail'
  | 'ugc';

export type TransitionType =
  // Clean Premium
  | 'fade' | 'crossfade' | 'soft_dissolve' | 'subtle_slide' | 'light_wipe'
  // Social / TikTok Fast
  | 'whip_pan' | 'zoom_snap' | 'blur_swipe' | 'quick_flash' | 'shake_hit' | 'speed_push'
  // Luxury
  | 'slow_cinematic_fade' | 'elegant_parallax' | 'soft_zoom_dissolve' | 'curtain_reveal' | 'depth_blur'
  // Food / Retail
  | 'pop_zoom' | 'snap_reveal' | 'object_wipe' | 'bounce_reveal' | 'fast_product_punch'
  // UGC
  | 'ugc_jump_cut' | 'subtitle_punch' | 'zoom_emphasis' | 'reaction_cut' | 'pause_removal';

export type MotionEffectType =
  | 'slow_zoom_in'
  | 'slow_zoom_out'
  | 'parallax_push'
  | 'handheld_micro'
  | 'product_hero_push'
  | 'cinematic_pan'
  | 'social_punch_zoom'
  | 'floating_premium'
  | 'smooth_slide'
  | 'dramatic_reveal';

export type EffectIntensity = 'subtle' | 'medium' | 'strong';

export type PacingMode = 'slow_premium' | 'medium_commercial' | 'fast_social' | 'aggressive_viral';

export type StylePackId =
  | 'premium_real_estate'
  | 'food_social'
  | 'ugc_ad'
  | 'luxury_brand'
  | 'sales_lead_gen'
  | 'event_lifestyle';

export type CaptionAnimationType =
  | 'fade_up'
  | 'punch_in'
  | 'type_reveal'
  | 'kinetic_bounce'
  | 'slide_reveal'
  | 'premium_soft'
  | 'highlight_pop';

export type SubtitleStyleId =
  | 'clean_premium'
  | 'tiktok_bold'
  | 'ugc_captions'
  | 'luxury_minimal'
  | 'sales_cta';

export type TimelineState =
  | 'idle'
  | 'selected'
  | 'hovered'
  | 'dragging'
  | 'trimming'
  | 'previewing_transition';

export type Easing =
  | 'linear'
  | 'ease_in'
  | 'ease_out'
  | 'ease_in_out'
  | 'spring'
  | 'bounce'
  | 'snap';

/* ═══════════════════════════════════════════════════════════════════════
   CUT PRESETS
   ═══════════════════════════════════════════════════════════════════════ */

export interface CutPreset {
  id: CutType;
  name: string;
  nameHe: string;
  description: string;
  descriptionHe: string;
  /** Default duration in ms (0 for instant cuts) */
  duration: number;
  easing: Easing;
  /** CSS preview class name */
  previewClass: string;
  /** Recommended use cases */
  recommended: string[];
}

/* ═══════════════════════════════════════════════════════════════════════
   TRANSITION PRESETS
   ═══════════════════════════════════════════════════════════════════════ */

export interface TransitionPreset {
  id: TransitionType;
  name: string;
  nameHe: string;
  category: TransitionCategory;
  /** Duration in ms */
  duration: number;
  easing: Easing;
  /** Visual behavior description for preview/render */
  behavior: string;
  /** CSS keyframe name for preview animation */
  cssPreview: string;
  recommendedUseCase: string;
  recommendedUseCaseHe: string;
  /** Icon emoji for UI */
  icon: string;
  /** Compatibility notes */
  notes: string;
  /** Is this a "heavy" effect for safety guardrails */
  isHeavy: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════
   MOTION EFFECTS
   ═══════════════════════════════════════════════════════════════════════ */

export interface MotionPreset {
  id: MotionEffectType;
  name: string;
  nameHe: string;
  description: string;
  /** Scale range [start, end] — 1.0 = no zoom */
  scale: [number, number];
  /** Position offset [x%, y%] */
  position: [number, number];
  easing: Easing;
  /** How the duration relates to clip: 'full' covers entire clip, 'start'/'end' partial */
  durationBehavior: 'full' | 'start' | 'end';
  /** Default intensity */
  defaultIntensity: EffectIntensity;
  /** Icon emoji for UI */
  icon: string;
}

/** Motion effect applied to a specific clip */
export interface MotionEffect {
  clipId: string;
  type: MotionEffectType;
  intensity: EffectIntensity;
  /** Relative start within clip (0-1) */
  startTime: number;
  /** Relative end within clip (0-1) */
  endTime: number;
}

/* ═══════════════════════════════════════════════════════════════════════
   BEAT SYNC / RHYTHM
   ═══════════════════════════════════════════════════════════════════════ */

export interface BeatMarker {
  /** Time in seconds from start */
  time: number;
  /** Beat strength 0-1 */
  strength: number;
  /** Is this a downbeat (strong beat) */
  isDownbeat: boolean;
}

export interface BeatSyncConfig {
  bpm: number;
  pacing: PacingMode;
  /** Snap tolerance in ms */
  snapTolerance: number;
  markers: BeatMarker[];
  /** Whether markers were auto-generated or from audio analysis */
  source: 'manual' | 'auto_bpm' | 'audio_analysis';
}

/* ═══════════════════════════════════════════════════════════════════════
   AI DIRECTOR STYLE PACKS
   ═══════════════════════════════════════════════════════════════════════ */

export interface StylePack {
  id: StylePackId;
  name: string;
  nameHe: string;
  description: string;
  descriptionHe: string;
  icon: string;
  pacing: PacingMode;
  preferredCuts: CutType[];
  preferredTransitions: TransitionType[];
  preferredMotions: MotionEffectType[];
  subtitleStyle: SubtitleStyleId;
  captionAnimation: CaptionAnimationType;
  /** Seconds from end where CTA should appear */
  ctaTiming: number;
  recommendedPlatforms: string[];
  /** Max clip duration in seconds for this style */
  maxClipDuration: number;
  /** Min clip duration in seconds for this style */
  minClipDuration: number;
}

/* ═══════════════════════════════════════════════════════════════════════
   CAPTION / TEXT MOTION
   ═══════════════════════════════════════════════════════════════════════ */

export interface CaptionAnimationPreset {
  id: CaptionAnimationType;
  name: string;
  nameHe: string;
  description: string;
  /** CSS animation class name */
  cssClass: string;
  /** Duration in ms */
  duration: number;
  easing: Easing;
  icon: string;
}

export interface SubtitleStylePreset {
  id: SubtitleStyleId;
  name: string;
  nameHe: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  borderRadius: number;
  padding: string;
  textTransform: 'none' | 'uppercase';
  maxWordsPerLine: number;
  position: 'bottom' | 'center' | 'top';
}

export interface CaptionEntry {
  id: string;
  text: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  animation: CaptionAnimationType;
  style: SubtitleStyleId;
  /** Emphasis words (indices) */
  emphasisWords: number[];
  /** Is this a CTA caption */
  isCTA: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════
   CLIP & TIMELINE
   ═══════════════════════════════════════════════════════════════════════ */

export interface Clip {
  id: string;
  /** Source video/image URL */
  sourceUrl: string;
  /** Original media duration in seconds */
  duration: number;
  /** Absolute start in timeline (seconds) */
  start: number;
  /** Absolute end in timeline (seconds) */
  end: number;
  /** Trim start offset within source (seconds) */
  trimStart: number;
  /** Trim end offset within source (seconds) */
  trimEnd: number;
  /** Applied motion effect */
  motionEffect: MotionEffect | null;
  /** Captions on this clip */
  captions: CaptionEntry[];
  /** Sort order */
  order: number;
  /** Thumbnail URL (generated) */
  thumbnailUrl: string;
  /** Display label */
  label: string;
}

export interface Transition {
  fromClipId: string;
  toClipId: string;
  type: TransitionType;
  /** Duration in ms */
  duration: number;
  easing: Easing;
  intensity: EffectIntensity;
  /** Optional cut type override */
  cutType: CutType | null;
}

/* ═══════════════════════════════════════════════════════════════════════
   VIDEO EDIT PROJECT — MAIN DATA MODEL
   ═══════════════════════════════════════════════════════════════════════ */

export interface VideoEditProject {
  id: string;
  /** Link to existing Project record */
  projectId: string;
  clips: Clip[];
  transitions: Transition[];
  motions: MotionEffect[];
  captions: CaptionEntry[];
  stylePack: StylePackId | null;
  pacing: PacingMode;
  beatSync: BeatSyncConfig | null;
  /** AI-generated edit draft (separate from user edits) */
  aiEditDraft: AIEditDraft | null;
  /** Timeline zoom level (pixels per second) */
  zoomLevel: number;
  /** Playhead position in seconds */
  playheadPosition: number;
  /** Total duration in seconds */
  totalDuration: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIEditDraft {
  clips: Clip[];
  transitions: Transition[];
  motions: MotionEffect[];
  captions: CaptionEntry[];
  stylePack: StylePackId;
  pacing: PacingMode;
  /** Explanation of choices made */
  reasoning: string;
  reasoningHe: string;
  /** Confidence score 0-1 */
  confidence: number;
  createdAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   SAFETY
   ═══════════════════════════════════════════════════════════════════════ */

export interface SafetyConfig {
  maxHeavyTransitions: number;
  maxShakeEffects: number;
  maxFlashEffects: number;
  respectReducedMotion: boolean;
  maxFlashFrequencyHz: number;
}

export interface SafetyReport {
  isValid: boolean;
  warnings: SafetyWarning[];
}

export interface SafetyWarning {
  type: 'heavy_transitions' | 'shake_overuse' | 'flash_risk' | 'pacing_chaos' | 'accessibility';
  message: string;
  messageHe: string;
  severity: 'info' | 'warning' | 'error';
  clipIds?: string[];
}

/* ═══════════════════════════════════════════════════════════════════════
   TIMELINE UI STATE
   ═══════════════════════════════════════════════════════════════════════ */

export interface TimelineUIState {
  selectedClipId: string | null;
  hoveredClipId: string | null;
  dragState: {
    isDragging: boolean;
    clipId: string | null;
    startX: number;
    currentX: number;
  };
  trimState: {
    isTrimming: boolean;
    clipId: string | null;
    handle: 'start' | 'end' | null;
    startX: number;
    currentX: number;
  };
  previewingTransition: string | null;
  zoomLevel: number;
  scrollOffset: number;
}

/* ═══════════════════════════════════════════════════════════════════════
   RENDER CONFIG (serializable for Remotion)
   ═══════════════════════════════════════════════════════════════════════ */

export interface VideoEditorRenderConfig {
  projectId: string;
  clips: Clip[];
  transitions: Transition[];
  motions: MotionEffect[];
  captions: CaptionEntry[];
  stylePack: StylePackId | null;
  pacing: PacingMode;
  beatMarkers: BeatMarker[];
  totalDuration: number;
  format: '9:16' | '16:9' | '1:1' | '4:5';
  fps: number;
  quality: 'draft' | 'preview' | 'production';
}
