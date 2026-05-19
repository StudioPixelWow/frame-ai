/**
 * FrameAI — Clip Scoring & Ranking for Podcast Clip Engine
 *
 * Scores raw clip candidates across six weighted criteria and produces
 * a ranked list of clips ready for editorial review.
 * All scoring is deterministic — no AI calls.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A raw clip candidate before scoring (e.g. from AI analysis or manual selection). */
export interface RawClipCandidate {
  id: string;
  startTime: number;
  endTime: number;
  transcript: string;
  title: string;
  topicTags: string[];
  /** 0-1 estimate of how strong the opening hook is. */
  hookStrengthEstimate: number;
  /** 0-1 estimate of emotional arc within the clip. */
  emotionalArcEstimate: number;
  /** 0-1 estimate of how well the clip stands alone without context. */
  standaloneValueEstimate: number;
  /** 0-1 estimate of viral potential. */
  viralEstimate: number;
  /** 0-1 relevance to the overall topic of the episode. */
  topicRelevanceEstimate: number;
  /** 0-1 audio quality indicator (loudness consistency, no clipping, etc.). */
  audioQualityEstimate: number;
}

/** A scored clip with all sub-scores and aggregates. */
export interface ScoredClip extends RawClipCandidate {
  /** Weighted viral score (hookStrength + viralPotential components). */
  viralScore: number;
  /** Weighted engagement score (emotionalArc + standaloneValue components). */
  engagementScore: number;
  /** Raw hook score (direct from hookStrengthEstimate). */
  hookScore: number;
  /** Final weighted aggregate score, 0-1. */
  overallScore: number;
}

// ── Scoring weights ──────────────────────────────────────────────────────────

const WEIGHTS = {
  hookStrength:    0.25,
  emotionalArc:    0.20,
  standaloneValue: 0.20,
  viralPotential:  0.15,
  topicRelevance:  0.10,
  audioQuality:    0.10,
} as const;

// ── Duration bonuses / penalties ─────────────────────────────────────────────

/** Ideal clip duration range in seconds. */
const IDEAL_MIN_DURATION_S = 30;
const IDEAL_MAX_DURATION_S = 90;

/**
 * Duration modifier: clips in the ideal 30-90s range get a small bonus,
 * clips that are too short or too long get a penalty.
 */
function durationModifier(startTime: number, endTime: number): number {
  const duration = endTime - startTime;
  if (duration >= IDEAL_MIN_DURATION_S && duration <= IDEAL_MAX_DURATION_S) {
    return 0.05; // small bonus for ideal length
  }
  if (duration < 15) return -0.10;   // too short to be useful
  if (duration > 180) return -0.08;  // too long for social
  return 0; // acceptable but not ideal
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a value to [0, 1]. */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ── Main exports ─────────────────────────────────────────────────────────────

/**
 * Score an array of raw clip candidates.
 *
 * Each candidate is evaluated across six weighted criteria:
 * - Hook Strength (25%) — how compelling is the opening moment
 * - Emotional Arc (20%) — does the clip build emotional tension/release
 * - Standalone Value (20%) — is the clip understandable without episode context
 * - Viral Potential (15%) — shareability, surprise factor, quotability
 * - Topic Relevance (10%) — alignment with the episode's core themes
 * - Audio Quality (10%) — technical quality of the audio
 *
 * @param candidates  Array of RawClipCandidate to score.
 * @returns           Array of ScoredClip with all score breakdowns.
 */
export function scoreClipCandidates(candidates: RawClipCandidate[]): ScoredClip[] {
  return candidates.map((candidate) => {
    const hookScore = clamp01(candidate.hookStrengthEstimate);

    const viralScore = clamp01(
      candidate.hookStrengthEstimate * 0.5 +
      candidate.viralEstimate * 0.5
    );

    const engagementScore = clamp01(
      candidate.emotionalArcEstimate * 0.5 +
      candidate.standaloneValueEstimate * 0.5
    );

    // Weighted aggregate
    const rawOverall =
      candidate.hookStrengthEstimate    * WEIGHTS.hookStrength +
      candidate.emotionalArcEstimate    * WEIGHTS.emotionalArc +
      candidate.standaloneValueEstimate * WEIGHTS.standaloneValue +
      candidate.viralEstimate           * WEIGHTS.viralPotential +
      candidate.topicRelevanceEstimate  * WEIGHTS.topicRelevance +
      candidate.audioQualityEstimate    * WEIGHTS.audioQuality;

    const durMod = durationModifier(candidate.startTime, candidate.endTime);
    const overallScore = clamp01(rawOverall + durMod);

    return {
      ...candidate,
      viralScore,
      engagementScore,
      hookScore,
      overallScore,
    };
  });
}

/**
 * Rank scored clips by overallScore descending and return top N.
 *
 * @param clips  Array of ScoredClip to rank.
 * @param topN   Max number of clips to return. Defaults to all.
 * @returns      Sorted array of ScoredClip, highest overallScore first.
 */
export function rankClips(clips: ScoredClip[], topN?: number): ScoredClip[] {
  const sorted = [...clips].sort((a, b) => b.overallScore - a.overallScore);
  return topN !== undefined ? sorted.slice(0, topN) : sorted;
}
