// Export all video editor components
export { default as SmartVideoTimeline } from './SmartVideoTimeline';
export { default as ClipBlock } from './ClipBlock';
export { default as TrimHandles } from './TrimHandles';
export { default as PlayheadScrubber } from './PlayheadScrubber';
export { default as BeatMarkerLayer } from './BeatMarkerLayer';
export { default as TransitionPicker } from './TransitionPicker';
export { default as MotionEffectPicker } from './MotionEffectPicker';
export { default as StylePackSelector } from './StylePackSelector';
export { default as CaptionMotionSelector } from './CaptionMotionSelector';
export { default as AutoEditButton } from './AutoEditButton';
export { default as AIEditDraftPanel } from './AIEditDraftPanel';
export { default as RenderPreviewPanel } from './RenderPreviewPanel';

// Re-export types for convenience
export type { VideoEditProject, Clip, Transition, MotionEffect, BeatMarker, BeatSyncConfig } from '@/lib/video-editor/types';
