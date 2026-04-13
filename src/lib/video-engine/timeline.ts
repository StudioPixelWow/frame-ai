/**
 * PixelFrameAI — Timeline Model
 * Represents the edited video as a multi-track timeline.
 * This is the internal structure that drives both preview and render.
 */

export type TrackType = "main" | "broll" | "subtitle" | "audio" | "transition";
export type TimelineItemType = "video-clip" | "broll-clip" | "subtitle" | "music" | "transition-event" | "silence-gap" | "zoom-event";

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  trackType: TrackType;
  startSec: number;
  endSec: number;
  durationSec: number;
  metadata: Record<string, any>;
}

export interface VideoClipItem extends TimelineItem {
  type: "video-clip";
  trackType: "main";
  metadata: {
    sourceStartSec: number;
    sourceEndSec: number;
    removed: boolean;       // true if this segment was cut by cleanup
    removalReason?: "filler" | "silence";
    zoomLevel: number;      // 1.0 = normal, 1.1 = slight zoom, etc.
    panX: number;           // -1 to 1 for pan direction
    panY: number;
  };
}

export interface BrollClipItem extends TimelineItem {
  type: "broll-clip";
  trackType: "broll";
  metadata: {
    keyword: string;
    source: string;
    mediaUrl: string;
    transitionIn: string;
    transitionOut: string;
    transitionDurationMs: number;
    opacity: number;
  };
}

export interface SubtitleItem extends TimelineItem {
  type: "subtitle";
  trackType: "subtitle";
  metadata: {
    text: string;
    highlightWord: string;
    highlightStyle: string;
    segmentIndex: number;
    isEdited: boolean;
    confidence: number;
  };
}

export interface MusicItem extends TimelineItem {
  type: "music";
  trackType: "audio";
  metadata: {
    trackId: string;
    trackTitle: string;
    trackUrl: string;
    volume: number;          // 0-100
    duckingEnabled: boolean;
    duckingLevel: number;    // 0-100, how much to reduce under speech
    fadeInSec: number;
    fadeOutSec: number;
  };
}

export interface TransitionEventItem extends TimelineItem {
  type: "transition-event";
  trackType: "transition";
  metadata: {
    style: string;
    durationMs: number;
    fromClipId: string;
    toClipId: string;
  };
}

export interface ZoomEventItem extends TimelineItem {
  type: "zoom-event";
  trackType: "main";
  metadata: {
    zoomFrom: number;
    zoomTo: number;
    easing: "linear" | "easeIn" | "easeOut" | "easeInOut";
  };
}

export interface TimelineTrack {
  id: string;
  type: TrackType;
  label: string;
  items: TimelineItem[];
  muted: boolean;
  visible: boolean;
}

export interface Timeline {
  id: string;
  projectId: string;
  durationSec: number;
  fps: number;
  tracks: TimelineTrack[];
  createdAt: string;
  version: string;
}

/**
 * Get all items at a specific time across all tracks
 */
export function getItemsAtTime(timeline: Timeline, timeSec: number): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const track of timeline.tracks) {
    if (!track.visible) continue;
    for (const item of track.items) {
      if (timeSec >= item.startSec && timeSec < item.endSec) {
        items.push(item);
      }
    }
  }
  return items;
}

/**
 * Get the effective duration of the timeline (accounting for removed segments)
 */
export function getEffectiveDuration(timeline: Timeline): number {
  const mainTrack = timeline.tracks.find(t => t.type === "main");
  if (!mainTrack) return timeline.durationSec;

  let effectiveDur = 0;
  for (const item of mainTrack.items) {
    if (item.type === "video-clip") {
      const clip = item as VideoClipItem;
      if (!clip.metadata.removed) {
        effectiveDur += clip.durationSec;
      }
    }
  }
  return effectiveDur || timeline.durationSec;
}

/**
 * Get items from a specific track type
 */
export function getTrackItems<T extends TimelineItem>(timeline: Timeline, trackType: TrackType): T[] {
  const track = timeline.tracks.find(t => t.type === trackType);
  return (track?.items || []) as T[];
}
