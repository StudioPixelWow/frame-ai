/**
 * Safety & Accessibility Engine
 * Validates edits for accessibility and safety concerns.
 */

import type { VideoEditProject, SafetyConfig, SafetyReport, SafetyWarning } from './types';
import { getTransitionPreset } from './transitions';

/** Default safety configuration */
export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxHeavyTransitions: 5,
  maxShakeEffects: 3,
  maxFlashEffects: 2,
  respectReducedMotion: true,
  maxFlashFrequencyHz: 3, // WCAG guideline for photosensitive epilepsy
};

/**
 * Validate edit safety based on accessibility and user experience guidelines.
 * Checks for:
 * - Heavy transition overuse
 * - Shake/flash effect density
 * - Pacing chaos
 * - Accessibility concerns
 *
 * @param project - Video edit project to validate
 * @param config - Optional custom safety config (uses defaults if not provided)
 * @returns SafetyReport with warnings
 */
export function validateEditSafety(
  project: VideoEditProject,
  config?: SafetyConfig
): SafetyReport {
  const settings = config || DEFAULT_SAFETY_CONFIG;
  const warnings: SafetyWarning[] = [];

  // ═══════════════════════════════════════════════════════════════
  // CHECK 1: Heavy transition count
  // ═══════════════════════════════════════════════════════════════

  const heavyTransitions = project.transitions.filter((trans) => {
    const preset = getTransitionPreset(trans.type);
    return preset && preset.isHeavy;
  });

  if (heavyTransitions.length > settings.maxHeavyTransitions) {
    warnings.push({
      type: 'heavy_transitions',
      message: `Too many heavy transitions (${heavyTransitions.length}). Recommend reducing to ${settings.maxHeavyTransitions} or fewer.`,
      messageHe: `יותר מדי מעברים כבדים (${heavyTransitions.length}). מומלץ להפחית ל-${settings.maxHeavyTransitions} או פחות.`,
      severity: 'warning',
      clipIds: heavyTransitions.map((t) => t.fromClipId),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHECK 2: Shake effect density
  // ═══════════════════════════════════════════════════════════════

  const shakeTransitions = project.transitions.filter(
    (trans) => trans.type === 'shake_hit' || trans.type === 'whip_pan'
  );

  if (shakeTransitions.length > settings.maxShakeEffects) {
    warnings.push({
      type: 'shake_overuse',
      message: `High shake effect frequency (${shakeTransitions.length}). Can cause motion sickness. Recommend ${settings.maxShakeEffects} or fewer.`,
      messageHe: `תדירות גבוהה של אפקטי רעדה (${shakeTransitions.length}). יכולה לגרום למחלת תנועה. מומלץ ${settings.maxShakeEffects} או פחות.`,
      severity: 'warning',
      clipIds: shakeTransitions.map((t) => t.fromClipId),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHECK 3: Flash effect density (photosensitivity risk)
  // ═══════════════════════════════════════════════════════════════

  const flashTransitions = project.transitions.filter(
    (trans) => trans.type === 'quick_flash' || trans.type === 'zoom_snap'
  );

  if (flashTransitions.length > settings.maxFlashEffects) {
    warnings.push({
      type: 'flash_risk',
      message: `High flash effect frequency (${flashTransitions.length}). Photosensitivity risk. Limit to ${settings.maxFlashEffects} flashes max.`,
      messageHe: `תדירות גבוהה של אפקטי הבהוב (${flashTransitions.length}). סיכון רגישות אור. הגבל ל-${settings.maxFlashEffects} הבהובים מקסימום.`,
      severity: 'error',
      clipIds: flashTransitions.map((t) => t.fromClipId),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHECK 4: Pacing chaos (rapid clip changes)
  // ═══════════════════════════════════════════════════════════════

  const avgClipDuration =
    project.clips.reduce((sum, clip) => sum + (clip.end - clip.start), 0) / Math.max(project.clips.length, 1);

  const shortClips = project.clips.filter((clip) => clip.end - clip.start < 1.0);
  const shortClipPercentage = (shortClips.length / Math.max(project.clips.length, 1)) * 100;

  if (shortClipPercentage > 40) {
    warnings.push({
      type: 'pacing_chaos',
      message: `${shortClipPercentage.toFixed(0)}% of clips are under 1 second. Consider lengthening clips for better viewer comprehension.`,
      messageHe: `${shortClipPercentage.toFixed(0)}% מהקליפים הם מתחת לשנייה אחת. שקול להאריך קליפים להבנה טובה יותר של הצופה.`,
      severity: 'info',
      clipIds: shortClips.map((c) => c.id),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHECK 5: Accessibility - captions and contrast
  // ═══════════════════════════════════════════════════════════════

  if (project.captions.length === 0) {
    warnings.push({
      type: 'accessibility',
      message: 'No captions detected. Add captions for accessibility and engagement.',
      messageHe: 'לא זוהו כתוביות. הוסף כתוביות לנגישות ולהשתתפות.',
      severity: 'info',
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHECK 6: Reduced motion preference
  // ═══════════════════════════════════════════════════════════════

  if (settings.respectReducedMotion) {
    const motionIntensiveTransitions = project.transitions.filter(
      (trans) => trans.type === 'whip_pan' || trans.type === 'shake_hit' || trans.type === 'speed_push'
    );

    if (motionIntensiveTransitions.length > 2) {
      warnings.push({
        type: 'accessibility',
        message: 'High motion effects detected. Consider providing a low-motion version for accessibility.',
        messageHe: 'זוהו אפקטי תנועה גבוהים. שקול לספק גרסה בתנועה נמוכה לנגישות.',
        severity: 'info',
        clipIds: motionIntensiveTransitions.map((t) => t.fromClipId),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Build final report
  // ═══════════════════════════════════════════════════════════════

  const isValid = !warnings.some((w) => w.severity === 'error');

  return {
    isValid,
    warnings,
  };
}
