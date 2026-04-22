/**
 * PixelManageAI — Core Type Definitions
 * Shared types across all AI engine modules.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Video & Subtitle Segments
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SubtitleSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  edited: boolean;
  highlightWord: string;
  highlightStyle: "color" | "background" | "scale" | "slide";
  emphasisWords?: string[];
}

export interface SubtitleStyle {
  font: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  highlightColor: string;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineThickness: number;
  shadow: boolean;
  bgEnabled: boolean;
  bgColor: string;
  bgOpacity: number;
  align: "left" | "center" | "right";
  position: "top" | "center" | "bottom" | "manual";
  manualY?: number; // 0-100 percentage from top (used when position === "manual")
  animation: "none" | "fade" | "slideIn" | "zoomIn" | "kineticTypography" | "typewriter";
  lineBreak: "auto" | "balanced";
  highlightMode?: "sequential" | "ai";
  highlightIntensity?: "subtle" | "strong";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Video Scoring & Analysis
   ═══════════════════════════════════════════════════════════════════════════ */

export interface VideoScoreBreakdown {
  category: "hook" | "clarity" | "engagement" | "pacing" | "cta";
  score: number;
  feedback: string;
  feedbackHe: string;
}

export interface VideoScore {
  overall: number;
  hookStrength: number;
  clarity: number;
  engagementPotential: number;
  pacing: number;
  ctaStrength: number;
  breakdown: VideoScoreBreakdown[];
}

export interface GeneratedHook {
  id: string;
  style: "question" | "statistic" | "bold_claim" | "pain_point" | "curiosity";
  text: string;
  estimatedStrength: number;
  reasoning: string;
}

export interface ReEditChange {
  field: string;
  from: string;
  to: string;
}

export interface ReEditSuggestion {
  id: string;
  type: "shorter" | "aggressive_pacing" | "emotional" | "tiktok_optimized";
  title: string;
  titleHe: string;
  description: string;
  descriptionHe: string;
  changes: ReEditChange[];
  estimatedImpact: number;
}

export interface PredictionFactor {
  name: string;
  nameHe: string;
  impact: "positive" | "neutral" | "negative";
  weight: number;
  detail: string;
}

export interface PerformancePrediction {
  engagementPotential: number;
  scrollStoppingStrength: number;
  viralityLikelihood: number;
  watchThroughRate: number;
  factors: PredictionFactor[];
}

