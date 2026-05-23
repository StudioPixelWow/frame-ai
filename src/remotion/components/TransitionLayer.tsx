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

  if (transStyle === "spectrumImpactFlash") {
    const burst = Math.exp(-Math.pow((progress - 0.15) * 6, 2));
    const bell = Math.sin(progress * Math.PI);
    const glow = Math.exp(-progress * 2.5);
    const sweepAngle = progress * 360;

    return (
      <AbsoluteFill style={{ zIndex: 20, pointerEvents: "none" }}>
        {/* Layer 1: Full-screen white/golden flash */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg,
              rgba(255,255,255,${0.95 * burst}) 0%,
              rgba(255,240,200,${0.85 * burst}) 30%,
              rgba(255,200,100,${0.7 * burst}) 60%,
              rgba(255,160,50,${0.5 * burst}) 100%)`,
            filter: `brightness(${1 + burst * 4})`,
            mixBlendMode: "screen",
          }}
        />
        {/* Layer 2: Orange-yellow fire wash */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(${sweepAngle}deg,
              rgba(255,165,0,${0.7 * bell}) 0%,
              rgba(255,200,0,${0.65 * bell}) 20%,
              rgba(255,140,0,${0.6 * bell}) 40%,
              rgba(255,80,0,${0.5 * bell}) 60%,
              rgba(255,200,50,${0.55 * bell}) 80%,
              rgba(255,165,0,${0.7 * bell}) 100%)`,
            filter: `blur(${5 + bell * 10}px)`,
            mixBlendMode: "screen",
          }}
        />
        {/* Layer 3: Chromatic color bands — full-screen horizontal sweep */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(90deg,
              rgba(255,100,0,${0.5 * bell}) 0%,
              rgba(255,200,0,${0.45 * bell}) 15%,
              rgba(0,255,200,${0.35 * bell}) 30%,
              rgba(80,120,255,${0.35 * bell}) 45%,
              rgba(200,60,255,${0.35 * bell}) 60%,
              rgba(255,60,150,${0.4 * bell}) 75%,
              rgba(255,140,0,${0.5 * bell}) 90%,
              rgba(255,200,50,${0.45 * bell}) 100%)`,
            filter: `blur(${8 + glow * 15}px)`,
            mixBlendMode: "screen",
            transform: `scale(${1.3 + bell * 0.3})`,
          }}
        />
        {/* Layer 4: Warm rainbow sweep — rotating full-screen */}
        <AbsoluteFill
          style={{
            background: `conic-gradient(from ${sweepAngle}deg at 50% 50%,
              rgba(255,140,0,${0.3 * bell}),
              rgba(255,200,0,${0.3 * bell}),
              rgba(255,255,100,${0.25 * bell}),
              rgba(0,255,200,${0.2 * bell}),
              rgba(0,180,255,${0.2 * bell}),
              rgba(150,80,255,${0.2 * bell}),
              rgba(255,60,200,${0.25 * bell}),
              rgba(255,100,0,${0.3 * bell}),
              rgba(255,200,50,${0.3 * bell}))`,
            filter: `blur(${25 + bell * 20}px)`,
            mixBlendMode: "screen",
            transform: `scale(${1.8 + bell * 0.5})`,
            opacity: bell * 0.8,
          }}
        />
        {/* Layer 5: Full-screen golden brightness flash */}
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(255,200,80,${burst * 0.35})`,
            mixBlendMode: "screen",
          }}
        />
        {/* Layer 6: Warm amber afterglow */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg,
              rgba(255,180,50,${0.2 * glow}) 0%,
              rgba(255,140,0,${0.15 * glow}) 50%,
              rgba(255,100,0,${0.1 * glow}) 100%)`,
            mixBlendMode: "screen",
          }}
        />
      </AbsoluteFill>
    );
  }

  if (transStyle === "prismaticFlashSweep") {
    const bell = Math.sin(progress * Math.PI);
    const sweepPos = progress * 200 - 50;
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(45deg,
            transparent ${sweepPos - 30}%,
            rgba(0,255,255,0.05) ${sweepPos - 20}%,
            rgba(0,200,255,0.12) ${sweepPos - 12}%,
            rgba(100,120,255,0.25) ${sweepPos - 6}%,
            rgba(180,140,255,0.35) ${sweepPos - 3}%,
            rgba(255,255,255,${0.7 * bell}) ${sweepPos}%,
            rgba(255,140,220,0.35) ${sweepPos + 3}%,
            rgba(255,100,180,0.25) ${sweepPos + 6}%,
            rgba(255,160,80,0.1) ${sweepPos + 12}%,
            transparent ${sweepPos + 30}%
          )`,
          opacity: bell * 0.95,
          filter: `blur(${2 + bell * 3}px)`,
          mixBlendMode: "screen",
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
