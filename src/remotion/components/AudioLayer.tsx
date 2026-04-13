import React from "react";
import { Audio, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { MusicProps, SubtitleSegmentProps } from "../types";

interface Props {
  music: MusicProps;
  segments: SubtitleSegmentProps[];
  totalDurationSec: number;
}

export const AudioLayer: React.FC<Props> = ({ music, segments, totalDurationSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSec = frame / fps;

  if (!music.enabled || !music.trackUrl) return null;

  const totalFrames = Math.ceil(totalDurationSec * fps);
  const fadeInFrames = Math.ceil(music.fadeInSec * fps);
  const fadeOutFrames = Math.ceil(music.fadeOutSec * fps);

  // Base volume
  let volume = music.volume / 100;

  // Fade in
  if (frame < fadeInFrames) {
    volume *= interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateRight: "clamp" });
  }

  // Fade out
  if (frame > totalFrames - fadeOutFrames) {
    volume *= interpolate(frame, [totalFrames - fadeOutFrames, totalFrames], [1, 0], { extrapolateRight: "clamp" });
  }

  // Ducking — reduce volume when speech is active
  if (music.ducking) {
    const isSpeechActive = segments.some(
      (seg) => currentSec >= seg.startSec && currentSec < seg.endSec && seg.text.trim()
    );
    if (isSpeechActive) {
      volume *= (1 - music.duckingLevel / 100);
    }
  }

  return (
    <Audio
      src={music.trackUrl}
      volume={Math.max(0, Math.min(1, volume))}
      startFrom={0}
    />
  );
};
