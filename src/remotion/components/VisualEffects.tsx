import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { AbsoluteFill } from "remotion";
import type { PremiumProps, VisualProps } from "../types";

interface Props {
  visual: VisualProps;
  premium: PremiumProps;
}

export const VisualEffects: React.FC<Props> = ({ visual, premium }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  if (!premium.enabled) return null;

  /* ── Color Grading ── */
  const colorGradingFilter = (() => {
    switch (visual.colorGrading) {
      case "vibrant":   return "saturate(1.25) contrast(1.08) brightness(1.02)";
      case "cinematic": return "contrast(1.15) saturate(0.85) brightness(0.93) sepia(0.05)";
      case "warm":      return "saturate(1.15) sepia(0.15) brightness(1.03) contrast(1.02)";
      case "corporate": return "contrast(1.08) saturate(0.92) brightness(1.01)";
      default:          return "none";
    }
  })();

  /* ── Premium-level color correction boost ── */
  const premiumColorBoost = (() => {
    if (!premium.colorCorrection) return "none";
    switch (premium.level) {
      case "cinematic": return "contrast(1.06) brightness(0.97)";
      case "premium":   return "contrast(1.03) brightness(0.99)";
      default:          return "none";
    }
  })();

  /* ── Vignette — stronger for cinematic ── */
  const vignetteOpacity = (() => {
    switch (premium.level) {
      case "cinematic": return 0.45;
      case "premium":   return 0.2;
      default:          return 0;
    }
  })();

  /* ── Film grain overlay (cinematic only) ── */
  const showFilmGrain = premium.level === "cinematic";
  const grainOpacity = showFilmGrain
    ? interpolate(frame % (fps * 2), [0, fps, fps * 2], [0.03, 0.06, 0.03])
    : 0;

  /* ── Letterbox bars for cinematic widescreen feel ── */
  const showLetterbox = premium.level === "cinematic" && visual.cropForVertical === false;
  const letterboxHeight = showLetterbox ? "4%" : "0%";

  /* ── Subtle breathing / pulse effect (premium motion) ── */
  const breatheScale = premium.motionEffects
    ? interpolate(
        frame,
        [0, Math.round(fps * 4), Math.round(fps * 8)],
        [1, 1.008, 1],
        { extrapolateRight: "wrap" }
      )
    : 1;

  return (
    <>
      {/* Color grading overlay — applied as a full-frame filter */}
      {premium.colorCorrection && colorGradingFilter !== "none" && (
        <AbsoluteFill
          style={{
            filter: colorGradingFilter,
            pointerEvents: "none",
            zIndex: 1,
            mixBlendMode: "normal",
          }}
        />
      )}

      {/* Premium-level color boost */}
      {premiumColorBoost !== "none" && (
        <AbsoluteFill
          style={{
            filter: premiumColorBoost,
            pointerEvents: "none",
            zIndex: 2,
            mixBlendMode: "normal",
          }}
        />
      )}

      {/* Vignette */}
      {vignetteOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
            pointerEvents: "none",
            zIndex: 15,
          }}
        />
      )}

      {/* Film grain (cinematic) */}
      {showFilmGrain && (
        <AbsoluteFill
          style={{
            background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            opacity: grainOpacity,
            mixBlendMode: "overlay",
            pointerEvents: "none",
            zIndex: 16,
          }}
        />
      )}

      {/* Letterbox bars */}
      {showLetterbox && (
        <>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: letterboxHeight,
            background: "black", zIndex: 20, pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: letterboxHeight,
            background: "black", zIndex: 20, pointerEvents: "none",
          }} />
        </>
      )}

      {/* Premium motion breathing — subtle scale pulse on the entire composition */}
      {premium.motionEffects && breatheScale !== 1 && (
        <AbsoluteFill
          style={{
            transform: `scale(${breatheScale})`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}
    </>
  );
};
