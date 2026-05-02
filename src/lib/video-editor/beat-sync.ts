/**
 * Beat Sync & Rhythm Engine
 * Beat synchronization, markers, and pacing configuration.
 */

import type { BeatMarker, BeatSyncConfig, PacingMode } from './types';

/** BPM presets for different pacing modes */
export const BPM_PRESETS: Record<PacingMode, number> = {
  slow_premium: 90,
  medium_commercial: 120,
  fast_social: 140,
  aggressive_viral: 160,
};

/**
 * Generate beat markers for a given BPM and duration.
 * Creates markers at regular beat intervals with downbeats every 4 beats.
 *
 * @param bpm - Beats per minute (e.g., 120)
 * @param durationSec - Total duration in seconds
 * @returns Array of beat markers with timing and strength info
 */
export function generateBeatMarkers(bpm: number, durationSec: number): BeatMarker[] {
  const markers: BeatMarker[] = [];

  // Calculate milliseconds per beat
  const msPerBeat = (60 / bpm) * 1000;
  const totalDurationMs = durationSec * 1000;

  let beatCount = 0;
  let timeMs = 0;

  while (timeMs < totalDurationMs) {
    const timeSec = timeMs / 1000;
    const isDownbeat = beatCount % 4 === 0;

    markers.push({
      time: timeSec,
      strength: isDownbeat ? 1.0 : 0.6,
      isDownbeat,
    });

    beatCount++;
    timeMs += msPerBeat;
  }

  return markers;
}

/**
 * Create a complete beat sync configuration.
 *
 * @param options - Configuration options
 * @returns Configured BeatSyncConfig
 */
export function createBeatSyncConfig(options: {
  bpm?: number;
  pacing?: PacingMode;
  durationSec?: number;
  snapTolerance?: number;
  source?: 'manual' | 'auto_bpm' | 'audio_analysis';
}): BeatSyncConfig {
  const pacing = options.pacing || 'medium_commercial';
  const bpm = options.bpm || BPM_PRESETS[pacing];
  const durationSec = options.durationSec || 60;
  const snapTolerance = options.snapTolerance || 50; // 50ms default
  const source = options.source || 'auto_bpm';

  const markers = generateBeatMarkers(bpm, durationSec);

  return {
    bpm,
    pacing,
    snapTolerance,
    markers,
    source,
  };
}

/**
 * Snap a time value to the nearest beat marker.
 * Returns null if no marker is within tolerance.
 *
 * @param time - Time in seconds
 * @param markers - Array of beat markers
 * @param toleranceMs - Snap tolerance in milliseconds
 * @returns Snapped time in seconds, or null if no snap possible
 */
export function snapToNearestBeat(
  time: number,
  markers: BeatMarker[],
  toleranceMs: number
): number | null {
  let closest: BeatMarker | null = null;
  let closestDistance = toleranceMs;

  for (const marker of markers) {
    const distanceMs = Math.abs((marker.time - time) * 1000);
    if (distanceMs < closestDistance) {
      closest = marker;
      closestDistance = distanceMs;
    }
  }

  return closest ? closest.time : null;
}

/**
 * Suggest cut points based on beat markers and pacing.
 * Different pacing modes suggest different frequencies.
 *
 * @param markers - Array of beat markers
 * @param pacing - Pacing mode (affects cut frequency)
 * @returns Array of recommended cut times in seconds
 */
export function suggestCutPoints(markers: BeatMarker[], pacing: PacingMode): number[] {
  const cutPoints: number[] = [];

  // Determine beat interval based on pacing
  let beatInterval: number;
  switch (pacing) {
    case 'slow_premium':
      beatInterval = 4; // Every 4 beats
      break;
    case 'medium_commercial':
      beatInterval = 2; // Every 2 beats
      break;
    case 'fast_social':
      beatInterval = 1; // Every beat
      break;
    case 'aggressive_viral':
      beatInterval = 1; // Every beat or even more frequent
      break;
    default:
      beatInterval = 2;
  }

  // Filter to downbeats and apply interval
  const downbeats = markers.filter((m) => m.isDownbeat);
  for (let i = 0; i < downbeats.length; i += beatInterval) {
    cutPoints.push(downbeats[i].time);
  }

  return cutPoints;
}