export interface DetectedHighlight {
  id: string;
  segmentId: string;
  startSec: number;
  endSec: number;
  text: string;
  type: "hook" | "strong_phrase" | "emotional_peak" | "cta";
  strength: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Client DNA & Growth
   ═══════════════════════════════════════════════════════════════════════════ */

export type OutputFormat = "16:9" | "9:16" | "1:1" | "4:5" | "4:3";

export interface ClientDNA {
  clientId: string;
  toneOfVoice: string[];
  recurringWords: string[];
  messagingStyle: "descriptive" | "balanced" | "punchy";
  contentThemes: string[];
  preferredFormats: OutputFormat[];
  avgHookStrength: number;
  topPerformingTopics: string[];
}

export interface GrowthInsight {
  id: string;
  type: "what_works" | "what_to_improve" | "what_to_try";
  title: string;
  titleHe: string;
  detail: string;
  detailHe: string;
  confidence: number;
  basedOn: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Viral Trends & Ideas
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ViralTrend {
  id: string;
  topic: string;
  topicHe: string;
  industry: string;
  trendScore: number;
  whyViral: string;
  whyViralHe: string;
}

export interface ScriptStructure {
  hook: string;
  problem: string;
  solution: string;
  cta: string;
}

export interface ViralVideoIdea {
  id: string;
  title: string;
  titleHe: string;
  hook: string;
  hookHe: string;
  structure: ScriptStructure;
  estimatedViralScore: number;
  suggestedPreset: SmartPresetId;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Script & Creative Parsing
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ScriptToVideoInput {
  script: string;
  language: string;
  targetDurationSec: number;
  preset: string;
}

export interface ScenePlan {
  sceneIndex: number;
  startSec: number;
  endSec: number;
  text: string;
  brollSuggestion: string;
  cameraMovement: "static" | "zoomIn" | "zoomOut" | "pan";
  transition: "cut" | "crossfade" | "slide";
}

export interface ScriptToVideoOutput {
  segments: SubtitleSegment[];
  scenePlan: ScenePlan[];
  suggestedPacing: string;
  estimatedDurationSec: number;
}

export interface ParsedCreativeConfig {
  pacing: "slow" | "moderate" | "fast" | "aggressive" | null;
  tone: "professional" | "casual" | "energetic" | "emotional" | "humorous" | null;
  cutIntensity: number | null;
  brollFrequency: "none" | "sparse" | "moderate" | "frequent" | null;
  subtitleEmphasis: "minimal" | "standard" | "heavy" | null;
  overallMood: string | null;
  targetAudience: string | null;
  keyMessages: string[];
}

export interface CreativeInstructions {
  rawPrompt: string;
  parsedConfig: ParsedCreativeConfig;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Render Configuration
   ═══════════════════════════════════════════════════════════════════════════ */

export type SmartPresetId = "viral" | "sales" | "bold" | "storytelling" | "authority" | "casual" | "educational";

export interface SmartPreset {
  id: SmartPresetId;
  name: string;
  nameHe: string;
  description: string;
  pacing: "slow" | "moderate" | "fast" | "aggressive";
  colorGrading: string;
  jumpCutAggression: number;
  zoomBehavior: ZoomBehavior;
  subtitleStyle: Partial<SubtitleStyle>;
}

export const SMART_PRESETS: SmartPreset[] = [
  {
    id: "viral",
    name: "Viral",
    nameHe: "ויראלי",
    description: "Fast cuts, bold subtitles, maximum energy",
    pacing: "aggressive",
    colorGrading: "vibrant",
    jumpCutAggression: 75,
    zoomBehavior: { enabled: true, onSpeech: 1.1, onTransition: 1.15, speed: "fast" },
    subtitleStyle: { fontSize: 42, fontWeight: 700, animation: "kineticTypography" },
  },
  {
    id: "sales",
    name: "Sales",
    nameHe: "מכירות",
    description: "Professional, clear CTAs, smooth transitions",
    pacing: "moderate",
    colorGrading: "corporate",
    jumpCutAggression: 35,
    zoomBehavior: { enabled: true, onSpeech: 1.05, onTransition: 1.08, speed: "slow" },
    subtitleStyle: { fontSize: 38, fontWeight: 600, animation: "slideIn" },
  },
  {
    id: "bold",
    name: "Bold",
    nameHe: "נועז",
    description: "High contrast, dramatic transitions",
    pacing: "fast",
    colorGrading: "cinematic",
    jumpCutAggression: 65,
    zoomBehavior: { enabled: true, onSpeech: 1.15, onTransition: 1.2, speed: "fast" },
    subtitleStyle: { fontSize: 45, fontWeight: 800, animation: "zoomIn" },
  },
  {
    id: "storytelling",
    name: "Storytelling",
    nameHe: "סיפורי",
    description: "Slower pace, emotional depth, warm colors",
    pacing: "slow",
    colorGrading: "warm",
    jumpCutAggression: 15,
    zoomBehavior: { enabled: false, onSpeech: 1.0, onTransition: 1.0, speed: "slow" },
    subtitleStyle: { fontSize: 36, fontWeight: 500, animation: "fade" },
  },
  {
    id: "authority",
    name: "Authority",
    nameHe: "סמכות",
    description: "Polished, minimal, professional",
    pacing: "moderate",
    colorGrading: "corporate",
    jumpCutAggression: 25,
    zoomBehavior: { enabled: false, onSpeech: 1.0, onTransition: 1.05, speed: "slow" },
    subtitleStyle: { fontSize: 38, fontWeight: 400, animation: "fade" },
  },
  {
    id: "casual",
    name: "Casual",
    nameHe: "קזואל",
    description: "Fun, playful, relatable",
    pacing: "fast",
    colorGrading: "vibrant",
    jumpCutAggression: 55,
    zoomBehavior: { enabled: true, onSpeech: 1.08, onTransition: 1.1, speed: "moderate" },
    subtitleStyle: { fontSize: 40, fontWeight: 600, animation: "slideIn" },
  },
  {
    id: "educational",
    name: "Educational",
    nameHe: "חינוכי",
    description: "Clear, structured, informative",
    pacing: "moderate",
    colorGrading: "neutral",
    jumpCutAggression: 30,
    zoomBehavior: { enabled: true, onSpeech: 1.05, onTransition: 1.08, speed: "moderate" },
    subtitleStyle: { fontSize: 40, fontWeight: 500, animation: "slideIn" },
  },
];

export interface ZoomBehavior {
  enabled: boolean;
  onSpeech: number;
  onTransition: number;
  speed: "slow" | "moderate" | "fast";
}

export interface SmartFramingConfig {
  enabled: boolean;
  faceDetection: boolean;
  keepSubjectCentered: boolean;
  cropForVertical: boolean;
}

export interface ColorGradingConfig {
  preset: "vibrant" | "corporate" | "cinematic" | "warm" | "neutral";
  contrast: number;
  saturation: number;
  temperature: number;
}

export interface JumpCutConfig {
  enabled: boolean;
  removeSilence: boolean;
  removeFillers: boolean;
  minSilenceDurationMs: number;
  aggression: number;
  keepEnergyPace: boolean;
}

export interface CleanupConfig {
  fillersEnabled: boolean;
  silenceEnabled: boolean;
  intensity: "light" | "medium" | "aggressive";
  removedSegments: Array<{ id: string; startSec: number; endSec: number; type: "filler" | "silence"; label: string }>;
}

export interface MusicConfig {
  enabled: boolean;
  trackId: string;
  volume: number;
  ducking: boolean;
  duckingLevel: number;
}

export interface SoundDesignConfig {
  enabled: boolean;
  sfxOnCuts: boolean;
  sfxStyle: "subtle" | "standard" | "dramatic";
  duckingEnabled: boolean;
  duckingLevel: number;
}

export interface BrollConfig {
  enabled: boolean;
  style: "stock" | "ai" | "none";
  placements: ClipSelection[];
}

export interface ClipSelection {
  id: string;
  startSec: number;
  endSec: number;
  keyword: string;
  source: string;
  stockProvider?: string;
  stockClipId?: string;
  stockPreviewUrl?: string;
  stockDownloadUrl?: string;
  mediaStatus?: string;
}

export interface SourceVideo {
  fileKey: string;
  fileName: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
}

export interface BrandConfig {
  clientId: string;
  clientName: string;
  primaryColor: string;
}

export interface SubtitleConfig {
  mode: "auto" | "manual";
  language: string;
  segments: SubtitleSegment[];
  style: SubtitleStyle;
  maxWordsPerLine: number;
  maxLines: number;
}

export type ExportQuality = "standard" | "premium" | "max";

export interface QualityPreset {
  resolution: string;
  bitrate: string;
  fps: number;
  colorGrading: ColorGradingConfig;
}

export const QUALITY_PRESETS: Record<ExportQuality, QualityPreset> = {
  standard: {
    resolution: "1080x1920",
    bitrate: "5mbps",
    fps: 30,
    colorGrading: { preset: "neutral", contrast: 100, saturation: 100, temperature: 0 },
  },
  premium: {
    resolution: "1440x2560",
    bitrate: "8mbps",
    fps: 30,
    colorGrading: { preset: "cinematic", contrast: 105, saturation: 110, temperature: 5 },
  },
  max: {
    resolution: "2160x3840",
    bitrate: "12mbps",
    fps: 60,
    colorGrading: { preset: "cinematic", contrast: 110, saturation: 120, temperature: 10 },
  },
};

export type TransitionStyle = "cut" | "fade" | "zoom" | "motionBlur" | "premiumSlide" | "punchyCut" | "cinematicDissolve" | "lightLeak";

export interface TransitionConfig {
  style: TransitionStyle;
  durationMs: number;
  applyToSceneChanges: boolean;
  applyToBroll: boolean;
}

export interface PremiumOutputConfig {
  enabled: boolean;
  level: "standard" | "premium" | "cinematic";
  smartPacing: boolean;
  audioLayering: boolean;
  visualStructure: boolean;
  brollEnhancement: boolean;
  subtitleEnhancement: boolean;
  motionEffects: boolean;
  colorCorrection: boolean;
  autoFill: boolean; // auto-fill missing layers
}

export interface EffectiveEditConfig {
  // Source
  trimMode: "full" | "clip";
  trimStart: number;
  trimEnd: number;
  effectiveDuration: number;

