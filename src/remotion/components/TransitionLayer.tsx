import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { AbsoluteFill } from "remotion";

interface Props {
  style: string;
  durationMs: number;
  at: "start" | "end";
}

export const TransitionLayer: React.FC<Props> = ({ style: transStyle, durationMs, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = Math.ceil((durationMs / 1000) * fps);

  if (transStyle === "cut" || durationFrames === 0) return null;

  const progress = at === "start"
    ? interpolate(frame, [0, durationFrames], [1, 0], { extrapolateRight: "clamp" })
    : interpolate(frame, [0, durationFrames], [0, 1], { extrapolateRight: "clamp" });

  if (transStyle === "fade") {
    return (
      <AbsoluteFill style={{ backgroundColor: "black", opacity: progress, zIndex: 20 }} />
    );
  }

  if (transStyle === "zoom") {
    const scale = interpolate(progress, [0, 1], [1, 1.5]);
    return (
      <AbsoluteFill style={{ backgroundColor: "black", opacity: progress * 0.6, transform: `scale(${scale})`, zIndex: 20 }} />
    );
  }

  if (transStyle === "motionBlur") {
    return (
      <AbsoluteFill style={{ backdropFilter: `blur(${progress * 10}px)`, zIndex: 20 }} />
    );
  }

  if (transStyle === "premiumSlide") {
    const translateX = at === "start"
      ? interpolate(frame, [0, durationFrames], [-100, 0])
      : interpolate(frame, [0, durationFrames], [0, 100]);
    return (
      <AbsoluteFill style={{ backgroundColor: "black", transform: `translateX(${translateX}%)`, zIndex: 20 }} />
    );
  }

  if (transStyle === "cinematicDissolve") {
    return (
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle, transparent ${(1 - progress) * 100}%, black ${(1 - progress) * 100 + 20}%)`,
          opacity: progress * 0.9,
          zIndex: 20,
        }}
      />
    );
  }

  // punchyCut — flash
  if (transStyle === "punchyCut") {
    const flashOpacity = interpolate(frame, [0, Math.ceil(durationFrames / 2), durationFrames], [0.8, 0, 0], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ backgroundColor: "white", opacity: flashOpacity, zIndex: 20 }} />
    );
  }

  // lightLeak — warm cinematic light leak overlay
  if (transStyle === "lightLeak") {
    // Light moves across frame (left→right) with warm glow
    const leakProgress = at === "start"
      ? interpolate(frame, [0, durationFrames], [1, 0], { extrapolateRight: "clamp" })
      : interpolate(frame, [0, durationFrames], [0, 1], { extrapolateRight: "clamp" });

    // Smooth ease-in-out for natural feel
    const ease = leakProgress < 0.5
      ? 2 * leakProgress * leakProgress
      : 1 - Math.pow(-2 * leakProgress + 2, 2) / 2;

    // Light position moves across frame
    const lightX = interpolate(frame, [0, durationFrames], [-20, 120], { extrapolateRight: "clamp" });

    // Warm color cycle: orange → golden → soft red
    const warmHue = interpolate(frame, [0, durationFrames / 2, durationFrames], [30, 45, 15], { extrapolateRight: "clamp" });

    // Bloom intensity peaks in the middle
    const bloomIntensity = ease * 0.75;
    const glowBlur = interpolate(ease, [0, 0.5, 1], [0, 30, 5], { extrapolateRight: "clamp" });

    return (
      <AbsoluteFill style={{ zIndex: 20, pointerEvents: "none" }}>
        {/* Main warm light leak gradient — screen blend */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 80% 100% at ${lightX}% 50%, hsla(${warmHue}, 100%, 65%, ${bloomIntensity}) 0%, hsla(${warmHue + 15}, 90%, 55%, ${bloomIntensity * 0.5}) 40%, transparent 75%)`,
            mixBlendMode: "screen",
            filter: `blur(${glowBlur}px)`,
          }}
        />
        {/* Secondary soft orange glow for depth */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 60% 80% at ${lightX + 10}% 40%, hsla(35, 100%, 70%, ${bloomIntensity * 0.4}) 0%, transparent 60%)`,
            mixBlendMode: "overlay",
            filter: `blur(${glowBlur * 1.5}px)`,
          }}
        />
        {/* Slight exposure bloom across entire frame */}
        <AbsoluteFill
          style={{
            backgroundColor: `hsla(40, 80%, 90%, ${ease * 0.12})`,
            mixBlendMode: "screen",
          }}
        />
      </AbsoluteFill>
    );
  }

  return null;
};
