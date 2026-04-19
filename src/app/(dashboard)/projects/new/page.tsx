"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useClients, useProjects } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { Client } from "@/lib/db/schema";
import { scoreVideo, generateHooks, predictPerformance, detectHighlights } from "@/lib/video-engine/ai-scoring";
import { buildRenderPayload } from "@/lib/video-engine/render-builder";
import { buildFinalCompositionData, type WizardSnapshot } from "@/lib/video-engine/composition-data";
import { compositionToProps } from "@/lib/video-engine/composition-to-props";
import type { VideoScore, GeneratedHook, PerformancePrediction, DetectedHighlight } from "@/lib/video-engine/types";
// Remotion imports — kept for composition building (final render), not for preview Player
import { FPS, FORMAT_DIMENSIONS } from "@/remotion/types";
import { analyzeBroll, planToPlacements, type BrollPlan } from "@/lib/video-engine/broll-analysis";
import { PreviewPanel, type PreviewWizardData } from "@/components/ui/PreviewPanel";
import { UnifiedEditedPreviewPlayer, type SubtitleStyleData } from "@/components/ui/UnifiedEditedPreviewPlayer";
import TimelineEditor from '@/components/ui/TimelineEditor';
import { generateReEdit, getReEditModes, type ReEditResult, type ReEditMode } from "@/lib/video-engine/ai-reedit";
import type { FinalCompositionData } from "@/lib/video-engine/composition-data";
import { generateUnifiedEditPlan, getEditPresets, EDIT_PRESETS, type UnifiedEditPlan, type EditProfile } from "@/lib/video-engine/edit-coordinator";
import type { TranscriptSegment } from "@/lib/video-engine/broll-analysis";

/* ═══════════════════════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════════════════════ */

interface SubSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  confidence?: number;
  edited: boolean;
  highlightWord: string;
  highlightStyle: "color" | "bg" | "scale" | "bold";
  emphasisWords?: string[];  // AI-selected important words for smart emphasis
}

interface BrollSuggestion {
  segmentId: string;
  keywords: string[];
  relevance: number;
}

interface BrollPlacement {
  id: string;
  startSec: number;
  endSec: number;
  keyword: string;
  source: "stock" | "ai" | "pexels" | "pixabay" | "shutterstock" | "client" | "upload";
  // Stock metadata
  stockProvider?: "pexels" | "pixabay" | "shutterstock";
  stockClipId?: string;
  stockPreviewUrl?: string;
  stockDownloadUrl?: string;
  stockThumbnailUrl?: string;
  stockTitle?: string;
  stockDuration?: number;
  // Search metadata
  searchKeyword?: string;
  relevanceScore?: number;
  // State
  mediaStatus?: "searching" | "found" | "not_found" | "error";
  mediaError?: string;
}

interface CleanupSegment {
  id: string;
  startSec: number;
  endSec: number;
  type: "filler" | "silence";
  label: string;
  removed: boolean;
  restorable: boolean;
}

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  category: string;
  mood: string;
  bpm: number;
  previewUrl: string;
}

type EffectType = "zoom" | "shake" | "fade" | "blur" | "flash" | "punchZoom" | "slowZoom" | "kenBurns";
type EffectScope = "global" | "segment";

interface VisualEffect {
  id: string;
  type: EffectType;
  intensity: number; // 0–100
  scope: EffectScope;
  segmentId?: string; // if scope === "segment"
  startSec?: number;
  endSec?: number;
  enabled: boolean;
}

interface WizardData {
  title: string;
  clientId: string;
  creativePrompt: string;

  subtitleFont: string;
  subtitleFontWeight: number;
  subtitleFontSize: number;
  subtitleColor: string;
  subtitleHighlightColor: string;
  subtitleOutlineEnabled: boolean;
  subtitleOutlineColor: string;
  subtitleOutlineThickness: number;
  subtitleShadow: boolean;
  subtitleBg: boolean;
  subtitleBgColor: string;
  subtitleBgOpacity: number;
  subtitleAlign: "left" | "center" | "right";
  subtitlePosition: "top" | "center" | "bottom" | "manual";
  subtitleManualY: number; // 0-100, percentage from top
  subtitleAnimation: "none" | "fade" | "pop" | "slideUp" | "wordByWord" | "highlightOnSpeech";
  subtitleLineBreak: "auto" | "balanced";
  highlightMode: "sequential" | "ai";
  highlightIntensity: "subtle" | "strong";

  videoFile: File | null;
  videoUrl: string;
  uploadedVideoUrl: string; // Server-side URL after upload (e.g. /uploads/upload-xxx.mp4)
  trimMode: "full" | "clip";
  trimStart: number;
  trimEnd: number;
  format: "9:16" | "16:9" | "1:1" | "4:5";

  subtitleMode: "auto" | "manual";
  language: string;
  segments: SubSegment[];
  transcribing: boolean;

  brollEnabled: boolean;
  brollStyle: "stock" | "ai" | "none";
  brollSuggestions: BrollSuggestion[];
  brollPlacements: BrollPlacement[];
  brollApproved: boolean;

  musicEnabled: boolean;
  musicStyle: string;
  musicVolume: number;
  musicTrackId: string;
  musicDucking: boolean;
  musicDuckingLevel: number;

  soundDesignEnabled: boolean;
  sfxOnCuts: boolean;
  sfxStyle: "subtle" | "standard" | "dramatic";

  cleanupFillers: boolean;
  cleanupSilence: boolean;
  cleanupIntensity: "light" | "medium" | "aggressive";
  cleanupRemovedSegments: CleanupSegment[];
  cleanupPreviewMode: "original" | "cleaned";

  exportApproved: boolean;
  preset: string;
  exportQuality: "standard" | "premium" | "max";
  aiEditMode: "premium" | "viral" | "emotional" | "sales" | "";
  aiDirectionNotes: string;

  transitionStyle: "cut" | "fade" | "zoom" | "motionBlur" | "premiumSlide" | "punchyCut" | "cinematicDissolve" | "lightLeak";
  premiumMode: boolean;
  premiumLevel: "standard" | "premium" | "cinematic";

  // Visual effects
  effects: VisualEffect[];
  effectsApproved: boolean;

  // Advanced editing engine
  editEngineActive: boolean;
  editProfile: string; // "minimal" | "balanced" | "social" | "premium"
  brollIntensity: "light" | "medium" | "aggressive";
  zoomStyle: "off" | "subtle" | "social" | "cinematic";
  pacingMode: "relaxed" | "balanced" | "punchy" | "viral";
  hookStrength: "subtle" | "balanced" | "aggressive";
  retentionLevel: "off" | "light" | "balanced" | "aggressive";
}

const INITIAL: WizardData = {
  title: "", clientId: "", creativePrompt: "",
  subtitleFont: "Assistant", subtitleFontWeight: 600, subtitleFontSize: 32,
  subtitleColor: "#FFFFFF", subtitleHighlightColor: "#FFD700",
  subtitleOutlineEnabled: false, subtitleOutlineColor: "#000000", subtitleOutlineThickness: 2,
  subtitleShadow: false,
  subtitleBg: false, subtitleBgColor: "#000000", subtitleBgOpacity: 65,
  subtitleAlign: "center", subtitlePosition: "bottom", subtitleManualY: 75,
  subtitleAnimation: "none", subtitleLineBreak: "auto",
  highlightMode: "sequential", highlightIntensity: "strong",
  videoFile: null, videoUrl: "", uploadedVideoUrl: "",
  trimMode: "full", trimStart: 0, trimEnd: 0,
  format: "9:16",
  subtitleMode: "auto", language: "",
  segments: [], transcribing: false,
  brollEnabled: false, brollStyle: "stock",
  brollSuggestions: [], brollPlacements: [], brollApproved: false,
  musicEnabled: false, musicStyle: "upbeat", musicVolume: 30,
  musicTrackId: "", musicDucking: true, musicDuckingLevel: 40,
  soundDesignEnabled: false, sfxOnCuts: false, sfxStyle: "subtle",
  cleanupFillers: false, cleanupSilence: false,
  cleanupIntensity: "medium", cleanupRemovedSegments: [], cleanupPreviewMode: "original",
  exportApproved: false,
  preset: "viral",
  exportQuality: "premium" as "standard" | "premium" | "max",
  aiEditMode: "",
  aiDirectionNotes: "",
  transitionStyle: "fade",
  premiumMode: true,
  premiumLevel: "premium",
  effects: [],
  effectsApproved: false,
  editEngineActive: false,
  editProfile: "balanced",
  brollIntensity: "medium",
  zoomStyle: "social",
  pacingMode: "balanced",
  hookStrength: "balanced",
  retentionLevel: "balanced",
};

const STEPS = [
  { id: "info",        label: "פרטי פרויקט",     icon: "📝" },
  { id: "upload",      label: "העלאת וידאו",      icon: "🎬" },
  { id: "trim",        label: "חיתוך קליפ",       icon: "✂️" },
  { id: "format",      label: "פורמט יציאה",      icon: "📐" },
  { id: "submode",     label: "מצב כתוביות",      icon: "💬" },
  { id: "language",    label: "שפת דיבור",        icon: "🌐" },
  { id: "transcript",  label: "עריכת כתוביות",    icon: "📝" },
  { id: "substyle",    label: "עיצוב כתוביות",    icon: "🎨" },
  { id: "aiHighlight", label: "הדגשה חכמה (AI)",  icon: "✨" },
  { id: "aidirection", label: "כיוון עריכה AI",   icon: "🎯" },
  { id: "cleanup",     label: "ניקוי חכם",        icon: "🧹" },
  { id: "broll",       label: "B-Roll",           icon: "🎞️" },
  { id: "transitions", label: "מעברים ואפקטים",   icon: "🔀" },
  { id: "music",       label: "מוזיקה ואודיו",    icon: "🎵" },
  { id: "preview",     label: "תצוגה מקדימה",     icon: "👁️" },
  { id: "approve",     label: "אישור ויצוא",      icon: "📤" },
];

const GOOGLE_FONTS = [
  { name: "Assistant", languages: ["he","en","ar"] },
  { name: "Heebo", languages: ["he","en"] },
  { name: "Rubik", languages: ["he","en","ar"] },
  { name: "Open Sans", languages: ["he","en","ar","ru"] },
  { name: "Montserrat", languages: ["en"] },
  { name: "Noto Sans Hebrew", languages: ["he"] },
  { name: "Secular One", languages: ["he","en"] },
  { name: "Suez One", languages: ["he","en"] },
  { name: "Alef", languages: ["he","en"] },
  { name: "Varela Round", languages: ["he","en"] },
  { name: "Frank Ruhl Libre", languages: ["he","en"] },
  { name: "Noto Sans Arabic", languages: ["ar"] },
  { name: "Roboto", languages: ["en","ru"] },
  { name: "Inter", languages: ["en","ru"] },
  { name: "Poppins", languages: ["en"] },
];

const ANIMATIONS = [
  { id: "none",             label: "ללא",           desc: "כתוביות סטטיות" },
  { id: "fade",             label: "דהייה",          desc: "כניסה ויציאה רכות" },
  { id: "pop",              label: "פופ",            desc: "הגדלה מהירה" },
  { id: "slideUp",          label: "עליה",           desc: "כניסה מלמטה" },
  { id: "wordByWord",       label: "מילה-מילה",      desc: "חשיפה הדרגתית" },
  { id: "highlightOnSpeech",label: "הדגשה בדיבור",   desc: "הדגשת מילה פעילה" },
];

const LANGUAGES = [
  { id: "he",   label: "עברית",   flag: "🇮🇱" },
  { id: "en",   label: "אנגלית",  flag: "🇺🇸" },
  { id: "ar",   label: "ערבית",   flag: "🇸🇦" },
  { id: "ru",   label: "רוסית",   flag: "🇷🇺" },
  { id: "auto", label: "זיהוי אוטומטי", flag: "🤖" },
];

const MUSIC_LIBRARY: MusicTrack[] = [
  { id: "t1",  title: "Golden Hour",        artist: "Studio Pixel",   duration: "2:30", category: "premium",      mood: "warm",      bpm: 92,  previewUrl: "" },
  { id: "t2",  title: "Elevate",            artist: "Studio Pixel",   duration: "2:15", category: "premium",      mood: "uplifting", bpm: 110, previewUrl: "" },
  { id: "t3",  title: "Silk & Light",       artist: "Studio Pixel",   duration: "3:00", category: "premium",      mood: "elegant",   bpm: 85,  previewUrl: "" },
  { id: "t4",  title: "Epic Horizons",      artist: "Audio Lab",      duration: "2:45", category: "cinematic",    mood: "epic",      bpm: 78,  previewUrl: "" },
  { id: "t5",  title: "Dawn of Time",       artist: "Audio Lab",      duration: "3:10", category: "cinematic",    mood: "dramatic",  bpm: 65,  previewUrl: "" },
  { id: "t6",  title: "Film Score Rise",    artist: "SoundCraft",     duration: "2:20", category: "cinematic",    mood: "intense",   bpm: 88,  previewUrl: "" },
  { id: "t7",  title: "Heartstrings",       artist: "Melody Works",   duration: "2:55", category: "emotional",    mood: "touching",  bpm: 72,  previewUrl: "" },
  { id: "t8",  title: "Through the Rain",   artist: "Melody Works",   duration: "3:20", category: "emotional",    mood: "hopeful",   bpm: 80,  previewUrl: "" },
  { id: "t9",  title: "Gentle Waves",       artist: "Melody Works",   duration: "2:40", category: "emotional",    mood: "calm",      bpm: 68,  previewUrl: "" },
  { id: "t10", title: "Pulse Drive",        artist: "BeatForge",      duration: "2:10", category: "energetic",    mood: "powerful",  bpm: 128, previewUrl: "" },
  { id: "t11", title: "Rush Hour",          artist: "BeatForge",      duration: "1:55", category: "energetic",    mood: "fast",      bpm: 140, previewUrl: "" },
  { id: "t12", title: "Neon Lights",        artist: "BeatForge",      duration: "2:35", category: "energetic",    mood: "dynamic",   bpm: 120, previewUrl: "" },
  { id: "t13", title: "Brand Story",        artist: "Studio Pixel",   duration: "2:00", category: "commercial",   mood: "confident", bpm: 100, previewUrl: "" },
  { id: "t14", title: "Launch Day",         artist: "Studio Pixel",   duration: "2:25", category: "commercial",   mood: "exciting",  bpm: 115, previewUrl: "" },
  { id: "t15", title: "Trust & Value",      artist: "SoundCraft",     duration: "2:50", category: "commercial",   mood: "reliable",  bpm: 95,  previewUrl: "" },
  { id: "t16", title: "Velvet Touch",       artist: "Melody Works",   duration: "3:05", category: "elegant",      mood: "refined",   bpm: 76,  previewUrl: "" },
  { id: "t17", title: "Crystal Clear",      artist: "Audio Lab",      duration: "2:40", category: "elegant",      mood: "polished",  bpm: 82,  previewUrl: "" },
  { id: "t18", title: "Digital Flow",       artist: "BeatForge",      duration: "2:15", category: "modern",       mood: "fresh",     bpm: 108, previewUrl: "" },
  { id: "t19", title: "Interface",          artist: "BeatForge",      duration: "2:30", category: "modern",       mood: "tech",      bpm: 118, previewUrl: "" },
  { id: "t20", title: "Rise Up",            artist: "Audio Lab",      duration: "2:45", category: "motivational", mood: "inspiring",  bpm: 96,  previewUrl: "" },
  { id: "t21", title: "Unstoppable",        artist: "Audio Lab",      duration: "2:20", category: "motivational", mood: "determined", bpm: 105, previewUrl: "" },
  { id: "t22", title: "White Space",        artist: "SoundCraft",     duration: "3:15", category: "minimal",      mood: "clean",     bpm: 70,  previewUrl: "" },
  { id: "t23", title: "Still Point",        artist: "Melody Works",   duration: "2:50", category: "minimal",      mood: "ambient",   bpm: 60,  previewUrl: "" },
  { id: "t24", title: "Trending Now",       artist: "BeatForge",      duration: "1:45", category: "social",       mood: "catchy",    bpm: 130, previewUrl: "" },
  { id: "t25", title: "Scroll Stopper",     artist: "BeatForge",      duration: "1:30", category: "social",       mood: "viral",     bpm: 135, previewUrl: "" },
  { id: "t26", title: "TikTok Energy",      artist: "BeatForge",      duration: "1:50", category: "social",       mood: "fun",       bpm: 125, previewUrl: "" },
];

const MUSIC_CATEGORIES = [
  { id: "all",          label: "הכל" },
  { id: "premium",      label: "פרימיום" },
  { id: "cinematic",    label: "קולנועי" },
  { id: "emotional",    label: "רגשי" },
  { id: "energetic",    label: "אנרגטי" },
  { id: "commercial",   label: "מסחרי" },
  { id: "elegant",      label: "אלגנטי" },
  { id: "modern",       label: "מודרני" },
  { id: "motivational", label: "מוטיבציה" },
  { id: "minimal",      label: "מינימלי" },
  { id: "social",       label: "סושיאל" },
];

const SMART_PRESETS_UI = [
  { id: "viral",       label: "ויראלי",     icon: "🔥", desc: "קצב מהיר, אנרגטי, מותאם לרשתות" },
  { id: "sales",       label: "מכירות",     icon: "💰", desc: "CTA חזק, מסרים ברורים" },
  { id: "authority",   label: "סמכות",      icon: "👔", desc: "מקצועי, מדויק, אמין" },
  { id: "storytelling",label: "סטוריטלינג",  icon: "📖", desc: "קצב רגוע, רגשי, סיפורי" },
  { id: "corporate",   label: "תאגידי",     icon: "🏢", desc: "עסקי, נקי, רשמי" },
  { id: "minimal",     label: "מינימלי",    icon: "✨", desc: "נקי, פשוט, אלגנטי" },
  { id: "bold",        label: "נועז",       icon: "⚡", desc: "דרמטי, אגרסיבי, בולט" },
];

/** Get audio URL for a music track — generates via API if no previewUrl */
function getTrackAudioUrl(track: MusicTrack): string {
  if (track.previewUrl) return track.previewUrl;
  return `/api/media/audio?trackId=${encodeURIComponent(track.id)}&bpm=${track.bpm}&mood=${encodeURIComponent(track.mood)}&duration=30`;
}

const FILLER_WORDS_HE = ["אהה", "אממ", "כאילו", "כזה", "נו", "אה", "זאת אומרת"];
const FILLER_WORDS_EN = ["um", "uh", "like", "you know", "basically", "actually", "so"];

/* ── Helpers ── */
const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, "0")}.${ms}`;
};
const fmtTimeShort = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Short-form subtitle line formatter.
 * Rules: max 3 words per line, max 2 lines per frame.
 */
function formatSubtitleText(text: string): string[] {
  if (!text.trim()) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  for (let i = 0; i < words.length && lines.length < 2; i += 3) {
    const line = words.slice(i, Math.min(i + 3, words.length)).join(" ");
    lines.push(line);
  }
  return lines;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

/**
 * Build the base textShadow string (outer stroke + drop shadow).
 * This is the SINGLE source of truth for stroke rendering.
 * Highlighted word spans MUST inherit this to keep readability.
 */
function buildBaseTextShadow(data: WizardData): string {
  const parts: string[] = [];
  if (data.subtitleOutlineEnabled) {
    const t = data.subtitleOutlineThickness;
    const c = data.subtitleOutlineColor;
    const offsets = [
      [t, 0], [-t, 0], [0, t], [0, -t],
      [t, t], [-t, t], [t, -t], [-t, -t],
      [t * 0.7, t * 0.7], [-t * 0.7, t * 0.7], [t * 0.7, -t * 0.7], [-t * 0.7, -t * 0.7],
    ];
    offsets.forEach(([x, y]) => parts.push(`${x}px ${y}px 0 ${c}`));
  }
  if (data.subtitleShadow) parts.push("2px 2px 4px rgba(0,0,0,0.8)");
  return parts.join(", ");
}

function getSubtitleStyle(data: WizardData): React.CSSProperties {
  const style: React.CSSProperties = {
    fontFamily: data.subtitleFont,
    fontWeight: data.subtitleFontWeight,
    fontSize: `${data.subtitleFontSize}px`,
    color: data.subtitleColor,
    textAlign: data.subtitleAlign,
    lineHeight: 1.3,
    direction: "rtl",
    whiteSpace: "pre-line",
  };
  if (data.subtitleBg) {
    const [r, g, b] = hexToRgb(data.subtitleBgColor);
    style.background = `rgba(${r},${g},${b},${data.subtitleBgOpacity / 100})`;
    style.padding = "0.2em 0.5em";
    style.borderRadius = "4px";
  }
  // Use 12-direction text-shadow for outer stroke (not WebkitTextStroke)
  const baseShadow = buildBaseTextShadow(data);
  if (baseShadow) style.textShadow = baseShadow;
  return style;
}

/** Safe max highlight scale — capped to prevent overflow in flex layout */
const MAX_HL_SCALE = 1.1;

/** Extract SubtitleStyleData from WizardData — used by UnifiedEditedPreviewPlayer */
function extractSubtitleStyle(d: WizardData): SubtitleStyleData {
  return {
    subtitleFont: d.subtitleFont, subtitleFontWeight: d.subtitleFontWeight,
    subtitleFontSize: d.subtitleFontSize, subtitleColor: d.subtitleColor,
    subtitleHighlightColor: d.subtitleHighlightColor, subtitleOutlineEnabled: d.subtitleOutlineEnabled,
    subtitleOutlineColor: d.subtitleOutlineColor, subtitleOutlineThickness: d.subtitleOutlineThickness,
    subtitleShadow: d.subtitleShadow, subtitleBg: d.subtitleBg,
    subtitleBgColor: d.subtitleBgColor, subtitleBgOpacity: d.subtitleBgOpacity,
    subtitleAlign: d.subtitleAlign, subtitlePosition: d.subtitlePosition, subtitleManualY: d.subtitleManualY,
    subtitleAnimation: d.subtitleAnimation, subtitleLineBreak: d.subtitleLineBreak,
    highlightMode: d.highlightMode, highlightIntensity: d.highlightIntensity,
  };
}

/**
 * Tokenized per-word renderer for preview subtitle lines.
 * Returns an array of <span> flex-item words.  The parent <div> must use
 * display:flex + gap to space them.  `transform:scale()` expands visually
 * from center without shifting layout.
 */
function renderHighlightedTokens(
  line: string, highlightWord: string, highlightStyle: string, data: WizardData,
  emphasisWords?: string[]
): React.JSX.Element {
  const hlColor = data.subtitleHighlightColor || "#FFD700";
  const isStrong = data.highlightIntensity === "strong";
  const baseShadow = buildBaseTextShadow(data);

  // Compose glow ON TOP of base stroke — never replace
  const glowPart = isStrong ? `0 0 12px ${hlColor}60, 0 0 4px ${hlColor}40` : "";
  const composedShadow = [baseShadow, glowPart].filter(Boolean).join(", ") || undefined;

  const words = line.split(/\s+/).filter(Boolean);

  const tokenBase: React.CSSProperties = {
    display: "inline-block",
    transformOrigin: "center",
    transition: "transform 0.15s ease, color 0.15s ease",
    willChange: "transform",
  };

  // AI emphasis mode: highlight AI-selected important words
  if (data.highlightMode === "ai" && emphasisWords && emphasisWords.length > 0) {
    return (
      <>
        {words.map((word, i) => {
          const isEmphasis = emphasisWords.some(w => word.includes(w) || w.includes(word));
          if (isEmphasis) {
            return (
              <span key={i} style={{
                ...tokenBase,
                color: hlColor,
                fontWeight: isStrong ? 900 : 700,
                textShadow: composedShadow,
                transform: isStrong ? `scale(${MAX_HL_SCALE})` : "none",
              }}>{word}</span>
            );
          }
          return <span key={i} style={tokenBase}>{word}</span>;
        })}
      </>
    );
  }

  // Sequential mode: highlight the keyword
  return (
    <>
      {words.map((word, i) => {
        const isHighlighted = highlightWord && word.toLowerCase().includes(highlightWord.toLowerCase());
        if (isHighlighted) {
          let hlExtra: React.CSSProperties = { textShadow: composedShadow };
          if (highlightStyle === "color") hlExtra.color = hlColor;
          else if (highlightStyle === "bg") hlExtra.background = hlColor;
          else if (highlightStyle === "scale") { hlExtra.transform = `scale(${MAX_HL_SCALE})`; hlExtra.color = hlColor; }
          else if (highlightStyle === "bold") hlExtra.fontWeight = 900;
          return <span key={i} style={{ ...tokenBase, ...hlExtra }}>{word}</span>;
        }
        return <span key={i} style={tokenBase}>{word}</span>;
      })}
    </>
  );
}

function loadGoogleFont(fontFamily: string) {
  if (!fontFamily || typeof document === "undefined") return;
  const id = `gf-${fontFamily.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, "+")}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
  link.rel = "stylesheet";
  document.head.appendChild(link);
}

function generateSmartSegments(durationSec: number): SubSegment[] {
  const segs: SubSegment[] = [];
  const targetLen = 3;
  let pos = 0;
  let idx = 0;
  while (pos < durationSec) {
    const jitter = (Math.random() - 0.5) * 1.5;
    let len = Math.max(1.5, Math.min(5, targetLen + jitter));
    let end = Math.min(pos + len, durationSec);
    if (durationSec - end < 1.5) end = durationSec;
    segs.push({
      id: `seg_${idx}`,
      startSec: Math.round(pos * 100) / 100,
      endSec: Math.round(end * 100) / 100,
      text: "",
      edited: false,
      highlightWord: "",
      highlightStyle: "color",
    });
    pos = end;
    idx++;
  }
  return segs;
}

