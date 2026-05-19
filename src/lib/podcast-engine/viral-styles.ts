/**
 * FrameAI — Viral Style Presets for AI Clip Engine
 *
 * Defines visual/editing style presets that control clip pacing,
 * transitions, text overlays, B-roll frequency, and color grading.
 */

import type { ViralStyleConfig } from "@/lib/db/schema";

// ── Preset definitions ─────────────────────────────────────────────────────

export const VIRAL_STYLES: ViralStyleConfig[] = [
  {
    id: "hormozi",
    name: "Alex Hormozi",
    nameHe: "אלכס הורמוזי",
    description:
      "Fast cuts every 2-3s, aggressive zoom, bold text overlays, high-energy B-roll. Designed for maximum retention and dopamine-driven engagement.",
    cutFrequency: 2.5,
    zoomBehavior: "aggressive",
    textStyle: "bold_overlay",
    transitionType: "cut",
    brollFrequency: 8,
    musicMood: "energetic",
    colorGrade: "vibrant",
    pacingCurve: "fast",
  },
  {
    id: "documentary",
    name: "Documentary",
    nameHe: "דוקומנטרי",
    description:
      "Slow, deliberate cuts every 5-8s with subtle zoom. Clean subtitles, fade transitions, and cinematic color grading for a polished, story-driven feel.",
    cutFrequency: 6.5,
    zoomBehavior: "subtle",
    textStyle: "clean_subtitle",
    transitionType: "fade",
    brollFrequency: 15,
    musicMood: "cinematic",
    colorGrade: "cinematic",
    pacingCurve: "slow",
  },
  {
    id: "podcast_clean",
    name: "Podcast Clean",
    nameHe: "פודקאסט נקי",
    description:
      "Medium-paced cuts every 4-6s with no zoom. Minimal text, fade transitions, and neutral color. Lets the conversation breathe naturally.",
    cutFrequency: 5,
    zoomBehavior: "none",
    textStyle: "minimal",
    transitionType: "fade",
    brollFrequency: 20,
    musicMood: "calm",
    colorGrade: "neutral",
    pacingCurve: "medium",
  },
  {
    id: "fast_tiktok",
    name: "Fast TikTok",
    nameHe: "טיקטוק מהיר",
    description:
      "Ultra-fast cuts every 1-2s, aggressive zoom, impact text, and glitch transitions. Maximum sensory stimulation for short-form platforms.",
    cutFrequency: 1.5,
    zoomBehavior: "aggressive",
    textStyle: "impact",
    transitionType: "glitch",
    brollFrequency: 5,
    musicMood: "energetic",
    colorGrade: "vibrant",
    pacingCurve: "fast",
  },
  {
    id: "linkedin_pro",
    name: "LinkedIn Professional",
    nameHe: "לינקדאין מקצועי",
    description:
      "Medium-paced cuts every 4-5s with subtle zoom. Clean subtitles, fade transitions, warm color grading. Professional tone for B2B content.",
    cutFrequency: 4.5,
    zoomBehavior: "subtle",
    textStyle: "clean_subtitle",
    transitionType: "fade",
    brollFrequency: 12,
    musicMood: "calm",
    colorGrade: "warm",
    pacingCurve: "medium",
  },
  {
    id: "storyteller",
    name: "Storyteller",
    nameHe: "מספר סיפורים",
    description:
      "Dynamic cuts every 3-6s with subtle zoom. Clean subtitles, fade transitions, warm color, and cinematic music. Builds narrative arcs within clips.",
    cutFrequency: 4.5,
    zoomBehavior: "subtle",
    textStyle: "clean_subtitle",
    transitionType: "fade",
    brollFrequency: 10,
    musicMood: "cinematic",
    colorGrade: "warm",
    pacingCurve: "dynamic",
  },
];

// ── Lookup map ─────────────────────────────────────────────────────────────

export const VIRAL_STYLE_MAP: Record<string, ViralStyleConfig> =
  VIRAL_STYLES.reduce<Record<string, ViralStyleConfig>>((map, style) => {
    map[style.id] = style;
    return map;
  }, {});

// ── Lookup helper ──────────────────────────────────────────────────────────

/**
 * Retrieve a viral style preset by its ID.
 *
 * @param id  Style identifier (e.g. "hormozi", "documentary").
 * @returns   The matching ViralStyleConfig, or undefined if not found.
 */
export function getViralStyle(id: string): ViralStyleConfig | undefined {
  return VIRAL_STYLE_MAP[id];
}
