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

// ─── Scene Structure ───────────────────────────────────────────────
export type SceneType =
  | 'hook'
  | 'brand_reveal'
  | 'value_prop'
  | 'product_focus'
  | 'benefits'
  | 'social_proof'
  | 'cta';

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
  motionPreset: 'static' | 'slow-zoom' | 'drift' | 'pulse' | 'parallax';
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