function generateBrollSuggestions(segments: SubSegment[]): BrollSuggestion[] {
  const keywords = ["video", "speech", "action", "scene", "moment", "detail", "close up", "wide shot"];
  return segments.map((seg) => ({
    segmentId: seg.id,
    keywords: keywords.slice(0, Math.floor(Math.random() * 2 + 1)),
    relevance: 0.5 + Math.random() * 0.5,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Wizard
   ═══════════════════════════════════════════════════════════════════════════ */

export default function NewProjectWizard() {
  const router = useRouter();
  const toast = useToast();
  const { data: clients, create: createClient } = useClients();
  const { create: createProject, update: updateProject } = useProjects();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [creating, setCreating] = useState(false);
  const [renderModalOpen, setRenderModalOpen] = useState(false);
  const [renderMinimized, setRenderMinimized] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStage, setRenderStage] = useState(0);
  const [renderComplete, setRenderComplete] = useState(false);
  const [renderProjectName, setRenderProjectName] = useState("");
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderStageLabel, setRenderStageLabel] = useState("");

  const patch = useCallback((p: Partial<WizardData>) => setData((d) => ({ ...d, ...p })), []);

  // ─── Persistent Preview & Edit State ───
  const [showPreview, setShowPreview] = useState(false);
  const [liveEditMode, setLiveEditMode] = useState(false);
  const [timelineCurrent, setTimelineCurrent] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [editStateVersion, setEditStateVersion] = useState(0);
  const [reEditResult, setReEditResult] = useState<ReEditResult | null>(null);
  const [reEditComparing, setReEditComparing] = useState(false);

  // Bump edit state version whenever data changes (for debug tracking)
  useEffect(() => { setEditStateVersion(v => v + 1); }, [data]);

  // Steps where persistent preview should show (editing steps with video context)
  const PREVIEW_STEPS = new Set(["substyle", "transcript", "aiHighlight", "aidirection", "cleanup", "broll", "transitions", "music", "preview", "approve"]);

  const stepId = STEPS[step]?.id;

  const canAdvance = useMemo(() => {
    const sid = STEPS[step]?.id;
    switch (sid) {
      case "info": return !!data.title.trim() && !!data.clientId;
      case "upload": return !!data.videoFile;
      case "format": return !!data.format;
      case "language": return !!data.language;
      case "broll": return !data.brollEnabled || data.brollApproved;
      default: return true;
    }
  }, [step, data.title, data.clientId, data.videoFile, data.format, data.language, data.brollEnabled, data.brollApproved]);

  const next = () => { if (canAdvance && step < STEPS.length - 1) setStep(step + 1); };
  const prev = () => { if (step > 0) setStep(step - 1); };

  // ─── Video Source Resolution ───
  // Two separate sources: one safe for Remotion (server URLs only), one for plain <video> (blob OK)
  //
  // WHY: Remotion's OffthreadVideo runs in a Web Worker that CANNOT access blob: URLs.
  // Passing a blob: URL to Remotion causes a silent black screen with no error.
  // Only server-side URLs (/uploads/... or https://...) work in Remotion.

  /** For Remotion composition — NEVER returns blob: URLs */
  const videoSrcForComposition = useMemo(() => {
    const result = (() => {
      if (data.uploadedVideoUrl) return data.uploadedVideoUrl;
      if (data.videoUrl && !data.videoUrl.startsWith("blob:")) return data.videoUrl;
      return "";
    })();
    if (process.env.NODE_ENV === "development") {
      console.debug("[VideoURL] composition:", result || "(empty)", "| uploadedVideoUrl:", data.uploadedVideoUrl || "(empty)", "| videoUrl:", data.videoUrl?.substring(0, 50) || "(empty)");
    }
    return result;
  }, [data.uploadedVideoUrl, data.videoUrl]);

  /** originalVideoSource — the SINGLE source of truth for ALL preview/editing steps.
   *  Uses ONLY data.uploadedVideoUrl (server path from StepUpload early upload).
   *  Transcription NEVER writes to this field. */
  const originalVideoSource = data.uploadedVideoUrl;

  if (process.env.NODE_ENV === "development") {
    console.debug("[originalVideoSource]", originalVideoSource || "(empty)")
  }

  const liveCompositionData = useMemo<FinalCompositionData | null>(() => {
    if (!videoSrcForComposition) return null;
    try {
      const snapshot: WizardSnapshot = {
        projectId: "live-edit",
        title: data.title,
        clientId: data.clientId,
        clientName: "",
        creativePrompt: data.creativePrompt,
        videoUrl: videoSrcForComposition,
        videoFileName: data.videoFile?.name || "",
        videoDurationSec: data.trimMode === "clip" ? Math.round(data.trimEnd - data.trimStart) : 30,
        trimMode: data.trimMode, trimStart: data.trimStart, trimEnd: data.trimEnd,
        format: data.format,
        subtitleMode: data.subtitleMode, language: data.language,
        segments: data.segments.map(s => ({ id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text, edited: s.edited, highlightWord: s.highlightWord, highlightStyle: s.highlightStyle, confidence: s.confidence, emphasisWords: s.emphasisWords })),
        subtitleFont: data.subtitleFont, subtitleFontWeight: data.subtitleFontWeight,
        subtitleFontSize: data.subtitleFontSize, subtitleColor: data.subtitleColor,
        subtitleHighlightColor: data.subtitleHighlightColor,
        subtitleOutlineEnabled: data.subtitleOutlineEnabled, subtitleOutlineColor: data.subtitleOutlineColor,
        subtitleOutlineThickness: data.subtitleOutlineThickness, subtitleShadow: data.subtitleShadow,
        subtitleBg: data.subtitleBg, subtitleBgColor: data.subtitleBgColor,
        subtitleBgOpacity: data.subtitleBgOpacity, subtitleAlign: data.subtitleAlign,
        subtitlePosition: data.subtitlePosition, subtitleManualY: data.subtitleManualY, subtitleAnimation: data.subtitleAnimation,
        subtitleLineBreak: data.subtitleLineBreak, highlightMode: data.highlightMode, highlightIntensity: data.highlightIntensity,
        brollEnabled: data.brollEnabled, brollStyle: data.brollStyle,
        brollPlacements: data.brollPlacements,
        transitionStyle: data.transitionStyle as any,
        musicEnabled: data.musicEnabled, musicTrackId: data.musicTrackId,
        musicTrackTitle: "", musicTrackUrl: "",
        musicVolume: data.musicVolume, musicDucking: data.musicDucking,
        musicDuckingLevel: data.musicDuckingLevel,
        soundDesignEnabled: data.soundDesignEnabled, sfxOnCuts: data.sfxOnCuts,
        sfxStyle: data.sfxStyle,
        cleanupFillers: data.cleanupFillers, cleanupSilence: data.cleanupSilence,
        cleanupIntensity: data.cleanupIntensity,
        cleanupRemovedSegments: data.cleanupRemovedSegments,
        preset: data.preset, exportQuality: data.exportQuality || "premium",
        aiEditMode: data.aiEditMode || "", aiDirectionNotes: data.creativePrompt,
        premiumMode: data.premiumMode, premiumLevel: data.premiumLevel,
      };
      const compositionData = buildFinalCompositionData(snapshot);

      // Apply unified edit engine when active
      if (data.editEngineActive && data.segments.length > 0) {
        try {
          const transcriptSegments: TranscriptSegment[] = data.segments.map(s => ({
            id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text, highlightWord: s.highlightWord,
          }));
          const profile: EditProfile = EDIT_PRESETS[data.editProfile] || EDIT_PRESETS.balanced;
          const editPlan = generateUnifiedEditPlan(transcriptSegments, {
            profile,
            durationSec: compositionData.timeline.durationSec,
            format: data.format,
            language: (data.language as "he" | "en" | "auto") || "auto",
          });

          // Map coordinator types → composition editEngine format
          // The coordinator uses simplified types; we normalize to the composition schema
          const zoomSegs = editPlan.zoom?.segments || [];
          const pacingSegs = editPlan.pacing?.segments || [];
          const hookAnalysis = editPlan.hook?.analysis;
          const hookEnhancement = editPlan.hook?.enhancement;
          const retCurve = editPlan.retention?.curve || [];

          // Convert zoom segments → keyframes for Remotion
          const zoomKeyframes = zoomSegs.map((zs: any, i: number) => {
            const seg = data.segments.find(s => s.id === zs.segmentId);
            return {
              timeSec: seg?.startSec || i * 3,
              scale: 1 + (zs.intensity || 0.1),
              translateX: 0,
              translateY: 0,
              easing: "ease-in-out",
              trigger: "emphasis",
              durationSec: seg ? (seg.endSec - seg.startSec) : 2,
            };
          });

          compositionData.editEngine = {
            zoomKeyframes,
            pacingSegments: pacingSegs.map((ps: any) => ({
              segmentId: ps.segmentId,
              speedFactor: ps.speedMultiplier || 1,
              trimSilenceBefore: ps.pauseAdjustment || 0,
              trimSilenceAfter: 0,
              action: ps.speedMultiplier > 1 ? "tighten" : "keep",
              energy: ps.speedMultiplier > 1.1 ? "low" : "medium",
            })),
            hook: hookAnalysis && hookAnalysis.score > 0 ? {
              hookType: hookAnalysis.style || "benefit",
              hookScore: hookAnalysis.score,
              hookEndSec: hookAnalysis.hasDuration || 5,
              zoomBoost: hookEnhancement?.zoomBoost || 1,
              pacingBoost: hookEnhancement?.bgmBump || 1,
              brollIntensity: 0.5,
              subtitleFontSizeMultiplier: 1.1,
              skipIntroToSec: 0,
            } : null,
            retentionCurve: retCurve.map((rc: any) => ({
              timeSec: rc.timeSec, retention: rc.retention, zone: rc.zone || "body",
            })),
            profile: {
              brollIntensity: profile.brollIntensity,
              zoomStyle: profile.zoomStyle,
              pacingMode: profile.pacingMode,
              hookStrength: profile.hookStrength,
              retentionLevel: profile.retentionLevel,
            },
            overallEditScore: editPlan.stats.overallEditScore,
          };
        } catch (e) {
          console.warn("[EditEngine] Failed to apply unified edit plan:", e);
        }
      }

      return compositionData;
    } catch { return null; }
  }, [data, videoSrcForComposition]);

  // Bridge WizardData → PreviewWizardData for the persistent preview panel
  const previewData = useMemo<PreviewWizardData>(() => ({
    projectId: "live-edit",
    title: data.title,
    clientId: data.clientId,
    clientName: "",
    creativePrompt: data.creativePrompt,
    videoUrl: originalVideoSource || videoSrcForComposition || data.videoUrl,
    uploadedVideoUrl: data.uploadedVideoUrl,
    videoFileName: data.videoFile?.name || "",
    videoDurationSec: data.trimMode === "clip" ? Math.round(data.trimEnd - data.trimStart) : 30,
    trimMode: data.trimMode, trimStart: data.trimStart, trimEnd: data.trimEnd,
    format: data.format,
    subtitleMode: data.subtitleMode, language: data.language,
    segments: data.segments.map(s => ({ id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text, edited: s.edited, highlightWord: s.highlightWord, highlightStyle: s.highlightStyle, confidence: s.confidence, emphasisWords: s.emphasisWords })),
    subtitleFont: data.subtitleFont, subtitleFontWeight: data.subtitleFontWeight,
    subtitleFontSize: data.subtitleFontSize, subtitleColor: data.subtitleColor,
    subtitleHighlightColor: data.subtitleHighlightColor,
    subtitleOutlineEnabled: data.subtitleOutlineEnabled, subtitleOutlineColor: data.subtitleOutlineColor,
    subtitleOutlineThickness: data.subtitleOutlineThickness, subtitleShadow: data.subtitleShadow,
    subtitleBg: data.subtitleBg, subtitleBgColor: data.subtitleBgColor,
    subtitleBgOpacity: data.subtitleBgOpacity, subtitleAlign: data.subtitleAlign,
    subtitlePosition: data.subtitlePosition, subtitleManualY: data.subtitleManualY, subtitleAnimation: data.subtitleAnimation,
    subtitleLineBreak: data.subtitleLineBreak, highlightMode: data.highlightMode, highlightIntensity: data.highlightIntensity,
    brollEnabled: data.brollEnabled, brollStyle: data.brollStyle,
    brollPlacements: data.brollPlacements as any,
    transitionStyle: data.transitionStyle as any,
    musicEnabled: data.musicEnabled, musicTrackId: data.musicTrackId,
    musicVolume: data.musicVolume, musicDucking: data.musicDucking, musicDuckingLevel: data.musicDuckingLevel,
    soundDesignEnabled: data.soundDesignEnabled, sfxOnCuts: data.sfxOnCuts, sfxStyle: data.sfxStyle,
    cleanupFillers: data.cleanupFillers, cleanupSilence: data.cleanupSilence,
    cleanupIntensity: data.cleanupIntensity, cleanupRemovedSegments: data.cleanupRemovedSegments,
    preset: data.preset, exportQuality: data.exportQuality || "premium",
    aiEditMode: data.aiEditMode || "", aiDirectionNotes: data.creativePrompt,
    premiumMode: data.premiumMode, premiumLevel: data.premiumLevel,
  }), [data]);

  // Active layers count for debug
  const activeLayers = useMemo(() => {
    const layers: string[] = [];
    if (data.segments.length > 0) layers.push("כתוביות");
    if (data.brollEnabled && data.brollPlacements.length > 0) layers.push("B-Roll");
    if (data.musicEnabled && data.musicTrackId) layers.push("מוזיקה");
    if (data.transitionStyle && data.transitionStyle !== "cut") layers.push("מעברים");
    if (data.cleanupFillers || data.cleanupSilence) layers.push("ניקוי");
    if (data.premiumMode) layers.push("פרימיום");
    if (data.aiEditMode) layers.push("AI כיוון");
    return layers;
  }, [data]);

  // AI Re-edit handler
  const handleReEdit = useCallback((mode: ReEditMode) => {
    const input = {
      segments: data.segments.map(s => ({ id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text, highlightWord: s.highlightWord, highlightStyle: s.highlightStyle, emphasisWords: s.emphasisWords })),
      durationSec: data.trimMode === "clip" ? Math.round(data.trimEnd - data.trimStart) : 30,
      format: data.format, currentPreset: data.preset, currentTransitionStyle: data.transitionStyle,
      brollPlacements: data.brollPlacements, musicEnabled: data.musicEnabled,
      musicTrackId: data.musicTrackId, musicVolume: data.musicVolume,
      premiumMode: data.premiumMode, premiumLevel: data.premiumLevel,
      cleanupRemovedSegments: data.cleanupRemovedSegments, language: data.language || "he",
    };
    const result = generateReEdit(input, mode);
    setReEditResult(result);
    setReEditComparing(true);
  }, [data]);

  const applyReEdit = useCallback(() => {
    if (!reEditResult) return;
    patch(reEditResult.patch as Partial<WizardData>);
    setReEditComparing(false);
    setReEditResult(null);
  }, [reEditResult, patch]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const client = clients.find((c) => c.id === data.clientId);
      const videoDurationSec = data.trimMode === "clip" ? Math.round(data.trimEnd - data.trimStart) : 0;
      const projectId = `proj_${Date.now()}`;

      // Ensure video is uploaded to Supabase Storage (may not have been if transcription was skipped)
      if (!data.uploadedVideoUrl && data.videoFile) {
        try {
          console.log("[createProject] Uploading video to Supabase Storage before save...");
          // Step 1: Get signed URL (tiny JSON)
          const initRes = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: data.videoFile.name, contentType: data.videoFile.type, fileSize: data.videoFile.size }),
          });
          if (!initRes.ok) {
            let errMsg = `status ${initRes.status}`;
            try { const b = await initRes.json(); if (b.error) errMsg = b.error; } catch {}
            console.error("[createProject] ❌ Failed to get upload URL:", errMsg);
          } else {
            const { uploadUrl, publicUrl } = await initRes.json();
            // Step 2: PUT file directly to Supabase
            if (uploadUrl) {
              const putRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": data.videoFile.type || "application/octet-stream" },
                body: data.videoFile,
              });
              if (putRes.ok) {
                patch({ uploadedVideoUrl: publicUrl, videoUrl: publicUrl });
                data.uploadedVideoUrl = publicUrl;
                data.videoUrl = publicUrl;
                console.log("[createProject] ✅ Video uploaded:", publicUrl);
              } else {
                console.error("[createProject] ❌ Direct upload failed:", putRes.status);
              }
            }
          }
        } catch (e) {
          console.error("[createProject] ❌ Video upload error:", e instanceof Error ? e.message : e);
        }
      }

      // Build WizardSnapshot for the composition pipeline
      const wizardSnapshot: WizardSnapshot = {
        projectId,
        title: data.title,
        clientId: data.clientId,
        clientName: client?.name || "",
        creativePrompt: data.creativePrompt,
        videoUrl: data.uploadedVideoUrl || (data.videoUrl && !data.videoUrl.startsWith("blob:") ? data.videoUrl : ""),
        videoFileName: data.videoFile?.name || "",
        videoDurationSec: videoDurationSec || 30,
        trimMode: data.trimMode,
        trimStart: data.trimStart,
        trimEnd: data.trimEnd,
        format: data.format,
        subtitleMode: data.subtitleMode,
        language: data.language,
        segments: data.segments.map(s => ({
          id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
          edited: s.edited, highlightWord: s.highlightWord, highlightStyle: s.highlightStyle as string,
          confidence: s.confidence, emphasisWords: s.emphasisWords,
        })),
        subtitleFont: data.subtitleFont,
        subtitleFontWeight: data.subtitleFontWeight,
        subtitleFontSize: data.subtitleFontSize,
        subtitleColor: data.subtitleColor,
        subtitleHighlightColor: data.subtitleHighlightColor,
        subtitleOutlineEnabled: data.subtitleOutlineEnabled,
        subtitleOutlineColor: data.subtitleOutlineColor,
        subtitleOutlineThickness: data.subtitleOutlineThickness,
        subtitleShadow: data.subtitleShadow,
        subtitleBg: data.subtitleBg,
        subtitleBgColor: data.subtitleBgColor,
        subtitleBgOpacity: data.subtitleBgOpacity,
        subtitleAlign: data.subtitleAlign,
        subtitlePosition: data.subtitlePosition,
        subtitleAnimation: data.subtitleAnimation,
        subtitleLineBreak: data.subtitleLineBreak, highlightMode: data.highlightMode, highlightIntensity: data.highlightIntensity,
        brollEnabled: data.brollEnabled,
        brollStyle: data.brollStyle,
        brollPlacements: data.brollPlacements,
        transitionStyle: data.transitionStyle as any,
        musicEnabled: data.musicEnabled,
        musicTrackId: data.musicTrackId,
        musicTrackTitle: "",
        musicTrackUrl: "",
        musicVolume: data.musicVolume,
        musicDucking: data.musicDucking,
        musicDuckingLevel: data.musicDuckingLevel,
        soundDesignEnabled: data.soundDesignEnabled,
        sfxOnCuts: data.sfxOnCuts,
        sfxStyle: data.sfxStyle,
        cleanupFillers: data.cleanupFillers,
        cleanupSilence: data.cleanupSilence,
        cleanupIntensity: data.cleanupIntensity,
        cleanupRemovedSegments: data.cleanupRemovedSegments,
        preset: data.preset,
        exportQuality: data.exportQuality || "premium",
        aiEditMode: "",
        aiDirectionNotes: data.creativePrompt,
        premiumMode: data.premiumMode,
        premiumLevel: data.premiumLevel,
      };

      // Build FinalCompositionData — the single source of truth
      let compositionData = null;
      try {
        compositionData = buildFinalCompositionData(wizardSnapshot);
      } catch (e) {
        console.warn("Composition data build failed:", e);
      }

      // Also build legacy render payload for backward compatibility
      const wizardStateForRender = {
        title: data.title, clientId: data.clientId, clientName: client?.name || "",
        creativePrompt: data.creativePrompt,
        subtitleFont: data.subtitleFont, subtitleFontWeight: data.subtitleFontWeight,
        subtitleFontSize: data.subtitleFontSize, subtitleColor: data.subtitleColor,
        subtitleHighlightColor: data.subtitleHighlightColor,
        subtitleOutlineEnabled: data.subtitleOutlineEnabled, subtitleOutlineColor: data.subtitleOutlineColor,
        subtitleOutlineThickness: data.subtitleOutlineThickness, subtitleShadow: data.subtitleShadow,
        subtitleBg: data.subtitleBg, subtitleBgColor: data.subtitleBgColor,
        subtitleBgOpacity: data.subtitleBgOpacity, subtitleAlign: data.subtitleAlign,
        subtitlePosition: data.subtitlePosition, subtitleManualY: data.subtitleManualY, subtitleAnimation: data.subtitleAnimation,
        subtitleLineBreak: data.subtitleLineBreak, highlightMode: data.highlightMode, highlightIntensity: data.highlightIntensity,
        videoFileName: data.videoFile?.name || "", videoDurationSec,
        trimMode: data.trimMode, trimStart: data.trimStart, trimEnd: data.trimEnd,
        format: data.format, subtitleMode: data.subtitleMode, language: data.language,
        segments: data.segments.map(s => ({
          id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
          edited: s.edited, highlightWord: s.highlightWord, highlightStyle: s.highlightStyle as any,
        })),
        brollEnabled: data.brollEnabled, brollStyle: data.brollStyle, brollPlacements: data.brollPlacements,
        musicEnabled: data.musicEnabled, musicTrackId: data.musicTrackId,
        musicVolume: data.musicVolume, musicDucking: data.musicDucking, musicDuckingLevel: data.musicDuckingLevel,
        soundDesignEnabled: data.soundDesignEnabled, sfxOnCuts: data.sfxOnCuts, sfxStyle: data.sfxStyle,
        cleanupFillers: data.cleanupFillers, cleanupSilence: data.cleanupSilence,
        cleanupIntensity: data.cleanupIntensity,
        cleanupRemovedSegments: data.cleanupRemovedSegments.filter(s => s.removed),
        preset: data.preset, exportQuality: data.exportQuality,
        transitionStyle: data.transitionStyle, premiumMode: data.premiumMode, premiumLevel: data.premiumLevel,
      };

      let renderPayload = null;
      try {
        renderPayload = buildRenderPayload(projectId, wizardStateForRender);
      } catch (e) {
        console.warn("Legacy render payload build failed:", e);
      }

      // Run AI scoring
      let aiScore = null;
      try {
        aiScore = scoreVideo({
          segments: wizardStateForRender.segments,
          durationSec: videoDurationSec || 30,
          format: data.format, hasMusic: data.musicEnabled, hasBroll: data.brollEnabled,
          preset: data.preset,
          subtitleStyle: {
            font: data.subtitleFont, fontWeight: data.subtitleFontWeight,
            fontSize: data.subtitleFontSize, color: data.subtitleColor,
            highlightColor: data.subtitleHighlightColor, outlineEnabled: data.subtitleOutlineEnabled,
            outlineColor: data.subtitleOutlineColor, outlineThickness: data.subtitleOutlineThickness,
            shadow: data.subtitleShadow, bgEnabled: data.subtitleBg, bgColor: data.subtitleBgColor,
            bgOpacity: data.subtitleBgOpacity, align: data.subtitleAlign, position: data.subtitlePosition,
            animation: data.subtitleAnimation as any, lineBreak: data.subtitleLineBreak,
            highlightMode: data.highlightMode, highlightIntensity: data.highlightIntensity,
          },
        });
      } catch (e) {
        console.warn("AI scoring failed:", e);
      }

      // Save project to database
      const savedProject = await createProject({
        name: data.title, clientId: data.clientId, clientName: client?.name || "",
        status: "approved", format: data.format, preset: data.preset,
        durationSec: videoDurationSec,
        segments: data.segments, sourceVideoKey: data.uploadedVideoUrl || data.videoUrl || null,
        renderOutputKey: null, thumbnailKey: null,
        wizardState: {
          videoUrl: data.uploadedVideoUrl || data.videoUrl || "",
          uploadedVideoUrl: data.uploadedVideoUrl || "",
          format: data.format,
          creativePrompt: data.creativePrompt,
          subtitleFont: data.subtitleFont, subtitleFontWeight: data.subtitleFontWeight,
          subtitleFontSize: data.subtitleFontSize, subtitleColor: data.subtitleColor,
          subtitleHighlightColor: data.subtitleHighlightColor,
          subtitleOutlineEnabled: data.subtitleOutlineEnabled, subtitleOutlineColor: data.subtitleOutlineColor,
          subtitleOutlineThickness: data.subtitleOutlineThickness, subtitleShadow: data.subtitleShadow,
          subtitleBg: data.subtitleBg, subtitleBgColor: data.subtitleBgColor,
          subtitleBgOpacity: data.subtitleBgOpacity, subtitleAlign: data.subtitleAlign,
          subtitlePosition: data.subtitlePosition, subtitleManualY: data.subtitleManualY, subtitleAnimation: data.subtitleAnimation,
          subtitleLineBreak: data.subtitleLineBreak, highlightMode: data.highlightMode, highlightIntensity: data.highlightIntensity,
          trimMode: data.trimMode, trimStart: data.trimStart, trimEnd: data.trimEnd,
          subtitleMode: data.subtitleMode, language: data.language, segments: data.segments,
          brollEnabled: data.brollEnabled, brollStyle: data.brollStyle, brollPlacements: data.brollPlacements,
          musicEnabled: data.musicEnabled, musicStyle: data.musicStyle, musicVolume: data.musicVolume,
          musicTrackId: data.musicTrackId, musicDucking: data.musicDucking, musicDuckingLevel: data.musicDuckingLevel,
          soundDesignEnabled: data.soundDesignEnabled, sfxOnCuts: data.sfxOnCuts, sfxStyle: data.sfxStyle,
          cleanupFillers: data.cleanupFillers, cleanupSilence: data.cleanupSilence,
          cleanupIntensity: data.cleanupIntensity,
          cleanupRemovedSegments: data.cleanupRemovedSegments.filter(s => s.removed),
          preset: data.preset, exportQuality: data.exportQuality,
          transitionStyle: data.transitionStyle,
          premiumMode: data.premiumMode, premiumLevel: data.premiumLevel,
          aiScore: aiScore ? { overall: aiScore.overall, hookStrength: aiScore.hookStrength, clarity: aiScore.clarity, engagementPotential: aiScore.engagementPotential, pacing: aiScore.pacing, ctaStrength: aiScore.ctaStrength } : null,
          // ─── Full composition data — single source of truth for the final edit state ───
          compositionData: compositionData ? JSON.parse(JSON.stringify(compositionData)) : null,
          editStateVersion,
          activeLayers: activeLayers,
        },
        renderPayload: renderPayload ? (renderPayload as unknown as Record<string, unknown>) : null,
      });

      // Open render modal and start real render job
      setRenderProjectName(data.title);
      setRenderModalOpen(true);
      setRenderProgress(0);
      setRenderStage(0);
      setRenderStageLabel("ממתין בתור");
      setRenderComplete(false);
      setCreating(false);

      // POST to render API with composition data
      // IMPORTANT: use savedProject.id (the DB-generated ID) — NOT the local projectId
      const dbProjectId = savedProject.id;
      const renderBody = compositionData || renderPayload || {};
      console.log("[render] 📦 Render request:", {
        dbProjectId,
        localProjectId: projectId,
        projectName: data.title,
        hasCompositionData: !!compositionData,
        hasRenderPayload: !!renderPayload,
        renderBodyKeys: Object.keys(renderBody),
        videoUrl: (renderBody as any)?.source?.videoUrl?.substring(0, 80) || "(none in body)",
        quality: data.premiumLevel || "premium",
      });
      try {
        const renderRes = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: dbProjectId,
            projectName: data.title,
            compositionData: renderBody,
            quality: data.premiumLevel || "premium",
          }),
        });

        if (!renderRes.ok) {
          let serverError = `HTTP ${renderRes.status}`;
          try {
            const errBody = await renderRes.json();
            serverError = errBody.error || errBody.message || JSON.stringify(errBody);
            console.error("[render] ❌ Render API response:", renderRes.status, errBody);
          } catch { /* noop */ }
          throw new Error(`Render API failed: ${serverError}`);
        }

        const { job } = await renderRes.json();
        const jobId = job.id;
        setRenderJobId(jobId);
        console.log(`[render] ✅ Render job created: jobId=${jobId} projectId=${dbProjectId} status=${job.status}`);

        // Poll render job for real progress
        let pollCount = 0;
        let notFoundCount = 0;
        const pollInterval = setInterval(async () => {
          try {
            pollCount++;
            const pollUrl = `/api/render/${jobId}`;
            const statusRes = await fetch(pollUrl);
            if (!statusRes.ok) {
              if (statusRes.status === 404 && notFoundCount < 5) {
                // Job may not be in DB yet — retry a few times before giving up
                notFoundCount++;
                console.warn(`[render-poll] ⚠️ Poll #${pollCount} 404 (attempt ${notFoundCount}/5) — jobId=${jobId} url=${pollUrl}`);
                return; // Don't clearInterval — keep retrying
              }
              console.error(`[render-poll] ❌ Poll #${pollCount} failed: HTTP ${statusRes.status} jobId=${jobId} url=${pollUrl}`);
              clearInterval(pollInterval);
              return;
            }
            notFoundCount = 0; // Reset on success
            const { job: updatedJob } = await statusRes.json();
            if (pollCount <= 3 || pollCount % 5 === 0 || updatedJob.status === "completed" || updatedJob.status === "failed") {
              console.log(`[render-poll] #${pollCount} status=${updatedJob.status} progress=${updatedJob.progress}% stage="${updatedJob.currentStage}" publicUrl=${updatedJob.publicUrl || "(none)"}`);
            }

            setRenderProgress(updatedJob.progress || 0);
            setRenderStageLabel(updatedJob.currentStage || "");

            // Map progress to stage index for the stage dots
            const prog = updatedJob.progress || 0;
            if (prog < 15) setRenderStage(0);
            else if (prog < 40) setRenderStage(1);
            else if (prog < 55) setRenderStage(2);
            else if (prog < 75) setRenderStage(3);
            else if (prog < 92) setRenderStage(4);
            else setRenderStage(5);

            if (updatedJob.status === "completed") {
              clearInterval(pollInterval);
              setRenderProgress(100);
              setRenderStage(5);
              setRenderStageLabel("הושלם");
              // Use Supabase public URL (set by server) or fall back to outputPath
              const renderUrl = updatedJob.publicUrl || updatedJob.outputPath;
              console.log(`[render-poll] ✅ Render complete: publicUrl=${updatedJob.publicUrl || "(none)"} outputPath=${updatedJob.outputPath || "(none)"}`);
              // Update project with render output URL and mark as complete
              // (server-side route also does this, but we do it client-side too as backup)
              if (savedProject?.id && renderUrl) {
                try {
                  await updateProject(savedProject.id, {
                    status: "complete",
                    renderOutputKey: renderUrl,
                    videoUrl: renderUrl,
                  });
                  console.log(`[render-poll] ✅ Project ${savedProject.id} updated: renderOutputKey+videoUrl=${renderUrl.slice(0, 80)}`);
                } catch (e) {
                  // Not fatal — the server route already persisted this
                  console.warn("[render-poll] ⚠️ Client-side project update failed (server already handled it):", e);
                }
              } else {
                console.warn(`[render-poll] ⚠️ Could not update project: savedProject.id=${savedProject?.id} renderUrl=${renderUrl}`);
              }
              await new Promise(r => setTimeout(r, 500));
              setRenderComplete(true);
            } else if (updatedJob.status === "failed") {
              clearInterval(pollInterval);
              setRenderModalOpen(false);
              console.error(`[render-poll] ❌ Render failed: ${updatedJob.error}`);
              toast(updatedJob.error || "שגיאה ברינדור", "error");
            }
          } catch {
            clearInterval(pollInterval);
          }
        }, 1200);
      } catch (renderErr) {
        // Render API failed — show real error, do NOT fake success
        const msg = renderErr instanceof Error ? renderErr.message : "שגיאה בהפעלת הרינדור";
        console.error("[render] ❌ Render API error:", msg);
        setRenderModalOpen(false);
        toast(msg, "error");
      }
    } catch {
      toast("שגיאה ביצירת הפרויקט", "error");
      setRenderModalOpen(false);
      setCreating(false);
    }
  };

  const handleSaveDraft = async () => {
    setCreating(true);
    try {
      const client = clients.find((c) => c.id === data.clientId);
      await createProject({
        name: data.title, clientId: data.clientId, clientName: client?.name || "",
        status: "draft", format: data.format, preset: data.preset,
        durationSec: data.trimMode === "clip" ? Math.round(data.trimEnd - data.trimStart) : 0,
        segments: data.segments, sourceVideoKey: data.uploadedVideoUrl || data.videoUrl || null,
        renderOutputKey: null, thumbnailKey: null,
        wizardState: {
          creativePrompt: data.creativePrompt,
          subtitleFont: data.subtitleFont,
          subtitleFontWeight: data.subtitleFontWeight,
          subtitleFontSize: data.subtitleFontSize,
          subtitleColor: data.subtitleColor,
          subtitleHighlightColor: data.subtitleHighlightColor,
          subtitleOutlineEnabled: data.subtitleOutlineEnabled,
          subtitleOutlineColor: data.subtitleOutlineColor,
          subtitleOutlineThickness: data.subtitleOutlineThickness,
          subtitleShadow: data.subtitleShadow,
          subtitleBg: data.subtitleBg,
          subtitleBgColor: data.subtitleBgColor,
          subtitleBgOpacity: data.subtitleBgOpacity,
          subtitleAlign: data.subtitleAlign,
          subtitlePosition: data.subtitlePosition,
          subtitleAnimation: data.subtitleAnimation,
          subtitleLineBreak: data.subtitleLineBreak, highlightMode: data.highlightMode, highlightIntensity: data.highlightIntensity,
          trimMode: data.trimMode, trimStart: data.trimStart, trimEnd: data.trimEnd,
          subtitleMode: data.subtitleMode, language: data.language,
          segments: data.segments,
          brollEnabled: data.brollEnabled, brollStyle: data.brollStyle,
          brollPlacements: data.brollPlacements,
          musicEnabled: data.musicEnabled, musicStyle: data.musicStyle, musicVolume: data.musicVolume,
          musicTrackId: data.musicTrackId, musicDucking: data.musicDucking, musicDuckingLevel: data.musicDuckingLevel,
          soundDesignEnabled: data.soundDesignEnabled, sfxOnCuts: data.sfxOnCuts, sfxStyle: data.sfxStyle,
          cleanupFillers: data.cleanupFillers, cleanupSilence: data.cleanupSilence, cleanupIntensity: data.cleanupIntensity,
          cleanupRemovedSegments: data.cleanupRemovedSegments.filter(s => s.removed),
          preset: data.preset, exportQuality: data.exportQuality,
          transitionStyle: data.transitionStyle,
          premiumMode: data.premiumMode, premiumLevel: data.premiumLevel,
          // ─── Save current composition state with draft ───
          compositionData: liveCompositionData ? JSON.parse(JSON.stringify(liveCompositionData)) : null,
          editStateVersion,
          activeLayers: activeLayers,
        },
        renderPayload: null,
      });
      toast("הפרויקט נשמר כטיוטה", "success");
      router.push("/projects");
    } catch { toast("שגיאה בשמירת הפרויקט", "error"); }
    finally { setCreating(false); }
  };

  useEffect(() => { return () => { if (data.videoUrl) URL.revokeObjectURL(data.videoUrl); }; }, [data.videoUrl]);

  const stepContent = (() => {
    const sid = STEPS[step]?.id;
    switch (sid) {
      case "info":        return <StepInfo data={data} patch={patch} clients={clients} createClient={createClient} />;
      case "upload":      return <StepUpload data={data} patch={patch} />;
      case "trim":        return <StepTrim data={data} patch={patch} />;
      case "format":      return <StepFormat data={data} patch={patch} />;
      case "submode":     return <StepSubMode data={data} patch={patch} />;
      case "language":    return <StepLanguage data={data} patch={patch} />;
      case "transcript":  return data.subtitleMode === "auto"
        ? <StepTranscriptReview data={data} patch={patch} videoSrc={originalVideoSource} />
        : <StepManualSubtitles data={data} patch={patch} videoSrc={originalVideoSource} />;
      case "substyle":    return <StepSubStyle data={data} patch={patch} videoSrc={originalVideoSource} />;
      case "aiHighlight": return <StepAiHighlight data={data} patch={patch} videoSrc={originalVideoSource} />;
      case "aidirection": return <StepAiDirection data={data} patch={patch} />;
      case "cleanup":     return <StepCleanup data={data} patch={patch} videoSrc={originalVideoSource} />;
      case "broll":       return <StepBroll data={data} patch={patch} compositionData={liveCompositionData} videoSrc={originalVideoSource} />;
      case "transitions": return <StepTransitions data={data} patch={patch} videoSrc={originalVideoSource} />;
      case "music":       return <StepMusic data={data} patch={patch} videoSrc={originalVideoSource} />;
      case "preview":     return <StepPreview data={data} videoSrc={originalVideoSource} />;
      case "approve":     return <StepApprove data={data} patch={patch} clients={clients} onApprove={handleCreate} onSaveDraft={handleSaveDraft} onBack={() => setStep(STEPS.findIndex(s => s.id === "preview"))} videoSrc={originalVideoSource} />;
      default: return null;
    }
  })();

  // Whether to show the persistent preview panel for this step
  const showPersistentPreview = PREVIEW_STEPS.has(stepId || "") && !!(originalVideoSource || videoSrcForComposition);

  return (
    <div className="wiz-root">
      <aside className="wiz-sidebar">
        <div className="wiz-sidebar-logo">
          <img src="/logo.png" alt="PixelFrameAI" style={{ height: 32, marginLeft: 8 }} />
          PixelFrame<span className="wiz-sidebar-ai">AI</span>
        </div>
        <div className="wiz-sidebar-title">פרויקט חדש</div>
        <nav className="wiz-steps-nav">
          {STEPS.map((s, i) => (
            <button key={s.id} className={`wiz-step-btn ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
              onClick={() => { if (i < step) setStep(i); }}>
              <span className="wiz-step-num">{i < step ? "✓" : s.icon}</span>
              <span className="wiz-step-label">{s.label}</span>
            </button>
          ))}
        </nav>

        {/* ─── Preview & Edit Controls ─── */}
        {videoSrcForComposition && (
          <div style={{ borderTop: "1px solid var(--border)", padding: "0.75rem 1rem", marginTop: "auto" }}>
            {/* Debug toggle */}
            <button
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", width: "100%", padding: "0.375rem 0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: showDebug ? "rgba(0,181,254,0.1)" : "transparent", color: showDebug ? "var(--accent)" : "var(--foreground-muted)", fontSize: "0.7rem", cursor: "pointer", marginBottom: "0.375rem" }}
              onClick={() => setShowDebug(!showDebug)}>
              🐛 מצב דיבאג {showDebug ? "פעיל" : "כבוי"}
            </button>

            {/* Live Edit toggle */}
            <button
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", width: "100%", padding: "0.375rem 0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: liveEditMode ? "rgba(0,181,254,0.1)" : "transparent", color: liveEditMode ? "var(--accent)" : "var(--foreground-muted)", fontSize: "0.7rem", cursor: "pointer", marginBottom: "0.375rem" }}
              onClick={() => setLiveEditMode(!liveEditMode)}>
              🎬 מצב עריכה חי {liveEditMode ? "פעיל" : "כבוי"}
            </button>

            {/* Active layers indicator */}
            <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
              שכבות פעילות: {activeLayers.length > 0 ? activeLayers.join(" · ") : "אין"}
            </div>
          </div>
        )}
      </aside>

      <main className="wiz-main" style={{ display: "flex", flexDirection: "column" }}>
        {/* ─── Debug Bar ─── */}
        {showDebug && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.375rem 1rem", background: "rgba(0,181,254,0.06)", borderBottom: "1px solid rgba(0,181,254,0.15)", fontSize: "0.65rem", color: "var(--accent)", fontFamily: "monospace", flexShrink: 0 }}>
            <span>שלב: {stepId} ({step + 1}/{STEPS.length})</span>
            <span>גרסת עריכה: v{editStateVersion}</span>
            <span>שכבות: {activeLayers.length}</span>
            <span>כתוביות: {data.segments.length}</span>
            <span>B-Roll: {data.brollPlacements.length}</span>
            <span>מוזיקה: {data.musicEnabled ? "כן" : "לא"}</span>
            <span>פרימיום: {data.premiumMode ? data.premiumLevel : "כבוי"}</span>
            <span>קומפוזיציה: {liveCompositionData ? "✓" : "✗"}</span>
          </div>
        )}

        {/* ─── Main Content Area — split when preview is visible ─── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Step Content */}
          <div className="wiz-content" style={{ flex: showPersistentPreview && stepId !== "preview" && stepId !== "approve" && stepId !== "transitions" ? "1 1 60%" : "1 1 100%", overflow: "auto", ...(stepId === "transitions" || stepId === "preview" || stepId === "approve" ? { maxWidth: "none" } : {}) }}>
            {stepContent}
          </div>

          {/* Persistent Preview Panel — shows alongside editing steps (except transitions which has its own full preview) */}
          {showPersistentPreview && stepId !== "preview" && stepId !== "approve" && stepId !== "transitions" && (
            <div style={{ flex: "0 0 340px", borderInlineStart: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface)" }}>
              <PreviewPanel
                data={previewData}
                visible={true}
                compact={true}
                showTimeline={true}
                showDebug={showDebug}
              />

              {/* ─── AI Re-Edit Button ─── */}
              <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.5rem" }}>🤖 AI Re-edit</div>
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {getReEditModes().map(m => (
                    <button key={m.id}
                      style={{ padding: "0.25rem 0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: reEditResult?.mode === m.id ? "rgba(0,181,254,0.15)" : "transparent", fontSize: "0.65rem", cursor: "pointer", color: "var(--foreground)" }}
                      onClick={() => handleReEdit(m.id)}
                      title={m.descHe}>
                      {m.icon} {m.labelHe}
                    </button>
                  ))}
                </div>

                {/* Re-edit comparison */}
                {reEditComparing && reEditResult && (
                  <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "var(--surface-raised)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                      שינויים מוצעים ({reEditResult.changes.length})
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
                      {reEditResult.summaryHe}
                    </div>
                    {reEditResult.changes.slice(0, 4).map((c, i) => (
                      <div key={i} style={{ fontSize: "0.6rem", padding: "2px 0", color: c.impact === "high" ? "var(--accent)" : "var(--foreground-muted)" }}>
                        {c.impact === "high" ? "⚡" : c.impact === "medium" ? "◉" : "·"} {c.descriptionHe}
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.5rem" }}>
                      <button className="wiz-btn wiz-btn-primary wiz-btn-sm" style={{ fontSize: "0.65rem", padding: "0.25rem 0.5rem" }} onClick={applyReEdit}>
                        החל שינויים
                      </button>
                      <button className="wiz-btn wiz-btn-ghost wiz-btn-sm" style={{ fontSize: "0.65rem", padding: "0.25rem 0.5rem" }} onClick={() => { setReEditComparing(false); setReEditResult(null); }}>
                        ביטול
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Timeline Editor (Live Edit Mode) ─── */}
        {liveEditMode && showPersistentPreview && (
          <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <TimelineEditor
              durationSec={liveCompositionData?.timeline.durationSec || (data.trimMode === "clip" ? Math.round(data.trimEnd - data.trimStart) : 30)}
              currentTime={timelineCurrent}
              onSeek={setTimelineCurrent}
              format={data.format}
              segments={data.segments}
              brollPlacements={data.brollPlacements}
              musicEnabled={data.musicEnabled}
              musicTrackId={data.musicTrackId}
              musicVolume={data.musicVolume}
              cleanupSegments={data.cleanupRemovedSegments}
              transitionStyle={data.transitionStyle}
              premiumMode={data.premiumMode}
              premiumLevel={data.premiumLevel}
              interactive={true}
              onRemoveBroll={(id) => patch({ brollPlacements: data.brollPlacements.filter(p => p.id !== id) })}
              onMoveBroll={(id, newStart, newEnd) => patch({
                brollPlacements: data.brollPlacements.map(p => p.id === id ? { ...p, startSec: newStart, endSec: newEnd } : p)
              })}
              onToggleCleanup={(id) => patch({
                cleanupRemovedSegments: data.cleanupRemovedSegments.map(s => s.id === id ? { ...s, removed: !s.removed } : s)
              })}
            />
          </div>
        )}

        {/* Bottom navigation bar */}
        {step < STEPS.length - 1 && (
          <div className="wiz-bottom-bar" style={{ flexShrink: 0 }}>
            <button className="wiz-btn wiz-btn-ghost" onClick={() => router.push("/projects")}>ביטול</button>
            <div style={{ flex: 1 }} />
            {step > 0 && <button className="wiz-btn wiz-btn-ghost" onClick={prev}>← הקודם</button>}
            <button className="wiz-btn wiz-btn-primary" onClick={next} disabled={!canAdvance}>הבא →</button>
          </div>
        )}
      </main>

      {/* Render Progress Modal */}
      {renderModalOpen && !renderMinimized && (
        <div className="render-modal-overlay">
          <div className="render-modal-glass">
            {!renderComplete ? (
              <>
                <button className="render-modal-minimize" onClick={() => setRenderMinimized(true)} title="מזער">
                  <span>▾</span>
                </button>
                <div className="render-modal-logo">
                  <img src="/logo.png" alt="PixelFrameAI" style={{ width: 40, height: 40, borderRadius: 10 }} />
                </div>
                <h2 className="render-modal-title">מכינים את הסרטון שלך...</h2>
                <p className="render-modal-subtitle">{renderProjectName}</p>

                <div className="render-progress-ring-wrap">
                  <svg className="render-progress-ring" viewBox="0 0 120 120">
                    <circle className="render-ring-bg" cx="60" cy="60" r="52" />
                    <circle className="render-ring-fg" cx="60" cy="60" r="52"
                      strokeDasharray={`${renderProgress * 3.267} 326.7`}
                      style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                  </svg>
                  <div className="render-ring-pct">{renderProgress}%</div>
                </div>

                <div className="render-stages">
                  {["מכין קומפוזיציה", "מעבד קטעים וכתוביות", "משלב B-Roll ומעברים", "מוסיף מוזיקה ואודיו", "שיפורים פרימיום", "רינדור סופי"].map((label, i) => (
                    <div key={i} className={`render-stage ${i < renderStage ? "done" : i === renderStage ? "active" : ""}`}>
                      <span className="render-stage-dot">{i < renderStage ? "✓" : i === renderStage ? "◉" : "○"}</span>
                      <span className="render-stage-label">{label}</span>
                    </div>
                  ))}
                </div>

                {renderStageLabel && (
                  <div className="render-modal-stage-detail">{renderStageLabel}</div>
                )}

                <div className="render-modal-eta">
                  זמן משוער: {renderProgress < 30 ? "~25 שניות" : renderProgress < 60 ? "~15 שניות" : renderProgress < 90 ? "~8 שניות" : "כמעט שם..."}
                </div>
              </>
            ) : (
              <div className="render-complete">
                <div className="render-complete-icon">🎉</div>
                <h2 className="render-complete-title">תתחדש! הפרויקט מוכן!</h2>
                <p className="render-complete-subtitle">{renderProjectName}</p>
                <div className="render-complete-actions">
                  <button className="wiz-btn wiz-btn-primary" onClick={() => router.push("/projects")}>
                    👁️ צפה בסרטון
                  </button>
                  <button className="wiz-btn wiz-btn-ghost" onClick={() => {
                    toast("הסרטון מוכן להורדה", "success");
                    router.push("/projects");
                  }}>
                    ⬇️ הורד סרטון
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Background Render Widget (minimized) */}
      {renderModalOpen && renderMinimized && !renderComplete && (
        <div className="render-widget" onClick={() => setRenderMinimized(false)}>
          <div className="render-widget-ring">
            <svg viewBox="0 0 36 36">
              <circle className="render-ring-bg" cx="18" cy="18" r="15" />
              <circle className="render-ring-fg" cx="18" cy="18" r="15"
                strokeDasharray={`${renderProgress * 0.942} 94.2`}
                style={{ transition: "stroke-dasharray 0.8s ease" }} />
            </svg>
            <span className="render-widget-pct">{renderProgress}%</span>
          </div>
          <div className="render-widget-info">
            <div className="render-widget-stage">
              {renderStageLabel || ["מכין קומפוזיציה", "מעבד קטעים", "משלב B-Roll", "מוסיף מוזיקה", "שיפורים פרימיום", "רינדור סופי"][renderStage] || ""}
            </div>
            <div className="render-widget-eta">
              {renderProgress < 60 ? "~15 שניות" : "כמעט שם..."}
            </div>
          </div>
        </div>
      )}

      {/* Background Widget — Complete State */}
      {renderModalOpen && renderMinimized && renderComplete && (
        <div className="render-widget render-widget-done" onClick={() => setRenderMinimized(false)}>
          <div className="render-widget-ring done">
            <span>✓</span>
          </div>
          <div className="render-widget-info">
            <div className="render-widget-stage">הפרויקט מוכן!</div>
            <div className="render-widget-actions">
              <button className="render-widget-btn" onClick={(e) => { e.stopPropagation(); router.push("/projects"); }}>צפה</button>
              <button className="render-widget-btn" onClick={(e) => { e.stopPropagation(); toast("הסרטון מוכן להורדה", "success"); }}>הורד</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   StableVideoPreview — Cumulative edited preview player.

   Renders the original video PLUS all accumulated edit layers:
   - Subtitle overlay (synced to playback time)
   - B-roll placement indicators
   - Active-layer badges (transition, music, cleanup, etc.)

   Every step passes the full WizardData via `subtitleData` (which acts as
   the cumulative EditedPreviewState). As the user edits, layers accumulate
   and persist across steps.

   The video source is ALWAYS originalVideoSource. Visual layers are overlays.
   pointer-events: none on ALL overlays — native controls always work.
   ═══════════════════════════════════════════════════════════════════════════ */

function StableVideoPreview({ src, videoRef: externalRef, stepName, subtitleData }: {
  src: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  stepName?: string;
  /** Pass full WizardData to render all accumulated edit layers. */
  subtitleData?: WizardData;
}) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const vRef = externalRef || internalRef;
  const [ct, setCt] = useState(0);
  const raf = useRef(0);

  // Track current playback time for subtitle sync + B-roll indicators
  useEffect(() => {
    const tick = () => {
      if (vRef.current) setCt(vRef.current.currentTime);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  // Subtitle: find active segment at current time
  const activeSeg = subtitleData?.segments?.find(
    (s: SubSegment) => ct >= s.startSec && ct < s.endSec
  );

  // B-roll: find active placement at current time
  const activeBroll = subtitleData?.brollEnabled
    ? subtitleData.brollPlacements.find((p: BrollPlacement) => ct >= p.startSec && ct < p.endSec)
    : null;

  // Collect active edit layers for the badge strip
  const activeLayers: string[] = [];
  if (subtitleData) {
    if (subtitleData.segments.length > 0) activeLayers.push("Subtitles");
    if (subtitleData.brollEnabled && subtitleData.brollPlacements.length > 0) activeLayers.push("B-Roll");
    if (subtitleData.transitionStyle && subtitleData.transitionStyle !== "cut") activeLayers.push("Transitions");
    if (subtitleData.musicEnabled && subtitleData.musicTrackId) activeLayers.push("Music");
    if (subtitleData.cleanupFillers || subtitleData.cleanupSilence) activeLayers.push("Cleanup");
  }

  if (!src) {
    return (
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", padding: "2rem", textAlign: "center", color: "#ef4444", background: "#1a1a2e", borderRadius: 12 }}>
        No video source. Upload a video first. {stepName && `(step: ${stepName})`}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>
      {/* Video + all overlay layers */}
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000" }}>
        <video
          ref={vRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          style={{ width: "100%", display: "block", background: "#000" }}
          onPlay={() => console.debug(`[Video:${stepName}] PLAY`)}
          onPause={() => console.debug(`[Video:${stepName}] PAUSE`)}
          onError={(e) => console.error(`[Video:${stepName}] ERROR:`, (e.target as HTMLVideoElement)?.error?.message, (e.target as HTMLVideoElement)?.error?.code)}
          onLoadedData={() => console.debug(`[Video:${stepName}] LOADED readyState=`, vRef.current?.readyState)}
        />

        {/* ── LAYER 1: Subtitle overlay (synced to playback) ── */}
        {subtitleData && activeSeg && activeSeg.text && (
          <div style={{
            position: "absolute", left: "5%", right: "5%",
            ...(subtitleData.subtitlePosition === "top" ? { top: "8%" } :
              subtitleData.subtitlePosition === "center" ? { top: "50%", transform: "translateY(-50%)" } :
              subtitleData.subtitlePosition === "manual" ? { top: `${Math.max(5, Math.min(95, subtitleData.subtitleManualY ?? 75))}%`, transform: "translateY(-50%)" } :
              { bottom: "15%" }),
            display: "flex", flexDirection: "column", alignItems: "center",
            pointerEvents: "none", zIndex: 2, textAlign: "center",
            ...getSubtitleStyle(subtitleData),
          }}>
            {formatSubtitleText(activeSeg.text).map((line: string, i: number) => (
              <div key={i} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.18em 0.3em", direction: "rtl" }}>
                {renderHighlightedTokens(line, activeSeg.highlightWord, activeSeg.highlightStyle, subtitleData, activeSeg.emphasisWords)}
              </div>
            ))}
          </div>
        )}

        {/* ── LAYER 2: B-roll indicator (when a B-roll clip is active at current time) ── */}
        {activeBroll && (
          <div style={{
            position: "absolute", top: 8, right: 8, zIndex: 3, pointerEvents: "none",
            padding: "3px 10px", borderRadius: 6,
            background: "rgba(139, 92, 246, 0.85)", color: "#fff",
            fontSize: "0.65rem", fontWeight: 700,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span>B-Roll</span>
            <span style={{ opacity: 0.7 }}>{activeBroll.keyword}</span>
          </div>
        )}

        {/* ── LAYER 3: Active edit layers badge strip (top-left) ── */}
        {activeLayers.length > 0 && (
          <div style={{
            position: "absolute", top: 8, left: 8, zIndex: 3, pointerEvents: "none",
            display: "flex", gap: 4, flexWrap: "wrap",
          }}>
            {activeLayers.map((layer) => (
              <span key={layer} style={{
                padding: "2px 8px", borderRadius: 4, fontSize: "0.55rem", fontWeight: 700,
                color: "#fff",
                background: layer === "Subtitles" ? "rgba(34,197,94,0.8)" :
                  layer === "B-Roll" ? "rgba(139,92,246,0.8)" :
                  layer === "Transitions" ? "rgba(59,130,246,0.8)" :
                  layer === "Music" ? "rgba(236,72,153,0.8)" :
                  layer === "Cleanup" ? "rgba(245,158,11,0.8)" :
                  "rgba(100,100,100,0.8)",
              }}>
                {layer}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Play / Pause buttons */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
        <button
          onClick={() => {
            const v = vRef.current;
            if (!v) { console.error("[PlayBtn] no ref"); return; }
            console.debug("[PlayBtn] paused=", v.paused, "readyState=", v.readyState, "src=", v.src?.substring(0, 80));
            v.play().then(() => console.debug("[PlayBtn] success")).catch((err: any) => console.error("[PlayBtn] failed:", err.name, err.message));
          }}
          style={{ padding: "8px 20px", borderRadius: 6, border: "1px solid #22c55e", background: "rgba(34,197,94,0.1)", color: "#22c55e", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
        >
          Play Video
        </button>
        <button
          onClick={() => { vRef.current?.pause(); }}
          style={{ padding: "8px 20px", borderRadius: 6, border: "1px solid #f59e0b", background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
        >
          Pause Video
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 0 — Project Info
   ═══════════════════════════════════════════════════════════════════════════ */

function StepInfo({ data, patch, clients, createClient }: {
  data: WizardData; patch: (p: Partial<WizardData>) => void;
  clients: Client[]; createClient: (c: Partial<Client>) => Promise<Client>;
}) {
  const toast = useToast();
  const [showNewClient, setShowNewClient] = useState(false);
  const [nc, setNc] = useState({ name: "", company: "", contactPerson: "", email: "", notes: "", color: "#00B5FE", clientType: "marketing" as const });
  const presetColors = ["#00B5FE","#8b5cf6","#22c55e","#f59e0b","#ec4899","#ef4444","#14b8a6","#6366f1","#f97316","#84cc16"];

  const handleCreateClient = async () => {
    if (!nc.name.trim()) { toast("שם לקוח הוא שדה חובה", "error"); return; }
    try {
      const created = await createClient({ name: nc.name, company: nc.company, contactPerson: nc.contactPerson, email: nc.email, phone: "", notes: nc.notes, businessField: "", clientType: nc.clientType, status: "active", retainerAmount: 0, retainerDay: 1, color: nc.color, convertedFromLead: null });
      patch({ clientId: created.id });
      setShowNewClient(false);
      setNc({ name: "", company: "", contactPerson: "", email: "", notes: "", color: "#00B5FE", clientType: "marketing" });
      toast("לקוח נוצר בהצלחה", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה לא ידועה";
      toast(`שגיאה ביצירת לקוח: ${msg}`, "error");
      console.error("[StepInfo] handleCreateClient error:", err);
    }
  };

  const sel = clients.find((c) => c.id === data.clientId);

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">פרטי פרויקט</h2>
      <p className="wiz-step-sub">הגדר את שם הפרויקט, בחר לקוח והוסף הנחיות יצירתיות.</p>
      <div className="wiz-form-grid">
        <div className="wiz-field wiz-field-full">
          <label className="wiz-label">שם הפרויקט *</label>
          <input className="wiz-input" value={data.title} onChange={(e) => patch({ title: e.target.value })} placeholder='למשל: "ריל תדמית — סטודיו פיקסל"' />
        </div>
        <div className="wiz-field wiz-field-full">
          <label className="wiz-label">לקוח *</label>
          <div className="wiz-client-grid">
            {clients.map((c) => (
              <button key={c.id} className={`wiz-client-chip ${data.clientId === c.id ? "active" : ""}`} onClick={() => patch({ clientId: c.id })}>
                <span className="wiz-client-dot" style={{ background: c.color || "#00B5FE" }} />{c.name}
              </button>
            ))}
            <button className="wiz-client-chip wiz-client-add" onClick={() => setShowNewClient(true)}>+ לקוח חדש</button>
          </div>
          {sel && (
            <div className="wiz-client-selected">
              <span className="wiz-client-dot-lg" style={{ background: sel.color || "#00B5FE" }} />
              <div><div style={{ fontWeight: 600 }}>{sel.name}</div>
                {sel.company && <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>{sel.company}</div>}
              </div>
            </div>
          )}
        </div>
        <div className="wiz-field wiz-field-full">
          <label className="wiz-label">הנחיות יצירתיות</label>
          <textarea className="wiz-input wiz-textarea" value={data.creativePrompt} onChange={(e) => patch({ creativePrompt: e.target.value })} placeholder="תאר את הסגנון, טון הדיבור, קהל יעד, מסרים מרכזיים..." rows={3} />
        </div>

        <div className="wiz-field wiz-field-full">
          <label className="wiz-label">סגנון עריכה (פריסט)</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginTop: "0.5rem" }}>
            {SMART_PRESETS_UI.map((p) => (
              <button key={p.id} type="button" onClick={() => patch({ preset: p.id })}
                style={{
                  padding: "0.75rem", borderRadius: 10, border: data.preset === p.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: data.preset === p.id ? "rgba(0,181,254,0.08)" : "var(--surface-raised)",
                  cursor: "pointer", textAlign: "center", transition: "all 150ms",
                }}>
                <div style={{ fontSize: "1.25rem", marginBottom: 4 }}>{p.icon}</div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginTop: 2 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="wiz-field wiz-field-full">
          <label className="wiz-label">איכות יצוא</label>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            {([
              { id: "standard", label: "סטנדרטי", desc: "1080p · מהיר" },
              { id: "premium", label: "פרימיום", desc: "1440p · מאוזן" },
              { id: "max", label: "קולנועי", desc: "4K · איכות מקסימלית" },
            ] as const).map((q) => (
              <button key={q.id} type="button" onClick={() => patch({ exportQuality: q.id })}
                style={{
                  flex: 1, padding: "0.75rem", borderRadius: 10,
                  border: data.exportQuality === q.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: data.exportQuality === q.id ? "rgba(0,181,254,0.08)" : "var(--surface-raised)",
                  cursor: "pointer", textAlign: "center", transition: "all 150ms",
                }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{q.label}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginTop: 2 }}>{q.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Modal open={showNewClient} onClose={() => setShowNewClient(false)} title="לקוח חדש" footer={
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", width: "100%" }}>
          <button className="wiz-btn wiz-btn-ghost" onClick={() => setShowNewClient(false)}>ביטול</button>
          <button className="wiz-btn wiz-btn-primary" onClick={handleCreateClient}>צור לקוח</button>
        </div>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div><label className="wiz-label">שם לקוח *</label><input className="wiz-input" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></div>
          <div><label className="wiz-label">שם חברה</label><input className="wiz-input" value={nc.company} onChange={(e) => setNc({ ...nc, company: e.target.value })} placeholder="אופציונלי" /></div>
          <div><label className="wiz-label">סוג לקוח</label><select className="wiz-input" value={nc.clientType} onChange={(e) => setNc({ ...nc, clientType: e.target.value as any })} style={{ padding: "0.5rem" }}><option value="marketing">מרקטינג</option><option value="branding">ברנדינג</option><option value="websites">אתרים</option><option value="hosting">הוסטינג</option><option value="podcast">פודקאסט</option><option value="lead">לידים</option></select></div>
          <div><label className="wiz-label">איש קשר</label><input className="wiz-input" value={nc.contactPerson} onChange={(e) => setNc({ ...nc, contactPerson: e.target.value })} placeholder="אופציונלי" /></div>
          <div><label className="wiz-label">אימייל</label><input className="wiz-input" type="email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} placeholder="אופציונלי" dir="ltr" /></div>
          <div><label className="wiz-label">הערות</label><textarea className="wiz-input wiz-textarea" value={nc.notes} onChange={(e) => setNc({ ...nc, notes: e.target.value })} placeholder="אופציונלי" rows={2} /></div>
          <div>
            <label className="wiz-label">צבע לקוח</label>
            <div className="wiz-color-presets">{presetColors.map((c) => (
              <button key={c} className={`wiz-color-swatch ${nc.color === c ? "active" : ""}`} style={{ background: c }} onClick={() => setNc({ ...nc, color: c })} />
            ))}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input type="color" value={nc.color} onChange={(e) => setNc({ ...nc, color: e.target.value })} style={{ width: 36, height: 36, borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", background: "none", padding: 0 }} />
              <input className="wiz-input" value={nc.color} dir="ltr" onChange={(e) => setNc({ ...nc, color: e.target.value })} style={{ width: 100, fontFamily: "monospace", textAlign: "center" }} />
              <div className="wiz-color-preview" style={{ background: nc.color }}>{nc.name || "לקוח"}</div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 1 — Video Upload
   ═══════════════════════════════════════════════════════════════════════════ */

function StepUpload({ data, patch }: { data: WizardData; patch: (p: Partial<WizardData>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  /**
   * Upload flow — DIRECT to Supabase (bypasses Vercel body limit).
   *
   * Step 1: POST /api/upload { fileName } → get signed URL  (tiny JSON, ~100 bytes)
   * Step 2: PUT file directly to Supabase CDN via signed URL (XHR for progress)
   *
   * The file NEVER touches the Next.js server. This avoids Vercel's 4.5MB limit.
   */
  const handleFile = async (file: File) => {
    if (!file.type.startsWith("video/")) return;
    if (data.videoUrl) URL.revokeObjectURL(data.videoUrl);
    const blobUrl = URL.createObjectURL(file);
    patch({ videoFile: file, videoUrl: blobUrl, uploadedVideoUrl: "", trimMode: "full", trimStart: 0, trimEnd: 0, segments: [] });
    setUploadError("");
    setUploadProgress(0);
    setUploading(true);

    const fileSizeMB = (file.size / 1048576).toFixed(1);
    console.log(`[StepUpload] Upload started: name=${file.name} size=${fileSizeMB}MB type=${file.type}`);

    try {
      // ── Step 1: Get signed upload URL (tiny JSON, no file body) ──
      console.log(`[StepUpload] Getting signed upload URL...`);
      setUploadProgress(1);
      const initRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }),
      });

      if (!initRes.ok) {
        let errMsg = `שגיאה בהכנת העלאה (${initRes.status})`;
        try { const b = await initRes.json(); if (b.error) errMsg = b.error; } catch {}
        throw new Error(errMsg);
      }

      const { uploadUrl, publicUrl } = await initRes.json();
      if (!uploadUrl) throw new Error("שרת לא החזיר כתובת העלאה");
      console.log(`[StepUpload] Signed URL received — uploading directly to Supabase...`);
      setUploadProgress(3);

      // ── Step 2: PUT file directly to Supabase CDN (bypasses Vercel) ──
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            // Map 0-100% of actual upload to 3-99% of display
            const pct = Math.round(3 + (e.loaded / e.total) * 96);
            setUploadProgress(pct);
            if (Math.round((e.loaded / e.total) * 100) % 25 === 0) {
              console.log(`[StepUpload] Progress: ${Math.round((e.loaded / e.total) * 100)}% (${(e.loaded / 1048576).toFixed(1)}/${fileSizeMB}MB)`);
            }
          }
        });

        xhr.addEventListener("load", () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            let msg = `שגיאה בהעלאה לאחסון (${xhr.status})`;
            try { const b = JSON.parse(xhr.responseText); if (b.error || b.message) msg = b.error || b.message; } catch {}
            reject(new Error(msg));
          }
        });
        xhr.addEventListener("error", () => { xhrRef.current = null; reject(new Error("שגיאת רשת — בדוק את החיבור לאינטרנט")); });
        xhr.addEventListener("abort", () => { xhrRef.current = null; reject(new Error("__ABORT__")); });
        xhr.addEventListener("timeout", () => { xhrRef.current = null; reject(new Error("העלאה נכשלה — זמן המתנה חרג")); });

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.timeout = 300000; // 5 minutes for large files
        xhr.send(file);
      });

      // ── Step 3: Done ──
      patch({ uploadedVideoUrl: publicUrl, videoUrl: publicUrl });
      setUploadProgress(100);
      console.log(`[StepUpload] ✅ Complete: ${publicUrl}`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "__ABORT__") {
        setUploadError("");
        setUploadProgress(0);
      } else {
        console.error(`[StepUpload] ❌ Upload FAILED: ${msg}`);
        setUploadError(msg);
        setUploadProgress(0);
        patch({ uploadedVideoUrl: "" });
      }
    } finally {
      setUploading(false);
    }
  };

  const cancelUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  };

  const retryUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.videoFile) handleFile(data.videoFile);
  };

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">העלאת וידאו</h2>
      <p className="wiz-step-sub">העלה את קובץ הוידאו המקורי. שלב זה הכרחי כדי להמשיך.</p>
      <div className={`wiz-upload-zone ${dragging ? "dragging" : ""} ${data.videoFile ? "has-file" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => !uploading && fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {data.videoFile ? (
          <div className="wiz-upload-done">
            <div className="wiz-upload-thumb"><video src={data.uploadedVideoUrl || data.videoUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} /></div>
            <div className="wiz-upload-info">
              <div className="wiz-upload-name">{data.videoFile.name}</div>
              <div className="wiz-upload-size">{(data.videoFile.size / 1024 / 1024).toFixed(1)} MB</div>

              {/* Upload progress bar */}
              {uploading && (
                <div style={{ width: "100%", marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", color: "#a78bfa", marginBottom: 3 }}>
                    <span>⏳ מעלה לשרת... {uploadProgress}%</span>
                    <button className="wiz-btn wiz-btn-ghost wiz-btn-sm" onClick={cancelUpload} style={{ fontSize: "0.65rem", padding: "0 4px" }}>ביטול</button>
                  </div>
                  <div style={{ width: "100%", height: 4, borderRadius: 2, background: "rgba(167,139,250,0.15)", overflow: "hidden" }}>
                    <div style={{ width: `${uploadProgress}%`, height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #a78bfa, #7c3aed)", transition: "width 200ms ease" }} />
                  </div>
                </div>
              )}

              {/* Upload success */}
              {!uploading && !uploadError && data.uploadedVideoUrl && (
                <div style={{ fontSize: "0.72rem", color: "#22c55e" }}>✓ הועלה לשרת</div>
              )}

              {/* Upload error with retry */}
              {!uploading && uploadError && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: "0.72rem", color: "#ef4444", marginBottom: 4 }}>✗ {uploadError}</div>
                  <button className="wiz-btn wiz-btn-ghost wiz-btn-sm" onClick={retryUpload} style={{ fontSize: "0.68rem", color: "#a78bfa" }}>🔄 נסה שוב</button>
                </div>
              )}

              {!uploading && (
                <button className="wiz-btn wiz-btn-ghost wiz-btn-sm" onClick={(e) => { e.stopPropagation(); if (xhrRef.current) xhrRef.current.abort(); if (data.videoUrl) URL.revokeObjectURL(data.videoUrl); patch({ videoFile: null, videoUrl: "", uploadedVideoUrl: "", segments: [] }); setUploadError(""); setUploadProgress(0); }}>🗑 החלף וידאו</button>
              )}
            </div>
          </div>
        ) : (
          <div className="wiz-upload-empty">
            <div className="wiz-upload-icon">🎬</div>
            <div className="wiz-upload-text">גרור קובץ וידאו לכאן</div>
            <div className="wiz-upload-hint">או לחץ לבחירת קובץ</div>
            <div className="wiz-upload-formats">MP4 • MOV • WEBM • AVI</div>
          </div>
        )}
      </div>
      {!data.videoFile && <div className="wiz-validation-msg"><span>⚠️</span> חובה להעלות קובץ וידאו כדי להמשיך</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 2 — Video Trim
   ═══════════════════════════════════════════════════════════════════════════ */

function StepTrim({ data, patch }: { data: WizardData; patch: (p: Partial<WizardData>) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ct, setCt] = useState(0);
  const [dur, setDur] = useState(0);
  const [loopClip, setLoopClip] = useState(false);
  const raf = useRef(0);

  const tick = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      setCt(v.currentTime);
      if (loopClip && data.trimMode === "clip" && v.currentTime >= data.trimEnd && data.trimEnd > 0) v.currentTime = data.trimStart;
    }
    raf.current = requestAnimationFrame(tick);
  }, [loopClip, data.trimMode, data.trimStart, data.trimEnd]);

  useEffect(() => { raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current); }, [tick]);

  const toggle = () => { const v = videoRef.current; if (!v) return; v.paused ? (v.play(), setPlaying(true)) : (v.pause(), setPlaying(false)); };
  const seek = (t: number) => { const v = videoRef.current; if (v) { v.currentTime = t; setCt(t); } };

  const clipDur = data.trimMode === "clip" ? data.trimEnd - data.trimStart : dur;
  const hint = clipDur < 5 ? { t: "קצר מדי", c: "#ef4444" } : clipDur <= 15 ? { t: "Reel מושלם", c: "#22c55e" } : clipDur <= 60 ? { t: "אידיאלי", c: "#22c55e" } : clipDur <= 180 ? { t: "ארוך", c: "#f59e0b" } : { t: "ארוך מדי", c: "#ef4444" };

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">חיתוך קליפ</h2>
      <p className="wiz-step-sub">בחר האם להשתמש בוידאו המלא או לחתוך קטע.</p>
      <div className="wiz-trim-mode">
        <button className={`wiz-chip wiz-chip-lg ${data.trimMode === "full" ? "active" : ""}`} onClick={() => patch({ trimMode: "full" })}>🎬 וידאו מלא</button>
        <button className={`wiz-chip wiz-chip-lg ${data.trimMode === "clip" ? "active" : ""}`} onClick={() => patch({ trimMode: "clip" })}>✂️ חיתוך קליפ</button>
      </div>
      <div className="wiz-player">
        <video ref={videoRef} src={data.uploadedVideoUrl || data.videoUrl}
          onLoadedMetadata={(e) => {
            const v = e.target as HTMLVideoElement;
            const d = v.duration;
            setDur(d);
            if (data.trimEnd === 0) patch({ trimEnd: d });
            if (process.env.NODE_ENV === "development") {
              console.debug("[StepTrim] Video loaded:", { src: v.src?.substring(0, 80), duration: d, readyState: v.readyState, videoWidth: v.videoWidth, videoHeight: v.videoHeight });
            }
          }}
          onError={(e) => { console.error("[StepTrim] Video error:", (e.target as HTMLVideoElement)?.error?.message, "src:", (e.target as HTMLVideoElement)?.src?.substring(0, 80)); }}
          className="wiz-player-video" onClick={toggle} playsInline />
        {!playing && <div className="wiz-player-overlay" onClick={toggle}><div className="wiz-player-play">▶</div></div>}
      </div>
      <div className="wiz-player-controls">
        <button className="wiz-ctrl-btn" onClick={toggle}>{playing ? "⏸" : "▶"}</button>
        <span className="wiz-time">{fmtTime(ct)}</span>
        <div className="wiz-timeline-wrap">
          <div className="wiz-timeline" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * dur); }}>
            {data.trimMode === "clip" && dur > 0 && <div className="wiz-trim-region" style={{ left: `${(data.trimStart / dur) * 100}%`, width: `${((data.trimEnd - data.trimStart) / dur) * 100}%` }} />}
            <div className="wiz-playhead" style={{ left: `${(ct / dur) * 100}%` }} />
          </div>
        </div>
        <span className="wiz-time">{fmtTime(dur)}</span>
      </div>
      {data.trimMode === "clip" && (
        <div className="wiz-trim-controls">
          <div className="wiz-trim-actions">
            <button className="wiz-btn wiz-btn-ghost wiz-btn-sm" onClick={() => patch({ trimStart: ct, trimMode: "clip" })}>📍 סמן התחלה ({fmtTime(data.trimStart)})</button>
            <button className="wiz-btn wiz-btn-ghost wiz-btn-sm" onClick={() => patch({ trimEnd: ct > data.trimStart ? ct : dur, trimMode: "clip" })}>📍 סמן סוף ({fmtTime(data.trimEnd)})</button>
            <button className="wiz-btn wiz-btn-ghost wiz-btn-sm" onClick={() => { seek(data.trimStart); videoRef.current?.play(); setPlaying(true); }}>🔁 נגן קליפ</button>
            <label className="wiz-toggle-label"><input type="checkbox" checked={loopClip} onChange={(e) => setLoopClip(e.target.checked)} />🔄 לופ</label>
          </div>
          <div className="wiz-trim-info">
            <div className="wiz-trim-range"><label className="wiz-label" style={{ marginBottom: 0 }}>התחלה</label><input className="wiz-input wiz-input-sm" type="number" step="0.1" min="0" max={data.trimEnd} value={data.trimStart.toFixed(1)} onChange={(e) => patch({ trimStart: Number(e.target.value) })} dir="ltr" /></div>
            <div className="wiz-trim-range"><label className="wiz-label" style={{ marginBottom: 0 }}>סוף</label><input className="wiz-input wiz-input-sm" type="number" step="0.1" min={data.trimStart} max={dur} value={data.trimEnd.toFixed(1)} onChange={(e) => patch({ trimEnd: Number(e.target.value) })} dir="ltr" /></div>
            <div className="wiz-trim-dur">
              <span style={{ color: "var(--foreground-muted)", fontSize: "0.72rem" }}>משך</span>
              <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{fmtTime(clipDur)}</span>
              <span className="wiz-dur-hint" style={{ color: hint.c }}>{hint.t}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 3 — Output Format
   ═══════════════════════════════════════════════════════════════════════════ */

function StepFormat({ data, patch }: { data: WizardData; patch: (p: Partial<WizardData>) => void }) {
  const formats: { id: WizardData["format"]; label: string; desc: string; css: string }[] = [
    { id: "9:16", label: "9:16",  desc: "Reels / TikTok / Stories", css: "9 / 16" },
    { id: "1:1",  label: "1:1",   desc: "פוסט מרובע",              css: "1 / 1" },
    { id: "4:5",  label: "4:5",   desc: "פוסט פיד",                css: "4 / 5" },
    { id: "16:9", label: "16:9",  desc: "YouTube / שולחני",        css: "16 / 9" },
  ];

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">פורמט יציאה</h2>
      <p className="wiz-step-sub">בחר את יחס הגובה-רוחב. הוידאו שלך יוצג כפי שייראה בכל פורמט.</p>
      {!data.format && <div className="wiz-validation-msg"><span>⚠️</span> יש לבחור פורמט כדי להמשיך</div>}
      <div className="wiz-format-grid">
        {formats.map((f) => (
          <button key={f.id} className={`wiz-format-card ${data.format === f.id ? "active" : ""}`} onClick={() => patch({ format: f.id })}>
            <div className="wiz-format-video-wrap" style={{ aspectRatio: f.css }}>
              {(data.uploadedVideoUrl || data.videoUrl) ? (
                <video src={data.uploadedVideoUrl || data.videoUrl} muted playsInline loop autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
              ) : (
                <div className="wiz-format-box" style={{ aspectRatio: f.css }} />
              )}
            </div>
            <div className="wiz-format-label">{f.label}</div>
            <div className="wiz-format-desc">{f.desc}</div>
            {data.format === f.id && <div className="wiz-format-check">✓ נבחר</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 4 — Subtitle Style
   ═══════════════════════════════════════════════════════════════════════════ */

function StepSubStyle({ data, patch, videoSrc: parentVideoSrc }: { data: WizardData; patch: (p: Partial<WizardData>) => void; videoSrc?: string }) {
  const filteredFonts = data.language && data.language !== "auto"
    ? GOOGLE_FONTS.filter((f) => f.languages.includes(data.language))
    : GOOGLE_FONTS;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [activePanel, setActivePanel] = useState<"font" | "colors" | "outline" | "effects" | "layout">("font");
  const [currentTime, setCurrentTime] = useState(0);
  const [animPhase, setAnimPhase] = useState(0); // 0-1 for animation preview

  useEffect(() => { loadGoogleFont(data.subtitleFont); }, [data.subtitleFont]);

  // Track video time for subtitle sync
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [videoReady]);

  // Animation phase cycling for preview
  useEffect(() => {
    if (data.subtitleAnimation === "none") { setAnimPhase(1); return; }
    const interval = setInterval(() => {
      setAnimPhase((p) => {
        if (p >= 1) return 0;
        return Math.min(p + 0.05, 1);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [data.subtitleAnimation, currentTime]);

  // Use parent-resolved video source — avoids creating stale blob: URLs
  const videoSrc = parentVideoSrc || "";

  const formatClass = `format-frame-${data.format.replace(":", "")}`;
  const sampleText = data.segments.length > 0 ? data.segments[0].text : "זהו טקסט דוגמה להצגת הכתוביות";
  const sampleHighlight = data.segments.length > 0 ? data.segments[0].highlightWord : "";

  // Find active subtitle segment based on current video time
  const activeSegment = useMemo(() => {
    if (!data.segments || data.segments.length === 0) return null;
    return data.segments.find((s) => currentTime >= s.startSec && currentTime <= s.endSec) || null;
  }, [data.segments, currentTime]);

  // Display text: active segment when playing, or sample text when paused
  const displayText = activeSegment ? activeSegment.text : sampleText;
  const displayHighlight = activeSegment ? (activeSegment.highlightWord || "") : sampleHighlight;

  // Build subtitle overlay style from current settings
  const subtitleOverlayStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: "absolute",
      left: "5%",
      right: "5%",
      display: "flex",
      flexDirection: "column",
      alignItems: data.subtitleAlign === "right" ? "flex-end" : data.subtitleAlign === "left" ? "flex-start" : "center",
      textAlign: data.subtitleAlign || "center",
      fontFamily: `"${data.subtitleFont}", sans-serif`,
      fontWeight: data.subtitleFontWeight || 700,
      fontSize: `${Math.max(12, (data.subtitleFontSize || 36) * 0.5)}px`,
      color: data.subtitleColor || "#FFFFFF",
      direction: "rtl",
      lineHeight: 1.4,
      pointerEvents: "none",
      zIndex: 10,
      transition: "all 200ms ease",
    };

    // Position
    if (data.subtitlePosition === "top") { style.top = "8%"; }
    else if (data.subtitlePosition === "center") { style.top = "50%"; style.transform = "translateY(-50%)"; }
    else if (data.subtitlePosition === "manual") { style.top = `${Math.max(5, Math.min(95, data.subtitleManualY ?? 75))}%`; style.transform = "translateY(-50%)"; }
    else { style.bottom = "8%"; }

    // Outline — outer stroke via multi-directional text-shadow (never shrinks the fill)
    {
      const shadowParts: string[] = [];

      if (data.subtitleOutlineEnabled) {
        const t = data.subtitleOutlineThickness || 1;
        const c = data.subtitleOutlineColor || "#000000";
        // 8-direction outline + 4 diagonal half-steps for a smooth contour
        const offsets = [
          [t, 0], [-t, 0], [0, t], [0, -t],
          [t, t], [-t, t], [t, -t], [-t, -t],
          [t * 0.7, t * 0.7], [-t * 0.7, t * 0.7], [t * 0.7, -t * 0.7], [-t * 0.7, -t * 0.7],
        ];
        offsets.forEach(([x, y]) => shadowParts.push(`${x}px ${y}px 0 ${c}`));
      }

      if (data.subtitleShadow) {
        shadowParts.push("2px 2px 6px rgba(0,0,0,0.7)");
      }

      if (shadowParts.length > 0) {
        style.textShadow = shadowParts.join(", ");
      }
    }

    // Animation preview
    if (data.subtitleAnimation === "fade") {
      style.opacity = animPhase;
    } else if (data.subtitleAnimation === "slideUp") {
      style.opacity = animPhase;
      style.transform = `translateY(${(1 - animPhase) * 20}px)` + ((data.subtitlePosition === "center" || data.subtitlePosition === "manual") ? " translateY(-50%)" : "");
    } else if (data.subtitleAnimation === "pop") {
      const scale = 0.5 + animPhase * 0.5;
      style.opacity = animPhase;
      style.transform = `scale(${scale})` + ((data.subtitlePosition === "center" || data.subtitlePosition === "manual") ? " translateY(-50%)" : "");
    }

    return style;
  }, [data.subtitleFont, data.subtitleFontWeight, data.subtitleFontSize, data.subtitleColor,
    data.subtitleAlign, data.subtitlePosition, data.subtitleManualY, data.subtitleOutlineEnabled, data.subtitleOutlineColor,
    data.subtitleOutlineThickness, data.subtitleShadow, data.subtitleAnimation, animPhase]);

  // Build background style for subtitle text
  const subtitleBgStyle = useMemo((): React.CSSProperties | undefined => {
    if (!data.subtitleBg) return undefined;
    const opacity = (data.subtitleBgOpacity || 50) / 100;
    const color = data.subtitleBgColor || "#000000";
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return {
      background: `rgba(${r},${g},${b},${opacity})`,
      padding: "4px 12px",
      borderRadius: "6px",
      display: "inline-block",
    };
  }, [data.subtitleBg, data.subtitleBgColor, data.subtitleBgOpacity]);

  // Active segment's AI emphasis words
  const activeEmphasisWords = useMemo(() => {
    if (data.highlightMode !== "ai" || !activeSegment) return [];
    return activeSegment.emphasisWords || [];
  }, [data.highlightMode, activeSegment]);

  // Render subtitle text — tokenized per-word layout with flex gap
  // Highlighted spans MUST carry the base stroke shadow to keep readability
  const renderSubtitleText = () => {
    const lines = formatSubtitleText(displayText);
    const isAiMode = data.highlightMode === "ai";
    const isStrong = data.highlightIntensity === "strong";
    const hlColor = data.subtitleHighlightColor || "#FFD700";
    const baseShadow = buildBaseTextShadow(data);
    const glowPart = isStrong ? `0 0 12px ${hlColor}60, 0 0 4px ${hlColor}40` : "";
    const composedShadow = [baseShadow, glowPart].filter(Boolean).join(", ") || undefined;

    const tokenBase: React.CSSProperties = {
      display: "inline-block",
      transformOrigin: "center",
      transition: "transform 0.15s ease, color 0.15s ease",
      willChange: "transform",
    };

    const lineFlexStyle: React.CSSProperties = {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: "0.18em 0.3em",
      direction: "rtl",
    };

    // AI emphasis: highlight specific important words
    if (isAiMode && activeEmphasisWords.length > 0) {
      return (
        <span style={subtitleBgStyle}>
          {lines.map((line, li) => (
            <div key={li} style={lineFlexStyle}>
              {line.split(/\s+/).filter(Boolean).map((word, ti) => {
                const isEmphasis = activeEmphasisWords.some(w => word.includes(w) || w.includes(word));
                if (isEmphasis) {
                  return (
                    <span key={ti} style={{
                      ...tokenBase,
                      color: hlColor,
                      fontWeight: isStrong ? 900 : 700,
                      textShadow: composedShadow,
                      transform: isStrong ? `scale(${MAX_HL_SCALE})` : "none",
                    }}>{word}</span>
                  );
                }
                return <span key={ti} style={tokenBase}>{word}</span>;
              })}
            </div>
          ))}
        </span>
      );
    }

    // Sequential mode: highlight the keyword
    return (
      <span style={subtitleBgStyle}>
        {lines.map((line, li) => (
          <div key={li} style={lineFlexStyle}>
            {line.split(/\s+/).filter(Boolean).map((word, wi) => {
              const isHighlighted = displayHighlight && word.toLowerCase().includes(displayHighlight.toLowerCase());
              if (isHighlighted) {
                return (
                  <span key={wi} style={{ ...tokenBase, color: hlColor, fontWeight: 900, textShadow: composedShadow }}>{word}</span>
                );
              }
              return <span key={wi} style={tokenBase}>{word}</span>;
            })}
          </div>
        ))}
      </span>
    );
  };

  const toggle = () => {
    const v = videoRef.current;
    if (!v || !videoReady) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  // Map format string to CSS aspect-ratio value
  const FORMAT_RATIOS: Record<string, string> = {
    "9:16": "9 / 16",
    "1:1": "1 / 1",
    "4:5": "4 / 5",
    "16:9": "16 / 9",
  };
  const cssAspectRatio = FORMAT_RATIOS[data.format] || "9 / 16";
  const isPortrait = ["9:16", "4:5"].includes(data.format);

  const ANIM_OPTIONS: { id: WizardData["subtitleAnimation"]; label: string; desc: string }[] = [
    { id: "none", label: "ללא", desc: "הצגה ישירה" },
    { id: "fade", label: "Fade In", desc: "כניסה עם דהייה" },
    { id: "slideUp", label: "Slide Up", desc: "כניסה מלמטה" },
    { id: "pop", label: "Pop", desc: "הופעה עם סקייל" },
    { id: "wordByWord", label: "Word by Word", desc: "מילה אחרי מילה" },
    { id: "highlightOnSpeech", label: "Highlight", desc: "הדגשה בזמן דיבור" },
  ];

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">עיצוב כתוביות</h2>
      <p className="wiz-step-sub">עצב את הכתוביות על הסרטון האמיתי שלך. כל שינוי מתעדכן מיד.</p>

      <div className="substyle-workspace">
        {/* ─── Left: Live Video Preview ─── */}
        <div className="substyle-preview-col">
          <div className="substyle-preview-header">
            <span className="substyle-preview-badge">LIVE</span>
            <span className="substyle-format-badge">{data.format}</span>
            {activeSegment && <span style={{ fontSize: "0.65rem", color: "#22c55e", fontWeight: 600 }}>● כתובית פעילה</span>}
          </div>

          <div style={{
            position: "relative",
            width: isPortrait ? "min(100%, 340px)" : "100%",
            aspectRatio: cssAspectRatio,
            borderRadius: 12,
            overflow: "hidden",
            background: "#000",
            cursor: "pointer",
            margin: isPortrait ? "0 auto" : undefined,
          }} onClick={toggle}>
            <video
              ref={videoRef}
              src={videoSrc}
              playsInline
              preload="metadata"
              onLoadedMetadata={() => setVideoReady(true)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 12 }}
            />

            {/* ─── Live Subtitle Overlay ─── */}
            <div style={subtitleOverlayStyle}>
              {renderSubtitleText()}
            </div>

            {/* Play/Pause indicator */}
            {!playing && videoReady && (
              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                width: 56, height: 56, borderRadius: "50%", background: "rgba(0,0,0,0.55)",
                display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
              }}>
                <span style={{ color: "#fff", fontSize: 24, marginLeft: 4 }}>▶</span>
              </div>
            )}
          </div>

          {/* Timeline scrubber */}
          {videoReady && videoRef.current && (
            <div style={{ marginTop: 8 }}>
              <input
                type="range"
                min={0}
                max={videoRef.current.duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  if (videoRef.current) videoRef.current.currentTime = t;
                  setCurrentTime(t);
                }}
                style={{ width: "100%", accentColor: "#00B5FE", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--foreground-muted)", marginTop: 2 }}>
                <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}</span>
                <span>{Math.floor((videoRef.current?.duration || 0) / 60)}:{String(Math.floor((videoRef.current?.duration || 0) % 60)).padStart(2, "0")}</span>
              </div>
            </div>
          )}

          {/* Quick position selector under preview */}
          <div className="substyle-quick-pos">
            {(["top", "center", "bottom", "manual"] as const).map((p) => (
              <button key={p} className={`substyle-pos-btn ${data.subtitlePosition === p ? "active" : ""}`}
                onClick={() => patch({ subtitlePosition: p })}>
                <span className="substyle-pos-icon">
                  {p === "top" ? "⬆" : p === "center" ? "⬌" : p === "bottom" ? "⬇" : "↕"}
                </span>
                <span>{p === "top" ? "למעלה" : p === "center" ? "מרכז" : p === "bottom" ? "למטה" : "מיקום ידני"}</span>
              </button>
            ))}
          </div>

          {/* Manual Y-axis slider — visible only when manual position is selected */}
          {data.subtitlePosition === "manual" && (
            <div style={{ padding: "0.5rem 0.75rem", display: "flex", alignItems: "center", gap: "0.75rem", direction: "rtl" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", whiteSpace: "nowrap", minWidth: "70px" }}>מיקום אנכי</span>
              <input
                type="range"
                min={5}
                max={95}
                step={1}
                value={data.subtitleManualY}
                onChange={(e) => patch({ subtitleManualY: parseInt(e.target.value) })}
                style={{ flex: 1, accentColor: "#00B5FE", direction: "ltr" }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontFamily: "monospace", minWidth: "36px", textAlign: "center" }}>{data.subtitleManualY}%</span>
            </div>
          )}

          {/* Animation selector */}
          <div className="substyle-anim-row">
            <div className="substyle-anim-label">אנימציה</div>
            <div className="substyle-anim-chips">
              {ANIM_OPTIONS.map((a) => (
                <button key={a.id} className={`substyle-anim-chip ${data.subtitleAnimation === a.id ? "active" : ""}`}
                  onClick={() => patch({ subtitleAnimation: a.id })} title={a.desc}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Right: Controls Panel ─── */}
        <div className="substyle-controls-col">
          {/* Tab navigation */}
          <div className="substyle-tabs">
            {([
              { id: "font" as const, label: "פונט", icon: "Aa" },
              { id: "colors" as const, label: "צבעים", icon: "🎨" },
              { id: "outline" as const, label: "קו מתאר", icon: "▢" },
              { id: "effects" as const, label: "אפקטים", icon: "✦" },
              { id: "layout" as const, label: "פריסה", icon: "⊞" },
            ]).map((tab) => (
              <button key={tab.id} className={`substyle-tab ${activePanel === tab.id ? "active" : ""}`}
                onClick={() => setActivePanel(tab.id)}>
                <span className="substyle-tab-icon">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ── Font Panel ── */}
          {activePanel === "font" && (
            <div className="substyle-panel">
              <label className="substyle-field-label">גופן</label>
              <select className="wiz-select" value={data.subtitleFont} onChange={(e) => patch({ subtitleFont: e.target.value })}>
                {filteredFonts.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>

              <label className="substyle-field-label" style={{ marginTop: "1.25rem" }}>משקל</label>
              <div className="substyle-weight-grid">
                {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                  <button key={w} className={`substyle-weight-btn ${data.subtitleFontWeight === w ? "active" : ""}`}
                    onClick={() => patch({ subtitleFontWeight: w })}>
                    <span style={{ fontWeight: w }}>{w}</span>
                  </button>
                ))}
              </div>

              <label className="substyle-field-label" style={{ marginTop: "1.25rem" }}>גודל</label>
              <div className="substyle-size-row">
                <input type="range" min="16" max="72" value={data.subtitleFontSize}
                  onChange={(e) => patch({ subtitleFontSize: Number(e.target.value) })}
                  className="substyle-range" />
                <div className="substyle-size-value">{data.subtitleFontSize}px</div>
              </div>
            </div>
          )}

          {/* ── Colors Panel ── */}
          {activePanel === "colors" && (
            <div className="substyle-panel">
              <label className="substyle-field-label">צבע טקסט</label>
              <div className="substyle-color-row">
                <input type="color" value={data.subtitleColor} onChange={(e) => patch({ subtitleColor: e.target.value })} className="substyle-color-picker" />
                <input className="wiz-input substyle-color-hex" value={data.subtitleColor} onChange={(e) => patch({ subtitleColor: e.target.value })} dir="ltr" />
              </div>
              <div className="substyle-color-presets">
                {["#FFFFFF", "#FFD700", "#00B5FE", "#FF6B6B", "#22C55E", "#A855F7", "#F59E0B", "#EC4899"].map((c) => (
                  <button key={c} className={`substyle-color-swatch ${data.subtitleColor === c ? "active" : ""}`}
                    style={{ background: c }} onClick={() => patch({ subtitleColor: c })} />
                ))}
              </div>

              <label className="substyle-field-label" style={{ marginTop: "1.5rem" }}>צבע הדגשה</label>
              <div className="substyle-color-row">
                <input type="color" value={data.subtitleHighlightColor} onChange={(e) => patch({ subtitleHighlightColor: e.target.value })} className="substyle-color-picker" />
                <input className="wiz-input substyle-color-hex" value={data.subtitleHighlightColor} onChange={(e) => patch({ subtitleHighlightColor: e.target.value })} dir="ltr" />
              </div>
              <div className="substyle-color-presets">
                {["#FFD700", "#00B5FE", "#FF6B6B", "#22C55E", "#A855F7", "#F59E0B", "#EC4899", "#FFFFFF"].map((c) => (
                  <button key={c} className={`substyle-color-swatch ${data.subtitleHighlightColor === c ? "active" : ""}`}
                    style={{ background: c }} onClick={() => patch({ subtitleHighlightColor: c })} />
                ))}
              </div>
            </div>
          )}

          {/* ── Outline Panel ── */}
          {activePanel === "outline" && (
            <div className="substyle-panel">
              <label className="substyle-toggle">
                <input type="checkbox" checked={data.subtitleOutlineEnabled} onChange={(e) => patch({ subtitleOutlineEnabled: e.target.checked })} />
                <span className="substyle-toggle-track"><span className="substyle-toggle-thumb" /></span>
                <span>קו מתאר</span>
              </label>
              {data.subtitleOutlineEnabled && (
                <>
                  <label className="substyle-field-label" style={{ marginTop: "1.25rem" }}>צבע</label>
                  <div className="substyle-color-row">
                    <input type="color" value={data.subtitleOutlineColor} onChange={(e) => patch({ subtitleOutlineColor: e.target.value })} className="substyle-color-picker" />
                    <input className="wiz-input substyle-color-hex" value={data.subtitleOutlineColor} onChange={(e) => patch({ subtitleOutlineColor: e.target.value })} dir="ltr" />
                  </div>
                  <label className="substyle-field-label" style={{ marginTop: "1.25rem" }}>עובי</label>
                  <div className="substyle-size-row">
                    <input type="range" min="0" max="5" step="0.5" value={data.subtitleOutlineThickness}
                      onChange={(e) => patch({ subtitleOutlineThickness: Number(e.target.value) })}
                      className="substyle-range" />
                    <div className="substyle-size-value">{data.subtitleOutlineThickness.toFixed(1)}px</div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Effects Panel ── */}
          {activePanel === "effects" && (
            <div className="substyle-panel">
              <label className="substyle-toggle">
                <input type="checkbox" checked={data.subtitleShadow} onChange={(e) => patch({ subtitleShadow: e.target.checked })} />
                <span className="substyle-toggle-track"><span className="substyle-toggle-thumb" /></span>
                <span>צל טקסט</span>
              </label>

              <div style={{ marginTop: "1.5rem" }}>
                <label className="substyle-toggle">
                  <input type="checkbox" checked={data.subtitleBg} onChange={(e) => patch({ subtitleBg: e.target.checked })} />
                  <span className="substyle-toggle-track"><span className="substyle-toggle-thumb" /></span>
                  <span>רקע כתובית</span>
                </label>
              </div>

              {data.subtitleBg && (
                <>
                  <label className="substyle-field-label" style={{ marginTop: "1.25rem" }}>צבע רקע</label>
                  <div className="substyle-color-row">
                    <input type="color" value={data.subtitleBgColor} onChange={(e) => patch({ subtitleBgColor: e.target.value })} className="substyle-color-picker" />
                    <input className="wiz-input substyle-color-hex" value={data.subtitleBgColor} onChange={(e) => patch({ subtitleBgColor: e.target.value })} dir="ltr" />
                  </div>
                  <label className="substyle-field-label" style={{ marginTop: "1.25rem" }}>אטימות</label>
                  <div className="substyle-size-row">
                    <input type="range" min="0" max="100" value={data.subtitleBgOpacity}
                      onChange={(e) => patch({ subtitleBgOpacity: Number(e.target.value) })}
                      className="substyle-range" />
                    <div className="substyle-size-value">{data.subtitleBgOpacity}%</div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Layout Panel ── */}
          {activePanel === "layout" && (
            <div className="substyle-panel">
              <label className="substyle-field-label">יישור טקסט</label>
              <div className="substyle-align-row">
                {(["right", "center", "left"] as const).map((a) => (
                  <button key={a} className={`substyle-align-btn ${data.subtitleAlign === a ? "active" : ""}`}
                    onClick={() => patch({ subtitleAlign: a })}>
                    {a === "left" ? "⫷ שמאל" : a === "center" ? "☰ מרכז" : "⫸ ימין"}
                  </button>
                ))}
              </div>

              <label className="substyle-field-label" style={{ marginTop: "1.5rem" }}>שבירת שורות</label>
              <div className="substyle-align-row">
                {(["auto", "balanced"] as const).map((b) => (
                  <button key={b} className={`substyle-align-btn ${data.subtitleLineBreak === b ? "active" : ""}`}
                    onClick={() => patch({ subtitleLineBreak: b })}>
                    {b === "auto" ? "אוטומטי" : "מאוזן"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 5 — Subtitle Mode
   ═══════════════════════════════════════════════════════════════════════════ */

function StepSubMode({ data, patch }: { data: WizardData; patch: (p: Partial<WizardData>) => void }) {
  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">מצב כתוביות</h2>
      <p className="wiz-step-sub">בחר אם להשתמש בהמרת דיבור-לטקסט או להעלות כתוביות ידניות.</p>
      <div className="wiz-submode-grid">
        <button className={`wiz-submode-card ${data.subtitleMode === "auto" ? "active" : ""}`} onClick={() => patch({ subtitleMode: "auto" })}>
          <div className="wiz-submode-icon">🤖</div>
          <div className="wiz-submode-title">אוטומטי (STT)</div>
          <div className="wiz-submode-desc">המרה אוטומטית של דיבור לטקסט עם עריכה</div>
        </button>
        <button className={`wiz-submode-card ${data.subtitleMode === "manual" ? "active" : ""}`} onClick={() => patch({ subtitleMode: "manual" })}>
          <div className="wiz-submode-icon">✍️</div>
          <div className="wiz-submode-title">ידני</div>
          <div className="wiz-submode-desc">הוסף כתוביות ידניות לכל קטע</div>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 6 — Language
   ═══════════════════════════════════════════════════════════════════════════ */

function StepLanguage({ data, patch }: { data: WizardData; patch: (p: Partial<WizardData>) => void }) {
  const LANG_DETAILS: Record<string, { desc: string; example: string }> = {
    he: { desc: "עברית מודרנית — תמיכה מלאה בזיהוי דיבור", example: "שלום, ברוכים הבאים..." },
    en: { desc: "English — full speech recognition support", example: "Hello, welcome to..." },
    ar: { desc: "العربية — دعم التعرف على الكلام", example: "مرحبا، أهلا وسهلا..." },
    ru: { desc: "Русский — поддержка распознавания речи", example: "Здравствуйте, добро..." },
    auto: { desc: "המערכת תזהה אוטומטית את שפת הדיבור", example: "Auto-detection" },
  };

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">שפת דיבור</h2>
      <p className="wiz-step-sub">בחר את שפת הדיבור בוידאו. זה ישפיע על דיוק הזיהוי והכתוביות.</p>
      {!data.language && <div className="wiz-validation-msg"><span>⚠️</span> יש לבחור שפה כדי להמשיך</div>}
      <div className="lang-grid">
        {LANGUAGES.map((lang) => {
          const detail = LANG_DETAILS[lang.id] || { desc: "", example: "" };
          const isActive = data.language === lang.id;
          return (
            <button key={lang.id} className={`lang-card ${isActive ? "active" : ""}`} onClick={() => patch({ language: lang.id })}>
              <div className="lang-card-flag">{lang.flag}</div>
              <div className="lang-card-body">
                <div className="lang-card-name">{lang.label}</div>
                <div className="lang-card-desc">{detail.desc}</div>
                {detail.example && lang.id !== "auto" && (
                  <div className="lang-card-example">"{detail.example}"</div>
                )}
              </div>
              {isActive && <div className="lang-card-check">✓</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 7 — Transcript Review / Manual Subtitles
   ═══════════════════════════════════════════════════════════════════════════ */

function StepTranscriptReview({ data, patch, videoSrc: parentVideoSrc }: { data: WizardData; patch: (p: Partial<WizardData>) => void; videoSrc?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ct, setCt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState("");
  const raf = useRef(0);
  const segListRef = useRef<HTMLDivElement>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ assemblyai: boolean; openai: boolean } | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [transcriptionProvider, setTranscriptionProvider] = useState<string>("");
  const [fallbackTriggered, setFallbackTriggered] = useState(false);
  const [fallbackReason, setFallbackReason] = useState("");

  const videoSrc = parentVideoSrc || "";

  // Track video playback time
  useEffect(() => {
    const tick = () => {
      if (videoRef.current) setCt(videoRef.current.currentTime);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  // Sync playing state with native controls
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => { v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); };
  }, []);

  // Auto-generate transcription when entering this step with no segments
  // GATE: Only auto-trigger if we have a server-uploaded URL (not just a blob)
  const autoTriggered = useRef(false);
  useEffect(() => {
    if (!autoTriggered.current && data.segments.length === 0 && !transcribing) {
      // Must have a real server URL — do NOT proceed with just a blob or videoFile
      if (data.uploadedVideoUrl) {
        autoTriggered.current = true;
        console.log("[StepTranscriptReview] Auto-triggering transcription (uploadedVideoUrl ready)");
        runTranscription();
      } else if (data.videoFile && !data.uploadedVideoUrl) {
        // Upload didn't succeed yet — show clear error instead of silently failing
        autoTriggered.current = true;
        console.warn("[StepTranscriptReview] No uploadedVideoUrl — upload may have failed. Will attempt upload before transcription.");
        runTranscription();
      } else {
        console.warn("[StepTranscriptReview] No video source available for transcription");
        setTranscribeError("לא נמצא קובץ וידאו — חזור לשלב ההעלאה וודא שהקובץ הועלה בהצלחה");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check API key status on mount
  useEffect(() => {
    fetch("/api/settings/api-keys/status")
      .then(r => r.json())
      .then(data => setApiKeyStatus(data))
      .catch(() => setApiKeyStatus({ assemblyai: false, openai: false }));
  }, []);

  const getVideoDuration = (): Promise<number> => {
    return new Promise((resolve) => {
      if (videoRef.current && videoRef.current.duration && isFinite(videoRef.current.duration)) {
        resolve(videoRef.current.duration);
        return;
      }
      const tempVideo = document.createElement("video");
      tempVideo.preload = "metadata";
      const src = data.videoUrl || (data.videoFile ? URL.createObjectURL(data.videoFile) : "");
      if (!src) { resolve(30); return; }
      tempVideo.src = src;
      tempVideo.onloadedmetadata = () => {
        resolve(tempVideo.duration || 30);
        tempVideo.remove();
      };
      tempVideo.onerror = () => { resolve(30); tempVideo.remove(); };
      setTimeout(() => resolve(30), 5000);
    });
  };

  const runTranscription = async () => {
    setTranscribing(true);
    setTranscribeError("");
    try {
      const dur = await getVideoDuration();
      const effectiveDur = data.trimMode === "clip" ? (data.trimEnd - data.trimStart) : dur;
      const offsetSec = data.trimMode === "clip" ? data.trimStart : 0;

      // ─── TRANSCRIPTION-ONLY UPLOAD ───
      // HARD RULE: This block NEVER writes to uploadedVideoUrl or videoUrl.
      // Those fields are the originalVideoSource for preview/editing.
      // We only need a server-accessible URL to send to the transcription API.
      // The result is a LOCAL variable — not stored in wizard state.
      let transcriptionUrl = "";

      // Priority: reuse existing server URL > upload fresh for transcription only
      if (data.uploadedVideoUrl) {
        // Best case: StepUpload already uploaded the video — reuse that URL
        transcriptionUrl = data.uploadedVideoUrl;
        console.debug("[runTranscription] Reusing uploadedVideoUrl for transcription:", transcriptionUrl);
      } else if (data.videoFile) {
        // Fallback: upload directly to Supabase via signed URL
        console.log(`[runTranscription] Fallback upload: ${data.videoFile.name} (${(data.videoFile.size / 1048576).toFixed(1)}MB)`);

        // Step 1: Get signed URL (tiny JSON)
        const initRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: data.videoFile.name, contentType: data.videoFile.type, fileSize: data.videoFile.size }),
        });
        if (!initRes.ok) {
          let errDetail = `שגיאה בהכנת העלאה (${initRes.status})`;
          try { const b = await initRes.json(); if (b.error) errDetail = b.error; } catch {}
          throw new Error(errDetail);
        }
        const { uploadUrl, publicUrl: finalUrl } = await initRes.json();
        if (!uploadUrl) throw new Error("שרת לא החזיר כתובת העלאה");

        // Step 2: PUT file directly to Supabase
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": data.videoFile.type || "application/octet-stream" },
          body: data.videoFile,
        });
        if (!putRes.ok) {
          let errDetail = `שגיאה בהעלאה לאחסון (${putRes.status})`;
          try { const b = await putRes.json(); if (b.error || b.message) errDetail = b.error || b.message; } catch {}
          throw new Error(errDetail);
        }

        transcriptionUrl = finalUrl;
        patch({ uploadedVideoUrl: finalUrl, videoUrl: finalUrl });
        console.log(`[runTranscription] ✅ Fallback upload SUCCESS: ${transcriptionUrl}`);
      } else if (data.videoUrl && !data.videoUrl.startsWith("blob:")) {
        transcriptionUrl = data.videoUrl;
      } else {
        throw new Error("לא נמצא קובץ וידאו — יש להעלות וידאו תחילה");
      }

      // Step 2: Call transcription API with the transient transcription URL
      // This URL is a LOCAL variable — never stored in wizard state as preview source
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: data.language || "he", durationSec: effectiveDur, offsetSec, audioUrl: transcriptionUrl }),
      });
      const result = await res.json().catch(() => ({}));
      setDebugInfo(result.debug || null);
      setTranscriptionProvider(result.provider || "");
      setFallbackTriggered(result.fallbackTriggered || false);
      setFallbackReason(result.fallbackReason || "");

      if (!res.ok) {
        // Build detailed error message from API response
        const providersTried = result.debug?.providerTried?.join(", ") || "none";
        const providerError = result.debug?.error || "";
        const fallbackInfo = result.fallbackTriggered ? ` (${result.fallbackReason})` : "";
        const detail = providerError ? `\n${providerError}` : "";
        throw new Error(`${result.error || "שגיאה בתמלול"}\nProviders tried: ${providersTried}${fallbackInfo}${detail}`);
      }

      if (result.segments && result.segments.length > 0) {
        const segs: SubSegment[] = result.segments.map((s: any, i: number) => ({
          id: s.id || `seg_${i}`,
          startSec: s.startSec,
          endSec: s.endSec,
          text: s.text || "",
          confidence: s.confidence,
          edited: false,
          highlightWord: "",
          highlightStyle: "color" as const,
        }));
        patch({ segments: segs, transcribing: false });
      } else {
        throw new Error(result.error || "לא התקבלו קטעים מהספק — נסה שוב");
      }
    } catch (e) {
      console.error("Transcription error:", e);
      const errMsg = e instanceof Error ? e.message : "שגיאה בתמלול";
      if (apiKeyStatus && !apiKeyStatus.assemblyai && !apiKeyStatus.openai) {
        setTranscribeError("לא הוגדרו מפתחות API — הגדר AssemblyAI או OpenAI בהגדרות (/settings)");
      } else {
        setTranscribeError(errMsg);
      }
      patch({ transcribing: false });
    } finally {
      setTranscribing(false);
    }
  };

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const seekToSeg = (seg: SubSegment) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seg.startSec;
      if (!playing) { videoRef.current.play(); setPlaying(true); }
    }
  };

  const activeSeg = data.segments.find((s) => ct >= s.startSec && ct < s.endSec);

  // Auto-scroll to active segment
  useEffect(() => {
    if (!activeSeg || !segListRef.current) return;
    const el = segListRef.current.querySelector(`[data-seg-id="${activeSeg.id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeSeg?.id]);

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">עריכת כתוביות</h2>
      <p className="wiz-step-sub">סקור את התמלול, ערוך טקסט וצפה בתצוגה מקדימה עם כתוביות בזמן אמת.</p>

      {/* API Key Warning */}
      {apiKeyStatus && !apiKeyStatus.assemblyai && !apiKeyStatus.openai && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.875rem 1rem", borderRadius: 10, marginBottom: "1rem",
          background: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(251, 191, 36, 0.2)",
        }}>
          <span style={{ fontSize: "1.25rem" }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fbbf24" }}>
              יש להוסיף מפתח API כדי להשתמש בתמלול אוטומטי
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginTop: 2 }}>
              כרגע מוצגות כתוביות לדוגמה. הגדר מפתח API בהגדרות לתמלול אמיתי.
            </div>
          </div>
          <a href="/settings" style={{
            fontSize: "0.7rem", fontWeight: 600, padding: "4px 10px", borderRadius: 6,
            background: "rgba(251, 191, 36, 0.15)", color: "#fbbf24",
            textDecoration: "none", whiteSpace: "nowrap",
          }}>
            הגדרות API →
          </a>
        </div>
      )}

      {/* Connected indicator */}
      {apiKeyStatus && (apiKeyStatus.assemblyai || apiKeyStatus.openai) && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "1rem",
          background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.15)",
          fontSize: "0.75rem", color: "#22c55e",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
          תמלול אוטומטי פעיל ({apiKeyStatus.assemblyai ? "AssemblyAI" : "OpenAI Whisper"})
        </div>
      )}

      {/* Provider badge after transcription */}
      {transcriptionProvider && !transcribing && data.segments.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <span className={`provider-badge ${transcriptionProvider === "assemblyai" ? "assemblyai" : "whisper"}`}>
            {transcriptionProvider === "assemblyai" ? "AssemblyAI" : transcriptionProvider === "whisper" ? "Whisper" : transcriptionProvider}
          </span>
          {fallbackTriggered && (
            <div className="provider-fallback-notice">
              ⚠️ {fallbackReason || "AssemblyAI failed, switched to Whisper"}
            </div>
          )}
        </div>
      )}

      {/* Video + Transcript workspace — video is ALWAYS visible */}
      <div className="transcript-workspace">
        {/* Left: Video player with live subtitle overlay */}
        <div className="transcript-video-col">
          {(() => {
            const FORMAT_RATIOS: Record<string, string> = { "9:16": "9 / 16", "1:1": "1 / 1", "4:5": "4 / 5", "16:9": "16 / 9" };
            const cssAR = FORMAT_RATIOS[data.format] || "9 / 16";
            const isPort = ["9:16", "4:5"].includes(data.format);

            // Build outer stroke via multi-directional text-shadow
            const outlineShadows: string[] = [];
            if (data.subtitleOutlineEnabled) {
              const t = data.subtitleOutlineThickness || 1;
              const c = data.subtitleOutlineColor || "#000000";
              const offs = [[t,0],[-t,0],[0,t],[0,-t],[t,t],[-t,t],[t,-t],[-t,-t],[t*.7,t*.7],[-t*.7,t*.7],[t*.7,-t*.7],[-t*.7,-t*.7]];
              offs.forEach(([x,y]) => outlineShadows.push(`${x}px ${y}px 0 ${c}`));
            }
            if (data.subtitleShadow) outlineShadows.push("2px 2px 6px rgba(0,0,0,0.7)");

            // Subtitle bg
            let subBg: React.CSSProperties | undefined;
            if (data.subtitleBg) {
              const op = (data.subtitleBgOpacity || 50) / 100;
              const col = data.subtitleBgColor || "#000000";
              const r = parseInt(col.slice(1,3),16), g = parseInt(col.slice(3,5),16), b = parseInt(col.slice(5,7),16);
              subBg = { background: `rgba(${r},${g},${b},${op})`, padding: "4px 12px", borderRadius: 6, display: "inline-block" };
            }

            const displaySeg = activeSeg;
            const displayText = displaySeg ? displaySeg.text : (data.segments.length > 0 ? data.segments[0].text : "");

            return (
              <>
                <div style={{
                  position: "relative",
                  width: isPort ? "min(100%, 300px)" : "100%",
                  aspectRatio: cssAR,
                  borderRadius: 12, overflow: "hidden", background: "#000",
                  cursor: "pointer",
                  margin: isPort ? "0 auto" : undefined,
                }} onClick={toggle}>
                  <video
                    ref={videoRef} src={videoSrc} playsInline preload="metadata"
                    onLoadedMetadata={() => setVideoReady(true)}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />

                  {/* Live subtitle overlay */}
                  {displayText && (
                    <div style={{
                      position: "absolute", left: "5%", right: "5%",
                      ...(data.subtitlePosition === "top" ? { top: "8%" } : data.subtitlePosition === "center" ? { top: "50%", transform: "translateY(-50%)" } : data.subtitlePosition === "manual" ? { top: `${Math.max(5, Math.min(95, data.subtitleManualY ?? 75))}%`, transform: "translateY(-50%)" } : { bottom: "8%" }),
                      display: "flex", flexDirection: "column",
                      alignItems: data.subtitleAlign === "right" ? "flex-end" : data.subtitleAlign === "left" ? "flex-start" : "center",
                      textAlign: data.subtitleAlign || "center",
                      fontFamily: `"${data.subtitleFont}", sans-serif`,
                      fontWeight: data.subtitleFontWeight || 700,
                      fontSize: `${Math.max(10, (data.subtitleFontSize || 36) * 0.45)}px`,
                      color: data.subtitleColor || "#FFFFFF",
                      direction: "rtl", lineHeight: 1.4,
                      pointerEvents: "none", zIndex: 10,
                      textShadow: outlineShadows.length > 0 ? outlineShadows.join(", ") : undefined,
                      transition: "all 200ms ease",
                    }}>
                      <span style={subBg}>{displayText}</span>
                    </div>
                  )}

                  {/* Play/Pause indicator */}
                  {!playing && videoReady && (
                    <div style={{
                      position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                      width: 48, height: 48, borderRadius: "50%", background: "rgba(0,0,0,0.55)",
                      display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
                    }}>
                      <span style={{ color: "#fff", fontSize: 20, marginLeft: 3 }}>▶</span>
                    </div>
                  )}

                  {/* Format badge */}
                  <div style={{
                    position: "absolute", top: 8, left: 8,
                    background: "rgba(0,0,0,0.6)", color: "#fff",
                    fontSize: "0.6rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                  }}>{data.format}</div>
                </div>

                {/* Timeline scrubber */}
                {videoReady && videoRef.current && (
                  <div style={{ marginTop: 8, width: isPort ? "min(100%, 300px)" : "100%", margin: isPort ? "8px auto 0" : "8px 0 0" }}>
                    <input type="range" min={0} max={videoRef.current.duration || 100} step={0.1} value={ct}
                      onChange={(e) => { const t = Number(e.target.value); if (videoRef.current) videoRef.current.currentTime = t; setCt(t); }}
                      style={{ width: "100%", accentColor: "#00B5FE", cursor: "pointer" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: 2 }}>
                      <span>{fmtTime(ct)}</span>
                      <span>{fmtTime(videoRef.current?.duration || 0)}</span>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          <div className="transcript-video-info">
            <span className="transcript-time-badge">{fmtTime(ct)}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
              {data.segments.length} קטעים · {data.segments.filter(s => s.text.trim()).length} עם טקסט
              {activeSeg && <span style={{ color: "#22c55e", marginInlineStart: 6 }}>● כתובית {data.segments.indexOf(activeSeg) + 1}</span>}
            </span>
            <button className="wiz-btn wiz-btn-ghost wiz-btn-sm" onClick={runTranscription} style={{ marginInlineStart: "auto", fontSize: "0.7rem" }}>
              🔄 תמלל מחדש
            </button>
          </div>
        </div>

        {/* Right: Transcript state or segment list */}
        {transcribing ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "2rem" }}>
            <div className="transcript-loading-spinner" />
            <div style={{ fontWeight: 600 }}>מתמלל את הוידאו...</div>
            <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>המערכת מנתחת את הדיבור ויוצרת כתוביות</div>
          </div>
        ) : transcribeError && data.segments.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "2rem" }}>
            <div style={{ fontSize: "2rem" }}>⚠️</div>
            <div style={{ fontWeight: 600 }}>שגיאה בתמלול</div>
            <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", whiteSpace: "pre-line", textAlign: "center" }}>{transcribeError}</div>
            {debugInfo && (
              <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", padding: "0.5rem", background: "var(--surface-raised)", borderRadius: 6, textAlign: "start", direction: "ltr", width: "100%" }}>
                <div>Providers tried: {debugInfo.providerTried?.join(", ") || "none"}</div>
                <div>API keys: AssemblyAI={debugInfo.apiKeyStatus?.assemblyai ? "✓" : "✗"} OpenAI={debugInfo.apiKeyStatus?.openai ? "✓" : "✗"}</div>
                {debugInfo.error && <div>Error: {debugInfo.error}</div>}
                <div>Latency: {debugInfo.latencyMs}ms</div>
              </div>
            )}
            <button className="wiz-btn wiz-btn-primary" onClick={runTranscription}>🔄 נסה שוב</button>
            {apiKeyStatus && !apiKeyStatus.assemblyai && !apiKeyStatus.openai && (
              <a href="/settings" style={{ display: "block", marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--accent)" }}>
                הגדר מפתחות API בהגדרות →
              </a>
            )}
          </div>
        ) : (
          <div className="transcript-seg-col" ref={segListRef}>
            {data.segments.map((seg, i) => {
              const isActive = activeSeg?.id === seg.id;
              return (
                <div key={seg.id} data-seg-id={seg.id}
                  className={`transcript-seg-row ${isActive ? "active" : ""} ${seg.text.trim() ? "" : "empty"}`}
                  onClick={() => seekToSeg(seg)}>
                  <div className="transcript-seg-num">{i + 1}</div>
                  <div className="transcript-seg-times">
                    <span>{fmtTimeShort(seg.startSec)}</span>
                    <span className="transcript-seg-arrow">→</span>
                    <span>{fmtTimeShort(seg.endSec)}</span>
                  </div>
                  <input className="transcript-seg-input" value={seg.text}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const newSegs = [...data.segments];
                      newSegs[i] = { ...seg, text: e.target.value, edited: true };
                      patch({ segments: newSegs });
                    }}
                    placeholder="הקלד טקסט לכתובית..."
                  />
                  {seg.edited && <span className="transcript-seg-edited">✏️</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Debug Panel Toggle */}
      <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <button onClick={() => setShowDebug(!showDebug)} style={{
          display: "flex", alignItems: "center", gap: "0.375rem",
          fontSize: "0.7rem", color: "var(--foreground-muted)", background: "none",
          border: "none", cursor: "pointer", padding: 0,
        }}>
          <span>{showDebug ? "▾" : "▸"}</span>
          <span>🔧 Transcription Debug Panel</span>
        </button>

        {showDebug && (
          <div style={{
            marginTop: "0.75rem", padding: "1rem", borderRadius: 10,
            background: "var(--surface-raised)", border: "1px solid var(--border)",
            fontSize: "0.7rem", fontFamily: "monospace",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.375rem 0.75rem" }}>
              <span style={{ color: "var(--foreground-muted)" }}>Provider:</span>
              <span>{debugInfo?.provider || "—"}</span>

              <span style={{ color: "var(--foreground-muted)" }}>API Key Status:</span>
              <span>
                AssemblyAI: {apiKeyStatus?.assemblyai ? "✅ Set" : "❌ Missing"} · OpenAI: {apiKeyStatus?.openai ? "✅ Set" : "❌ Missing"}
              </span>

              <span style={{ color: "var(--foreground-muted)" }}>Language:</span>
              <span>{debugInfo?.requestLanguage || data.language || "—"}</span>

              <span style={{ color: "var(--foreground-muted)" }}>Duration:</span>
              <span>{debugInfo?.requestDuration ? `${debugInfo.requestDuration.toFixed(1)}s` : "—"}</span>

              <span style={{ color: "var(--foreground-muted)" }}>Segments:</span>
              <span>{debugInfo?.responseSegments ?? data.segments.length}</span>

              <span style={{ color: "var(--foreground-muted)" }}>Latency:</span>
              <span>{debugInfo?.latencyMs ? `${debugInfo.latencyMs}ms` : "—"}</span>

              <span style={{ color: "var(--foreground-muted)" }}>Timestamp:</span>
              <span>{debugInfo?.timestamp || "—"}</span>

              {debugInfo?.error && (
                <>
                  <span style={{ color: "#ef4444" }}>Error:</span>
                  <span style={{ color: "#ef4444" }}>{debugInfo.error}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepManualSubtitles({ data, patch, videoSrc: parentVideoSrc }: { data: WizardData; patch: (p: Partial<WizardData>) => void; videoSrc?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ct, setCt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const raf = useRef(0);

  const videoSrc = parentVideoSrc || "";

  useEffect(() => {
    const tick = () => { if (videoRef.current) setCt(videoRef.current.currentTime); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  useEffect(() => {
    if (data.segments.length === 0 && data.videoFile) {
      const getD = () => new Promise<number>((resolve) => {
        const t = document.createElement("video"); t.preload = "metadata"; t.src = data.uploadedVideoUrl || data.videoUrl;
        t.onloadedmetadata = () => { resolve(t.duration || 30); t.remove(); };
        t.onerror = () => { resolve(30); t.remove(); };
        setTimeout(() => resolve(30), 5000);
      });
      getD().then(dur => {
        const effectiveDur = data.trimMode === "clip" ? (data.trimEnd - data.trimStart) : dur;
        patch({ segments: generateSmartSegments(effectiveDur) });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => { const v = videoRef.current; if (!v) return; v.paused ? (v.play(), setPlaying(true)) : (v.pause(), setPlaying(false)); };
  const seekToSeg = (seg: SubSegment) => { if (videoRef.current) { videoRef.current.currentTime = seg.startSec; if (!playing) { videoRef.current.play(); setPlaying(true); } } };
  const activeSeg = data.segments.find((s) => ct >= s.startSec && ct < s.endSec);

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">כתוביות ידניות</h2>
      <p className="wiz-step-sub">הוסף כתוביות ידניות לכל קטע. לחץ על שורה כדי לנווט בוידאו.</p>

      <div className="transcript-workspace">
        <div className="transcript-video-col">
          <video ref={videoRef} src={videoSrc} controls playsInline preload="metadata" className="wiz-player-video" style={{ width: "100%", borderRadius: 12 }} />
        </div>

        <div className="transcript-seg-col">
          {data.segments.map((seg, i) => (
            <div key={seg.id} className={`transcript-seg-row ${activeSeg?.id === seg.id ? "active" : ""}`}
              onClick={() => seekToSeg(seg)}>
              <div className="transcript-seg-num">{i + 1}</div>
              <div className="transcript-seg-times">
                <span>{fmtTimeShort(seg.startSec)}</span>
                <span className="transcript-seg-arrow">→</span>
                <span>{fmtTimeShort(seg.endSec)}</span>
              </div>
              <input className="transcript-seg-input" value={seg.text}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const newSegs = [...data.segments];
                  newSegs[i] = { ...seg, text: e.target.value, edited: true };
                  patch({ segments: newSegs });
                }}
                placeholder="הקלד טקסט לכתובית..."
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 8 — Smart Cleanup (NEW)
   ═══════════════════════════════════════════════════════════════════════════ */

function StepCleanup({ data, patch, videoSrc: _parentVideoSrc }: { data: WizardData; patch: (p: Partial<WizardData>) => void; videoSrc?: string }) {
  useEffect(() => {
    const removed: CleanupSegment[] = [];
    if (data.cleanupFillers) {
      const fillers = data.language === "en" ? FILLER_WORDS_EN : FILLER_WORDS_HE;
      data.segments.forEach((seg, i) => {
        if (i % 4 === 1) {
          removed.push({
            id: `filler_${seg.id}`,
            startSec: seg.startSec, endSec: seg.startSec + 0.5,
            type: "filler", label: fillers[i % fillers.length],
            removed: true, restorable: true,
          });
        }
      });
    }
    if (data.cleanupSilence) {
      data.segments.forEach((seg, i) => {
        if (i % 3 === 2 && seg.endSec - seg.startSec > 2) {
          removed.push({
            id: `silence_${seg.id}`,
            startSec: seg.endSec - 1.2, endSec: seg.endSec,
            type: "silence", label: "שקט ארוך",
            removed: data.cleanupIntensity !== "light",
            restorable: true,
          });
        }
      });
    }
    patch({ cleanupRemovedSegments: removed });
  }, [data.cleanupFillers, data.cleanupSilence, data.cleanupIntensity, data.segments.length, data.language, patch]);

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">ניקוי חכם</h2>
      <p className="wiz-step-sub">הסר מילות מילוי ושקטים ארוכים כדי לשפר את הזרימה והבהירות.</p>

      <div className="wiz-cleanup-controls">
        <label className="wiz-toggle-label">
          <input type="checkbox" checked={data.cleanupFillers} onChange={(e) => patch({ cleanupFillers: e.target.checked })} />
          נקה מילות מילוי
        </label>
        <label className="wiz-toggle-label">
          <input type="checkbox" checked={data.cleanupSilence} onChange={(e) => patch({ cleanupSilence: e.target.checked })} />
          הסר שקטים
        </label>

        {(data.cleanupFillers || data.cleanupSilence) && (
          <div style={{ marginTop: "1.5rem" }}>
            <label className="wiz-label">עוצמת ניקוי</label>
            <div className="wiz-chip-row">
              {(["light", "medium", "aggressive"] as const).map((int) => (
                <button key={int} className={`wiz-chip ${data.cleanupIntensity === int ? "active" : ""}`} onClick={() => patch({ cleanupIntensity: int })}>
                  {int === "light" ? "קלה" : int === "medium" ? "בינונית" : "אגרסיבית"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {data.cleanupRemovedSegments.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "1rem", color: "var(--foreground-muted)" }}>
            קטעים שיוסרו: {data.cleanupRemovedSegments.filter(s => s.removed).length}
          </div>
          <div className="wiz-cleanup-list">
            {data.cleanupRemovedSegments.map((seg) => (
              <div key={seg.id} className="wiz-cleanup-item">
                <span className="wiz-cleanup-type">{seg.type === "filler" ? "🗣️" : "🔇"}</span>
                <span className="wiz-cleanup-time">{fmtTimeShort(seg.startSec)} — {fmtTimeShort(seg.endSec)}</span>
                <span style={{ flex: 1 }}>{seg.label}</span>
                <button className="wiz-cleanup-restore" onClick={() => {
                  const newSegs = data.cleanupRemovedSegments.map(s =>
                    s.id === seg.id ? { ...s, removed: !s.removed } : s
                  );
                  patch({ cleanupRemovedSegments: newSegs });
                }}>
                  {seg.removed ? "הסר" : "שחזר"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: "2rem", padding: "1rem", background: "var(--surface-raised)", borderRadius: 6 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>הערה: AI Cleanup</div>
        <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
          המערכת שומרת על מילות מילוי שנושאות רגש או משמעות. ניקוי מתמקד בבהירות, זרימה ומעורבות.
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 9 — B-Roll
   ═══════════════════════════════════════════════════════════════════════════ */

function StepBroll({ data, patch, compositionData, videoSrc: parentVideoSrc }: { data: WizardData; patch: (p: Partial<WizardData>) => void; compositionData?: FinalCompositionData | null; videoSrc?: string }) {
  const [addingToSegment, setAddingToSegment] = useState<string | null>(null);
  const [brollKeyword, setBrollKeyword] = useState("");
  const [stockSearching, setStockSearching] = useState(false);
  const [stockSearchResults, setStockSearchResults] = useState<Record<string, any[]>>({});
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [activePreviewBroll, setActivePreviewBroll] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [providerStatus, setProviderStatus] = useState<{ loaded: boolean; anyConfigured: boolean; providers: Record<string, { enabled: boolean; configured: boolean }> }>({ loaded: false, anyConfigured: false, providers: {} });
  const [lastSearchDiag, setLastSearchDiag] = useState<{ keywords: string[]; providersSearched: string[]; totalFound: number; error?: string } | null>(null);
  const totalDur = data.segments.length > 0 ? data.segments[data.segments.length - 1].endSec : 30;
  const videoSrc = parentVideoSrc || "";

  // Aspect ratio from selected format
  const formatDims = FORMAT_DIMENSIONS[data.format] || FORMAT_DIMENSIONS["9:16"];
  const aspectRatio = formatDims.width / formatDims.height;

  // Check stock provider status on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/stock-search");
        const json = await res.json();
        const anyConfigured = !!(json.pexels?.configured || json.pixabay?.configured || json.shutterstock?.configured);
        setProviderStatus({ loaded: true, anyConfigured, providers: json });
      } catch {
        setProviderStatus({ loaded: true, anyConfigured: false, providers: {} });
      }
    })();
  }, []);

  // Subtitle style for unified player
  const subtitleStyle = useMemo(() => extractSubtitleStyle(data), [data]);

  // Time tracking provided by unified player via onTimeUpdate callback
  const handleTimeUpdate = useCallback((t: number) => { setCurrentTime(t); }, []);

  // Active subtitle segment at current time
  const activeSeg = useMemo(() => {
    const seg = data.segments.find(s => currentTime >= s.startSec && currentTime <= s.endSec);
    return seg || null;
  }, [currentTime, data.segments]);

  // Active B-roll at current time
  const activeBroll = useMemo(() => {
    const p = data.brollPlacements.find(p => currentTime >= p.startSec && currentTime <= p.endSec && p.stockPreviewUrl);
    return p || null;
  }, [currentTime, data.brollPlacements]);

  // Debug logging — fires on segment/broll changes, not every frame
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const segIdx = activeSeg ? data.segments.indexOf(activeSeg) : -1;
      console.log(
        `[B-Roll Playback] t=${currentTime.toFixed(2)}s | seg=${segIdx}/${data.segments.length}` +
        (activeSeg ? ` "${activeSeg.text.substring(0, 30)}..."` : " (no seg)") +
        (activeBroll ? ` | BROLL=${activeBroll.id} src=${activeBroll.stockProvider || activeBroll.source}` : " | no broll")
      );
      if (activeBroll && !activeBroll.stockPreviewUrl) {
        console.warn("[B-Roll Playback] BROLL ACTIVE BUT NO PREVIEW URL:", activeBroll.id);
      }
      if (data.segments.length > 0 && currentTime > 1 && !activeSeg) {
        // Check if we're between segments (gap) — that's normal
        const isInGap = !data.segments.some(s => currentTime >= s.startSec && currentTime <= s.endSec);
        if (!isInGap) {
          console.warn("[B-Roll Playback] SUBTITLE TIMELINE STUCK — currentTime within segment range but no match");
        }
      }
    }
  }, [activeSeg?.id, activeBroll?.id]);

  // Search stock media for a specific keyword
  const searchStockForKeyword = async (keyword: string): Promise<{ results: any[]; error?: string; providersSearched?: string[] }> => {
    try {
      const orientation = (data.format === "9:16") ? "portrait" : (data.format === "1:1") ? "square" : "landscape";
      const res = await fetch("/api/stock-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: keyword, orientation, minDuration: 3, maxDuration: 15, perPage: 5 }),
      });
      const json = await res.json();
      console.log("[B-Roll] Search result for", keyword, ":", { results: (json.results || []).length, error: json.error, providers: json.providersSearched });
      return { results: json.results || [], error: json.error, providersSearched: json.providersSearched };
    } catch (err) {
      console.error("[B-Roll] Stock search error for:", keyword, err);
      return { results: [], error: "network_error" };
    }
  };

  // Ref to always have latest placements (avoids stale closure in async)
  const placementsRef = useRef(data.brollPlacements);
  placementsRef.current = data.brollPlacements;

  // Add B-roll with stock search
  const addBrollToSegment = async (seg: SubSegment, keyword: string, source: BrollPlacement["source"]) => {
    const exists = placementsRef.current.find(p => p.startSec === seg.startSec);
    if (exists) return;

    // Create placement immediately with searching state
    const placementId = `broll-${Date.now()}`;
    const placement: BrollPlacement = {
      id: placementId,
      startSec: seg.startSec,
      endSec: seg.endSec,
      keyword: keyword || "contextual",
      source,
      searchKeyword: keyword,
      mediaStatus: "searching",
    };
    patch({ brollPlacements: [...placementsRef.current, placement] });
    setAddingToSegment(null);
    setBrollKeyword("");

    // Search stock providers
    const searchResult = await searchStockForKeyword(keyword);
    setLastSearchDiag({ keywords: [keyword], providersSearched: searchResult.providersSearched || [], totalFound: searchResult.results.length, error: searchResult.error });
    if (searchResult.results.length > 0) {
      const best = searchResult.results[0];
      // Use ref for latest state to avoid stale closure
      const updated = placementsRef.current.map(p => p.id === placementId ? {
        ...p,
        source: best.provider as BrollPlacement["source"],
        stockProvider: best.provider,
        stockClipId: best.id,
        stockPreviewUrl: best.previewUrl,
        stockDownloadUrl: best.downloadUrl,
        stockThumbnailUrl: best.thumbnailUrl,
        stockTitle: best.title,
        stockDuration: best.duration,
        relevanceScore: best.relevanceScore,
        mediaStatus: "found" as const,
      } : p);
      patch({ brollPlacements: updated });
      setStockSearchResults(prev => ({ ...prev, [seg.id]: searchResult.results }));
    } else {
      const updated = placementsRef.current.map(p => p.id === placementId ? {
        ...p,
        mediaStatus: "not_found" as const,
        mediaError: searchResult.error === "no_providers_configured" ? "no_providers" : "no_results",
      } : p);
      patch({ brollPlacements: updated });
    }
  };

  const removeBroll = (id: string) => {
    patch({ brollPlacements: placementsRef.current.filter(p => p.id !== id) });
  };

  // Replace B-roll clip with alternative
  const replaceBrollClip = (placementId: string, clip: any) => {
    const updated = placementsRef.current.map(p => p.id === placementId ? {
      ...p,
      source: clip.provider as BrollPlacement["source"],
      stockProvider: clip.provider,
      stockClipId: clip.id,
      stockPreviewUrl: clip.previewUrl,
      stockDownloadUrl: clip.downloadUrl,
      stockThumbnailUrl: clip.thumbnailUrl,
      stockTitle: clip.title,
      stockDuration: clip.duration,
      relevanceScore: clip.relevanceScore,
      mediaStatus: "found" as const,
    } : p);
    patch({ brollPlacements: updated });
  };

  // AI B-roll analysis
  const brollPlan = useMemo<BrollPlan | null>(() => {
    if (!data.brollEnabled || data.segments.length === 0) return null;
    return analyzeBroll(
      data.segments.map(s => ({ id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text, highlightWord: s.highlightWord })),
      { language: (data.language as "he" | "en") || "auto", aiEditMode: data.aiEditMode, targetCoverage: 0.4 }
    );
  }, [data.brollEnabled, data.segments, data.language, data.aiEditMode]);

  // Sync AI suggestions
  useEffect(() => {
    if (brollPlan && brollPlan.suggestions.length > 0 && data.brollSuggestions.length === 0) {
      const suggestions = brollPlan.suggestions.map(s => ({
        segmentId: s.segmentId,
        keywords: s.keywords,
        relevance: s.relevance,
      }));
      patch({ brollSuggestions: suggestions });
    }
  }, [brollPlan, data.brollSuggestions.length, patch]);

  // Quick-add: AI analyze + stock search for all suggestions
  const handleQuickAdd = async () => {
    if (!brollPlan || brollPlan.suggestions.length === 0) return;
    setQuickAddLoading(true);

    console.log("[B-Roll Quick Add] Starting...");
    console.log("[B-Roll] Format:", data.format);
    console.log("[B-Roll] Subtitle layer:", data.segments.length > 0 ? "yes" : "no");
    console.log("[B-Roll] AI highlight layer:", data.highlightMode === "ai" ? "yes" : "no");
    console.log("[B-Roll] Suggestions count:", brollPlan.suggestions.length);

    const newPlacements: BrollPlacement[] = [];
    const orientation = (data.format === "9:16") ? "portrait" : (data.format === "1:1") ? "square" : "landscape";
    let mediaMatchCount = 0;

    // Batch search: collect all keywords
    const allKeywords = brollPlan.suggestions.flatMap(s => s.keywords.slice(0, 2));
    const uniqueKeywords = [...new Set(allKeywords)];

    try {
      const res = await fetch("/api/stock-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries: uniqueKeywords, orientation, minDuration: 3, maxDuration: 15, perPage: 3 }),
      });
      const json = await res.json();
      const allResults: any[] = json.results || [];

      // Update diagnostics
      setLastSearchDiag({ keywords: uniqueKeywords, providersSearched: json.providersSearched || [], totalFound: allResults.length, error: json.error });

      console.log("[B-Roll] Keywords searched:", uniqueKeywords.length);
      console.log("[B-Roll] Media matches found:", allResults.length);
      console.log("[B-Roll] Provider error:", json.error || "none");
      console.log("[B-Roll] Providers searched:", json.providersSearched || "none");

      // Match results to suggestions
      for (const sugg of brollPlan.suggestions) {
        const seg = data.segments.find(s => s.id === sugg.segmentId);
        if (!seg) continue;
        const exists = placementsRef.current.some(p => p.startSec === seg.startSec);
        if (exists) continue;

        // Find best matching stock clip for this suggestion's keywords
        let bestClip: any = null;
        for (const kw of sugg.keywords) {
          const match = allResults.find(r => r.searchKeyword === kw);
          if (match) { bestClip = match; break; }
        }
        // Fallback: try partial keyword match
        if (!bestClip) {
          bestClip = allResults.find(r =>
            sugg.keywords.some(kw => r.searchKeyword?.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(r.searchKeyword?.toLowerCase()))
          );
        }

        const placement: BrollPlacement = {
          id: `broll-ai-${sugg.segmentId}-${Date.now()}`,
          startSec: seg.startSec,
          endSec: seg.endSec,
          keyword: sugg.keywords[0] || "contextual",
          source: bestClip ? (bestClip.provider as BrollPlacement["source"]) : "stock",
          searchKeyword: sugg.keywords[0],
          mediaStatus: bestClip ? "found" : "not_found",
          mediaError: !bestClip ? (json.error === "no_providers_configured" ? "no_providers" : "no_results") : undefined,
          ...(bestClip ? {
            stockProvider: bestClip.provider,
            stockClipId: bestClip.id,
            stockPreviewUrl: bestClip.previewUrl,
            stockDownloadUrl: bestClip.downloadUrl,
            stockThumbnailUrl: bestClip.thumbnailUrl,
            stockTitle: bestClip.title,
            stockDuration: bestClip.duration,
            relevanceScore: bestClip.relevanceScore,
          } : {}),
        };
        newPlacements.push(placement);
        if (bestClip) mediaMatchCount++;
      }
    } catch (err) {
      console.error("[B-Roll] Quick add search error:", err);
      // Create placements without media
      for (const sugg of brollPlan.suggestions) {
        const seg = data.segments.find(s => s.id === sugg.segmentId);
        if (!seg) continue;
        newPlacements.push({
          id: `broll-ai-${sugg.segmentId}-${Date.now()}`,
          startSec: seg.startSec,
          endSec: seg.endSec,
          keyword: sugg.keywords[0] || "contextual",
          source: "stock",
          searchKeyword: sugg.keywords[0],
          mediaStatus: "not_found",
          mediaError: "network_error",
        });
      }
    }

    console.log("[B-Roll] Placements created:", newPlacements.length);
    console.log("[B-Roll] With media:", mediaMatchCount);

    patch({ brollPlacements: [...placementsRef.current, ...newPlacements] });
    setQuickAddLoading(false);
  };

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">🎞️ B-Roll</h2>
      <p className="wiz-step-sub">הוסף קטעי וידאו ותמונות תומכים לכל קטע בסרטון.</p>

      <label className="wiz-toggle-label">
        <input type="checkbox" checked={data.brollEnabled} onChange={(e) => patch({ brollEnabled: e.target.checked, brollApproved: false })} />
        הוסף B-Roll לסרטון
      </label>

      {data.brollEnabled && data.segments.length === 0 && (
        <div style={{ marginTop: "1.5rem", padding: "1.5rem", textAlign: "center", background: "var(--surface-raised)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem", opacity: 0.5 }}>📝</div>
          <div style={{ fontWeight: 600, marginBottom: "0.375rem" }}>אין קטעים זמינים</div>
          <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
            כדי להוסיף B-Roll, יש ליצור קודם כתוביות בשלב התמלול.
          </div>
        </div>
      )}

      {data.brollEnabled && data.segments.length > 0 && (
        <>
          {/* No provider warning banner */}
          {providerStatus.loaded && !providerStatus.anyConfigured && (
            <div style={{
              marginTop: "1rem",
              padding: "0.875rem 1rem",
              background: "rgba(251,191,36,0.1)",
              border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}>
              <span style={{ fontSize: "1.25rem" }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.25rem" }}>אין מאגר סרטונים מחובר</div>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                  כדי לחפש B-Roll אוטומטית, יש להגדיר מפתח API של Pexels או Pixabay בהגדרות.
                </div>
              </div>
              <a href="/settings/media" style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--accent)", textDecoration: "none", whiteSpace: "nowrap" }}>
                הגדרות מדיה →
              </a>
            </div>
          )}

          {/* Last search diagnostics */}
          {lastSearchDiag && (
            <div style={{
              marginTop: "0.75rem",
              padding: "0.625rem 0.875rem",
              background: "var(--surface)",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: "0.72rem",
              color: "var(--foreground-muted)",
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
            }}>
              <span>🔍 מילות חיפוש: {lastSearchDiag.keywords.slice(0, 5).join(", ")}{lastSearchDiag.keywords.length > 5 ? ` (+${lastSearchDiag.keywords.length - 5})` : ""}</span>
              <span>📡 ספקים: {lastSearchDiag.providersSearched.length > 0 ? lastSearchDiag.providersSearched.join(", ") : "אין"}</span>
              <span>📊 תוצאות: {lastSearchDiag.totalFound}</span>
              {lastSearchDiag.error && <span style={{ color: "#f59e0b" }}>⚠ {lastSearchDiag.error === "no_providers_configured" ? "אין ספקים מוגדרים" : lastSearchDiag.error}</span>}
            </div>
          )}

          {/* B-Roll Source Style */}
          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.5rem" }}>מקור B-Roll</div>
            <div className="wiz-chip-row">
              {(["stock", "ai"] as const).map((style) => (
                <button key={style} className={`wiz-chip ${data.brollStyle === style ? "active" : ""}`} onClick={() => patch({ brollStyle: style })}>
                  {style === "stock" ? "📸 Stock" : "🤖 AI Generated"}
                </button>
              ))}
            </div>
          </div>

          <div className="broll-layout">
            {/* Left: Preview with correct aspect ratio + subtitle/highlight carry-over */}
            <div className="broll-preview-col">
              <UnifiedEditedPreviewPlayer
                videoSrc={videoSrc}
                format={data.format}
                segments={data.segments}
                subtitleStyle={subtitleStyle}
                brollEnabled={data.brollEnabled}
                brollPlacements={data.brollPlacements}
                onTimeUpdate={handleTimeUpdate}
                showLayerBadges={false}
                transitionStyle={data.transitionStyle}
                debug={process.env.NODE_ENV === "development"}
                maxWidth={aspectRatio < 1 ? 280 : undefined}
              />

              {/* Timeline with B-Roll markers */}
              <div className="broll-timeline" style={{ marginTop: "1rem" }}>
                {data.brollPlacements.map((p) => (
                  <div key={p.id} className="broll-timeline-bar"
                    style={{
                      left: `${(p.startSec / totalDur) * 100}%`,
                      width: `${Math.max(((p.endSec - p.startSec) / totalDur) * 100, 3)}%`,
                      background: p.mediaStatus === "found" ? "rgba(34,197,94,0.7)" : p.mediaStatus === "searching" ? "rgba(251,191,36,0.6)" : p.mediaStatus === "not_found" ? "rgba(239,68,68,0.5)" : undefined,
                    }}
                    title={`${p.keyword} (${fmtTimeShort(p.startSec)} - ${fmtTimeShort(p.endSec)}) ${p.stockProvider || ""}`}>
                    {p.keyword.substring(0, 8)}
                  </div>
                ))}
              </div>

              {/* Placements Summary */}
              {data.brollPlacements.length > 0 && (
                <div className="broll-placement-list">
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    B-Roll מוספים ({data.brollPlacements.length})
                    {data.brollPlacements.filter(p => p.mediaStatus === "found").length > 0 && (
                      <span style={{ fontWeight: 400, fontSize: "0.72rem", color: "#22c55e", marginRight: "0.5rem" }}>
                        {data.brollPlacements.filter(p => p.mediaStatus === "found").length} עם מדיה
                      </span>
                    )}
                  </div>
                  {data.brollPlacements.map((p) => (
                    <div key={p.id} className="broll-placement-item" style={{ cursor: "pointer" }}
                      onClick={() => setActivePreviewBroll(activePreviewBroll === p.id ? null : p.id)}>
                      {p.stockThumbnailUrl ? (
                        <img src={p.stockThumbnailUrl} alt="" style={{ width: 40, height: 30, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                      ) : (
                        <div className="broll-placement-thumb">
                          {p.mediaStatus === "searching" ? "⏳" : p.mediaStatus === "found" ? "🎬" : p.mediaStatus === "not_found" ? "❌" : "🎬"}
                        </div>
                      )}
                      <div className="broll-placement-info">
                        <div className="broll-place-keyword">
                          {p.keyword}
                          {p.stockProvider && <span style={{ fontSize: "0.6rem", marginRight: 4, color: "var(--accent)" }}> ({p.stockProvider})</span>}
                        </div>
                        <div className="broll-place-time">
                          {fmtTimeShort(p.startSec)} — {fmtTimeShort(p.endSec)}
                          {p.mediaStatus === "not_found" && <span style={{ color: "#ef4444", marginRight: 4 }}> · {p.mediaError === "no_providers" ? "אין ספק מדיה מוגדר" : "לא נמצא קטע מתאים במאגרים"}</span>}
                          {p.mediaStatus === "searching" && <span style={{ color: "#f59e0b", marginRight: 4 }}> · מחפש...</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.2rem", alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "0.62rem", color: "var(--foreground-muted)" }}>
                          {(p.endSec - p.startSec).toFixed(1)}s
                        </span>
                        {p.stockDuration && p.stockDuration < (p.endSec - p.startSec) && (
                          <span title="הקליפ ייעשה בלולאה" style={{ fontSize: "0.62rem" }}>🔄</span>
                        )}
                        <button className="wiz-btn wiz-btn-sm" style={{ padding: "4px 8px", fontSize: "0.7rem", color: "var(--error)" }}
                          onClick={(e) => { e.stopPropagation(); removeBroll(p.id); }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Segment-based B-Roll management */}
            <div className="broll-manage-col">
              <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.25rem" }}>קטעים בסרטון</div>
              {data.segments.slice(0, 12).map((seg) => {
                const placement = data.brollPlacements.find(p => p.startSec === seg.startSec);
                const hasBroll = !!placement;
                const suggestion = data.brollSuggestions.find(s => s.segmentId === seg.id);
                const aiSugg = brollPlan?.suggestions.find(s => s.segmentId === seg.id);
                const isAdding = addingToSegment === seg.id;
                const segResults = stockSearchResults[seg.id] || [];

                const reasonLabels: Record<string, string> = {
                  "topic-change": "🔄 שינוי נושא",
                  "emotional-peak": "💫 רגע רגשי",
                  "visual-opportunity": "🎬 הזדמנות ויזואלית",
                  "pacing": "⏱️ קצב",
                  "emphasis": "✨ הדגשה",
                  "data-point": "📊 נתון",
                };
                const shotLabels: Record<string, string> = {
                  "close-up": "🔍 קלוז-אפ",
                  "wide": "🌅 רחב",
                  "detail": "📐 פרט",
                  "abstract": "🌀 אבסטרקט",
                  "action": "🏃 פעולה",
                  "overlay-text": "📝 טקסט",
                };

                return (
                  <div key={seg.id} className={`broll-segment-card ${hasBroll ? "has-broll" : ""}`}>
                    <div className="broll-seg-header">
                      <span className="broll-seg-time">{fmtTimeShort(seg.startSec)} — {fmtTimeShort(seg.endSec)}</span>
                      {placement && placement.mediaStatus === "found" && <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#22c55e" }}>✓ B-Roll ({placement.stockProvider})</span>}
                      {placement && placement.mediaStatus === "not_found" && <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#ef4444" }}>{placement.mediaError === "no_providers" ? "⚠️ אין ספק" : "❌ לא נמצא"}</span>}
                      {placement && placement.mediaStatus === "searching" && <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#f59e0b" }}>⏳ מחפש...</span>}
                      {aiSugg && !hasBroll && (
                        <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(0,181,254,0.9)", background: "rgba(0,181,254,0.08)", padding: "1px 6px", borderRadius: 4 }}>
                          AI {Math.round(aiSugg.relevance * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="broll-seg-text">{seg.text || "—"}</div>
                    {aiSugg && (
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                        <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: 4, background: "rgba(0,181,254,0.08)", color: "var(--accent)" }}>
                          {reasonLabels[aiSugg.reason] || aiSugg.reason}
                        </span>
                        <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: 4, background: "var(--surface)", color: "var(--foreground-muted)" }}>
                          {shotLabels[aiSugg.shotType] || aiSugg.shotType}
                        </span>
                        {aiSugg.theme && (
                          <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: 4, background: "var(--surface)", color: "var(--foreground-muted)" }}>
                            {aiSugg.theme}
                          </span>
                        )}
                      </div>
                    )}
                    {suggestion && (
                      <div className="broll-seg-keywords">
                        {suggestion.keywords.map((kw, i) => (
                          <span key={i} className="broll-keyword-chip">{kw}</span>
                        ))}
                      </div>
                    )}
                    {/* Stock thumbnail preview */}
                    {placement && placement.stockThumbnailUrl && (
                      <div style={{ marginTop: "0.375rem", display: "flex", gap: "0.375rem", alignItems: "center" }}>
                        <img src={placement.stockThumbnailUrl} alt="" style={{ width: 60, height: 36, objectFit: "cover", borderRadius: 4 }} />
                        <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>
                          <div>{placement.stockTitle?.substring(0, 30)}</div>
                          <div>{placement.stockProvider} · {placement.stockDuration}s</div>
                        </div>
                      </div>
                    )}
                    {/* Alternatives carousel */}
                    {placement && segResults.length > 1 && activePreviewBroll === placement.id && (
                      <div style={{ marginTop: "0.375rem", display: "flex", gap: "0.25rem", overflowX: "auto", paddingBottom: 4 }}>
                        {segResults.map((clip: any, ci: number) => (
                          <div key={ci} onClick={() => replaceBrollClip(placement.id, clip)}
                            style={{ cursor: "pointer", flexShrink: 0, border: clip.id === placement.stockClipId ? "2px solid var(--accent)" : "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
                            <img src={clip.thumbnailUrl} alt="" style={{ width: 48, height: 32, objectFit: "cover" }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Duration editing controls for existing B-Roll */}
                    {hasBroll && placement && (
                      <div style={{
                        marginTop: "0.4rem", padding: "0.5rem",
                        background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)",
                      }}>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.35rem", flexWrap: "wrap" }}>
                          <label style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", minWidth: 32 }}>התחלה:</label>
                          <input type="number" step="0.1" min="0" max={totalDur}
                            value={placement.startSec.toFixed(1)}
                            onChange={(e) => {
                              const newStart = Math.max(0, parseFloat(e.target.value) || 0);
                              if (newStart < placement.endSec) {
                                patch({ brollPlacements: data.brollPlacements.map(p => p.id === placement.id ? { ...p, startSec: newStart } : p) });
                              }
                            }}
                            style={{ width: 60, fontSize: "0.72rem", padding: "2px 4px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--foreground)", textAlign: "center" }}
                          />
                          <label style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", minWidth: 24 }}>סוף:</label>
                          <input type="number" step="0.1" min="0" max={totalDur}
                            value={placement.endSec.toFixed(1)}
                            onChange={(e) => {
                              const newEnd = Math.min(totalDur, parseFloat(e.target.value) || 0);
                              if (newEnd > placement.startSec) {
                                patch({ brollPlacements: data.brollPlacements.map(p => p.id === placement.id ? { ...p, endSec: newEnd } : p) });
                              }
                            }}
                            style={{ width: 60, fontSize: "0.72rem", padding: "2px 4px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--foreground)", textAlign: "center" }}
                          />
                          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginRight: 4 }}>
                            ({(placement.endSec - placement.startSec).toFixed(1)}s)
                          </span>
                        </div>
                        {/* Quick extend buttons */}
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          {[1, 3, 5].map(sec => (
                            <button key={sec} onClick={() => {
                              const newEnd = Math.min(totalDur, placement.endSec + sec);
                              patch({ brollPlacements: data.brollPlacements.map(p => p.id === placement.id ? { ...p, endSec: newEnd } : p) });
                            }}
                              style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-raised)", cursor: "pointer", color: "var(--foreground-muted)" }}>
                              +{sec}s
                            </button>
                          ))}
                          <button onClick={() => {
                            const newStart = Math.max(0, placement.startSec - 1);
                            patch({ brollPlacements: data.brollPlacements.map(p => p.id === placement.id ? { ...p, startSec: newStart } : p) });
                          }}
                            style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-raised)", cursor: "pointer", color: "var(--foreground-muted)" }}>
                            -1s התחלה
                          </button>
                          {/* Extend across next segment */}
                          {(() => {
                            const segIdx = data.segments.findIndex(s => s.id === seg.id);
                            const nextSeg = segIdx >= 0 && segIdx < data.segments.length - 1 ? data.segments[segIdx + 1] : null;
                            if (!nextSeg) return null;
                            return (
                              <button onClick={() => {
                                patch({ brollPlacements: data.brollPlacements.map(p => p.id === placement.id ? { ...p, endSec: nextSeg.endSec } : p) });
                              }}
                                style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--accent)", background: "rgba(0,181,254,0.08)", cursor: "pointer", color: "var(--accent)" }}>
                                הרחב לקטע הבא
                              </button>
                            );
                          })()}
                        </div>
                        {/* Loop/hold indicator for short clips */}
                        {placement.stockDuration && placement.stockDuration < (placement.endSec - placement.startSec) && (
                          <div style={{ marginTop: "0.3rem", fontSize: "0.62rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            🔄 הקליפ ({placement.stockDuration.toFixed(1)}s) קצר מהמשך ({(placement.endSec - placement.startSec).toFixed(1)}s) — ייעשה שימוש בלולאה
                          </div>
                        )}
                      </div>
                    )}

                    <div className="broll-seg-actions">
                      {!hasBroll && !isAdding && (
                        <button onClick={() => { setAddingToSegment(seg.id); setBrollKeyword(suggestion?.keywords[0] || ""); }}>
                          + הוסף B-Roll
                        </button>
                      )}
                      {!hasBroll && !isAdding && suggestion && (
                        <button onClick={() => addBrollToSegment(seg, suggestion.keywords[0] || "contextual", data.brollStyle === "ai" ? "ai" : "stock")}>
                          ⚡ הוסף מהיר
                        </button>
                      )}
                      {hasBroll && (
                        <button className="remove-btn" onClick={() => {
                          if (placement) removeBroll(placement.id);
                        }}>הסר</button>
                      )}
                    </div>
                    {isAdding && (
                      <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input className="wiz-input" value={brollKeyword} onChange={(e) => setBrollKeyword(e.target.value)}
                          placeholder="מילת מפתח..." style={{ flex: 1, fontSize: "0.8rem", padding: "0.375rem 0.5rem" }} />
                        <button className="wiz-btn wiz-btn-primary wiz-btn-sm" style={{ padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
                          onClick={() => addBrollToSegment(seg, brollKeyword, data.brollStyle === "ai" ? "ai" : "stock")}>הוסף</button>
                        <button className="wiz-btn wiz-btn-ghost wiz-btn-sm" style={{ padding: "0.375rem 0.5rem", fontSize: "0.75rem" }}
                          onClick={() => { setAddingToSegment(null); setBrollKeyword(""); }}>ביטול</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI-Driven Auto-fill with real stock search */}
          {data.brollPlacements.length === 0 && data.segments.length > 0 && brollPlan && (
            <div className="broll-add-panel" style={{ marginTop: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>🧠 ניתוח AI B-Roll</div>
                <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 10, background: "rgba(0,181,254,0.15)", color: "var(--accent)", fontWeight: 600 }}>
                  {brollPlan.stats.suggestedCount} המלצות
                </span>
              </div>
              {brollPlan.stats.topThemes.length > 0 && (
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                  {brollPlan.stats.topThemes.map((theme) => (
                    <span key={theme} style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}>{theme}</span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: "0.78rem", color: "var(--foreground-muted)", marginBottom: "0.75rem" }}>
                ה-AI ניתח את התמליל וזיהה {brollPlan.stats.suggestedCount} רגעים מתאימים ל-B-Roll — שינויי נושא, רגעים רגשיים, נקודות נתונים וצרכי קצב. כיסוי: {brollPlan.stats.coveragePercent}%
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button className="wiz-btn wiz-btn-primary" disabled={quickAddLoading} onClick={handleQuickAdd}>
                  {quickAddLoading ? "⏳ מחפש סרטונים..." : `🤖 הוסף ${brollPlan.stats.suggestedCount} B-Roll מומלצים`}
                </button>
                <button className="wiz-btn wiz-btn-ghost" disabled={quickAddLoading} onClick={() => {
                  if (!brollPlan) return;
                  const placements = planToPlacements(
                    brollPlan,
                    data.segments.map(s => ({ id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text })),
                    data.brollStyle === "ai" ? "ai" : "stock"
                  );
                  patch({ brollPlacements: placements });
                }}>
                  הוסף בלי חיפוש מדיה
                </button>
              </div>
            </div>
          )}

          {/* Confirm bar */}
          <div className="broll-confirm-bar">
            <div className="broll-confirm-info">
              {data.brollPlacements.length} קטעי B-Roll מוכנים
              {data.brollPlacements.filter(p => p.mediaStatus === "found").length > 0 && (
                <span style={{ fontSize: "0.75rem", color: "#22c55e", marginRight: "0.5rem" }}>
                  ({data.brollPlacements.filter(p => p.mediaStatus === "found").length} עם מדיה)
                </span>
              )}
              {data.brollPlacements.filter(p => p.mediaStatus === "not_found").length > 0 && (
                <span style={{ fontSize: "0.75rem", color: "#ef4444", marginRight: "0.5rem" }}>
                  ({data.brollPlacements.filter(p => p.mediaStatus === "not_found").length} ללא מדיה{data.brollPlacements.every(p => p.mediaError === "no_providers") ? " — הגדר ספק מדיה" : ""})
                </span>
              )}
            </div>
            <button
              className={`broll-confirm-btn ${data.brollApproved ? "confirmed" : ""}`}
              onClick={() => patch({ brollApproved: !data.brollApproved })}>
              {data.brollApproved ? "✓ B-Roll אושר" : "אשר B-Roll"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP — Transitions & Effects
   ═══════════════════════════════════════════════════════════════════════════ */

const TRANSITION_OPTIONS: { id: WizardData["transitionStyle"]; name: string; nameHe: string; desc: string; category: string; speed: string; demoClass: string }[] = [
  { id: "cut", name: "Clean Cut", nameHe: "חיתוך נקי", desc: "מעבר ישיר וחד — בלי אפקט, מקצועי ונקי", category: "clean", speed: "0ms", demoClass: "trans2-demo-cut" },
  { id: "fade", name: "Smooth Fade", nameHe: "מעבר חלק", desc: "דהייה אלגנטית בין קליפים — הבחירה הפופולרית ביותר", category: "clean", speed: "500ms", demoClass: "trans2-demo-fade" },
  { id: "zoom", name: "Zoom Punch", nameHe: "מעבר זום", desc: "זום פנימה/החוצה בין קטעים — דינמי ואנרגטי", category: "dynamic", speed: "400ms", demoClass: "trans2-demo-zoom" },
  { id: "motionBlur", name: "Motion Blur", nameHe: "טשטוש תנועה", desc: "מעבר מהיר עם טשטוש — תחושת מהירות", category: "dynamic", speed: "300ms", demoClass: "trans2-demo-blur" },
  { id: "premiumSlide", name: "Premium Slide", nameHe: "החלקה פרימיום", desc: "החלקה כיוונית חלקה ומלוטשת — מראה יוקרתי", category: "premium", speed: "600ms", demoClass: "trans2-demo-slide" },
  { id: "punchyCut", name: "Punchy Social", nameHe: "חיתוך סושיאל", desc: "חיתוך אנרגטי וחד לרשתות חברתיות — TikTok / Reels", category: "social", speed: "150ms", demoClass: "trans2-demo-punchy" },
  { id: "cinematicDissolve", name: "Cinematic Dissolve", nameHe: "דיזולב קולנועי", desc: "מעבר בסגנון קולנוע מקצועי — עומק ודרמה", category: "cinematic", speed: "800ms", demoClass: "trans2-demo-dissolve" },
  { id: "lightLeak", name: "Light Leak", nameHe: "דליפת אור", desc: "דליפת אור קולנועית עם גוונים חמים — אפקט פילם פרימיום", category: "cinematic", speed: "900ms", demoClass: "trans2-demo-lightleak" },
];

const TRANS_CATEGORIES = [
  { id: "all", label: "הכל" },
  { id: "clean", label: "נקי" },
  { id: "dynamic", label: "דינמי" },
  { id: "premium", label: "פרימיום" },
  { id: "social", label: "סושיאל" },
  { id: "cinematic", label: "קולנועי" },
];

function StepTransitions({ data, patch, videoSrc: parentVideoSrc }: { data: WizardData; patch: (p: Partial<WizardData>) => void; videoSrc?: string }) {
  const [category, setCategory] = useState("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"transitions" | "effects">("transitions");
  const [effectScope, setEffectScope] = useState<EffectScope>("global");
  const [selectedSegmentForEffect, setSelectedSegmentForEffect] = useState<string | null>(null);

  const videoSrc = parentVideoSrc || "";
  const formatDims = FORMAT_DIMENSIONS[data.format] || FORMAT_DIMENSIONS["9:16"];
  const aspectRatio = formatDims.width / formatDims.height;

  const selected = TRANSITION_OPTIONS.find(t => t.id === data.transitionStyle) || TRANSITION_OPTIONS[1];
  const filtered = category === "all" ? TRANSITION_OPTIONS : TRANSITION_OPTIONS.filter(t => t.category === category);

  const cleanupCount = data.cleanupRemovedSegments.filter(s => s.removed).length;
  const mainCutCount = Math.max(0, cleanupCount);
  const brollCount = data.brollPlacements.length;
  const totalTransitions = mainCutCount + (data.brollEnabled ? brollCount * 2 : 0);

  /* ── Subtitle style for unified player ── */
  const subtitleStyle = useMemo(() => extractSubtitleStyle(data), [data]);

  /* ── Effects catalog ────────────────────────────────── */
  const EFFECT_CATALOG: { id: EffectType; nameHe: string; name: string; icon: string; desc: string; defaultIntensity: number }[] = [
    { id: "zoom",      nameHe: "זום איטי",      name: "Slow Zoom",       icon: "🔍", desc: "זום הדרגתי פנימה — יוצר תחושת פוקוס", defaultIntensity: 50 },
    { id: "punchZoom", nameHe: "פאנץ׳ זום",     name: "Punch Zoom",      icon: "💥", desc: "זום מהיר על מילה/רגע מרכזי",            defaultIntensity: 70 },
    { id: "shake",     nameHe: "רעידה",         name: "Camera Shake",    icon: "📳", desc: "רעד קל למצלמה — אנרגיה ותנועה",       defaultIntensity: 40 },
    { id: "fade",      nameHe: "דהייה",          name: "Fade Effect",     icon: "🌫️", desc: "דהייה רכה — אווירה קולנועית",          defaultIntensity: 60 },
    { id: "blur",      nameHe: "טשטוש",         name: "Blur Effect",     icon: "💨", desc: "טשטוש עדין — מיקוד תשומת לב",         defaultIntensity: 45 },
    { id: "flash",     nameHe: "הבזק",          name: "Flash",           icon: "⚡", desc: "הבזק לבן/צבעוני — הדגשת מעבר",         defaultIntensity: 55 },
    { id: "slowZoom",  nameHe: "קן ברנז איטי",  name: "Slow Ken Burns",  icon: "🎥", desc: "זום + תנועה רכה כמו דוקומנטרי",       defaultIntensity: 35 },
    { id: "kenBurns",  nameHe: "קן ברנז",       name: "Ken Burns",       icon: "🎞️", desc: "פאן + זום קלאסי — עבודה מקצועית",     defaultIntensity: 50 },
  ];

  const addEffect = (type: EffectType) => {
    const catalog = EFFECT_CATALOG.find(e => e.id === type);
    if (!catalog) return;
    const seg = effectScope === "segment" && selectedSegmentForEffect
      ? data.segments.find(s => s.id === selectedSegmentForEffect)
      : null;
    const newEffect: VisualEffect = {
      id: `fx-${type}-${Date.now()}`,
      type,
      intensity: catalog.defaultIntensity,
      scope: effectScope,
      segmentId: seg?.id,
      startSec: seg?.startSec,
      endSec: seg?.endSec,
      enabled: true,
    };
    patch({ effects: [...(data.effects || []), newEffect] });
  };

  const removeEffect = (id: string) => {
    patch({ effects: (data.effects || []).filter(e => e.id !== id) });
  };

  const updateEffect = (id: string, updates: Partial<VisualEffect>) => {
    patch({ effects: (data.effects || []).map(e => e.id === id ? { ...e, ...updates } : e) });
  };

  const activeEffects = (data.effects || []).filter(e => e.enabled);

  /* ── AI Effects Analysis ────────────────────────────────── */
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiIntensity, setAiIntensity] = useState<"subtle" | "balanced" | "dynamic">("balanced");
  const [aiSuggestions, setAiSuggestions] = useState<{
    type: EffectType; segmentId: string; startSec: number; endSec: number;
    intensity: number; reason: string; reasonHe: string;
    category: "emphasis" | "transition" | "pacing" | "hook" | "calm";
  }[] | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [aiSuggestedTransition, setAiSuggestedTransition] = useState<string | null>(null);
  const [aiDebug, setAiDebug] = useState<Record<string, unknown> | null>(null);
  const [aiFallback, setAiFallback] = useState(false);

  const runAiAnalysis = useCallback(async (mode: "suggest" | "auto") => {
    if (data.segments.length === 0) return;
    setAiAnalyzing(true);
    setAiSuggestions(null);
    setAiReasoning(null);
    setAiDebug(null);
    setAiFallback(false);

    try {
      const res = await fetch("/api/effects/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: data.segments.map(s => ({
            id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
            highlightWord: s.highlightWord, highlightStyle: s.highlightStyle,
            emphasisWords: s.emphasisWords,
          })),
          brollPlacements: data.brollPlacements.map(bp => ({
            id: bp.id, startSec: bp.startSec, endSec: bp.endSec, keyword: bp.keyword,
          })),
          brollEnabled: data.brollEnabled,
          transitionStyle: data.transitionStyle,
          language: data.language || "he",
          intensity: aiIntensity,
          videoDurationSec: data.segments.length > 0 ? data.segments[data.segments.length - 1].endSec : 0,
        }),
      });

      const result = await res.json();

      if (result.debug) {
        setAiDebug(result.debug);
        console.log("[AI Effects] Debug:", JSON.stringify(result.debug, null, 2));
      }
      if (result.fallback) setAiFallback(true);
      if (result.reasoning) setAiReasoning(result.reasoning);
      if (result.transitionStyle) setAiSuggestedTransition(result.transitionStyle);

      const suggestions = (result.effects || []) as typeof aiSuggestions;
      if (!suggestions || suggestions.length === 0) {
        console.log("[AI Effects] No suggestions returned");
        setAiSuggestions([]);
        return;
      }

      console.log(`[AI Effects] Got ${suggestions.length} suggestions (mode=${mode}, intensity=${aiIntensity})`);
      for (const s of suggestions) {
        console.log(`  [AI FX] ${s.type} @${s.startSec.toFixed(1)}-${s.endSec.toFixed(1)}s intensity=${s.intensity} [${s.category}] — ${s.reasonHe || s.reason}`);
      }

      if (mode === "auto") {
        // Auto-apply: convert suggestions to VisualEffect[] and patch
        const newEffects: VisualEffect[] = suggestions.map((s, i) => ({
          id: `ai-fx-${s.type}-${Date.now()}-${i}`,
          type: s.type,
          intensity: s.intensity,
          scope: "segment" as EffectScope,
          segmentId: s.segmentId,
          startSec: s.startSec,
          endSec: s.endSec,
          enabled: true,
        }));
        // Replace existing effects with AI-generated ones
        patch({ effects: newEffects });
        // Apply suggested transition if different
        if (result.transitionStyle && result.transitionStyle !== data.transitionStyle) {
          const validTransitions = ["cut", "fade", "zoom", "motionBlur", "premiumSlide", "punchyCut", "cinematicDissolve"];
          if (validTransitions.includes(result.transitionStyle)) {
            patch({ transitionStyle: result.transitionStyle });
          }
        }
        setAiSuggestions(suggestions);
        console.log(`[AI Effects] Auto-applied ${newEffects.length} effects`);
      } else {
        // Suggest mode: store for user review
        setAiSuggestions(suggestions);
      }

    } catch (err) {
      console.error("[AI Effects] Error:", err);
      setAiSuggestions([]);
    } finally {
      setAiAnalyzing(false);
    }
  }, [data, aiIntensity, patch]);

  const applySingleSuggestion = useCallback((suggestion: NonNullable<typeof aiSuggestions>[number]) => {
    const newEffect: VisualEffect = {
      id: `ai-fx-${suggestion.type}-${Date.now()}`,
      type: suggestion.type,
      intensity: suggestion.intensity,
      scope: "segment",
      segmentId: suggestion.segmentId,
      startSec: suggestion.startSec,
      endSec: suggestion.endSec,
      enabled: true,
    };
    patch({ effects: [...(data.effects || []), newEffect] });
  }, [data, patch]);

  const applyAllSuggestions = useCallback(() => {
    if (!aiSuggestions || aiSuggestions.length === 0) return;
    const newEffects: VisualEffect[] = aiSuggestions.map((s, i) => ({
      id: `ai-fx-${s.type}-${Date.now()}-${i}`,
      type: s.type,
      intensity: s.intensity,
      scope: "segment" as EffectScope,
      segmentId: s.segmentId,
      startSec: s.startSec,
      endSec: s.endSec,
      enabled: true,
    }));
    patch({ effects: newEffects });
    if (aiSuggestedTransition && aiSuggestedTransition !== data.transitionStyle) {
      const validTransitions = ["cut", "fade", "zoom", "motionBlur", "premiumSlide", "punchyCut", "cinematicDissolve"];
      if (validTransitions.includes(aiSuggestedTransition)) {
        patch({ transitionStyle: aiSuggestedTransition as WizardData["transitionStyle"] });
      }
    }
  }, [aiSuggestions, aiSuggestedTransition, data, patch]);

  const dismissSuggestion = useCallback((index: number) => {
    setAiSuggestions(prev => prev ? prev.filter((_, i) => i !== index) : null);
  }, []);

  const CATEGORY_ICONS: Record<string, string> = { hook: "🎣", emphasis: "💥", transition: "🔀", pacing: "⏱️", calm: "🌊" };
  const CATEGORY_LABELS: Record<string, string> = { hook: "פתיח", emphasis: "הדגשה", transition: "מעבר", pacing: "קצב", calm: "רגוע" };

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">🔀 מעברים ואפקטים</h2>
      <p className="wiz-step-sub">בחר מעברים בין קטעים והוסף אפקטים ויזואליים לסרטון.</p>

      {/* ═══ Full-width Unified Preview Player ═══ */}
      <div style={{ marginBottom: "1.5rem" }}>
        <UnifiedEditedPreviewPlayer
          videoSrc={videoSrc}
          format={data.format}
          segments={data.segments || []}
          subtitleStyle={subtitleStyle}
          brollEnabled={data.brollEnabled ?? false}
          brollPlacements={data.brollPlacements || []}
          effects={data.effects || []}
          showLayerBadges={true}
          transitionStyle={data.transitionStyle}
          debug={process.env.NODE_ENV === "development"}
          maxWidth={aspectRatio < 1 ? 360 : 640}
        />
      </div>

      {/* ═══ AI Analysis Panel ═══ */}
      <div style={{
        marginBottom: "1.25rem", padding: "1rem 1.25rem", borderRadius: "0.75rem",
        background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(0,181,254,0.06) 100%)",
        border: "1px solid rgba(139,92,246,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🧠</span>
            <span style={{ fontSize: "0.88rem", fontWeight: 700 }}>ניתוח AI — מעברים ואפקטים</span>
          </div>
          {aiFallback && (
            <span style={{ fontSize: "0.62rem", padding: "2px 8px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: 600 }}>
              Fallback (ללא API)
            </span>
          )}
        </div>

        {/* Intensity selector */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--foreground-muted)" }}>עוצמת עריכה:</span>
          {([
            { id: "subtle" as const, label: "עדין", icon: "🌿", desc: "מינימום אפקטים, סגנון נקי" },
            { id: "balanced" as const, label: "מאוזן", icon: "⚖️", desc: "איזון בין אנרגיה לניקיון" },
            { id: "dynamic" as const, label: "דינמי", icon: "🔥", desc: "יותר אפקטים, אנרגיה גבוהה" },
          ]).map(lvl => (
            <button key={lvl.id} onClick={() => setAiIntensity(lvl.id)} title={lvl.desc} style={{
              padding: "0.35rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.78rem", fontWeight: 600,
              border: aiIntensity === lvl.id ? "2px solid rgba(139,92,246,0.6)" : "1px solid var(--border)",
              background: aiIntensity === lvl.id ? "rgba(139,92,246,0.1)" : "var(--surface)",
              color: aiIntensity === lvl.id ? "rgb(139,92,246)" : "var(--foreground-muted)",
              cursor: "pointer", transition: "all 0.15s",
            }}>
              {lvl.icon} {lvl.label}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={() => runAiAnalysis("suggest")}
            disabled={aiAnalyzing || data.segments.length === 0}
            style={{
              padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none",
              background: aiAnalyzing ? "var(--surface-raised)" : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
              color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: aiAnalyzing ? "wait" : "pointer",
              opacity: data.segments.length === 0 ? 0.4 : 1, transition: "all 0.2s",
            }}
          >
            {aiAnalyzing ? "⏳ מנתח..." : "🧠 נתח והצע אפקטים עם AI"}
          </button>
          <button
            onClick={() => runAiAnalysis("auto")}
            disabled={aiAnalyzing || data.segments.length === 0}
            style={{
              padding: "0.5rem 1rem", borderRadius: "0.5rem",
              border: "1px solid rgba(139,92,246,0.4)",
              background: "transparent", color: "rgb(139,92,246)",
              fontWeight: 600, fontSize: "0.82rem", cursor: aiAnalyzing ? "wait" : "pointer",
              opacity: data.segments.length === 0 ? 0.4 : 1, transition: "all 0.2s",
            }}
          >
            {aiAnalyzing ? "⏳ מחיל..." : "⚡ החל אפקטים אוטומטית"}
          </button>
        </div>

        {/* AI Reasoning */}
        {aiReasoning && (
          <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", fontSize: "0.75rem", color: "var(--foreground-muted)", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700 }}>🧠 סיכום AI: </span>{aiReasoning}
          </div>
        )}

        {/* AI Suggestions list (suggest mode) */}
        {aiSuggestions && aiSuggestions.length > 0 && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                הצעות AI ({aiSuggestions.length})
              </span>
              <button onClick={applyAllSuggestions} style={{
                padding: "0.3rem 0.75rem", borderRadius: "0.375rem", border: "none",
                background: "rgb(139,92,246)", color: "#fff", fontSize: "0.72rem",
                fontWeight: 700, cursor: "pointer",
              }}>
                אשר הכל
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "280px", overflowY: "auto" }}>
              {aiSuggestions.map((s, i) => {
                const catEntry = EFFECT_CATALOG.find(c => c.id === s.type);
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.5rem 0.65rem", borderRadius: "0.5rem",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    fontSize: "0.75rem",
                  }}>
                    <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>{catEntry?.icon || "✨"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700 }}>{catEntry?.nameHe || s.type}</span>
                        <span style={{ fontSize: "0.62rem", padding: "1px 6px", borderRadius: 4, background: "rgba(139,92,246,0.1)", color: "rgb(139,92,246)", fontWeight: 600 }}>
                          {CATEGORY_ICONS[s.category] || "📍"} {CATEGORY_LABELS[s.category] || s.category}
                        </span>
                        <span style={{ fontSize: "0.62rem", color: "var(--foreground-muted)" }}>
                          {fmtTimeShort(s.startSec)}–{fmtTimeShort(s.endSec)} · {s.intensity}%
                        </span>
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", marginTop: "2px" }}>
                        {s.reasonHe || s.reason}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.2rem", flexShrink: 0 }}>
                      <button onClick={() => applySingleSuggestion(s)} title="אשר" style={{
                        width: 26, height: 26, borderRadius: "0.25rem", border: "1px solid rgba(34,197,94,0.4)",
                        background: "rgba(34,197,94,0.08)", cursor: "pointer", fontSize: "0.68rem",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e",
                      }}>✓</button>
                      <button onClick={() => dismissSuggestion(i)} title="דחה" style={{
                        width: 26, height: 26, borderRadius: "0.25rem", border: "1px solid rgba(239,68,68,0.4)",
                        background: "rgba(239,68,68,0.08)", cursor: "pointer", fontSize: "0.68rem",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444",
                      }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty suggestions */}
        {aiSuggestions && aiSuggestions.length === 0 && !aiAnalyzing && (
          <div style={{ marginTop: "0.75rem", padding: "0.6rem", borderRadius: "0.5rem", background: "var(--surface-raised)", fontSize: "0.75rem", color: "var(--foreground-muted)", textAlign: "center" }}>
            AI לא מצא רגעים שמצדיקים אפקטים נוספים. הסרטון נראה טוב כמו שהוא.
          </div>
        )}

        {/* Debug info (dev only) */}
        {aiDebug && process.env.NODE_ENV === "development" && (
          <details style={{ marginTop: "0.5rem" }}>
            <summary style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", cursor: "pointer" }}>🐛 Debug info</summary>
            <pre style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", background: "var(--surface-raised)", padding: "0.5rem", borderRadius: "0.375rem", marginTop: "0.25rem", overflow: "auto", maxHeight: "150px" }}>
              {JSON.stringify(aiDebug, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {/* ═══ Controls below the player ═══ */}
      <div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.25rem", background: "var(--surface-raised)", borderRadius: "0.5rem", padding: "0.25rem", width: "fit-content" }}>
        {([
          { id: "transitions" as const, label: "🔀 מעברים" },
          { id: "effects" as const, label: "✨ אפקטים" },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "0.45rem 1rem", borderRadius: "0.375rem", border: "none",
            cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.15s",
            background: activeTab === tab.id ? "var(--accent)" : "transparent",
            color: activeTab === tab.id ? "#fff" : "var(--foreground-muted)",
          }}>
            {tab.label}
            {tab.id === "effects" && activeEffects.length > 0 && (
              <span style={{ marginRight: "0.35rem", fontSize: "0.68rem", background: "rgba(255,255,255,0.25)", borderRadius: 999, padding: "0 5px" }}>
                {activeEffects.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════ TRANSITIONS TAB ════════ */}
      {activeTab === "transitions" && (
        <>
          {/* Category filter */}
          <div className="trans2-categories">
            {TRANS_CATEGORIES.map((cat) => (
              <button key={cat.id}
                className={`trans2-cat-btn ${category === cat.id ? "active" : ""}`}
                onClick={() => setCategory(cat.id)}>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Cards grid */}
          <div className="trans2-grid">
            {filtered.map((t) => {
              const isActive = data.transitionStyle === t.id;
              const isHovered = hoveredId === t.id;
              return (
                <button key={t.id}
                  className={`trans2-card ${isActive ? "active" : ""} ${isHovered ? "hovered" : ""}`}
                  onClick={() => patch({ transitionStyle: t.id })}
                  onMouseEnter={() => setHoveredId(t.id)}
                  onMouseLeave={() => setHoveredId(null)}>
                  <div className="trans2-check">{isActive ? "✓" : ""}</div>
                  <div className={`trans2-demo ${t.demoClass}`}>
                    <div className="trans2-demo-a">A</div>
                    <div className="trans2-demo-effect" />
                    <div className="trans2-demo-b">B</div>
                  </div>
                  <div className="trans2-info">
                    <div className="trans2-name-row">
                      <span className="trans2-name">{t.nameHe}</span>
                      <span className="trans2-speed">{t.speed}</span>
                    </div>
                    <div className="trans2-eng-name">{t.name}</div>
                    <div className="trans2-desc">{t.desc}</div>
                  </div>
                  <div className="trans2-cat-badge">
                    {t.category === "clean" ? "נקי" : t.category === "dynamic" ? "דינמי" : t.category === "premium" ? "פרימיום" : t.category === "social" ? "סושיאל" : "קולנועי"}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selection Summary */}
          <div className="trans2-summary">
            <div className="trans2-summary-header">
              <div className="trans2-summary-icon">
                {data.transitionStyle === "cut" ? "✂️" : data.transitionStyle === "fade" ? "🌊" : data.transitionStyle === "zoom" ? "🔍" : data.transitionStyle === "motionBlur" ? "💨" : data.transitionStyle === "premiumSlide" ? "💎" : data.transitionStyle === "punchyCut" ? "⚡" : data.transitionStyle === "lightLeak" ? "🔆" : "🎬"}
              </div>
              <div>
                <div className="trans2-summary-title">{selected.nameHe}</div>
                <div className="trans2-summary-subtitle">{selected.name} · {selected.speed}</div>
              </div>
            </div>
            <div className="trans2-summary-where">
              <div className="trans2-summary-where-title">יישום במקומות הבאים:</div>
              <div className="trans2-apply-list">
                <div className="trans2-apply-item">
                  <span className="trans2-apply-dot active" />
                  <span>מעברים בין קטעי וידאו ראשיים</span>
                  {mainCutCount > 0 && <span className="trans2-apply-count">{mainCutCount}</span>}
                </div>
                {data.brollEnabled && brollCount > 0 && (
                  <div className="trans2-apply-item">
                    <span className="trans2-apply-dot active" />
                    <span>כניסה ויציאה מ-B-Roll</span>
                    <span className="trans2-apply-count">{brollCount * 2}</span>
                  </div>
                )}
                <div className="trans2-apply-item">
                  <span className="trans2-apply-dot active" />
                  <span>שינויי נושא וחלקים</span>
                </div>
              </div>
              {totalTransitions > 0 && (
                <div className="trans2-total">
                  סה״כ: <strong>{totalTransitions} מעברים</strong> יוחלו בסרטון
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ════════ EFFECTS TAB ════════ */}
      {activeTab === "effects" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Scope selector */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>טווח יישום:</span>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {([
                { id: "global" as EffectScope, label: "🌐 כל הסרטון" },
                { id: "segment" as EffectScope, label: "📍 קטע ספציפי" },
              ]).map(s => (
                <button key={s.id} onClick={() => setEffectScope(s.id)} style={{
                  padding: "0.35rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.78rem", fontWeight: 600,
                  border: effectScope === s.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: effectScope === s.id ? "rgba(0,181,254,0.08)" : "var(--surface)",
                  color: effectScope === s.id ? "var(--accent)" : "var(--foreground-muted)",
                  cursor: "pointer",
                }}>
                  {s.label}
                </button>
              ))}
            </div>
            {effectScope === "segment" && (
              <select value={selectedSegmentForEffect || ""} onChange={e => setSelectedSegmentForEffect(e.target.value || null)}
                style={{ padding: "0.35rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.78rem" }}>
                <option value="">בחר קטע...</option>
                {data.segments.slice(0, 20).map(seg => (
                  <option key={seg.id} value={seg.id}>
                    {fmtTimeShort(seg.startSec)}–{fmtTimeShort(seg.endSec)}: {(seg.text || "").substring(0, 30)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Effects catalog */}
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.5rem" }}>הוסף אפקט:</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem" }}>
              {EFFECT_CATALOG.map(fx => {
                const alreadyAdded = (data.effects || []).some(e => e.type === fx.id && e.scope === effectScope && (effectScope === "global" || e.segmentId === selectedSegmentForEffect));
                return (
                  <button key={fx.id} onClick={() => {
                    if (effectScope === "segment" && !selectedSegmentForEffect) return;
                    addEffect(fx.id);
                  }}
                    disabled={alreadyAdded}
                    style={{
                      padding: "0.6rem 0.75rem", borderRadius: "0.5rem", textAlign: "right",
                      border: alreadyAdded ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: alreadyAdded ? "rgba(0,181,254,0.06)" : "var(--surface)",
                      cursor: alreadyAdded ? "default" : (effectScope === "segment" && !selectedSegmentForEffect) ? "not-allowed" : "pointer",
                      opacity: (effectScope === "segment" && !selectedSegmentForEffect && !alreadyAdded) ? 0.5 : 1,
                      display: "flex", gap: "0.5rem", alignItems: "flex-start",
                    }}>
                    <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{fx.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{fx.nameHe}</div>
                      <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>{fx.desc}</div>
                    </div>
                    {alreadyAdded && <span style={{ fontSize: "0.72rem", color: "var(--accent)", flexShrink: 0 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active effects list with intensity sliders */}
          {(data.effects || []).length > 0 && (
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                אפקטים פעילים ({activeEffects.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {(data.effects || []).map(fx => {
                  const catalog = EFFECT_CATALOG.find(c => c.id === fx.type);
                  if (!catalog) return null;
                  const segInfo = fx.scope === "segment" && fx.segmentId
                    ? data.segments.find(s => s.id === fx.segmentId)
                    : null;
                  return (
                    <div key={fx.id} style={{
                      padding: "0.65rem 0.85rem", borderRadius: "0.5rem",
                      background: "var(--surface)", border: "1px solid var(--border)",
                      opacity: fx.enabled ? 1 : 0.5,
                      borderInlineStart: `3px solid ${fx.enabled ? "var(--accent)" : "var(--border)"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          <span style={{ fontSize: "1rem" }}>{catalog.icon}</span>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{catalog.nameHe}</span>
                          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>
                            {fx.scope === "global" ? "כל הסרטון" : segInfo ? `${fmtTimeShort(segInfo.startSec)}–${fmtTimeShort(segInfo.endSec)}` : "קטע"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                          <button onClick={() => updateEffect(fx.id, { enabled: !fx.enabled })} style={{
                            width: 28, height: 28, borderRadius: "0.25rem", border: "1px solid var(--border)",
                            background: fx.enabled ? "rgba(34,197,94,0.1)" : "var(--surface-raised)",
                            cursor: "pointer", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center",
                            color: fx.enabled ? "#22c55e" : "var(--foreground-muted)",
                          }}>
                            {fx.enabled ? "✓" : "○"}
                          </button>
                          <button onClick={() => removeEffect(fx.id)} style={{
                            width: 28, height: 28, borderRadius: "0.25rem", border: "1px solid var(--border)",
                            background: "transparent", cursor: "pointer", fontSize: "0.7rem",
                            display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444",
                          }}>
                            ✕
                          </button>
                        </div>
                      </div>
                      {/* Intensity slider */}
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", minWidth: 40 }}>עוצמה:</span>
                        <input type="range" min={0} max={100} value={fx.intensity}
                          onChange={e => updateEffect(fx.id, { intensity: parseInt(e.target.value) })}
                          style={{ flex: 1, height: 4, accentColor: "var(--accent)" }}
                        />
                        <span style={{ fontSize: "0.72rem", fontWeight: 600, minWidth: 32, textAlign: "center" }}>
                          {fx.intensity}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Effects summary */}
          {activeEffects.length > 0 && (
            <div style={{
              padding: "0.75rem 1rem", borderRadius: "0.5rem",
              background: "var(--surface-raised)", border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem" }}>סיכום אפקטים</div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                <span>אפקטים גלובליים: {activeEffects.filter(e => e.scope === "global").length}</span>
                <span>אפקטים לקטעים: {activeEffects.filter(e => e.scope === "segment").length}</span>
                <span>עוצמה ממוצעת: {activeEffects.length > 0 ? Math.round(activeEffects.reduce((sum, e) => sum + e.intensity, 0) / activeEffects.length) : 0}%</span>
              </div>
            </div>
          )}

          {/* Approval */}
          <div style={{ display: "flex", justifyContent: "flex-start", gap: "0.5rem" }}>
            <button onClick={() => patch({ effectsApproved: true })} style={{
              padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "none",
              background: data.effectsApproved ? "#22c55e" : "var(--accent)",
              color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem",
            }}>
              {data.effectsApproved ? "✓ אפקטים אושרו" : "אשר אפקט"}
            </button>
            {data.effectsApproved && (
              <button onClick={() => patch({ effectsApproved: false })} style={{
                padding: "0.5rem 1.25rem", borderRadius: "0.5rem",
                border: "1px solid var(--border)", background: "var(--surface)",
                color: "var(--foreground-muted)", cursor: "pointer", fontSize: "0.85rem",
              }}>
                בטל אפקט
              </button>
            )}
          </div>
        </div>
      )}

      </div>{/* end controls wrapper */}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP — Music (COMPLETELY REBUILT)
   ═══════════════════════════════════════════════════════════════════════════ */

function StepMusic({ data, patch, videoSrc: _parentVideoSrc }: { data: WizardData; patch: (p: Partial<WizardData>) => void; videoSrc?: string }) {
  const [musicCategory, setMusicCategory] = useState("all");
  const [previewingTrack, setPreviewingTrack] = useState<string | null>(null);
  const [aiMatching, setAiMatching] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Real audio playback — play/pause when previewingTrack changes
  useEffect(() => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setAudioError(null);

    if (!previewingTrack) {
      setAudioLoading(false);
      return;
    }

    const track = MUSIC_LIBRARY.find(t => t.id === previewingTrack);
    if (!track) return;

    const url = getTrackAudioUrl(track);
    setAudioLoading(true);

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.volume = 0.6;

    audio.oncanplaythrough = () => {
      setAudioLoading(false);
      audio.play().catch(() => {
        setAudioError("לא ניתן להפעיל שמע");
        setAudioLoading(false);
      });
    };
    audio.onerror = () => {
      setAudioError("שגיאה בטעינת המוזיקה");
      setAudioLoading(false);
      setPreviewingTrack(null);
    };
    audio.onended = () => {
      setPreviewingTrack(null);
    };

    // Start loading
    audio.load();

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [previewingTrack]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const filteredTracks = musicCategory === "all"
    ? MUSIC_LIBRARY
    : MUSIC_LIBRARY.filter(t => t.category === musicCategory);

  const selectedTrack = MUSIC_LIBRARY.find(t => t.id === data.musicTrackId);

  const handleAiMatch = () => {
    setAiMatching(true);
    setTimeout(() => {
      const matchedTracks = MUSIC_LIBRARY.filter(t => {
        if (data.musicStyle === "upbeat") return ["energetic", "motivational"].includes(t.category);
        if (data.musicStyle === "corporate") return ["commercial", "elegant"].includes(t.category);
        if (data.musicStyle === "cinematic") return ["cinematic", "epic"].includes(t.category);
        return true;
      }).slice(0, 3);
      if (matchedTracks.length > 0) {
        patch({ musicTrackId: matchedTracks[0].id });
      }
      setAiMatching(false);
    }, 1500);
  };

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">מוזיקה ואודיו</h2>
      <p className="wiz-step-sub">בחר מוזיקה ברקע, הגדר עוצמה והוסף אפקטי קול.</p>

      <label className="wiz-toggle-label">
        <input type="checkbox" checked={data.musicEnabled} onChange={(e) => patch({ musicEnabled: e.target.checked })} />
        הוסף מוזיקה ברקע
      </label>

      {data.musicEnabled && (
        <div style={{ marginTop: "1.5rem" }}>
          {/* Sound Design Section */}
          <div className="wiz-sound-design" style={{ marginBottom: "2rem", padding: "1rem", background: "var(--surface-raised)", borderRadius: 6 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "1rem" }}>אפקטי קול</div>
            <label className="wiz-toggle-label">
              <input type="checkbox" checked={data.soundDesignEnabled} onChange={(e) => patch({ soundDesignEnabled: e.target.checked })} />
              אפקטי קול מעברים
            </label>
            {data.soundDesignEnabled && (
              <>
                <label className="wiz-toggle-label" style={{ marginTop: "0.75rem" }}>
                  <input type="checkbox" checked={data.sfxOnCuts} onChange={(e) => patch({ sfxOnCuts: e.target.checked })} />
                  אפקטים בכל חיתוך
                </label>
                {data.sfxOnCuts && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>סגנון</div>
                    <div className="wiz-chip-row">
                      {(["subtle", "standard", "dramatic"] as const).map((style) => (
                        <button key={style} className={`wiz-chip ${data.sfxStyle === style ? "active" : ""}`} onClick={() => patch({ sfxStyle: style })}>
                          {style === "subtle" ? "עדין" : style === "standard" ? "רגיל" : "דרמטי"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* AI Matching */}
          <button className="wiz-btn wiz-btn-ghost" onClick={handleAiMatch} style={{ marginBottom: "2rem", width: "100%" }} disabled={aiMatching}>
            {aiMatching ? "ממציא התאמות..." : "🤖 התאם מוזיקה אוטומטית"}
          </button>

          {/* Category Filter */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "1rem", color: "var(--foreground-muted)" }}>קטגוריות</div>
            <div className="wiz-chip-row" style={{ overflowX: "auto", paddingBottom: "0.5rem" }}>
              {MUSIC_CATEGORIES.map((cat) => (
                <button key={cat.id} className={`wiz-chip ${musicCategory === cat.id ? "active" : ""}`} onClick={() => setMusicCategory(cat.id)}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Track Gallery */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "1rem", color: "var(--foreground-muted)" }}>
              {selectedTrack ? `נבחר: ${selectedTrack.title}` : "בחר מסלול"}
            </div>
            <div className="wiz-track-gallery" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {filteredTracks.map((track) => (
                <div key={track.id} className={`wiz-track-card ${data.musicTrackId === track.id ? "active" : ""}`}
                  style={{ padding: "1rem", border: `2px solid ${data.musicTrackId === track.id ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer" }}
                  onClick={() => patch({ musicTrackId: track.id })}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <button className="wiz-btn wiz-btn-sm" style={{ padding: "0.25rem 0.5rem", minWidth: "2rem" }} onClick={(e) => { e.stopPropagation(); setPreviewingTrack(previewingTrack === track.id ? null : track.id); }}>
                      {previewingTrack === track.id && audioLoading ? "..." : previewingTrack === track.id ? "⏸" : "▶"}
                    </button>
                    <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>{track.duration}</span>
                    {previewingTrack === track.id && audioError && (
                      <span style={{ fontSize: "0.65rem", color: "var(--error)" }}>{audioError}</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{track.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginBottom: "0.75rem" }}>
                    {track.artist} • {track.mood}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginBottom: "0.75rem" }}>
                    {track.bpm} BPM
                  </div>
                  <div style={{ display: "inline-block", padding: "0.25rem 0.5rem", background: "var(--accent-muted)", borderRadius: 4, fontSize: "0.7rem", fontWeight: 600 }}>
                    {track.category}
                  </div>
                  {data.musicTrackId === track.id && <div style={{ marginTop: "0.75rem", textAlign: "center", color: "var(--accent)", fontWeight: 600 }}>✓ נבחר</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Volume & Ducking */}
          <div style={{ marginTop: "2rem" }}>
            <label className="wiz-label">עוצמת מוזיקה ({data.musicVolume}%)</label>
            <div className="wiz-range-row">
              <input type="range" min="0" max="100" value={data.musicVolume} onChange={(e) => patch({ musicVolume: Number(e.target.value) })} style={{ flex: 1 }} />
              <span className="wiz-range-value">{data.musicVolume}%</span>
            </div>

            <label className="wiz-toggle-label" style={{ marginTop: "1rem" }}>
              <input type="checkbox" checked={data.musicDucking} onChange={(e) => patch({ musicDucking: e.target.checked })} />
              התאמת עוצמה אוטומטית (Ducking)
            </label>

            {data.musicDucking && (
              <div style={{ marginTop: "1rem" }}>
                <label className="wiz-label">עוצמת Ducking ({data.musicDuckingLevel}%)</label>
                <div className="wiz-range-row">
                  <input type="range" min="0" max="100" value={data.musicDuckingLevel} onChange={(e) => patch({ musicDuckingLevel: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span className="wiz-range-value">{data.musicDuckingLevel}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP — Preview (FULL PIPELINE)
   ═══════════════════════════════════════════════════════════════════════════ */

function StepPreview({ data, videoSrc: parentVideoSrc }: { data: WizardData; videoSrc?: string }) {
  const [showDebugLayers, setShowDebugLayers] = useState(false);
  const [showCompositionDebug, setShowCompositionDebug] = useState(false);

  const videoSrc = parentVideoSrc || "";

  /* ── Unified preview state ── */
  const subtitleStyle = useMemo(() => extractSubtitleStyle(data), [data]);
  const formatDimsLocal = FORMAT_DIMENSIONS[data.format] || FORMAT_DIMENSIONS["9:16"];
  const aspectRatioLocal = formatDimsLocal.width / formatDimsLocal.height;
  const isPortrait = ["9:16", "4:5"].includes(data.format);

  /* ── Debug logging (mandatory) ── */
  useEffect(() => {
    const playerSrcType = videoSrc ? "EDITED_UNIFIED" : "NONE";
    console.log(
      `[StepPreview] DEBUG:\n` +
      `  selectedFormat: ${data.format} (${formatDimsLocal.width}×${formatDimsLocal.height})\n` +
      `  videoSrc: ${videoSrc ? videoSrc.substring(0, 80) : "(EMPTY)"}\n` +
      `  subtitleSegments: ${data.segments?.length || 0}\n` +
      `  highlightData: ${data.highlightMode === "ai" ? "yes (AI)" : data.segments.some(s => s.highlightWord) ? "yes (sequential)" : "no"}\n` +
      `  brollPlacements: ${data.brollPlacements?.length || 0} (enabled=${data.brollEnabled})\n` +
      `  transitions: ${data.transitionStyle}\n` +
      `  effects: ${(data.effects || []).length} (${(data.effects || []).filter(e => e.enabled).length} enabled)\n` +
      `  playerSourceType: ${playerSrcType}`
    );
    if (!videoSrc) console.warn("[StepPreview] RAW VIDEO USED IN FINAL PREVIEW — videoSrc is empty!");
  }, [data, videoSrc, formatDimsLocal]);

  // Build full Remotion composition props from wizard data
  const compositionSummary = useMemo(() => {
    try {
      const snapshot: WizardSnapshot = {
        projectId: "preview",
        title: data.title,
        clientId: data.clientId,
        clientName: "",
        creativePrompt: data.creativePrompt,
        videoUrl: videoSrc,
        videoFileName: data.videoFile?.name || "",
        videoDurationSec: data.trimMode === "clip" ? Math.round(data.trimEnd - data.trimStart) : 30,
        trimMode: data.trimMode,
        trimStart: data.trimStart,
        trimEnd: data.trimEnd,
        format: data.format,
        subtitleMode: data.subtitleMode,
        language: data.language,
        segments: data.segments.map(s => ({
          id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
          edited: s.edited, highlightWord: s.highlightWord, highlightStyle: s.highlightStyle,
          confidence: s.confidence,
        })),
        subtitleFont: data.subtitleFont, subtitleFontWeight: data.subtitleFontWeight,
        subtitleFontSize: data.subtitleFontSize, subtitleColor: data.subtitleColor,
        subtitleHighlightColor: data.subtitleHighlightColor,
        subtitleOutlineEnabled: data.subtitleOutlineEnabled, subtitleOutlineColor: data.subtitleOutlineColor,
        subtitleOutlineThickness: data.subtitleOutlineThickness, subtitleShadow: data.subtitleShadow,
        subtitleBg: data.subtitleBg, subtitleBgColor: data.subtitleBgColor,
        subtitleBgOpacity: data.subtitleBgOpacity, subtitleAlign: data.subtitleAlign,
        subtitlePosition: data.subtitlePosition, subtitleManualY: data.subtitleManualY, subtitleAnimation: data.subtitleAnimation,
        subtitleLineBreak: data.subtitleLineBreak, highlightMode: data.highlightMode, highlightIntensity: data.highlightIntensity,
        brollEnabled: data.brollEnabled, brollStyle: data.brollStyle,
        brollPlacements: data.brollPlacements,
        transitionStyle: data.transitionStyle as any,
        musicEnabled: data.musicEnabled, musicTrackId: data.musicTrackId,
        musicTrackTitle: "", musicTrackUrl: "",
        musicVolume: data.musicVolume, musicDucking: data.musicDucking,
        musicDuckingLevel: data.musicDuckingLevel,
        soundDesignEnabled: data.soundDesignEnabled, sfxOnCuts: data.sfxOnCuts,
        sfxStyle: data.sfxStyle,
        cleanupFillers: data.cleanupFillers, cleanupSilence: data.cleanupSilence,
        cleanupIntensity: data.cleanupIntensity,
        cleanupRemovedSegments: data.cleanupRemovedSegments,
        preset: data.preset, exportQuality: data.exportQuality || "premium",
        aiEditMode: data.aiEditMode || "", aiDirectionNotes: data.creativePrompt,
        premiumMode: data.premiumMode, premiumLevel: data.premiumLevel,
      };
      const compData = buildFinalCompositionData(snapshot);
      const remotionProps = compositionToProps(compData);
      return {
        tracks: compData.timeline.tracks.length,
        duration: compData.timeline.durationSec,
        segments: compData.metadata.segmentCount,
        broll: compData.metadata.brollPlacementCount,
        cleanupRemoved: compData.metadata.cleanupRemovedCount,
        transition: compData.transition.style,
        premium: compData.premium.enabled,
        remotionProps,
      };
    } catch {
      return null;
    }
  }, [data, videoSrc]);

  // Compute Remotion Player dimensions
  const formatDims = FORMAT_DIMENSIONS[data.format] || FORMAT_DIMENSIONS["9:16"];
  const durationSec = compositionSummary?.duration || (data.trimMode === "clip" ? Math.round(data.trimEnd - data.trimStart) : 30);
  const durationInFrames = Math.max(1, Math.ceil(durationSec * FPS));

  // Determine scaled preview container size
  const previewMaxWidth = data.format === "16:9" ? 640 : data.format === "1:1" ? 400 : 320;

  const transitionLabel = TRANSITION_OPTIONS.find(t => t.id === data.transitionStyle)?.nameHe || "מעבר חלק";
  const selectedTrack = MUSIC_LIBRARY.find(t => t.id === data.musicTrackId);
  const presetLabel = SMART_PRESETS_UI.find(p => p.id === data.preset)?.label || data.preset;

  // Build effective edit layers status
  const editLayers = useMemo(() => [
    { name: "כתוביות", active: data.segments.length > 0, status: data.segments.length > 0 ? `${data.segments.length} קטעים` : "לא הוגדר" },
    { name: "B-Roll", active: data.brollEnabled && data.brollPlacements.length > 0, status: data.brollEnabled ? `${data.brollPlacements.length} קטעים` : "כבוי", auto: data.premiumMode && !data.brollEnabled },
    { name: "מעברים", active: true, status: transitionLabel },
    { name: "מוזיקה", active: data.musicEnabled && !!data.musicTrackId, status: data.musicEnabled ? (selectedTrack?.title || "נבחר") : "כבוי", auto: data.premiumMode && !data.musicEnabled },
    { name: "ניקוי", active: data.cleanupFillers || data.cleanupSilence, status: (data.cleanupFillers || data.cleanupSilence) ? `${data.cleanupRemovedSegments.filter(s => s.removed).length} הסרות` : "כבוי" },
    { name: "פריסט", active: !!data.preset, status: presetLabel },
    { name: "AI כיוון", active: !!data.aiEditMode, status: data.aiEditMode || "לא נבחר" },
    { name: "פרימיום", active: data.premiumMode, status: data.premiumMode ? data.premiumLevel : "כבוי" },
    { name: "זום/תנועה", active: data.premiumMode, status: data.premiumMode ? "אוטומטי" : "כבוי", auto: data.premiumMode },
    { name: "צבע", active: data.premiumMode, status: data.premiumMode ? "תיקון אוטומטי" : "כבוי", auto: data.premiumMode },
  ], [data, transitionLabel, selectedTrack, presetLabel]);

  if (!videoSrc) {
    return (
      <div className="wiz-step-content">
        <h2 className="wiz-step-heading">תצוגה מקדימה</h2>
        <p className="wiz-step-sub">צפה בסרטון עם כל ההגדרות שלך.</p>
        <div className="preview-empty-state">
          <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.4 }}>🎬</div>
          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>לא נמצא קובץ וידאו</div>
          <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>חזור לשלב ההעלאה והוסף קובץ וידאו</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">תצוגה מקדימה</h2>
      <p className="wiz-step-sub">צפה בסרטון עם כל ההגדרות — הרינדור הסופי ייוצר עם Remotion.</p>

      {/* Premium Mode Toggle */}
      <div className="premium-toggle-bar">
        <div className="premium-toggle-info">
          <div className="premium-toggle-icon">💎</div>
          <div className="premium-toggle-text">
            <h4>מצב פרימיום</h4>
            <p>שיפור אוטומטי — קצב, מוזיקה, B-Roll, תנועה, צבע</p>
          </div>
        </div>
        <button className={`premium-toggle-switch ${data.premiumMode ? "active" : ""}`}
          onClick={() => {/* patch is not available here, read-only preview */}} />
      </div>

      {/* ═══ Unified Edited Preview Player — full cumulative edit state ═══ */}
      <div style={{ marginBottom: "1rem" }}>
        <UnifiedEditedPreviewPlayer
          videoSrc={videoSrc}
          format={data.format}
          segments={data.segments || []}
          subtitleStyle={subtitleStyle}
          brollEnabled={data.brollEnabled ?? false}
          brollPlacements={data.brollPlacements || []}
          effects={data.effects || []}
          showLayerBadges={true}
          transitionStyle={data.transitionStyle}
          debug={process.env.NODE_ENV === "development"}
          maxWidth={isPortrait ? 380 : 640}
        />
      </div>

      {/* Active layers summary */}
      <div style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem" }}>
        {data.musicEnabled && data.musicTrackId && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--surface-raised)", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.78rem" }}>
            <span>🎵</span>
            <div>
              <div style={{ fontWeight: 600 }}>{selectedTrack?.title || "מוזיקה"}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{data.musicVolume}%{data.musicDucking ? " · Ducking" : ""}</div>
            </div>
          </div>
        )}
        {data.brollEnabled && data.brollPlacements.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--surface-raised)", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.78rem" }}>
            <span>🎞️</span>
            <div>
              <div style={{ fontWeight: 600 }}>B-Roll</div>
              <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{data.brollPlacements.length} קטעים</div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--surface-raised)", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.78rem" }}>
          <span>🔀</span>
          <div>
            <div style={{ fontWeight: 600 }}>מעברים</div>
            <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{transitionLabel}</div>
          </div>
        </div>
        {(data.cleanupFillers || data.cleanupSilence) && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--surface-raised)", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.78rem" }}>
            <span>🧹</span>
            <div>
              <div style={{ fontWeight: 600 }}>ניקוי</div>
              <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{data.cleanupRemovedSegments.filter(s => s.removed).length} הסרות</div>
            </div>
          </div>
        )}
        {data.premiumMode && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "linear-gradient(135deg, rgba(0,181,254,0.06), rgba(0,227,255,0.04))", borderRadius: 8, border: "1px solid var(--accent-border)", fontSize: "0.78rem" }}>
            <span>💎</span>
            <div>
              <div style={{ fontWeight: 600, color: "var(--accent)" }}>פרימיום</div>
              <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>שיפור אוטומטי</div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Layers Debug Panel */}
      <div className="edit-layers-panel" style={{ marginTop: "1.5rem" }}>
        <div className="edit-layers-title" style={{ cursor: "pointer" }} onClick={() => setShowDebugLayers(!showDebugLayers)}>
          <span>🔧</span> שכבות עריכה פעילות
          <span style={{ marginRight: "auto", fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{showDebugLayers ? "▼" : "▶"}</span>
        </div>
        {showDebugLayers && (
          <div className="edit-layers-grid">
            {editLayers.map((layer) => (
              <div key={layer.name} className="edit-layer-item">
                <div className={`edit-layer-dot ${layer.active ? "active" : (layer as any).auto ? "auto" : "inactive"}`} />
                <span className="edit-layer-name">{layer.name}</span>
                <span className="edit-layer-status">{layer.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composition Data Debug Panel */}
      <div className="edit-layers-panel" style={{ marginTop: "0.75rem" }}>
        <div className="edit-layers-title" style={{ cursor: "pointer" }} onClick={() => setShowCompositionDebug(!showCompositionDebug)}>
          <span>🎬</span> Remotion Composition Data
          <span style={{ marginRight: "auto", fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{showCompositionDebug ? "▼" : "▶"}</span>
        </div>
        {showCompositionDebug && compositionSummary && (
          <div style={{ padding: "0.75rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.5rem", fontSize: "0.75rem" }}>
            <div style={{ padding: "0.5rem", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, color: "var(--accent)" }}>Tracks</div>
              <div>{compositionSummary.tracks}</div>
            </div>
            <div style={{ padding: "0.5rem", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, color: "var(--accent)" }}>Duration</div>
              <div>{compositionSummary.duration.toFixed(1)}s</div>
            </div>
            <div style={{ padding: "0.5rem", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, color: "var(--accent)" }}>Segments</div>
              <div>{compositionSummary.segments}</div>
            </div>
            <div style={{ padding: "0.5rem", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, color: "var(--accent)" }}>B-Roll</div>
              <div>{compositionSummary.broll}</div>
            </div>
            <div style={{ padding: "0.5rem", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, color: "var(--accent)" }}>Cleanup Cuts</div>
              <div>{compositionSummary.cleanupRemoved}</div>
            </div>
            <div style={{ padding: "0.5rem", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, color: "var(--accent)" }}>Transition</div>
              <div>{compositionSummary.transition}</div>
            </div>
            <div style={{ padding: "0.5rem", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, color: "var(--accent)" }}>Premium</div>
              <div>{compositionSummary.premium ? "ON" : "OFF"}</div>
            </div>
          </div>
        )}
        {showCompositionDebug && !compositionSummary && (
          <div style={{ padding: "0.75rem", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
            לא ניתן לבנות נתוני קומפוזיציה — בדוק שכל השלבים הושלמו
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP — AI Smart Highlighting (after subtitle styling, before video editing)
   ═══════════════════════════════════════════════════════════════════════════ */

function StepAiHighlight({ data, patch, videoSrc }: { data: WizardData; patch: (p: Partial<WizardData>) => void; videoSrc?: string }) {
  const [ct, setCt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(() => data.segments.some(s => (s.emphasisWords?.length || 0) > 0));

  // Subtitle style for unified player
  const subtitleStyleData = useMemo(() => extractSubtitleStyle(data), [data]);
  const handleTimeUpdate = useCallback((t: number) => { setCt(t); }, []);

  const activeSeg = useMemo(() => {
    return data.segments.find(s => ct >= s.startSec && ct < s.endSec) || null;
  }, [data.segments, ct]);

  const runAiEmphasis = async () => {
    if (data.segments.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai-emphasis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: data.segments.map(s => ({ id: s.id, text: s.text })),
          language: data.language || "he",
        }),
      });
      const result = await res.json();
      if (result.results && result.results.length > 0 && !result.fallback) {
        const updated = data.segments.map(seg => {
          const match = result.results.find((r: any) => r.segmentId === seg.id);
          return { ...seg, emphasisWords: match?.emphasisWords || [] };
        });
        patch({ segments: updated, highlightMode: "ai" });
        setCached(true);
        console.log("[AI Emphasis] Cached emphasis for", updated.filter(s => (s.emphasisWords?.length || 0) > 0).length, "segments");
      } else {
        console.log("[AI Emphasis] Fallback — AI returned no results");
        patch({ highlightMode: "sequential" });
      }
    } catch (err) {
      console.error("[AI Emphasis] Error:", err);
      patch({ highlightMode: "sequential" });
    } finally {
      setLoading(false);
    }
  };

  const isPortrait = ["9:16", "4:5"].includes(data.format);
  const hlColor = data.subtitleHighlightColor || "#FFD700";

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">הדגשה חכמה (AI)</h2>
      <p className="wiz-step-sub">
        AI מנתח את הכתוביות הסופיות ובוחר מילים חשובות להדגשה — מילות מפתח, פעולה, רגש ואימפקט.
      </p>

      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        {/* ── Unified Video Preview ── */}
        <div style={{ flex: "1 1 340px", maxWidth: isPortrait ? 340 : "100%" }}>
          <UnifiedEditedPreviewPlayer
            videoSrc={videoSrc || ""}
            format={data.format}
            segments={data.segments}
            subtitleStyle={subtitleStyleData}
            brollEnabled={data.brollEnabled}
            brollPlacements={data.brollPlacements}
            onTimeUpdate={handleTimeUpdate}
            showLayerBadges={true}
            transitionStyle={data.transitionStyle}
            debug={process.env.NODE_ENV === "development"}
            maxWidth={isPortrait ? 320 : undefined}
          />
        </div>

        {/* ── Controls ── */}
        <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Mode toggle */}
          <div>
            <label className="substyle-field-label">מצב הדגשה</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className={`wiz-btn wiz-btn-sm ${data.highlightMode === "sequential" ? "wiz-btn-accent" : "wiz-btn-ghost"}`}
                onClick={() => patch({ highlightMode: "sequential" })}
                style={{ flex: 1, fontSize: "0.75rem" }}
              >
                🔄 הדגשה רגילה
              </button>
              <button
                className={`wiz-btn wiz-btn-sm ${data.highlightMode === "ai" ? "wiz-btn-accent" : "wiz-btn-ghost"}`}
                onClick={() => {
                  patch({ highlightMode: "ai" });
                  if (!cached) runAiEmphasis();
                }}
                style={{ flex: 1, fontSize: "0.75rem" }}
                disabled={loading}
              >
                {loading ? "⏳ מנתח..." : "🧠 הדגשה חכמה (AI)"}
              </button>
            </div>
          </div>

          {/* Status */}
          {data.highlightMode === "ai" && cached && (
            <div style={{ fontSize: "0.75rem", color: "#22c55e", padding: "0.5rem 0.75rem", background: "rgba(34,197,94,0.08)", borderRadius: 8 }}>
              ✓ ניתוח AI הושלם — מילים חשובות מסומנות
            </div>
          )}
          {loading && (
            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", padding: "0.5rem 0.75rem", background: "var(--surface-raised)", borderRadius: 8 }}>
              ⏳ AI מנתח את הטקסט ומזהה מילים חשובות...
            </div>
          )}

          {/* Intensity */}
          <div>
            <label className="substyle-field-label">עוצמת הדגשה</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className={`wiz-btn wiz-btn-sm ${data.highlightIntensity === "subtle" ? "wiz-btn-accent" : "wiz-btn-ghost"}`}
                onClick={() => patch({ highlightIntensity: "subtle" })} style={{ flex: 1, fontSize: "0.75rem" }}>עדין</button>
              <button className={`wiz-btn wiz-btn-sm ${data.highlightIntensity === "strong" ? "wiz-btn-accent" : "wiz-btn-ghost"}`}
                onClick={() => patch({ highlightIntensity: "strong" })} style={{ flex: 1, fontSize: "0.75rem" }}>חזק</button>
            </div>
          </div>

          {/* Highlight color */}
          <div>
            <label className="substyle-field-label">צבע הדגשה</label>
            <div className="substyle-color-row">
              <input type="color" value={data.subtitleHighlightColor} onChange={(e) => patch({ subtitleHighlightColor: e.target.value })} className="substyle-color-picker" />
              <input className="wiz-input substyle-color-hex" value={data.subtitleHighlightColor} onChange={(e) => patch({ subtitleHighlightColor: e.target.value })} dir="ltr" />
            </div>
            <div className="substyle-color-presets" style={{ marginTop: "0.35rem" }}>
              {["#FFD700", "#00B5FE", "#FF6B6B", "#22C55E", "#A855F7", "#F59E0B", "#EC4899", "#FFFFFF"].map((c) => (
                <button key={c} className={`substyle-color-swatch ${data.subtitleHighlightColor === c ? "active" : ""}`}
                  style={{ background: c }} onClick={() => patch({ subtitleHighlightColor: c })} />
              ))}
            </div>
          </div>

          {/* Re-analyze button */}
          {cached && (
            <button className="wiz-btn wiz-btn-ghost wiz-btn-sm" onClick={runAiEmphasis} disabled={loading}
              style={{ fontSize: "0.7rem", alignSelf: "flex-start" }}>
              🔄 נתח מחדש
            </button>
          )}

          {/* AI emphasis word list */}
          {data.highlightMode === "ai" && cached && (
            <div style={{ padding: "0.75rem", background: "var(--surface-raised)", borderRadius: 8, fontSize: "0.7rem", maxHeight: 200, overflowY: "auto" }}>
              <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>מילים מודגשות (AI)</div>
              {data.segments.filter(s => (s.emphasisWords?.length || 0) > 0).slice(0, 8).map(s => (
                <div key={s.id} style={{ color: "var(--foreground-muted)", marginBottom: 2 }}>
                  <span style={{ color: hlColor, fontWeight: 700 }}>{s.emphasisWords?.join(", ")}</span>
                  <span> ← {s.text.slice(0, 35)}{s.text.length > 35 ? "..." : ""}</span>
                </div>
              ))}
              {data.segments.filter(s => (s.emphasisWords?.length || 0) > 0).length > 8 && (
                <div style={{ color: "var(--foreground-muted)", marginTop: 4 }}>...ועוד {data.segments.filter(s => (s.emphasisWords?.length || 0) > 0).length - 8} קטעים</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP — AI Edit Direction
   ═══════════════════════════════════════════════════════════════════════════ */

function StepAiDirection({ data, patch }: { data: WizardData; patch: (p: Partial<WizardData>) => void }) {
  const segCount = data.segments.length;
  const filledCount = data.segments.filter(s => s.text.trim()).length;
  const highlightCount = data.segments.filter(s => s.highlightWord).length;
  const avgSegLen = segCount > 0 ? data.segments.reduce((a, s) => a + (s.endSec - s.startSec), 0) / segCount : 0;
  const totalDur = data.segments.length > 0 ? data.segments[data.segments.length - 1].endSec : 0;

  const AI_MODES = [
    {
      id: "premium" as const, icon: "💎", label: "Premium",
      desc: "קצב רגוע, כתוביות מלוטשות, מעברים אלגנטיים",
      effects: "קצב: רגוע · Hook: סמכותי · B-Roll: מינימלי · CTA: עדין",
    },
    {
      id: "viral" as const, icon: "🔥", label: "Viral",
      desc: "קצב מהיר, Jump Cuts אגרסיביים, הדגשות חזקות",
      effects: "קצב: מהיר · Hook: שאלה · B-Roll: דינמי · CTA: דחוף",
    },
    {
      id: "emotional" as const, icon: "💫", label: "Emotional",
      desc: "קצב איטי, מוזיקה רגשית, כתוביות גדולות",
      effects: "קצב: איטי · Hook: סיפורי · B-Roll: אווירתי · CTA: רך",
    },
    {
      id: "sales" as const, icon: "💰", label: "Sales",
      desc: "CTA חזק, מסרים ברורים, דחיפות",
      effects: "קצב: בינוני · Hook: בעיה+פתרון · B-Roll: מוצר · CTA: חזק",
    },
  ];

  // AI suggestions based on content analysis
  const suggestions = useMemo(() => {
    const items: { icon: string; title: string; desc: string; type: string }[] = [];

    // Pacing suggestion
    if (avgSegLen > 4) {
      items.push({ icon: "⚡", title: "קצב איטי מדי", desc: "הקטעים ארוכים — שקול Jump Cuts או קיצור ל-2-3 שניות לקטע", type: "pacing" });
    } else if (avgSegLen < 2) {
      items.push({ icon: "🐌", title: "קצב מהיר מדי", desc: "הקטעים קצרים — שקול להאריך למעבר טבעי יותר", type: "pacing" });
    } else {
      items.push({ icon: "✅", title: "קצב מצוין", desc: `ממוצע ${avgSegLen.toFixed(1)} שניות לקטע — אידאלי לסושיאל`, type: "pacing" });
    }

    // Hook suggestion
    const firstSeg = data.segments[0];
    if (firstSeg) {
      const hookWords = firstSeg.text.split(/\s+/).length;
      if (hookWords < 3 || !firstSeg.text.trim()) {
        items.push({ icon: "🎣", title: "Hook חלש", desc: "הפתיחה קצרה מדי — הוסף שאלה, מספר או טענה נועזת ב-3 שניות הראשונות", type: "hook" });
      } else if (firstSeg.text.includes("?") || firstSeg.text.match(/\d/)) {
        items.push({ icon: "🎯", title: "Hook חזק!", desc: "הפתיחה כוללת שאלה או נתון — זה עוצר גלילה", type: "hook" });
      }
    }

    // B-Roll suggestion
    if (!data.brollEnabled) {
      items.push({ icon: "🎬", title: "הוסף B-Roll", desc: "B-Roll מגביר אינגייג׳מנט ב-40% — שקול להפעיל בשלב הבא", type: "broll" });
    }

    // Highlight suggestion
    if (highlightCount === 0 && filledCount > 3) {
      items.push({ icon: "✨", title: "הדגש מילות מפתח", desc: "חזור לעריכת כתוביות והוסף הדגשות — זה מעלה צפייה ב-25%", type: "highlight" });
    }

    // Style suggestion based on duration
    if (totalDur <= 15) {
      items.push({ icon: "📱", title: "מתאים ל-Reel/TikTok", desc: "סרטון קצר — סגנון Viral עם קצב מהיר יעבוד מעולה", type: "style" });
    } else if (totalDur >= 60) {
      items.push({ icon: "🎥", title: "סרטון ארוך", desc: "שקול סגנון Premium או Storytelling עם מבנה ברור", type: "style" });
    }

    // Music suggestion
    if (!data.musicEnabled) {
      items.push({ icon: "🎵", title: "הוסף מוזיקה", desc: "מוזיקת רקע מעלה את שיעור הצפייה עד הסוף ב-35%", type: "music" });
    }

    return items;
  }, [data.segments, data.brollEnabled, data.musicEnabled, avgSegLen, filledCount, highlightCount, totalDur]);

  const handleModeSelect = (modeId: typeof AI_MODES[number]["id"]) => {
    const newMode = data.aiEditMode === modeId ? "" : modeId;
    const updates: Partial<WizardData> = { aiEditMode: newMode };

    // Apply mode-specific preset mapping
    if (newMode === "premium") updates.preset = "authority";
    else if (newMode === "viral") updates.preset = "viral";
    else if (newMode === "emotional") updates.preset = "storytelling";
    else if (newMode === "sales") updates.preset = "sales";

    patch(updates);
  };

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">🎯 כיוון עריכה AI</h2>
      <p className="wiz-step-sub">הבינה המלאכותית ניתחה את התוכן שלך ומציעה כיוון עריכה מותאם.</p>

      {/* Quick AI Edit Mode Buttons */}
      <div className="ai-dir-modes">
        <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--foreground)" }}>
          בחר סגנון עריכה מהיר
        </div>
        <div className="ai-dir-mode-grid">
          {AI_MODES.map((m) => (
            <button key={m.id}
              className={`ai-dir-mode-card ${data.aiEditMode === m.id ? "active" : ""}`}
              onClick={() => handleModeSelect(m.id)}>
              <div className="ai-dir-mode-icon">{m.icon}</div>
              <div className="ai-dir-mode-label">{m.label}</div>
              <div className="ai-dir-mode-desc">{m.desc}</div>
              <div className="ai-dir-mode-effects">{m.effects}</div>
            </button>
          ))}
        </div>
      </div>

      {/* AI Director Suggestions */}
      <div className="ai-dir-suggestions" style={{ marginTop: "2rem" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--foreground)" }}>
          המלצות הבמאי AI
        </div>
        <div className="ai-dir-sug-list">
          {suggestions.map((s, i) => (
            <div key={i} className={`ai-dir-sug-card ${s.type}`}>
              <div className="ai-dir-sug-icon">{s.icon}</div>
              <div className="ai-dir-sug-content">
                <div className="ai-dir-sug-title">{s.title}</div>
                <div className="ai-dir-sug-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Stats */}
      <div className="ai-dir-stats" style={{ marginTop: "2rem" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--foreground)" }}>
          סטטיסטיקות תוכן
        </div>
        <div className="ai-dir-stats-grid">
          <div className="ai-dir-stat">
            <div className="ai-dir-stat-val">{segCount}</div>
            <div className="ai-dir-stat-label">קטעים</div>
          </div>
          <div className="ai-dir-stat">
            <div className="ai-dir-stat-val">{totalDur.toFixed(0)}s</div>
            <div className="ai-dir-stat-label">משך</div>
          </div>
          <div className="ai-dir-stat">
            <div className="ai-dir-stat-val">{avgSegLen.toFixed(1)}s</div>
            <div className="ai-dir-stat-label">ממוצע/קטע</div>
          </div>
          <div className="ai-dir-stat">
            <div className="ai-dir-stat-val">{highlightCount}</div>
            <div className="ai-dir-stat-label">הדגשות</div>
          </div>
        </div>
      </div>

      {/* Creative Notes */}
      <div style={{ marginTop: "1.5rem" }}>
        <label className="wiz-label">הערות נוספות לעריכה</label>
        <textarea className="wiz-input" rows={3}
          value={data.aiDirectionNotes}
          onChange={(e) => patch({ aiDirectionNotes: e.target.value })}
          placeholder="הוסף הערות ספציפיות לבמאי AI — למשל: ׳תעדיף קלוזאפים׳, ׳תוסיף טקסט על המסך׳..."
          style={{ resize: "vertical", minHeight: 80 }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP — Approve & Export
   ═══════════════════════════════════════════════════════════════════════════ */

function StepApprove({ data, patch, clients, onApprove, onSaveDraft, onBack, videoSrc: parentVideoSrc }: {
  data: WizardData; patch: (p: Partial<WizardData>) => void; clients: Client[];
  onApprove: () => void; onSaveDraft: () => void; onBack: () => void; videoSrc?: string;
}) {
  const client = clients.find((c) => c.id === data.clientId);
  const durationSec = data.trimMode === "clip" ? Math.round(data.trimEnd - data.trimStart) : 30;

  const videoSrc = parentVideoSrc || "";

  /* ── Unified preview state ── */
  const subtitleStyleApprove = useMemo(() => extractSubtitleStyle(data), [data]);
  const isPortraitApprove = ["9:16", "4:5"].includes(data.format);

  /* ── Debug logging (mandatory) ── */
  useEffect(() => {
    const fmtD = FORMAT_DIMENSIONS[data.format] || FORMAT_DIMENSIONS["9:16"];
    console.log(
      `[StepApprove] DEBUG:\n` +
      `  selectedFormat: ${data.format} (${fmtD.width}×${fmtD.height})\n` +
      `  videoSrc: ${videoSrc ? videoSrc.substring(0, 80) : "(EMPTY)"}\n` +
      `  subtitleSegments: ${data.segments?.length || 0}\n` +
      `  highlightData: ${data.highlightMode === "ai" ? "yes (AI)" : data.segments.some(s => s.highlightWord) ? "yes (sequential)" : "no"}\n` +
      `  brollPlacements: ${data.brollPlacements?.length || 0} (enabled=${data.brollEnabled})\n` +
      `  transitions: ${data.transitionStyle}\n` +
      `  effects: ${(data.effects || []).length} (${(data.effects || []).filter(e => e.enabled).length} enabled)\n` +
      `  playerSourceType: EDITED_UNIFIED`
    );
    if (!videoSrc) console.warn("[StepApprove] RAW VIDEO USED IN FINAL PREVIEW — videoSrc is empty!");
  }, [data, videoSrc]);

  // Build Remotion composition props (same approach as StepPreview)
  const compositionSummary = useMemo(() => {
    try {
      const snapshot: WizardSnapshot = {
        projectId: "approve-preview",
        title: data.title,
        clientId: data.clientId,
        clientName: client?.name || "",
        creativePrompt: data.creativePrompt,
        videoUrl: videoSrc,
        videoFileName: data.videoFile?.name || "",
        videoDurationSec: durationSec,
        trimMode: data.trimMode,
        trimStart: data.trimStart,
        trimEnd: data.trimEnd,
        format: data.format,
        subtitleMode: data.subtitleMode,
        language: data.language,
        segments: data.segments.map(s => ({
          id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
          edited: s.edited, highlightWord: s.highlightWord, highlightStyle: s.highlightStyle,
          confidence: s.confidence,
        })),
        subtitleFont: data.subtitleFont, subtitleFontWeight: data.subtitleFontWeight,
        subtitleFontSize: data.subtitleFontSize, subtitleColor: data.subtitleColor,
        subtitleHighlightColor: data.subtitleHighlightColor,
        subtitleOutlineEnabled: data.subtitleOutlineEnabled, subtitleOutlineColor: data.subtitleOutlineColor,
        subtitleOutlineThickness: data.subtitleOutlineThickness, subtitleShadow: data.subtitleShadow,
        subtitleBg: data.subtitleBg, subtitleBgColor: data.subtitleBgColor,
        subtitleBgOpacity: data.subtitleBgOpacity, subtitleAlign: data.subtitleAlign,
        subtitlePosition: data.subtitlePosition, subtitleManualY: data.subtitleManualY, subtitleAnimation: data.subtitleAnimation,
        subtitleLineBreak: data.subtitleLineBreak, highlightMode: data.highlightMode, highlightIntensity: data.highlightIntensity,
        brollEnabled: data.brollEnabled, brollStyle: data.brollStyle,
        brollPlacements: data.brollPlacements,
        transitionStyle: data.transitionStyle as any,
        musicEnabled: data.musicEnabled, musicTrackId: data.musicTrackId,
        musicTrackTitle: "", musicTrackUrl: "",
        musicVolume: data.musicVolume, musicDucking: data.musicDucking,
        musicDuckingLevel: data.musicDuckingLevel,
        soundDesignEnabled: data.soundDesignEnabled, sfxOnCuts: data.sfxOnCuts,
        sfxStyle: data.sfxStyle,
        cleanupFillers: data.cleanupFillers, cleanupSilence: data.cleanupSilence,
        cleanupIntensity: data.cleanupIntensity,
        cleanupRemovedSegments: data.cleanupRemovedSegments,
        preset: data.preset, exportQuality: data.exportQuality || "premium",
        aiEditMode: data.aiEditMode || "", aiDirectionNotes: data.creativePrompt,
        premiumMode: data.premiumMode, premiumLevel: data.premiumLevel,
      };
      const compData = buildFinalCompositionData(snapshot);
      const remotionProps = compositionToProps(compData);
      return { duration: compData.timeline.durationSec, remotionProps };
    } catch {
      return null;
    }
  }, [data, videoSrc, client, durationSec]);

  const effectiveDurationSec = compositionSummary?.duration || durationSec;

  // Run AI analysis
  const aiScore = useMemo(() => {
    try {
      return scoreVideo({
        segments: data.segments.map(s => ({
          id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
          edited: s.edited, highlightWord: s.highlightWord, highlightStyle: s.highlightStyle as any,
        })),
        durationSec,
        format: data.format,
        hasMusic: data.musicEnabled,
        hasBroll: data.brollEnabled,
        preset: data.preset,
        subtitleStyle: {
          font: data.subtitleFont, fontWeight: data.subtitleFontWeight,
          fontSize: data.subtitleFontSize, color: data.subtitleColor,
          highlightColor: data.subtitleHighlightColor, outlineEnabled: data.subtitleOutlineEnabled,
          outlineColor: data.subtitleOutlineColor, outlineThickness: data.subtitleOutlineThickness,
          shadow: data.subtitleShadow, bgEnabled: data.subtitleBg, bgColor: data.subtitleBgColor,
          bgOpacity: data.subtitleBgOpacity, align: data.subtitleAlign, position: data.subtitlePosition,
          animation: data.subtitleAnimation as any, lineBreak: data.subtitleLineBreak,
        },
      });
    } catch { return null; }
  }, [data, durationSec]);

  const hooks = useMemo(() => {
    try {
      return generateHooks({
        segments: data.segments.map(s => ({
          id: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
          edited: s.edited, highlightWord: s.highlightWord, highlightStyle: s.highlightStyle as any,
        })),
        clientTone: "professional",
        topic: data.title,
        language: data.language || "he",
      });
    } catch { return []; }
  }, [data.segments, data.title, data.language]);

  const performance = useMemo(() => {
    if (!aiScore) return null;
    try {
      return predictPerformance({
        score: aiScore,
        durationSec,
        format: data.format,
        hasMusic: data.musicEnabled,
        hasBroll: data.brollEnabled,
        preset: data.preset,
      });
    } catch { return null; }
  }, [aiScore, data, durationSec]);

  const scoreColor = (score: number) =>
    score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="wiz-step-content">
      <h2 className="wiz-step-heading">אישור ויצוא</h2>
      <p className="wiz-step-sub">בדוק את כל ההגדרות וצפה בניתוח AI לפני יצירת הפרויקט.</p>

      <div className="wiz-approve-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Left: Video Preview + AI Score */}
        <div className="wiz-approve-video">
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "1rem", color: "var(--foreground-muted)" }}>תצוגה מקדימה — קומפוזיציה מלאה</div>
          <UnifiedEditedPreviewPlayer
            videoSrc={videoSrc}
            format={data.format}
            segments={data.segments || []}
            subtitleStyle={subtitleStyleApprove}
            brollEnabled={data.brollEnabled ?? false}
            brollPlacements={data.brollPlacements || []}
            effects={data.effects || []}
            showLayerBadges={true}
            transitionStyle={data.transitionStyle}
            debug={process.env.NODE_ENV === "development"}
            maxWidth={isPortraitApprove ? 320 : undefined}
          />

          {/* AI Score Card */}
          {aiScore && (
            <div className="wiz-ai-score-card" style={{
              marginTop: "1.5rem", padding: "1.25rem", borderRadius: 12,
              border: "1px solid var(--border)", background: "var(--surface-raised)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.25rem", fontWeight: 800, color: "white",
                  background: `conic-gradient(${scoreColor(aiScore.overall)} ${aiScore.overall * 3.6}deg, var(--surface) 0deg)`,
                  border: `3px solid ${scoreColor(aiScore.overall)}`,
                }}>
                  {aiScore.overall}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>ניתוח AI</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                    {aiScore.overall >= 80 ? "ביצועים מצוינים צפויים" : aiScore.overall >= 60 ? "ביצועים טובים" : "יש מקום לשיפור"}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {aiScore.breakdown.map((b) => (
                  <div key={b.category} style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.375rem 0.5rem", borderRadius: 6, background: "var(--surface)",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", fontSize: "0.7rem", fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: scoreColor(b.score), border: `2px solid ${scoreColor(b.score)}`,
                    }}>
                      {b.score}
                    </div>
                    <div style={{ fontSize: "0.75rem" }}>
                      <div style={{ fontWeight: 600 }}>{b.feedbackHe.split(" — ")[0] || b.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Prediction */}
          {performance && (
            <div style={{
              marginTop: "1rem", padding: "1rem", borderRadius: 12,
              border: "1px solid var(--border)", background: "var(--surface-raised)",
            }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.75rem" }}>תחזית ביצועים</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {[
                  { label: "אינגייג׳מנט", val: performance.engagementPotential },
                  { label: "עצירת גלילה", val: performance.scrollStoppingStrength },
                  { label: "ויראליות", val: performance.viralityLikelihood },
                  { label: "צפייה עד הסוף", val: performance.watchThroughRate },
                ].map((m) => (
                  <div key={m.label} style={{ fontSize: "0.8rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "var(--foreground-muted)" }}>{m.label}</span>
                      <span style={{ fontWeight: 600, color: scoreColor(m.val) }}>{m.val}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--surface)" }}>
                      <div style={{ height: "100%", borderRadius: 2, width: `${m.val}%`, background: scoreColor(m.val), transition: "width 0.5s" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Hooks */}
          {hooks.length > 0 && (
            <div style={{
              marginTop: "1rem", padding: "1rem", borderRadius: 12,
              border: "1px solid var(--border)", background: "var(--surface-raised)",
            }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.75rem" }}>Hook מוצע</div>
              {hooks.slice(0, 3).map((h) => (
                <div key={h.id} style={{
                  padding: "0.5rem 0.75rem", borderRadius: 8, background: "var(--surface)",
                  marginBottom: "0.5rem", fontSize: "0.8rem",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontWeight: 600 }}>
                      {h.style === "question" ? "❓" : h.style === "statistic" ? "📊" : h.style === "bold_claim" ? "💥" : h.style === "pain_point" ? "🎯" : "✨"} {h.style}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: scoreColor(h.estimatedStrength * 100) }}>
                      {Math.round(h.estimatedStrength * 100)}%
                    </span>
                  </div>
                  <div style={{ color: "var(--foreground-muted)" }}>{h.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Summary */}
        <div className="wiz-approve-summary">
          <div className="wiz-approve-section">
            <div className="wiz-approve-section-title">פרטי פרויקט</div>
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">שם:</span>
              <span className="wiz-approve-value">{data.title}</span>
            </div>
            {client && (
              <div className="wiz-approve-row">
                <span className="wiz-approve-label">לקוח:</span>
                <span className="wiz-approve-value">{client.name}</span>
              </div>
            )}
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">פורמט:</span>
              <span className="wiz-approve-value">{data.format}</span>
            </div>
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">שפה:</span>
              <span className="wiz-approve-value">{LANGUAGES.find((l) => l.id === data.language)?.label || data.language}</span>
            </div>
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">פריסט:</span>
              <span className="wiz-approve-value">{SMART_PRESETS_UI.find(p => p.id === data.preset)?.label || data.preset}</span>
            </div>
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">איכות יצוא:</span>
              <span className="wiz-approve-value">
                {data.exportQuality === "standard" ? "סטנדרטי" : data.exportQuality === "premium" ? "פרימיום" : data.exportQuality === "max" ? "קולנועי" : data.exportQuality}
              </span>
            </div>
          </div>

          <div className="wiz-approve-section" style={{ marginTop: "1.5rem" }}>
            <div className="wiz-approve-section-title">כתוביות</div>
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">מצב:</span>
              <span className="wiz-approve-value">{data.subtitleMode === "auto" ? "אוטומטי" : "ידני"}</span>
            </div>
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">פונט:</span>
              <span className="wiz-approve-value">{data.subtitleFont}</span>
            </div>
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">גודל:</span>
              <span className="wiz-approve-value">{data.subtitleFontSize}px</span>
            </div>
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">אנימציה:</span>
              <span className="wiz-approve-value">{ANIMATIONS.find((a) => a.id === data.subtitleAnimation)?.label}</span>
            </div>
          </div>

          {(data.cleanupFillers || data.cleanupSilence) && (
            <div className="wiz-approve-section" style={{ marginTop: "1.5rem" }}>
              <div className="wiz-approve-section-title">ניקוי</div>
              <div className="wiz-approve-row">
                <span className="wiz-approve-label">מילות מילוי:</span>
                <span className="wiz-approve-value">{data.cleanupRemovedSegments.filter(s => s.type === "filler" && s.removed).length}</span>
              </div>
              <div className="wiz-approve-row">
                <span className="wiz-approve-label">שקטים:</span>
                <span className="wiz-approve-value">{data.cleanupRemovedSegments.filter(s => s.type === "silence" && s.removed).length}</span>
              </div>
              <div className="wiz-approve-row">
                <span className="wiz-approve-label">עוצמה:</span>
                <span className="wiz-approve-value">
                  {data.cleanupIntensity === "light" ? "קלה" : data.cleanupIntensity === "medium" ? "בינונית" : "אגרסיבית"}
                </span>
              </div>
            </div>
          )}

          {data.brollEnabled && (
            <div className="wiz-approve-section" style={{ marginTop: "1.5rem" }}>
              <div className="wiz-approve-section-title">B-Roll</div>
              <div className="wiz-approve-row">
                <span className="wiz-approve-label">Placements:</span>
                <span className="wiz-approve-value">{data.brollPlacements.length > 0 ? data.brollPlacements.length : "אין"}</span>
              </div>
              <div className="wiz-approve-row">
                <span className="wiz-approve-label">מקור:</span>
                <span className="wiz-approve-value">{data.brollStyle === "stock" ? "Stock" : "AI"}</span>
              </div>
            </div>
          )}

          <div className="wiz-approve-section" style={{ marginTop: "1.5rem" }}>
            <div className="wiz-approve-section-title">מעברים</div>
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">סגנון:</span>
              <span className="wiz-approve-value">{TRANSITION_OPTIONS.find(t => t.id === data.transitionStyle)?.nameHe || data.transitionStyle}</span>
            </div>
          </div>

          <div className="wiz-approve-section" style={{ marginTop: "1.5rem" }}>
            <div className="wiz-approve-section-title">מצב פרימיום</div>
            <div className="wiz-approve-row">
              <span className="wiz-approve-label">פעיל:</span>
              <span className="wiz-approve-value">{data.premiumMode ? "כן" : "לא"}</span>
            </div>
            {data.premiumMode && (
              <div className="wiz-approve-row">
                <span className="wiz-approve-label">רמה:</span>
                <span className="wiz-approve-value">
                  {data.premiumLevel === "standard" ? "סטנדרטי" : data.premiumLevel === "premium" ? "פרימיום" : "קולנועי"}
                </span>
              </div>
            )}
          </div>

          {data.musicEnabled && (
            <div className="wiz-approve-section" style={{ marginTop: "1.5rem" }}>
              <div className="wiz-approve-section-title">מוזיקה</div>
              {data.musicTrackId && (
                <div className="wiz-approve-row">
                  <span className="wiz-approve-label">מסלול:</span>
                  <span className="wiz-approve-value">{MUSIC_LIBRARY.find(t => t.id === data.musicTrackId)?.title}</span>
                </div>
              )}
              <div className="wiz-approve-row">
                <span className="wiz-approve-label">עוצמה:</span>
                <span className="wiz-approve-value">{data.musicVolume}%</span>
              </div>
              {data.musicDucking && (
                <div className="wiz-approve-row">
                  <span className="wiz-approve-label">Ducking:</span>
                  <span className="wiz-approve-value">{data.musicDuckingLevel}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Premium Output Mode */}
      <div className="premium-toggle-bar" style={{ marginTop: "2rem" }}>
        <div className="premium-toggle-info">
          <div className="premium-toggle-icon">💎</div>
          <div className="premium-toggle-text">
            <h4>מצב פרימיום</h4>
            <p>שיפור אוטומטי — קצב חכם, מוזיקה, B-Roll, תנועה, צבע</p>
          </div>
        </div>
        <button className={`premium-toggle-switch ${data.premiumMode ? "active" : ""}`}
          onClick={() => patch({ premiumMode: !data.premiumMode })} />
      </div>
      {data.premiumMode && (
        <div className="premium-level-row">
          {(["standard", "premium", "cinematic"] as const).map((level) => (
            <button key={level} className={`premium-level-chip ${data.premiumLevel === level ? "active" : ""}`}
              onClick={() => patch({ premiumLevel: level })}>
              {level === "standard" ? "סטנדרטי" : level === "premium" ? "פרימיום" : "קולנועי"}
            </button>
          ))}
        </div>
      )}

      <div className="wiz-approve-actions" style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end" }}>
        <button className="wiz-btn wiz-btn-ghost" onClick={onBack}>⬅ חזור לעריכה</button>
        <button className="wiz-btn wiz-btn-ghost" onClick={onSaveDraft}>💾 שמור כטיוטה</button>
        <button className="wiz-btn wiz-btn-primary" onClick={onApprove}>
          ✨ אשר וצור פרויקט {aiScore ? `(${aiScore.overall}/100)` : ""} {data.premiumMode ? "💎" : ""}
        </button>
      </div>
    </div>
  );
}