  // Output
  format: OutputFormat;
  quality: ExportQuality;

  // Subtitles
  subtitlesActive: boolean;
  subtitleMode: "auto" | "manual";
  subtitleStyle: SubtitleStyle;
  segmentCount: number;
  hasHighlights: boolean;

  // AI Direction
  aiEditMode: string;
  aiDirectionNotes: string;
  preset: SmartPresetId | null;

  // B-Roll
  brollActive: boolean;
  brollStyle: "stock" | "ai" | "none";
  brollPlacementCount: number;

  // Transitions
  transition: TransitionConfig;

  // Music & Audio
  musicActive: boolean;
  musicTrackId: string;
  musicVolume: number;
  musicDucking: boolean;
  soundDesignActive: boolean;

  // Cleanup
  cleanupActive: boolean;
  cleanupFillers: boolean;
  cleanupSilence: boolean;
  cleanupIntensity: "light" | "medium" | "aggressive";
  cleanupRemovedCount: number;

  // Premium
  premiumOutput: PremiumOutputConfig;

  // Motion
  zoomEnabled: boolean;
  framingEnabled: boolean;

  // Color
  colorGrading: string;
}

export const TRANSITION_STYLES: { id: TransitionStyle; name: string; nameHe: string; description: string; descriptionHe: string; durationMs: number }[] = [
  { id: "cut", name: "Clean Cut", nameHe: "חיתוך נקי", description: "Direct, sharp transition", descriptionHe: "מעבר ישיר וחד", durationMs: 0 },
  { id: "fade", name: "Smooth Fade", nameHe: "מעבר חלק", description: "Elegant crossfade", descriptionHe: "מעבר חלק ואלגנטי", durationMs: 500 },
  { id: "zoom", name: "Zoom Transition", nameHe: "מעבר זום", description: "Zoom in/out between clips", descriptionHe: "זום פנימה/החוצה בין קליפים", durationMs: 400 },
  { id: "motionBlur", name: "Motion Blur", nameHe: "טשטוש תנועה", description: "Fast motion blur transition", descriptionHe: "מעבר עם טשטוש תנועה מהיר", durationMs: 300 },
  { id: "premiumSlide", name: "Premium Slide", nameHe: "החלקה פרימיום", description: "Smooth directional slide", descriptionHe: "החלקה כיוונית חלקה", durationMs: 600 },
  { id: "punchyCut", name: "Punchy Social Cut", nameHe: "חיתוך סושיאל", description: "Fast punchy cut for social media", descriptionHe: "חיתוך מהיר ואנרגטי לרשתות", durationMs: 150 },
  { id: "cinematicDissolve", name: "Cinematic Dissolve", nameHe: "דיזולב קולנועי", description: "Film-style dissolve", descriptionHe: "מעבר בסגנון קולנועי", durationMs: 800 },
  { id: "lightLeak", name: "Light Leak", nameHe: "דליפת אור", description: "Premium cinematic light leak with warm film tones", descriptionHe: "דליפת אור קולנועית עם גוונים חמים של פילם", durationMs: 900 },
];

export interface RenderPayload {
  version: string;
  projectId: string;
  createdAt: string;
  source: {
    video: SourceVideo;
    clip: {
      mode: "full" | "clip";
      startSec: number;
      endSec: number;
      effectiveDurationSec: number;
    };
  };
  output: {
    format: OutputFormat;
    quality: QualityPreset;
  };
  subtitles: SubtitleConfig;
  brand: BrandConfig;
  creative: CreativeInstructions;
  edit: {
    preset: SmartPreset | null;
    jumpCuts: JumpCutConfig;
    zoom: ZoomBehavior;
    framing: SmartFramingConfig;
    colorGrading: ColorGradingConfig;
    scenePlan: ScenePlan[];
    cleanup: CleanupConfig;
    transition: TransitionConfig;
  };
  audio: {
    music: MusicConfig;
    soundDesign: SoundDesignConfig;
  };
  broll: BrollConfig;
  premiumOutput: PremiumOutputConfig;
  metadata: {
    clientId: string;
    clientName: string;
    projectName: string;
    language: string;
    estimatedDurationSec: number;
    segmentCount: number;
    brollPlacementCount: number;
    cleanupRemovedCount: number;
  };
}
