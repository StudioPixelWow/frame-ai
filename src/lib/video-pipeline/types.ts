/**
 * PixelManageAI — Video Pipeline Type Definitions
 * סוגי נתונים עבור מנוע הצינור של עיבוד וידאו.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Video Version Types
   ═══════════════════════════════════════════════════════════════════════════ */

/** סוג גרסת וידאו — כל שלב בצינור מייצר גרסה חדשה */
export type VideoVersionType =
  | 'original'
  | 'hook_generated'
  | 'trim_crop_generated'
  | 'final_pre_edit'
  | 'editable'
  | 'exported';

/* ═══════════════════════════════════════════════════════════════════════════
   Pipeline Status — Full Lifecycle
   ═══════════════════════════════════════════════════════════════════════════ */

/** סטטוס הצינור — מחזור חיים מלא של פרויקט וידאו */
export type PipelineStatus =
  | 'uploaded'
  | 'validating'
  | 'proxy_generating'
  | 'ready_for_hook_selection'
  | 'hook_selected'
  | 'hook_generating'
  | 'hook_ready'
  | 'ready_for_trim_crop'
  | 'trim_crop_selected'
  | 'pre_edit_generating'
  | 'pre_edit_ready'
  | 'source_locked'
  | 'ai_analysis_running'
  | 'editing_ready'
  | 'editing'
  | 'rendering'
  | 'exporting'
  | 'completed'
  | 'failed'
  | 'blocked_invalid_source';

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-Status Types
   ═══════════════════════════════════════════════════════════════════════════ */

/** סטטוס ניתוח AI */
export type AIAnalysisStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** סטטוס רינדור */
export type RenderStatus = 'queued' | 'rendering' | 'uploading' | 'completed' | 'failed' | 'cancelled';

/** סטטוס בחירת הוק */
export type HookStepStatus = 'pending' | 'analyzing' | 'ready' | 'selected' | 'generating' | 'completed' | 'skipped';

/** סטטוס חיתוך ומיקוד */
export type TrimCropStepStatus = 'pending' | 'ready' | 'selected' | 'generating' | 'completed' | 'skipped';

/** סטטוס הכנת קובץ לפני עריכה */
export type PreEditStepStatus = 'pending' | 'generating' | 'completed' | 'failed';

/* ═══════════════════════════════════════════════════════════════════════════
   Aspect Ratios
   ═══════════════════════════════════════════════════════════════════════════ */

/** יחסי גובה-רוחב נתמכים */
export type AspectRatio = '9:16' | '1:1' | '4:5' | '16:9' | 'free';

/* ═══════════════════════════════════════════════════════════════════════════
   Video Metadata & Validation
   ═══════════════════════════════════════════════════════════════════════════ */

/** מטא-דאטה של וידאו שנשלף לאחר העלאה */
export interface VideoMetadata {
  duration: number;
  fps: number;
  codec: string;
  bitrate: number;
  width: number;
  height: number;
  aspectRatio: string;
  hasAudio: boolean;
  audioCodec?: string;
  audioBitrate?: number;
  fileSize: number;
  format: string;
  orientation: 'landscape' | 'portrait' | 'square';
}

/** תוצאת אימות וידאו לאחר העלאה */
export interface VideoValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: VideoMetadata;
  thumbnailUrl?: string;
  waveformUrl?: string;
  proxyVideoUrl?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hook Selection & Analysis
   ═══════════════════════════════════════════════════════════════════════════ */

/** נתוני בחירת הוק */
export interface HookSelection {
  startTime: number;
  endTime: number;
  duration: number;
  viralScore?: number;
  engagementScore?: number;
  confidenceScore?: number;
  aiRecommended: boolean;
  selectedAt: string;
}

/** המלצת הוק בודדת מניתוח AI */
export interface HookRecommendation {
  startTime: number;
  endTime: number;
  score: number;
  reason: string;
  motionEnergy: number;
  emotionalIntensity: number;
  speechSpeed: number;
  visualContrast: number;
  retentionPrediction: number;
}

