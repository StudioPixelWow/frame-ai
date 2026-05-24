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
    const burst = Math.exp(-Math.pow((progress - 0.12) * 5, 2));
    const bell = Math.sin(progress * Math.PI);
    const glow = Math.exp(-progress * 2);
    const sweepAngle = progress * 540;

    return (
      <AbsoluteFill style={{ zIndex: 20, pointerEvents: "none" }}>
        {/* Layer 1: MASSIVE full-screen white-to-orange explosion */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg,
              rgba(255,255,255,${1.0 * burst}) 0%,
              rgba(255,220,100,${0.95 * burst}) 20%,
              rgba(255,165,0,${0.9 * burst}) 45%,
              rgba(255,120,0,${0.85 * burst}) 70%,
              rgba(255,80,0,${0.75 * burst}) 100%)`,
            filter: `brightness(${1 + burst * 6})`,
            mixBlendMode: "screen",
          }}
        />
        {/* Layer 2: Intense orange-yellow fire wall — full screen */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(${sweepAngle}deg,
              rgba(255,200,0,${0.9 * bell}) 0%,
              rgba(255,165,0,${0.85 * bell}) 15%,
              rgba(255,120,0,${0.8 * bell}) 30%,
              rgba(255,80,0,${0.75 * bell}) 45%,
              rgba(255,200,50,${0.85 * bell}) 60%,
              rgba(255,255,0,${0.8 * bell}) 75%,
              rgba(255,140,0,${0.9 * bell}) 100%)`,
            filter: `blur(${3 + bell * 8}px)`,
            mixBlendMode: "screen",
            transform: `scale(${1.2 + bell * 0.3})`,
          }}
        />
        {/* Layer 3: Full-screen warm color sweep — orange/amber/gold */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(${90 + sweepAngle * 0.3}deg,
              rgba(255,80,0,${0.7 * bell}) 0%,
              rgba(255,200,0,${0.65 * bell}) 12%,
              rgba(255,255,0,${0.6 * bell}) 22%,
              rgba(255,180,30,${0.55 * bell}) 35%,
              rgba(255,140,0,${0.5 * bell}) 48%,
              rgba(255,100,0,${0.55 * bell}) 60%,
              rgba(255,160,30,${0.6 * bell}) 72%,
              rgba(255,200,50,${0.65 * bell}) 85%,
              rgba(255,220,50,${0.7 * bell}) 100%)`,
            filter: `blur(${6 + glow * 12}px)`,
            mixBlendMode: "screen",
            transform: `scale(${1.5 + bell * 0.4})`,
          }}
        />
        {/* Layer 4: Rotating warm spectrum — massive scale */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(${sweepAngle + 45}deg,
              rgba(255,200,0,${0.6 * bell}) 0%,
              rgba(255,140,0,${0.55 * bell}) 20%,
              rgba(255,60,0,${0.5 * bell}) 40%,
              rgba(255,100,20,${0.45 * bell}) 55%,
              rgba(255,160,0,${0.4 * bell}) 70%,
              rgba(255,220,50,${0.4 * bell}) 85%,
              rgba(255,255,0,${0.55 * bell}) 100%)`,
            filter: `blur(${15 + bell * 25}px)`,
            mixBlendMode: "screen",
            transform: `scale(${2.0 + bell * 0.8})`,
            opacity: bell * 0.9,
          }}
        />
        {/* Layer 5: Massive golden brightness blast — full opacity */}
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(255,180,0,${burst * 0.6})`,
            mixBlendMode: "screen",
            filter: `brightness(${1 + burst * 3})`,
          }}
        />
        {/* Layer 6: Deep orange afterglow — lingers */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg,
              rgba(255,200,50,${0.35 * glow}) 0%,
              rgba(255,150,0,${0.3 * glow}) 40%,
              rgba(255,100,0,${0.25 * glow}) 70%,
              rgba(255,60,0,${0.15 * glow}) 100%)`,
            mixBlendMode: "screen",
          }}
        />
        {/* Layer 7: Final yellow flash punch */}
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(255,255,0,${burst * 0.25})`,
            mixBlendMode: "overlay",
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
