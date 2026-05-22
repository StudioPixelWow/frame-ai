/**
 * PixelManageAI — Video Pipeline
 * ייצוא מרכזי של מנוע הצינור, אימות, וסוגי נתונים.
 */

// --- Types ---
export type {
  VideoVersionType,
  PipelineStatus,
  AIAnalysisStatus,
  RenderStatus,
  HookStepStatus,
  TrimCropStepStatus,
  PreEditStepStatus,
  AspectRatio,
  VideoMetadata,
  VideoValidation,
  HookSelection,
  HookRecommendation,
  HookAnalysis,
  TrimCropData,
  VideoVersion,
  DetectedScene,
  SilenceSegment,
  DeadMoment,
  EmotionMapEntry,
  AIAnalysisResult,
  AuditEntry,
  VideoPipelineState,
  SourceValidationChecks,
  SourceValidationResult,
} from './types';

// --- Validator ---
export {
  validateSource,
  canProceedToStep,
  getNextStep,
  addAuditEntry,
} from './pipeline-validator';

// --- Engine ---
export {
  initializePipeline,
  completeHookSelection,
  completeHookGeneration,
  completeTrimCrop,
  completeFinalPreEdit,
  startAIAnalysis,
  completeAIAnalysis,
  markEditingReady,
  getActiveVideoId,
} from './pipeline-engine';