/** תוצאת ניתוח הוק AI */
export interface HookAnalysis {
  recommendations: HookRecommendation[];
  analyzedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Trim & Crop
   ═══════════════════════════════════════════════════════════════════════════ */

/** נתוני חיתוך ומיקוד */
export interface TrimCropData {
  trimStart: number;
  trimEnd: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  targetAspectRatio: AspectRatio;
  faceTrackingEnabled: boolean;
  subjectTrackingEnabled: boolean;
  appliedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Video Version
   ═══════════════════════════════════════════════════════════════════════════ */

/** גרסת וידאו — עוקב אחרי כל גרסה לאורך הצינור */
export interface VideoVersion {
  id: string;
  projectId: string;
  versionType: VideoVersionType;
  /** נתיב אחסון ב-Supabase Storage */
  storageKey: string;
  /** כתובת URL חתומה זמנית */
  signedUrl?: string;
  metadata?: VideoMetadata;
  hookSelection?: HookSelection;
  trimCrop?: TrimCropData;
  /** מזהה גרסת האב שממנה נגזרה גרסה זו */
  parentVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI Analysis Results
   ═══════════════════════════════════════════════════════════════════════════ */

/** סצנה שזוהתה */
export interface DetectedScene {
  start: number;
  end: number;
  type: string;
  confidence: number;
}

/** קטע שקט */
export interface SilenceSegment {
  start: number;
  end: number;
  duration: number;
}

/** רגע מת */
export interface DeadMoment {
  start: number;
  end: number;
  reason: string;
}

/** נקודת רגש על ציר הזמן */
export interface EmotionMapEntry {
  time: number;
  emotion: string;
  intensity: number;
}

/** תוצאות ניתוח AI מלאות */
export interface AIAnalysisResult {
  scenes: DetectedScene[];
  silences: SilenceSegment[];
  deadMoments: DeadMoment[];
  emotionMap: EmotionMapEntry[];
  pacingScore: number;
  viralScore: number;
  engagementPrediction: number;
  analyzedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Audit Log
   ═══════════════════════════════════════════════════════════════════════════ */

/** רשומת יומן ביקורת */
export interface AuditEntry {
  action: string;
  sourceVideoId: string;
  targetVideoId?: string;
  status: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Pipeline State — Full State Machine
   ═══════════════════════════════════════════════════════════════════════════ */

/** מצב הצינור — מכונת מצבים מלאה לפרויקט וידאו */
export interface VideoPipelineState {
  projectId: string;

  // --- מעקב גרסאות ---
  originalVideoId: string;
  hookGeneratedVideoId?: string;
  trimCropVideoId?: string;
  finalPreEditVideoId?: string;
  editableVideoId?: string;
  /** מזהה המקור הפעיל — שווה ל-finalPreEditVideoId לאחר נעילה */
  activeVideoId?: string;

  // --- מעקב סטטוסים ---
  pipelineStatus: PipelineStatus;
  hookStatus: HookStepStatus;
  trimCropStatus: TrimCropStepStatus;
  preEditStatus: PreEditStepStatus;
  aiAnalysisStatus: AIAnalysisStatus;
  sourceLocked: boolean;

  // --- נתונים ---
  hookAnalysis?: HookAnalysis;
  hookSelection?: HookSelection;
  trimCrop?: TrimCropData;

  // --- תוצאות ניתוח AI ---
  aiAnalysis?: AIAnalysisResult;

  // --- יומן ביקורת ---
  auditLog: AuditEntry[];

  // --- חותמות זמן ---
  createdAt: string;
  updatedAt: string;
  lockedAt?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Source Validation
   ═══════════════════════════════════════════════════════════════════════════ */

/** תוצאת בדיקות אימות מקור */
export interface SourceValidationChecks {
  sourceMatchesFinalPreEdit: boolean;
  hookCompleted: boolean;
  trimCropCompleted: boolean;
  preEditCompleted: boolean;
  sourceLocked: boolean;
}

/** תוצאת אימות מקור */
export interface SourceValidationResult {
  valid: boolean;
  sourceVideoId: string;
  expectedVideoId: string;
  versionType: VideoVersionType;
  checks: SourceValidationChecks;
  blockedReason?: string;
}
