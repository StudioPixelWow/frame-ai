/**
 * AI Auto-Edit Engine
 * Generates AI-powered edit drafts based on style packs and beat sync.
 */

import type {
  VideoEditProject,
  StylePack,
  BeatSyncConfig,
  AIEditDraft,
  Transition,
  MotionEffect,
  CaptionEntry,
} from './types';

import { getStylePack } from './ai-director';
import { getTransitionPreset } from './transitions';
import { suggestCutPoints, snapToNearestBeat } from './beat-sync';

/**
 * Generate an AI edit draft based on the project, style pack, and beat sync config.
 *
 * The function:
 * - Distributes transitions: 70% clean cuts, 20% style-specific, 10% accent transitions
 * - Applies motion effects to clips based on style pack preferences
 * - Generates caption entries from existing text
 * - Snaps cuts to beats if beat sync is available
 * - Returns complete AIEditDraft with reasoning in Hebrew
 *
 * @param project - Current video edit project
 * @param stylePack - Selected style pack
 * @param beatSync - Optional beat sync configuration
 * @returns AI-generated edit draft with reasoning
 */
export function generateAutoEdit(
  project: VideoEditProject,
  stylePack: StylePack,
  beatSync: BeatSyncConfig | null
): AIEditDraft {
  const { clips, captions } = project;

  // Initialize arrays for the draft
  const draftClips = [...clips];
  const draftTransitions: Transition[] = [];
  const draftMotions: MotionEffect[] = [];
  const draftCaptions: CaptionEntry[] = [...captions];

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Generate transitions between clips
  // ═══════════════════════════════════════════════════════════════

  for (let i = 0; i < clips.length - 1; i++) {
    const fromClip = clips[i];
    const toClip = clips[i + 1];

    // Choose transition type based on distribution:
    // 70% = fade (clean premium)
    // 20% = style-specific preference
    // 10% = accent/variety

    let transitionType = 'fade'; // Default: 70% of the time
    const rand = Math.random();

    if (rand < 0.7) {
      // Clean premium cuts
      transitionType = 'fade';
    } else if (rand < 0.9) {
      // Style-specific (20%)
      const styleTrans = stylePack.preferredTransitions[
        i % stylePack.preferredTransitions.length
      ];
      transitionType = styleTrans;
    } else {
      // Accent/variety (10%)
      const accentOptions = ['crossfade', 'soft_dissolve', 'subtle_slide'];
      transitionType = accentOptions[i % accentOptions.length];
    }

    const transPreset = getTransitionPreset(transitionType as any);
    if (transPreset) {
      const transition: Transition = {
        fromClipId: fromClip.id,
        toClipId: toClip.id,
        type: transPreset.id,
        duration: transPreset.duration,
        easing: transPreset.easing,
        intensity: 'medium',
        cutType: stylePack.preferredCuts[i % stylePack.preferredCuts.length] || null,
      };
      draftTransitions.push(transition);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Apply motion effects to clips
  // ═══════════════════════════════════════════════════════════════

  for (let i = 0; i < draftClips.length; i++) {
    const motionType = stylePack.preferredMotions[i % stylePack.preferredMotions.length];

    const motion: MotionEffect = {
      clipId: draftClips[i].id,
      type: motionType,
      intensity: 'medium',
      startTime: 0,
      endTime: 1,
    };
    draftMotions.push(motion);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Apply beat sync if available
  // ═══════════════════════════════════════════════════════════════

  if (beatSync && beatSync.markers.length > 0) {
    const cutPoints = suggestCutPoints(beatSync.markers, stylePack.pacing);

    // Snap existing transitions to nearest beat
    for (const transition of draftTransitions) {
      const fromClip = draftClips.find((c) => c.id === transition.fromClipId);
      if (fromClip) {
        const snappedTime = snapToNearestBeat(fromClip.end, beatSync.markers, beatSync.snapTolerance);
        if (snappedTime !== null) {
          // Adjust clip end time to snap to beat
          fromClip.end = snappedTime;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Ensure caption entries use style pack settings
  // ═══════════════════════════════════════════════════════════════

  for (const caption of draftCaptions) {
    caption.animation = stylePack.captionAnimation;
    caption.style = stylePack.subtitleStyle;
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: Build reasoning in Hebrew
  // ═══════════════════════════════════════════════════════════════

  const reasoning = buildAutoEditReasoning(stylePack, beatSync);
  const reasoningHe = buildAutoEditReasoningHe(stylePack, beatSync);

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: Calculate confidence score
  // ═══════════════════════════════════════════════════════════════

  let confidence = 0.85; // Base confidence
  if (beatSync) confidence += 0.1; // Bonus for beat sync
  if (draftCaptions.length > 0) confidence += 0.05; // Bonus for captions
  confidence = Math.min(confidence, 1.0);

  // ═══════════════════════════════════════════════════════════════
  // Build final draft
  // ═══════════════════════════════════════════════════════════════

  return {
    clips: draftClips,
    transitions: draftTransitions,
    motions: draftMotions,
    captions: draftCaptions,
    stylePack: stylePack.id,
    pacing: stylePack.pacing,
    reasoning,
    reasoningHe,
    confidence,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build English reasoning text for the auto-edit
 */
function buildAutoEditReasoning(stylePack: StylePack, beatSync: BeatSyncConfig | null): string {
  let reasoning = `Applied ${stylePack.name} style pack with ${stylePack.pacing} pacing. `;
  reasoning += `Distributed transitions: 70% clean fades, 20% style-specific, 10% accent. `;
  reasoning += `Applied motion effects from preferred set to each clip. `;

  if (beatSync) {
    reasoning += `Beat-synced edits to ${beatSync.bpm} BPM for rhythmic alignment. `;
  }

  reasoning += `Set captions to ${stylePack.captionAnimation} animation with ${stylePack.subtitleStyle} style.`;

  return reasoning;
}

/**
 * Build Hebrew reasoning text for the auto-edit
 */
function buildAutoEditReasoningHe(stylePack: StylePack, beatSync: BeatSyncConfig | null): string {
  let reasoning = `הוחלה ערכת סגנון ${stylePack.nameHe} עם קצב ${stylePack.pacing === 'slow_premium' ? 'איטי פרימיום' : stylePack.pacing === 'medium_commercial' ? 'מסחרי בינוני' : stylePack.pacing === 'fast_social' ? 'חברתי מהיר' : 'וירלי אגרסיבי'}. `;
  reasoning += `הופצו מעברים: 70% דהיות נקיות, 20% ספציפיות לסגנון, 10% הדגשה. `;
  reasoning += `הוחלו אפקטי תנועה מהקבוצה המועדפת לכל קליפ. `;

  if (beatSync) {
    reasoning += `עריכה מסונכרנת לקצב של ${beatSync.bpm} BPM ליישור קצב. `;
  }

  reasoning += `קבע כתוביות לאנימציה ${getAnimationNameHe(stylePack.captionAnimation)} עם סגנון ${getStyleNameHe(stylePack.subtitleStyle)}.`;

  return reasoning;
}

/** Helper to get Hebrew animation name */
function getAnimationNameHe(anim: string): string {
  const names: Record<string, string> = {
    fade_up: 'דהיות למעלה',
    punch_in: 'פאנץ\' פנימה',
    type_reveal: 'חשיפת הקלדה',
    kinetic_bounce: 'קפיצה קינטית',
    slide_reveal: 'חשיפת שקופית',
    premium_soft: 'רך פרימיום',
    highlight_pop: 'הדגשת קפיצה',
  };
  return names[anim] || anim;
}

/** Helper to get Hebrew style name */
function getStyleNameHe(style: string): string {
  const names: Record<string, string> = {
    clean_premium: 'נקי פרימיום',
    tiktok_bold: 'טיקטוק בולד',
    ugc_captions: 'כתוביות UGC',
    luxury_minimal: 'יוקרה מינימלית',
    sales_cta: 'CTA מכירות',
  };
  return names[style] || style;
}
