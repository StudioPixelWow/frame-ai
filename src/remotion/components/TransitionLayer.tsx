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
    const ringExpand = interpolate(progress, [0, 0.5, 1], [0.2, 1.8, 2.5], { extrapolateRight: "clamp" });
    const sweepAngle = progress * 360;

    return (
      <AbsoluteFill style={{ zIndex: 20, pointerEvents: "none" }}>
        {/* Layer 1: White burst — explosive center flash */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 50%,
              rgba(255,255,255,${0.95 * burst}) 0%,
              rgba(255,255,240,${0.7 * burst}) 15%,
              rgba(255,220,180,${0.3 * burst}) 35%,
              transparent 60%)`,
            filter: `brightness(${1 + burst * 3})`,
            mixBlendMode: "screen",
            transform: `scale(${1 + burst * 0.5})`,
          }}
        />
        {/* Layer 2: Chromatic ring — expanding colorful halo */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 50%,
              transparent ${ringExpand * 15}%,
              rgba(0,255,255,${0.6 * bell}) ${ringExpand * 20}%,
              rgba(80,120,255,${0.55 * bell}) ${ringExpand * 28}%,
              rgba(180,60,255,${0.5 * bell}) ${ringExpand * 36}%,
              rgba(255,60,200,${0.45 * bell}) ${ringExpand * 44}%,
              rgba(255,100,60,${0.3 * bell}) ${ringExpand * 52}%,
              transparent ${ringExpand * 65}%)`,
            filter: `blur(${3 + glow * 6}px)`,
            mixBlendMode: "screen",
            transform: `scale(${1.2 + bell * 0.3})`,
          }}
        />
        {/* Layer 3: RGB split bloom — tri-color offset glow */}
        <AbsoluteFill
          style={{
            background: `
              radial-gradient(ellipse 150% 150% at ${48 - bell * 3}% 50%, rgba(255,30,60,${0.35 * bell}) 0%, transparent 50%),
              radial-gradient(ellipse 150% 150% at ${52 + bell * 3}% 50%, rgba(30,120,255,${0.35 * bell}) 0%, transparent 50%),
              radial-gradient(ellipse 150% 150% at 50% ${48 - bell * 3}%, rgba(30,255,120,${0.3 * bell}) 0%, transparent 50%)`,
            filter: `blur(${8 + glow * 12}px)`,
            mixBlendMode: "screen",
          }}
        />
        {/* Layer 4: Rainbow sweep — rotating conic gradient */}
        <AbsoluteFill
          style={{
            background: `conic-gradient(from ${sweepAngle}deg at 50% 50%,
              rgba(255,0,0,${0.2 * bell}),
              rgba(255,165,0,${0.2 * bell}),
              rgba(255,255,0,${0.2 * bell}),
              rgba(0,255,0,${0.2 * bell}),
              rgba(0,255,255,${0.2 * bell}),
              rgba(0,0,255,${0.2 * bell}),
              rgba(128,0,255,${0.2 * bell}),
              rgba(255,0,255,${0.2 * bell}),
              rgba(255,0,0,${0.2 * bell}))`,
            filter: `blur(${20 + bell * 15}px)`,
            mixBlendMode: "screen",
            transform: `scale(${1.5 + bell * 0.5})`,
            opacity: bell * 0.7,
          }}
        />
        {/* Layer 5: Expanding rings */}
        <AbsoluteFill
          style={{
            background: `
              radial-gradient(circle at 50% 50%, transparent ${ringExpand * 30}%, rgba(255,255,255,${0.15 * bell}) ${ringExpand * 32}%, transparent ${ringExpand * 35}%),
              radial-gradient(circle at 50% 50%, transparent ${ringExpand * 50}%, rgba(0,200,255,${0.12 * bell}) ${ringExpand * 52}%, transparent ${ringExpand * 55}%),
              radial-gradient(circle at 50% 50%, transparent ${ringExpand * 70}%, rgba(180,60,255,${0.08 * bell}) ${ringExpand * 72}%, transparent ${ringExpand * 75}%)`,
            mixBlendMode: "screen",
            transform: `scale(${1.1 + bell * 0.4})`,
          }}
        />
        {/* Layer 6: Full-screen brightness overlay */}
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(255,255,255,${burst * 0.25})`,
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
